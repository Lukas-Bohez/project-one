"""
Miscellaneous Routes
Chat, sensor data, system operations
"""

from fastapi import APIRouter, HTTPException, Request, Body
from typing import List, Optional
from datetime import datetime

from database.datarepository import (
    SensorDataRepository, ChatLogRepository,
    QuizSessionRepository, SessionPlayerRepository,
    PlayerAnswerRepository
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
    session_id: Optional[int] = None,
    session_ids: Optional[str] = None,
    include_chat: bool = False,
    include_answers: bool = False,
    limit: int = 100
):
    """Get sensor data for sessions with optional chat and answers"""
    try:
        result = {}
        
        # Handle single session_id or multiple session_ids
        if session_id:
            # Single session - also get available sessions for navigation
            recent_sessions = QuizSessionRepository.get_recent_sessions(limit=50)
            sensor_data = SensorDataRepository.get_sensor_data_for_sessions([session_id], limit=limit)
            
            # Transform sensor data into the format frontend expects
            temperatures = [{"timestamp": d["timestamp"], "value": d.get("temperature (°C)")} for d in sensor_data]
            light_intensities = [{"timestamp": d["timestamp"], "value": d.get("lightIntensity (lux)")} for d in sensor_data]
            servo_positions = [{"timestamp": d["timestamp"], "value": d.get("servoPosition (°)")} for d in sensor_data]
            
            result["sessions"] = [{
                "session_id": session_id,
                "session_name": f"Session {session_id}",
                "sensor_data": sensor_data,
                "temperatures": temperatures,
                "light_intensities": light_intensities,
                "servo_positions": servo_positions
            }]
            result["current_session_id"] = session_id
            result["available_sessions"] = recent_sessions
            result["total_sessions"] = len(recent_sessions)
            
            # Add chat messages if requested
            if include_chat:
                chat_messages = ChatLogRepository.get_session_messages(session_id, limit=100)
                result["sessions"][0]["chat_messages"] = chat_messages
            
            # Add answers if requested
            if include_answers:
                # Get all players in this session
                session_players = SessionPlayerRepository.get_session_players(session_id)
                all_answers = []
                if session_players:
                    for player in session_players:
                        answers = PlayerAnswerRepository.get_player_answers_by_session_and_user(
                            session_id, player['userId']
                        )
                        if answers:
                            all_answers.extend(answers)
                result["sessions"][0]["player_answers"] = all_answers
                
        elif session_ids:
            # Multiple sessions
            ids = [int(id.strip()) for id in session_ids.split(',')]
            result["sessions"] = []
            for sid in ids:
                sensor_data = SensorDataRepository.get_sensor_data_for_sessions([sid], limit=limit)
                session_data = {
                    "session_id": sid,
                    "sensor_data": sensor_data
                }
                if include_chat:
                    session_data["chat_messages"] = ChatLogRepository.get_session_messages(sid, limit=100)
                if include_answers:
                    session_players = SessionPlayerRepository.get_session_players(sid)
                    all_answers = []
                    if session_players:
                        for player in session_players:
                            answers = PlayerAnswerRepository.get_player_answers_by_session_and_user(sid, player['userId'])
                            if answers:
                                all_answers.extend(answers)
                    session_data["player_answers"] = all_answers
                result["sessions"].append(session_data)
            result["current_session_id"] = ids[0] if ids else None
            result["total_sessions"] = len(ids)
        else:
            # No session specified - get most recent session with data
            recent_sessions = QuizSessionRepository.get_recent_sessions(limit=50)
            result["available_sessions"] = recent_sessions
            
            if recent_sessions:
                # Get data for the most recent session
                first_session_id = recent_sessions[0]['id']
                sensor_data = SensorDataRepository.get_sensor_data_for_sessions([first_session_id], limit=limit)
                
                # Transform sensor data
                temperatures = [{"timestamp": d["timestamp"], "value": d.get("temperature (°C)")} for d in sensor_data]
                light_intensities = [{"timestamp": d["timestamp"], "value": d.get("lightIntensity (lux)")} for d in sensor_data]
                servo_positions = [{"timestamp": d["timestamp"], "value": d.get("servoPosition (°)")} for d in sensor_data]
                
                result["sessions"] = [{
                    "session_id": first_session_id,
                    "session_name": f"Session {first_session_id}",
                    "sensor_data": sensor_data,
                    "temperatures": temperatures,
                    "light_intensities": light_intensities,
                    "servo_positions": servo_positions
                }]
                
                if include_chat:
                    chat_messages = ChatLogRepository.get_session_messages(first_session_id, limit=100)
                    result["sessions"][0]["chat_messages"] = chat_messages
                
                if include_answers:
                    session_players = SessionPlayerRepository.get_session_players(first_session_id)
                    all_answers = []
                    if session_players:
                        for player in session_players:
                            answers = PlayerAnswerRepository.get_player_answers_by_session_and_user(
                                first_session_id, player['userId']
                            )
                            if answers:
                                all_answers.extend(answers)
                    result["sessions"][0]["player_answers"] = all_answers
                
                result["current_session_id"] = first_session_id
            else:
                result["sessions"] = []
                result["current_session_id"] = None
            
            result["total_sessions"] = len(recent_sessions)
        
        return result
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
