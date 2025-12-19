"""
Socket.IO Event Handlers
Handles real-time communication events
"""

import socketio
import asyncio
from typing import Dict, Any
from datetime import datetime

from database.datarepository import (
    QuizSessionRepository, ChatLogRepository,
    SessionPlayerRepository, PlayerAnswerRepository
)

# This will be set by app.py
sio = None
main_asyncio_loop = None

def init_socketio(socketio_instance, event_loop):
    """Initialize Socket.IO handlers with the server instance"""
    global sio, main_asyncio_loop
    sio = socketio_instance
    main_asyncio_loop = event_loop
    register_handlers()


def register_handlers():
    """Register all Socket.IO event handlers"""
    
    @sio.event
    async def connect(sid, environ):
        """Handle client connection"""
        print(f"Client connected: {sid}")
        await sio.emit('connection_established', {'sid': sid}, room=sid)
    
    
    @sio.event
    async def disconnect(sid):
        """Handle client disconnection"""
        print(f"Client disconnected: {sid}")
        # Clean up any session data for this client
        try:
            # Remove from any rooms
            pass
        except Exception as e:
            print(f"Error during disconnect cleanup: {e}")
    
    
    @sio.event
    async def message(sid, data):
        """Handle generic message event"""
        print(f"Message from {sid}: {data}")
        await sio.emit('message_received', {'status': 'ok'}, room=sid)
    
    
    @sio.event
    async def join_room(sid, data):
        """Handle room join requests"""
        room_name = data.get('room')
        if room_name:
            sio.enter_room(sid, room_name)
            await sio.emit('joined_room', {'room': room_name}, room=sid)
            await sio.emit('user_joined', {'sid': sid}, room=room_name, skip_sid=sid)
    
    
    @sio.event
    async def leave_room(sid, data):
        """Handle room leave requests"""
        room_name = data.get('room')
        if room_name:
            sio.leave_room(sid, room_name)
            await sio.emit('left_room', {'room': room_name}, room=sid)
            await sio.emit('user_left', {'sid': sid}, room=room_name)
    
    
    @sio.on('request_user_data')
    async def handle_user_data_request(sid, data):
        """Handle user data requests"""
        try:
            user_id = data.get('user_id')
            if not user_id:
                await sio.emit('error', {'message': 'User ID required'}, room=sid)
                return
            
            # Fetch user data (implement based on your needs)
            user_data = {'user_id': user_id, 'status': 'active'}
            await sio.emit('user_data', user_data, room=sid)
        
        except Exception as e:
            await sio.emit('error', {'message': str(e)}, room=sid)
    
    
    @sio.on('join')
    async def handle_join(sid, data):
        """Handle quiz session join - supports both string room names and dict format"""
        print(f"[JOIN] Received join from {sid}, data: {data}")
        try:
            # Support both formats: string room name or dict with session_id/user_id
            if isinstance(data, str):
                # Old format: just a room name string like "quiz_session_999999"
                room = data
                sio.enter_room(sid, room)
                print(f"[JOIN] {sid} joined room {room}")
                await sio.emit('joined_room', {'room': room}, room=sid)
                # Return value is sent to callback
                return {'status': 'success', 'room': room}
            elif isinstance(data, dict):
                # New format: dict with session_id and user_id
                session_id = data.get('session_id')
                user_id = data.get('user_id')
                
                if session_id and user_id:
                    room = f"session_{session_id}"
                    sio.enter_room(sid, room)
                    
                    # Add player to session
                    SessionPlayerRepository.add_player_to_session(session_id, user_id)
                    
                    await sio.emit('joined_session', {
                        'session_id': session_id,
                        'user_id': user_id
                    }, room=sid)
                    
                    # Notify others
                    await sio.emit('player_joined', {
                        'user_id': user_id
                    }, room=room, skip_sid=sid)
                    
                    # Return value is sent to callback
                    return {'status': 'success', 'session_id': session_id}
                else:
                    return {'status': 'error', 'message': 'Missing session_id or user_id'}
            else:
                await sio.emit('error', {'message': 'Invalid data format for join event'}, room=sid)
                return {'status': 'error', 'message': 'Invalid data format for join event'}
        
        except Exception as e:
            await sio.emit('error', {'message': str(e)}, room=sid)
            return {'status': 'error', 'message': str(e)}
    
    
    @sio.on('submit_answer')
    async def handle_submit_answer(sid, data):
        """Handle quiz answer submission"""
        try:
            session_id = data.get('session_id')
            user_id = data.get('user_id')
            question_id = data.get('question_id')
            answer_id = data.get('answer_id')
            time_taken = data.get('time_taken', 0)
            
            # Record the answer
            is_correct = PlayerAnswerRepository.submit_answer(
                session_id=session_id,
                user_id=user_id,
                question_id=question_id,
                answer_id=answer_id,
                time_taken=time_taken
            )
            
            # Calculate points
            points = 100 if is_correct else 0
            
            await sio.emit('answer_result', {
                'is_correct': is_correct,
                'points': points
            }, room=sid)
            
            # Update leaderboard
            room = f"session_{session_id}"
            await sio.emit('leaderboard_update', {
                'user_id': user_id,
                'points': points
            }, room=room)
        
        except Exception as e:
            await sio.emit('error', {'message': str(e)}, room=sid)
    
    
    @sio.on('leave')
    async def handle_leave(sid, data):
        """Handle leaving a room - supports both string room names and dict format"""
        try:
            if isinstance(data, str):
                # String format: just a room name
                room = data
                sio.leave_room(sid, room)
                await sio.emit('left_room', {'room': room}, room=sid)
                return {'status': 'success', 'room': room}
            elif isinstance(data, dict):
                room_name = data.get('room')
                if room_name:
                    sio.leave_room(sid, room_name)
                    await sio.emit('left_room', {'room': room_name}, room=sid)
                    return {'status': 'success', 'room': room_name}
        except Exception as e:
            await sio.emit('error', {'message': str(e)}, room=sid)
            return {'status': 'error', 'message': str(e)}
    
    
    @sio.on('get_connection_info')
    async def handle_get_connection_info(sid):
        """Handle connection info requests"""
        try:
            await sio.emit('connection_info', {
                'sid': sid,
                'connected': True,
                'timestamp': datetime.now().isoformat()
            }, room=sid)
        except Exception as e:
            await sio.emit('error', {'message': str(e)}, room=sid)
    
    
    @sio.on('ping')
    async def handle_ping(sid):
        """Handle ping requests"""
        await sio.emit('pong', {'timestamp': datetime.now().isoformat()}, room=sid)
    
    
    @sio.on('theme_selected')
    async def handle_theme_selected(sid, data):
        """Handle theme selection for quiz"""
        try:
            session_id = data.get('session_id')
            theme_id = data.get('theme_id')
            
            if session_id and theme_id:
                # Update session with selected theme
                QuizSessionRepository.set_session_theme(session_id, theme_id)
                
                room = f"session_{session_id}"
                await sio.emit('theme_set', {
                    'theme_id': theme_id
                }, room=room)
        
        except Exception as e:
            await sio.emit('error', {'message': str(e)}, room=sid)
