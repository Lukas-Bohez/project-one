"""
Quiz and Question Management Routes
Handles CRUD operations for questions, themes, rankings, and quiz sessions
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Header, status
from typing import List, Optional
from datetime import datetime

from database.datarepository import (
    QuestionRepository, AnswerRepository, ThemeRepository,
    QuizSessionRepository, PlayerAnswerRepository, AuditLogRepository
)
from models.models import (
    QuestionCreate, QuestionUpdate, QuestionResponse,
    AnswerCreate, AnswerResponse, AnswerInput,
    ThemeCreate, ThemeUpdate, ThemeResponse, ThemeInput,
    QuestionInput, RandomQuestionRequest
)

router = APIRouter(prefix="/api", tags=["Quiz"])

# Helper functions
def convert_difficulty_to_id(difficulty_string: str) -> int:
    """Convert difficulty string to ID"""
    difficulty_map = {
        "easy": 1,
        "medium": 2,
        "hard": 3,
        "expert": 4
    }
    return difficulty_map.get(difficulty_string.lower(), 2)


def calculate_player_score(session_id: int, user_id: int) -> int:
    """Calculate player score for a session"""
    # Get all player answers for this session
    player_answers = PlayerAnswerRepository.get_player_answers_by_session_and_user(
        session_id, user_id
    )
    
    if not player_answers:
        return 0
    
    total_score = 0
    for pa in player_answers:
        total_score += pa.get('points_earned', 0)
    
    return total_score


def calculate_player_score_detailed(session_id: int, user_id: int) -> dict:
    """Calculate detailed player score breakdown"""
    player_answers = PlayerAnswerRepository.get_player_answers_by_session_and_user(
        session_id, user_id
    )
    
    if not player_answers:
        return {
            'total_score': 0,
            'correct_answers': 0,
            'total_questions': 0,
            'accuracy': 0.0
        }
    
    total_score = 0
    correct_count = 0
    
    for pa in player_answers:
        total_score += pa.get('points_earned', 0)
        if pa.get('is_correct'):
            correct_count += 1
    
    total_questions = len(player_answers)
    accuracy = (correct_count / total_questions * 100) if total_questions > 0 else 0
    
    return {
        'total_score': total_score,
        'correct_answers': correct_count,
        'total_questions': total_questions,
        'accuracy': round(accuracy, 2)
    }


# Question Routes
@router.get("/questions/active/count")
async def get_active_questions_count():
    """Get count of active questions"""
    try:
        count = QuestionRepository.get_active_question_count()
        return {"active_questions": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/v1/questions")
async def create_question_endpoint(
    question_data: QuestionInput,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Create a new question"""
    try:
        # Create question
        new_question_id = QuestionRepository.create_question(
            question_text=question_data.question_text,
            theme_id=question_data.theme_id,
            difficulty_id=convert_difficulty_to_id(question_data.difficulty),
            timer=question_data.timer,
            is_active=question_data.is_active,
            can_be_random=question_data.can_be_random
        )
        
        # Create answers
        for answer_data in question_data.answers:
            AnswerRepository.create_answer(
                question_id=new_question_id,
                answer_text=answer_data.answer_text,
                is_correct=answer_data.is_correct
            )
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='create_question',
            details=f'Created question {new_question_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Question created successfully", "question_id": new_question_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create question: {str(e)}")


@router.patch("/v1/questions/{question_id}")
async def update_question_endpoint(
    question_id: int,
    question_data: QuestionInput,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Update an existing question"""
    try:
        # Update question
        QuestionRepository.update_question(
            question_id=question_id,
            question_text=question_data.question_text,
            theme_id=question_data.theme_id,
            difficulty_id=convert_difficulty_to_id(question_data.difficulty),
            timer=question_data.timer,
            is_active=question_data.is_active,
            can_be_random=question_data.can_be_random
        )
        
        # Update answers if provided
        if question_data.answers:
            # Delete existing answers
            AnswerRepository.delete_answers_by_question(question_id)
            
            # Create new answers
            for answer_data in question_data.answers:
                AnswerRepository.create_answer(
                    question_id=question_id,
                    answer_text=answer_data.answer_text,
                    is_correct=answer_data.is_correct
                )
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='update_question',
            details=f'Updated question {question_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Question updated successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update question: {str(e)}")


@router.delete("/v1/questions/{question_id}")
async def delete_question_endpoint(
    question_id: int,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Delete a question"""
    try:
        QuestionRepository.delete_question(question_id)
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='delete_question',
            details=f'Deleted question {question_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Question deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")


# Theme Routes
@router.post("/v1/themes")
async def create_theme_endpoint(
    theme_data: ThemeInput,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Create a new theme"""
    try:
        new_theme_id = ThemeRepository.create_theme(
            theme_name=theme_data.theme_name,
            is_active=theme_data.is_active
        )
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='create_theme',
            details=f'Created theme {new_theme_id}: {theme_data.theme_name}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Theme created successfully", "theme_id": new_theme_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create theme: {str(e)}")


@router.delete("/v1/themes/{theme_id}")
async def delete_theme_endpoint(
    theme_id: int,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Delete a theme"""
    try:
        # Check if theme has questions
        question_count = ThemeRepository.get_theme_question_count(theme_id)
        if question_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete theme with {question_count} questions. Migrate questions first."
            )
        
        ThemeRepository.delete_theme(theme_id)
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='delete_theme',
            details=f'Deleted theme {theme_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Theme deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete theme: {str(e)}")


@router.post("/v1/themes/{source_theme_id}/migrate-to/{target_theme_id}")
async def migrate_questions_between_themes(
    source_theme_id: int,
    target_theme_id: int,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Migrate all questions from one theme to another"""
    try:
        # Verify both themes exist
        source_theme = ThemeRepository.get_theme_by_id(source_theme_id)
        target_theme = ThemeRepository.get_theme_by_id(target_theme_id)
        
        if not source_theme or not target_theme:
            raise HTTPException(status_code=404, detail="Source or target theme not found")
        
        # Migrate questions
        migrated_count = QuestionRepository.migrate_questions_to_theme(
            source_theme_id, target_theme_id
        )
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='migrate_questions',
            details=f'Migrated {migrated_count} questions from theme {source_theme_id} to {target_theme_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "message": f"Successfully migrated {migrated_count} questions",
            "migrated_count": migrated_count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to migrate questions: {str(e)}")


# Statistics and Rankings
@router.get("/v1/answers/percentage")
async def get_correct_answers_percentage():
    """Get correct answer percentage across all sessions"""
    try:
        stats = PlayerAnswerRepository.get_correct_answer_percentage()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@router.get("/v1/rankings/session/{session_id}/")
async def get_session_rankings(session_id: int):
    """Get rankings for a specific session"""
    try:
        # Get all players in session
        players = QuizSessionRepository.get_session_players(session_id)
        
        rankings = []
        for player in players:
            user_id = player.get('user_id')
            score_data = calculate_player_score_detailed(session_id, user_id)
            
            rankings.append({
                'user_id': user_id,
                'username': player.get('username'),
                **score_data
            })
        
        # Sort by score
        rankings.sort(key=lambda x: x['total_score'], reverse=True)
        
        return {"session_id": session_id, "rankings": rankings}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get rankings: {str(e)}")


@router.get("/v1/rankings/global/")
async def get_global_rankings(limit: int = 50):
    """Get global rankings across all sessions"""
    try:
        rankings = PlayerAnswerRepository.get_global_rankings(limit=limit)
        return {"rankings": rankings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get global rankings: {str(e)}")
