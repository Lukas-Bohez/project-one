import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from api.dependencies import get_current_user_info, get_client_ip
from database.datarepository import QuestionRepository, AnswerRepository, AuditLogRepository
from models.models import (
    QuestionResponse,
    ErrorNotFound,
    QuestionWithAnswers,
    RandomQuestionRequest,
    AnswerListResponse,
    CorrectAnswerResponse,
    AnswerResponse,
    QuestionInput
)

router = APIRouter()


def safe_int_convert(value, default=1):
    try:
        if value is None:
            return default
        if isinstance(value, bool):
            return int(value)
        return int(value)
    except (ValueError, TypeError):
        return default


def convert_difficulty_to_id(difficulty_string: str) -> int:
    difficulty_mapping = {
        "easy": 1,
        "medium": 2,
        "hard": 3,
        "expert": 4
    }
    difficulty_lower = difficulty_string.lower()

    if difficulty_lower in difficulty_mapping:
        return difficulty_mapping[difficulty_lower]
    return 2


# ----------------------------------------------------
# Questions
# ----------------------------------------------------

@router.get(
    "/api/v1/questions/",
    summary="Get all questions",
    response_model=List[QuestionResponse],
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def get_all_questions(active_only: bool = False):
    questions = QuestionRepository.get_all_questions(active_only)
    if not questions:
        raise HTTPException(
            status_code=404,
            detail="No questions found"
        )
    return questions


@router.get(
    "/api/v1/questions/{question_id}/",
    summary="Get question by ID",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def get_question_by_id(question_id: int):
    question = QuestionRepository.get_question_by_id(question_id)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return question


@router.get(
    "/api/v1/questions/random/",
    summary="Get a random question",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def get_random_question(params: RandomQuestionRequest = Body(default=None)):
    question = QuestionRepository.get_random_question(
        themeId=params.themeId if params else None,
        difficultyLevelId=params.difficultyLevelId if params else None
    )
    if not question:
        raise HTTPException(
            status_code=404,
            detail="No active questions found matching criteria"
        )
    return question


@router.get(
    "/api/v1/questions/{question_id}/with-answers/",
    summary="Get question with answers",
    response_model=QuestionWithAnswers,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def get_question_with_answers(question_id: int):
    question = QuestionRepository.get_questions_with_answers(question_id)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return question


@router.post("/api/v1/questions", tags=["Questions"])
async def create_question_endpoint(
    question_data: QuestionInput,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can create questions"
        )

    new_values = {
        "question_text": question_data.question_text,
        "created_by": user_id,
        "role": role,
        "timestamp": datetime.now().isoformat()
    }

    try:
        AuditLogRepository.create_audit_log(
            table_name="questions",
            record_id=0,
            action="CREATE",
            old_values=None,
            new_values=json.dumps(new_values),
            changed_by=user_id,
            ip_address=client_ip
        )
    except Exception as audit_error:
        print(f"Audit log creation failed: {audit_error}")

    is_active = True if role == "admin" else False

    try:
        theme_id = safe_int_convert(question_data.themeId, 1)
        difficulty_id = safe_int_convert(question_data.difficultyLevelId, 1)

        if not question_data.question_text or not question_data.question_text.strip():
            raise HTTPException(status_code=400, detail="Question text is required")

        if not question_data.answers or len(question_data.answers) == 0:
            raise HTTPException(status_code=400, detail="At least one answer is required")

        question_id = QuestionRepository.create_question(
            question_text=question_data.question_text.strip(),
            themeId=theme_id,
            difficultyLevelId=difficulty_id,
            explanation=question_data.explanation or "",
            Url=question_data.Url or "",
            time_limit=safe_int_convert(question_data.time_limit, 30),
            think_time=safe_int_convert(question_data.think_time, 5),
            points=safe_int_convert(question_data.points, 10),
            is_active=is_active,
            no_answer_correct=bool(question_data.no_answer_correct),
            createdBy=user_id,
            LightMax=safe_int_convert(question_data.LightMax, 100),
            LightMin=safe_int_convert(question_data.LightMin, 0),
            TempMax=safe_int_convert(question_data.TempMax, 30),
            TempMin=safe_int_convert(question_data.TempMin, 10)
        )

        if not question_id:
            raise HTTPException(status_code=500, detail="Failed to create question")

        created_answers = []
        for answer in question_data.answers:
            if not answer.answer_text or not answer.answer_text.strip():
                continue

            try:
                answer_id = AnswerRepository.create_answer(
                    question_id=question_id,
                    answer_text=answer.answer_text.strip(),
                    is_correct=bool(answer.is_correct)
                )

                if answer_id:
                    created_answers.append(answer_id)

            except Exception as answer_error:
                print(f"Failed to create answer: {answer_error}")

        if len(created_answers) == 0:
            raise HTTPException(status_code=400, detail="No valid answers were created")

        return {
            "status": "success",
            "question_id": question_id,
            "answers_created": len(created_answers),
            "is_active": is_active
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Question creation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create question")


@router.patch("/api/v1/questions/{question_id}", tags=["Questions"])
async def update_question_endpoint(
    question_id: int,
    question_data: QuestionInput,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info.get("id")
    role = current_user_info.get("role")
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can edit questions")

    try:
        audit_entry = {
            "action": "update_question_attempt",
            "question_id": question_id,
            "requested_by": user_id,
            "timestamp": datetime.now().isoformat()
        }
        _ = audit_entry
    except Exception:
        pass

    try:
        theme_id = safe_int_convert(question_data.themeId, 1)
        difficulty_id = safe_int_convert(question_data.difficultyLevelId, 1)

        update_success = QuestionRepository.update_question(
            question_id,
            question_text=question_data.question_text.strip() if question_data.question_text else None,
            themeId=theme_id,
            difficultyLevelId=difficulty_id,
            explanation=question_data.explanation or None,
            Url=question_data.Url or None,
            time_limit=safe_int_convert(question_data.time_limit, None),
            think_time=safe_int_convert(question_data.think_time, None),
            points=safe_int_convert(question_data.points, None),
            is_active=bool(question_data.is_active) if question_data.is_active is not None else None,
            no_answer_correct=bool(question_data.no_answer_correct) if question_data.no_answer_correct is not None else None,
            LightMax=safe_int_convert(question_data.LightMax, None),
            LightMin=safe_int_convert(question_data.LightMin, None),
            TempMax=safe_int_convert(question_data.TempMax, None),
            TempMin=safe_int_convert(question_data.TempMin, None)
        )

        if not update_success:
            raise HTTPException(status_code=500, detail="Failed to update question")

        created_answers = []
        if getattr(question_data, 'answers', None):
            try:
                delete_success = AnswerRepository.delete_all_answers_for_question(question_id)
                if not delete_success:
                    print(f"Warning: Failed to delete existing answers for question {question_id}")

                for answer in question_data.answers:
                    if not getattr(answer, 'answer_text', None) or not answer.answer_text.strip():
                        continue
                    try:
                        answer_id = AnswerRepository.create_answer(
                            question_id=question_id,
                            answer_text=answer.answer_text.strip(),
                            is_correct=bool(getattr(answer, 'is_correct', False))
                        )
                        if answer_id:
                            created_answers.append(answer_id)
                    except Exception as answer_error:
                        print(f"Failed to create answer: {answer_error}")
                        continue
            except Exception as answer_handling_error:
                print(f"Error handling answers: {answer_handling_error}")
                raise HTTPException(status_code=500, detail="Failed to update answers")

        return {
            "status": "success",
            "message": "Question updated successfully",
            "question_id": question_id,
            "updated_answers": len(created_answers),
            "is_active": bool(question_data.is_active),
            "role": role,
            "difficulty_id": difficulty_id,
            "theme_id": theme_id
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update question: {str(e)}")


@router.delete("/api/v1/questions/{question_id}", tags=["Questions"])
async def delete_question_endpoint(
    question_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete questions")

    try:
        existing_question = QuestionRepository.get_question_by_id(question_id)
        if not existing_question:
            raise HTTPException(status_code=404, detail="Question not found")

        try:
            delete_answers_success = AnswerRepository.delete_all_answers_for_question(question_id)
            if not delete_answers_success:
                print(f"Warning: Failed to delete associated answers for question {question_id}")
        except Exception as e:
            print(f"Error deleting answers: {e}")

        delete_success = QuestionRepository.delete_question(question_id)

        if not delete_success:
            raise HTTPException(status_code=500, detail="Failed to delete question")

        new_values = {
            "deleted_by": user_id,
            "question_id": question_id,
            "action": "DELETE",
            "timestamp": datetime.now().isoformat()
        }

        try:
            AuditLogRepository.create_audit_log(
                table_name="questions",
                record_id=question_id,
                action="DELETE",
                old_values=None,
                new_values=json.dumps(new_values),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"Delete audit log creation failed: {audit_error}")

        return {
            "status": "success",
            "message": "Question deleted successfully",
            "question_id": question_id,
            "role": role
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")


# ----------------------------------------------------
# Answers
# ----------------------------------------------------

@router.get(
    "/api/v1/questions/{question_id}/answers/",
    summary="Get all answers for a question",
    response_model=AnswerListResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_answers_for_question(question_id: int):
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    answers = AnswerRepository.get_all_answers_for_question(question_id)
    return AnswerListResponse(
        answers=answers,
        count=len(answers)
    )


@router.get(
    "/api/v1/questions/{question_id}/answers/correct/",
    summary="Get correct answers for a question",
    response_model=CorrectAnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_correct_answers(question_id: int):
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    answers = AnswerRepository.get_correct_answers_for_question(question_id)
    return CorrectAnswerResponse(
        correct_answers=answers,
        count=len(answers)
    )


@router.get(
    "/api/v1/answers/{answer_id}/",
    summary="Get answer by ID",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_answer(answer_id: int):
    answer = AnswerRepository.get_answer_by_id(answer_id)
    if not answer:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found"
        )
    return answer
