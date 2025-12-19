"""
Quiz Session Management Routes
Handles session creation, starting, and question broadcasting
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
import random

from database.datarepository import (
    QuizSessionRepository, QuestionRepository, 
    ThemeRepository, SessionPlayerRepository,
    AnswerRepository
)

router = APIRouter(prefix="/api", tags=["Sessions"])


@router.post("/v1/sessions/create")
async def create_quiz_session(
    name: str = "Auto Quiz Session",
    description: Optional[str] = None,
    theme_id: Optional[int] = None,
    host_user_id: int = 1
):
    """Create a new quiz session"""
    try:
        # If no theme specified, pick a random one
        if not theme_id:
            themes = ThemeRepository.get_all_themes()
            if themes:
                # Handle both dict and tuple formats
                first_theme = themes[0]
                theme_id = first_theme.get('id', 1) if isinstance(first_theme, dict) else first_theme[0]
            else:
                theme_id = 1
        
        session_date = datetime.now()
        session_id = QuizSessionRepository.create_session(
            session_date=session_date,
            name=name,
            description=description or f"Quiz session started at {session_date.strftime('%Y-%m-%d %H:%M')}",
            session_status_id=2,  # 2 = active
            theme_id=theme_id,
            host_user_id=host_user_id,
            start_time=session_date,
            end_time=None
        )
        
        if session_id:
            return {
                "success": True,
                "session_id": session_id,
                "status": "active",
                "theme_id": theme_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create session")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/sessions/{session_id}/start")
async def start_quiz_session(session_id: int):
    """Start a quiz session - sets it to active and prepares first question"""
    try:
        # Update session to active
        success = QuizSessionRepository.update_session_status(session_id, 2)
        
        if success:
            return {
                "success": True,
                "session_id": session_id,
                "status": "active",
                "message": "Session started successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Session not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/sessions/{session_id}/end")
async def end_quiz_session(session_id: int):
    """End a quiz session"""
    try:
        success = QuizSessionRepository.update_session_status(session_id, 3)  # 3 = ended
        
        if success:
            return {
                "success": True,
                "session_id": session_id,
                "status": "ended"
            }
        else:
            raise HTTPException(status_code=404, detail="Session not found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/sessions/{session_id}/question")
async def get_random_question(session_id: int, theme_id: Optional[int] = None):
    """Get a random question for the session"""
    try:
        # Get session to find its theme if not provided
        if not theme_id:
            session = QuizSessionRepository.get_session_by_id(session_id)
            if session:
                theme_id = session.get('themeId')
        
        # Get all active questions
        questions = QuestionRepository.get_all_questions()
        active_questions = [q for q in questions if q.get('isActive') or q.get('is_active')]
        
        # Filter by theme if specified
        if theme_id:
            active_questions = [q for q in active_questions if q.get('themeId') == theme_id or q.get('theme_id') == theme_id]
        
        if not active_questions:
            raise HTTPException(status_code=404, detail="No active questions found")
        
        # Pick a random question
        question = random.choice(active_questions)
        question_id = question.get('id')
        
        # Get answers for this question
        answers = AnswerRepository.get_all_answers_for_question(question_id)
        
        return {
            "success": True,
            "session_id": session_id,
            "question": question,
            "answers": answers
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/sessions/auto-start")
async def auto_start_session(user_id: int = 1):
    """Automatically create and start a session for solo play"""
    try:
        # SECURITY: Enforce single active session - only allow ONE
        active_sessions = QuizSessionRepository.get_active_sessions()
        
        if active_sessions:
            # Use the first (and ONLY) active session
            session = active_sessions[0]
            session_id = session.get('id') if isinstance(session, dict) else session[0]
            
            # Add player to session
            SessionPlayerRepository.add_player_to_session(session_id, user_id)
            
            return {
                "success": True,
                "session_id": session_id,
                "status": "joined_existing",
                "message": "Joined the active session (only 1 active session allowed for security)"
            }
        else:
            # No active session - create new one
            session_date = datetime.now()
            
            # Get random theme
            themes = ThemeRepository.get_all_themes()
            if themes:
                chosen = random.choice(themes)
                theme_id = chosen.get('id', 1) if isinstance(chosen, dict) else chosen[0]
            else:
                theme_id = 1
            
            session_id = QuizSessionRepository.create_session(
                session_date=session_date,
                name=f"Auto Session - {session_date.strftime('%H:%M')}",
                description="Automatically created quiz session",
                session_status_id=2,  # Active
                theme_id=theme_id,
                host_user_id=user_id,
                start_time=session_date,
                end_time=None
            )
            
            if session_id:
                # Add player to session
                SessionPlayerRepository.add_player_to_session(session_id, user_id)
                
                return {
                    "success": True,
                    "session_id": session_id,
                    "status": "created",
                    "theme_id": theme_id,
                    "message": "Created new session successfully"
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to create session")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
