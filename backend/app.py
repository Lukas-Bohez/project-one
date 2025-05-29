import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
# Import the new ThemeRepository
from database.datarepository import QuestionRepository, AnswerRepository, ThemeRepository 
from models.models import (
    QuestionBase, QuestionCreate, QuestionResponse, QuestionUpdate,
    QuestionStatusUpdate, ErrorNotFound, QuestionWithAnswers,
    ThemeBase, ThemeCreate, ThemeUpdate, ThemeResponse, # Import new Theme models
    DifficultyLevelResponse, QuestionSearchResult,
    RandomQuestionRequest, QuestionMetadataUpdate,
    QuestionActivationNotification,
    AnswerBase, AnswerCreate, AnswerListResponse, AnswerResponse, 
    AnswerStatusUpdate, AnswerUpdate, CorrectAnswerResponse
)
from typing import Optional, List
from fastapi import Request
from fastapi import Query, Depends
from models.models import User, UserCreate, UserUpdate, UserPublic # Import your new user models
from database.datarepository import UserRepository
from models.models import ErrorMessage,ErrorNotFound


# ----------------------------------------------------
# App setup
# ----------------------------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # This should allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='asgi', logger=True)
sio_app = socketio.ASGIApp(sio, app) # <-- THIS IS THE KEY

ENDPOINT = "/api/v1"  # API base endpoint

# ----------------------------------------------------
# FastAPI Endpoints - Questions (Existing, unchanged)
# ----------------------------------------------------

@app.get("/")
async def root():
    return "Quiz API Server is running. Use the API endpoints to interact with the system."

