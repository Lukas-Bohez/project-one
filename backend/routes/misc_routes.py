"""
Miscellaneous Routes
Chat, sensor data, system operations
"""

from fastapi import APIRouter, HTTPException, Request, Body
from typing import List, Optional
from datetime import datetime

from database.datarepository import (
    SensorDataRepository, ChatLogRepository,
    QuizSessionRepository
)
from models.models import BroadcastMessage

router = APIRouter(prefix="/api", tags=["Misc"])


# Root endpoint
@router.get("/", include_in_schema=False)
async def root():
    """Root endpoint"""
    return {"message": "Quiz API", "status": "running"}


# Sensor Data Routes
@router.get("/v1/sensor-data")
async def get_multi_session_sensor_data(
    session_ids: Optional[str] = None,
    limit: int = 100
):
    """Get sensor data for multiple sessions"""
    try:
        if session_ids:
            ids = [int(id.strip()) for id in session_ids.split(',')]
            data = SensorDataRepository.get_sensor_data_for_sessions(ids, limit=limit)
        else:
            data = SensorDataRepository.get_recent_sensor_data(limit=limit)
        
        return {"sensor_data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Chat Routes
@router.post("/v1/chat/messages")
async def send_chat_message(
    session_id: int = Body(...),
    user_id: int = Body(...),
    message: str = Body(...),
    request: Request = None
):
    """Send a chat message"""
    try:
        message_id = ChatLogRepository.create_message(
            session_id=session_id,
            user_id=user_id,
            message=message
        )
        
        return {
            "message_id": message_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/chat/support/messages")
async def send_support_message(
    user_id: int = Body(...),
    message: str = Body(...),
    request: Request = None
):
    """Send a support chat message"""
    try:
        message_id = ChatLogRepository.create_support_message(
            user_id=user_id,
            message=message
        )
        
        return {"message_id": message_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/chat/messages/{session_id}")
async def get_chat_messages(
    session_id: int,
    limit: int = 50
):
    """Get chat messages for a session"""
    try:
        messages = ChatLogRepository.get_session_messages(session_id, limit=limit)
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/chat/stats/{session_id}")
async def get_chat_stats(session_id: int):
    """Get chat statistics for a session"""
    try:
        stats = ChatLogRepository.get_session_chat_stats(session_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/chat/system-message")
async def send_system_message(
    session_id: int = Body(...),
    message: str = Body(...),
    broadcast: bool = Body(False)
):
    """Send a system message"""
    try:
        message_id = ChatLogRepository.create_system_message(
            session_id=session_id,
            message=message
        )
        
        return {"message_id": message_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Session Routes
@router.get("/v1/sessions/active")
async def get_active_sessions():
    """Get all active quiz sessions"""
    try:
        sessions = QuizSessionRepository.get_active_sessions()
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# System Routes
@router.post("/shutdown")
async def shutdown_server():
    """Shutdown the server (admin only)"""
    import os
    import signal
    
    # Send shutdown signal
    os.kill(os.getpid(), signal.SIGTERM)
    return {"message": "Server shutting down"}
