from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import socketio
from sqlalchemy.orm import Session
from typing import List, Optional

# Import your models and schemas
from models import (
    # Base SQLAlchemy models for table creation
    Base,
    # Response models
    UserResponse, ThemeResponse, QuestionResponse, ProgressResponse
)
from database.database import Database
from database.datarepository import DataRepository as DR

# 1. FastAPI app initialization
app = FastAPI(title="ThemeQuestionApp", description="API for quiz themes and questions", debug=True)

# API version prefix
ENDPOINT_PREFIX = "/api/v1"

# 2. CORS settings (important for Socket.IO)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Important for connections
    logger=True  # For debugging
)

# 4. Socket.IO wrapper for FastAPI
sio_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app
)

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    Database.create_tables()
    print("✅ Database tables initialized")

# 5. API endpoints
# User endpoints
@app.get(f"{ENDPOINT_PREFIX}/users/{{user_id}}", response_model=UserResponse)
async def read_user(user_id: int, db: Session = Depends(Database.get_db)):
    try:
        db_user = DR.get_user(db, user_id)
        if db_user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return db_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get(f"{ENDPOINT_PREFIX}/themes", response_model=List[ThemeResponse])
async def read_themes(skip: int = 0, limit: int = 100, db: Session = Depends(Database.get_db)):
    try:
        themes = DR.get_themes(db, skip=skip, limit=limit)
        return themes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get(f"{ENDPOINT_PREFIX}/questions", response_model=List[QuestionResponse])
async def read_questions(
    skip: int = 0, 
    limit: int = 100, 
    theme_id: Optional[int] = None,
    difficulty: Optional[str] = None,
    db: Session = Depends(Database.get_db)
):
    try:
        questions = DR.get_questions(db, skip=skip, limit=limit, theme_id=theme_id, difficulty=difficulty)
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get(f"{ENDPOINT_PREFIX}/progress/{{user_id}}", response_model=ProgressResponse)
async def get_user_progress(user_id: int, db: Session = Depends(Database.get_db)):
    try:
        progress_data = DR.get_user_progress(db, user_id)
        
        # Calculate percentage
        percentage = 0.0
        if progress_data["goal"] > 0:
            percentage = (progress_data["current"] / progress_data["goal"]) * 100
            
        return ProgressResponse(
            current_progress=progress_data["current"],
            daily_goal=progress_data["goal"],
            percentage=percentage
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. Socket.IO events
@sio.event
async def connect(sid, environ, *args):  # Added *args to handle any extra arguments
    print(f'✔ Client connected: {sid}')
    # Emit connection confirmation with any initial data
    await sio.emit('B2F_connected', {'status': 'connected'}, room=sid)

@sio.event
async def disconnect(sid):
    print(f'❌ Client disconnected: {sid}')

@sio.event
async def F2B_join_session(sid, data):
    """Handle client joining a quiz session"""
    session_id = data.get('session_id')
    if session_id:
        room = f'session_{session_id}'
        sio.enter_room(sid, room)
        await sio.emit('B2F_session_joined', {'session_id': session_id}, room=sid)
        print(f'👥 Client {sid} joined session: {session_id}')

@sio.event
async def F2B_answer_question(sid, data):
    """Handle client submitting an answer"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    question_id = data.get('question_id')
    answer_id = data.get('answer_id')
    
    # Send to everyone in the session room
    if session_id:
        room = f'session_{session_id}'
        await sio.emit('B2F_answer_submitted', {
            'user_id': user_id,
            'question_id': question_id,
            'answer_id': answer_id,
            'timestamp': DR.get_utc_now().isoformat()
        }, room=room)

# 7. Start server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:sio_app",  # Note: sio_app not app
        host="0.0.0.0",  # Accept connections from anywhere
        port=8000,
        reload=True,
        log_level="debug"  # More logging for debugging
    )