@app.get(
    ENDPOINT + "/questions/",
    summary="Get all questions",
    response_model=list[QuestionResponse],
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

@app.get(
    ENDPOINT + "/questions/{question_id}/",
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

@app.post(
    ENDPOINT + "/questions/",
    summary="Create a new question",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Questions"]
)
async def create_question(question: QuestionCreate):
    new_id = QuestionRepository.create_question(**question.dict())
    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create question"
        )
    return QuestionRepository.get_question_by_id(new_id)

@app.put(
    ENDPOINT + "/questions/{question_id}/",
    summary="Update a question",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def update_question(question_id: int, question: QuestionUpdate):
    updated = QuestionRepository.update_question(question_id, **question.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found or update failed"
        )
    return QuestionRepository.get_question_by_id(question_id)

@app.patch(
    ENDPOINT + "/questions/{question_id}/status/",
    summary="Update question status (active/inactive)",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def update_question_status(question_id: int, status: QuestionStatusUpdate):
    updated = QuestionRepository.update_question(
        question_id,
        is_active=status.is_active
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    await sio.emit('question_status_changed', {
        "question_id": question_id,
        "new_status": status.is_active
    })
    return QuestionRepository.get_question_by_id(question_id)

@app.delete(
    ENDPOINT + "/questions/{question_id}/",
    summary="Delete a question",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def delete_question(question_id: int):
    success = QuestionRepository.delete_question(question_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

# ----------------------------------------------------
# FastAPI Endpoints - Special Question Operations (Existing, unchanged)
# ----------------------------------------------------

@app.get(
    ENDPOINT + "/questions/random/",
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

@app.get(
    ENDPOINT + "/questions/{question_id}/with-answers/",
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

@app.patch(
    ENDPOINT + "/questions/{question_id}/metadata/",
    summary="Update question metadata",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def update_question_metadata(question_id: int, metadata: QuestionMetadataUpdate):
    updated = QuestionRepository.update_question_metadata(
        question_id,
        **metadata.dict(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return QuestionRepository.get_question_by_id(question_id)

# ----------------------------------------------------
# Socket.IO Handlers (Existing, unchanged)
# ----------------------------------------------------

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def request_random_question(sid, data):
    theme_id = data.get('themeId')
    difficulty_id = data.get('difficultyLevelId')
    question = QuestionRepository.get_random_question(theme_id, difficulty_id)
    if question:
        await sio.emit('new_question', question, room=sid)

# ----------------------------------------------------
# FastAPI Endpoints - Answers (Existing, unchanged)
# ----------------------------------------------------

@app.post(
    ENDPOINT + "/questions/{question_id}/answers/",
    summary="Create a new answer for a question",
    response_model=AnswerResponse,
    status_code=status.HTTP_201_CREATED,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def create_answer(question_id: int, answer: AnswerCreate):
    # Verify question exists
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    new_id = AnswerRepository.create_answer(
        questionId=question_id,
        answer_text=answer.answer_text,
        is_correct=answer.is_correct
    )

    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create answer"
        )
    return AnswerRepository.get_answer_by_id(new_id)


@app.get(
    ENDPOINT + "/questions/{question_id}/answers/",
    summary="Get all answers for a question",
    response_model=AnswerListResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_answers_for_question(question_id: int):
    # Verify question exists
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

@app.get(
    ENDPOINT + "/questions/{question_id}/answers/correct/",
    summary="Get correct answers for a question",
    response_model=CorrectAnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def get_correct_answers(question_id: int):
    # Verify question exists
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

@app.get(
    ENDPOINT + "/answers/{answer_id}/",
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

@app.put(
    ENDPOINT + "/answers/{answer_id}/",
    summary="Update an answer",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def update_answer(answer_id: int, answer: AnswerUpdate):
    updated = AnswerRepository.update_answer(
        answer_id,
        **answer.dict(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found or update failed"
        )
    return AnswerRepository.get_answer_by_id(answer_id)

@app.patch(
    ENDPOINT + "/answers/{answer_id}/correctness/",
    summary="Update answer correctness status",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def update_answer_correctness(answer_id: int, status: AnswerStatusUpdate):
    updated = AnswerRepository.update_answer(
        answer_id,
        is_correct=status.is_correct
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found"
        )
    return AnswerRepository.get_answer_by_id(answer_id)

@app.delete(
    ENDPOINT + "/answers/{answer_id}/",
    summary="Delete an answer",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Answers"]
)
async def delete_answer(answer_id: int):
    success = AnswerRepository.delete_answer(answer_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found"
        )

# ----------------------------------------------------
# Special Answer Operations (Existing, unchanged)
# ----------------------------------------------------

@app.put(
    ENDPOINT + "/questions/{question_id}/answers/set-correct/",
    summary="Set a specific answer as the correct one (makes others incorrect)",
    response_model=AnswerResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Answer Operations"]
)
async def set_correct_answer(question_id: int, answer_id: int):
    # Verify both question and answer exist
    if not QuestionRepository.get_question_by_id(question_id):
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

    answer = AnswerRepository.get_answer_by_id(answer_id)
    if not answer or answer['questionId'] != question_id:
        raise HTTPException(
            status_code=404,
            detail=f"Answer with ID {answer_id} not found for this question"
        )

    updated = AnswerRepository.set_single_correct_answer_for_question(
        question_id,
        answer_id
    )

    if not updated:
        raise HTTPException(
            status_code=400,
            detail="Failed to update answer correctness"
        )

    return AnswerRepository.get_answer_by_id(answer_id)


# ----------------------------------------------------
# FastAPI Endpoints - Themes (NEW)
# ----------------------------------------------------

@app.post(
    ENDPOINT + "/themes/",
    summary="Create a new theme",
    response_model=ThemeResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Themes"]
)
async def create_theme(theme: ThemeCreate):
    new_id = ThemeRepository.create_theme(**theme.dict())
    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create theme"
        )
    return ThemeRepository.get_theme_by_id(new_id)

@app.get(
    ENDPOINT + "/themes/",
    summary="Get all themes",
    response_model=List[ThemeResponse],
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_all_themes(active_only: bool = False):
    if active_only:
        themes = ThemeRepository.get_active_themes()
    else:
        themes = ThemeRepository.get_all_themes()

    if not themes:
        raise HTTPException(
            status_code=404,
            detail="No themes found"
        )
    return themes

@app.get(
    ENDPOINT + "/themes/{theme_id}/",
    summary="Get theme by ID",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_theme_by_id(theme_id: int):
    theme = ThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found"
        )
    return theme

@app.put(
    ENDPOINT + "/themes/{theme_id}/",
    summary="Update a theme",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def update_theme(theme_id: int, theme: ThemeUpdate):
    updated = ThemeRepository.update_theme(theme_id, **theme.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found or update failed"
        )
    return ThemeRepository.get_theme_by_id(theme_id)

@app.patch(
    ENDPOINT + "/themes/{theme_id}/status/",
    summary="Update theme active status",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def update_theme_status(theme_id: int, status_update: dict = Body(..., embed=True, alias="is_active")):
    # Extract the boolean value from the dict
    is_active_status = status_update.get('is_active')
    if is_active_status is None or not isinstance(is_active_status, bool):
        raise HTTPException(
            status_code=422,
            detail="Invalid 'is_active' value provided. Must be a boolean."
        )

    updated = ThemeRepository.set_theme_active_status(theme_id, is_active_status)
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found or status update failed"
        )
    return ThemeRepository.get_theme_by_id(theme_id)


@app.delete(
    ENDPOINT + "/themes/{theme_id}/",
    summary="Delete a theme",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def delete_theme(theme_id: int):
    success = ThemeRepository.delete_theme(theme_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found"
        )


@app.get(
    ENDPOINT + "/themes/{theme_id}/question_count/",
    summary="Get the number of questions for a specific theme",
    response_model=int, # This endpoint will just return an integer
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_theme_question_count(theme_id: int):
    count = QuestionRepository.get_questions_count_by_theme(theme_id)
    return count

# ----------------------------------------------------
# FastAPI Endpoints - Users
# ----------------------------------------------------

@app.post(
    ENDPOINT + "/users/",
    response_model=UserPublic, # Return the public version
    status_code=201, # Created
    summary="Create a new user",
    responses={400: {"model": ErrorMessage}},
    tags=["Users"]
)
async def create_user(user_create: UserCreate):
    # Pass the Pydantic model's data as a dictionary to the repository
    user_data = user_create.model_dump()
    user_id = UserRepository.create_user(user_data)
    if user_id is None:
        raise HTTPException(
            status_code=400,
            detail="User could not be created. Possible duplicate RFID or other issue."
        )
    
    # Fetch the newly created user to return it
    new_user = UserRepository.get_user_by_id(user_id)
    if not new_user:
        # This case should ideally not happen if create_user succeeded
        raise HTTPException(status_code=500, detail="Failed to retrieve newly created user.")
    
    # Return UserPublic to exclude sensitive fields
    return UserPublic(**new_user)


@app.get(
    ENDPOINT + "/users/",
    response_model=List[UserPublic], # Return list of public users
    summary="Get all users",
    tags=["Users"]
)
async def get_all_users():
    users = UserRepository.get_all_users()
    return [UserPublic(**user) for user in users]


@app.get(
    ENDPOINT + "/users/{user_id}",
    response_model=UserPublic, # Return public user
    summary="Get user by ID",
    responses={404: {"model": ErrorNotFound}},
    tags=["Users"]
)
async def get_user_by_id(user_id: int):
    user = UserRepository.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return UserPublic(**user)


@app.put(
    ENDPOINT + "/users/{user_id}",
    response_model=UserPublic, # Return public user
    summary="Update an existing user by ID",
    responses={404: {"model": ErrorNotFound}, 400: {"model": ErrorMessage}},
    tags=["Users"]
)
async def update_user(user_id: int, user_update: UserUpdate):
    update_data = user_update.model_dump(exclude_unset=True) # Only include fields that were set
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    success = UserRepository.update_user(user_id, update_data)
    if not success:
        # Check if user exists before saying "not found"
        existing_user = UserRepository.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
        else:
            # This could happen if no fields were actually changed or a DB error
            raise HTTPException(status_code=400, detail="Failed to update user.")
    
    updated_user = UserRepository.get_user_by_id(user_id)
    if not updated_user:
        # Should not happen if update was successful
        raise HTTPException(status_code=500, detail="Failed to retrieve updated user.")
    
    return UserPublic(**updated_user)


@app.delete(
    ENDPOINT + "/users/{user_id}",
    status_code=204, # No Content on successful deletion
    summary="Delete a user by ID",
    responses={404: {"model": ErrorNotFound}},
    tags=["Users"]
)
async def delete_user(user_id: int):
    success = UserRepository.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return {"message": "User deleted successfully"}

# You might also add endpoints for:
# - Login (e.g., POST /api/v1/users/login with username/password, returns token/session info)
# - Logout (e.g., POST /api/v1/users/logout)
# - Get user by RFID (if needed for specific frontend flows)


# ----------------------------------------------------
# Request Logging Middleware (Existing, unchanged)
# ----------------------------------------------------

@app.middleware("http")
async def log_request(request: Request, call_next):
    body = await request.body()
    print(f"\n----- INCOMING REQUEST -----")
    print(f"Method: {request.method}")
    print(f"URL: {request.url}")
    print(f"Headers: {dict(request.headers)}")
    print(f"Body: {body}")
    print(f"----------------------------\n")

    response = await call_next(request)
    return response


# ----------------------------------------------------
# Run the app (Existing, unchanged)
# ----------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:sio_app", # <-- YOU ARE RUNNING sio_app, not app directly
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"]
    )