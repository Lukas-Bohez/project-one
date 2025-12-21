"""
Socket.IO Event Handlers
Handles real-time communication events
"""

import socketio
import asyncio
from typing import Dict, Any
from datetime import datetime
import logging

from database.datarepository import (
    QuizSessionRepository, ChatLogRepository,
    SessionPlayerRepository, PlayerAnswerRepository
)

# Get the existing quiz logger
logger = logging.getLogger('quiz_debug')

# Test log to verify logging is working
logger.info("Socket.IO handlers module loaded")

# This will be set by app.py
sio = None
main_asyncio_loop = None

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
    print("🔧 ====== REGISTERING SOCKET.IO HANDLERS ======")
    
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
        """Handle user data requests - send session players data"""
        logger.info(f"[USER_DATA_REQUEST] Received from {sid}: {data}")
        try:
            from database.datarepository import SessionPlayerRepository
            
            user_id = data.get('user_id')
            session_id = data.get('session_id')
            
            logger.info(f"[USER_DATA_REQUEST] user_id: {user_id}, session_id: {session_id}")
            
            if not user_id:
                await sio.emit('error', {'message': 'User ID required'}, room=sid)
                return
            
            # If session_id not provided, try to find from active rooms
            if not session_id:
                for room_name in sio.rooms(sid):
                    if room_name.startswith('quiz_session_'):
                        session_id = int(room_name.replace('quiz_session_', ''))
                        break
            
            logger.info(f"[USER_DATA_REQUEST] final session_id: {session_id}")
            
            if not session_id:
                await sio.emit('error', {'message': 'Session ID required'}, room=sid)
                return
            
            # Get all players in the session
            players = SessionPlayerRepository.get_session_players(session_id) or []
            logger.info(f"[USER_DATA_REQUEST] existing players: {players}")
            
            # If no players in session, add the requesting user
            if not players and user_id:
                logger.info(f"[USER_DATA_REQUEST] Adding user {user_id} to session {session_id}")
                insert_result = SessionPlayerRepository.add_player_to_session(session_id, user_id)
                logger.info(f"[USER_DATA_REQUEST] Insert result: {insert_result}")
                
                if insert_result:
                    # Insert succeeded, get players again
                    players = SessionPlayerRepository.get_session_players(session_id) or []
                    logger.info(f"[USER_DATA_REQUEST] players after successful add: {players}")
                else:
                    logger.error(f"[USER_DATA_REQUEST] Failed to add user {user_id} to session {session_id}")
                    # Try to get user info from database for fallback
                    from database.datarepository import UserRepository
                    user_info = UserRepository.get_user_by_id(user_id)
                    if user_info:
                        user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
                        if not user_name:
                            user_name = user_info.get('username', f'Player {user_id}')
                    else:
                        user_name = f'Player {user_id}'
                    
                    players = [{
                        'userId': user_id,
                        'userName': user_name,
                        'totalScore': 0
                    }]
                    logger.info(f"[USER_DATA_REQUEST] Using fallback player data with real name: {players}")
            
            players_data = []
            for player in players:
                player_dict = {
                    'id': player.get('userId') or player.get('id'),
                    'name': player.get('userName') or f'Player {player.get("userId")}',
                    'score': player.get('totalScore', 0),
                    'is_online': True
                }
                players_data.append(player_dict)
                logger.debug(f"[USER_DATA_REQUEST] Added player: {player_dict}")
            
            logger.info(f"[USER_DATA_REQUEST] sending players_data: {players_data}")
            
            # Broadcast to all players in the session room
            room = f"quiz_session_{session_id}"
            logger.info(f"[USER_DATA_REQUEST] Emitting to room {room}, sid {sid}")
            await sio.emit('all_users_data_updated', {
                'players': players_data,
                'session_id': session_id
            }, room=sid)
            logger.info(f"[USER_DATA_REQUEST] Emitted to {sid}")
        
        except Exception as e:
            print(f"[ERROR] User data request failed: {e}")
            import traceback
            traceback.print_exc()
            await sio.emit('error', {'message': str(e)}, room=sid)
    
    
    @sio.on('join')
    async def handle_join(sid, data):
        """Handle quiz session join - supports both string room names and dict format"""
        print(f"[JOIN] Received join from {sid}, data: {data}")
        try:
            from database.datarepository import ThemeRepository
            import random
            
            # Support both formats: string room name or dict with session_id/user_id
            if isinstance(data, str):
                # Old format: just a room name string like "quiz_session_999999"
                room = data
                await sio.enter_room(sid, room)
                print(f"[JOIN] {sid} joined room {room}")
                await sio.emit('joined_room', {'room': room}, room=sid)
                
                # AUTO-START: Extract session_id from room name and send theme selection
                if room.startswith('quiz_session_'):
                    try:
                        session_id = int(room.replace('quiz_session_', ''))
                        print(f"[AUTO-START] Sending theme selection to {sid} for session {session_id}")
                        
                        # Get 4 random themes
                        all_themes = ThemeRepository.get_active_themes() or ThemeRepository.get_all_themes()
                        if all_themes and len(all_themes) > 0:
                            selected_themes = random.sample(all_themes, min(4, len(all_themes)))
                            
                            # Send theme_selection to this user only (not broadcast)
                            await sio.emit('theme_selection', {
                                'type': 'theme_selection',
                                'question': 'Select a theme for the quiz:',
                                'themes': selected_themes,
                                'session_id': session_id
                            }, room=sid)
                            
                            print(f"[AUTO-START] Theme selection sent to {sid}")
                    except ValueError:
                        print(f"[AUTO-START] Could not extract session_id from room: {room}")
                
                # Return value is sent to callback
                return {'status': 'success', 'room': room}
            elif isinstance(data, dict):
                # New format: dict with session_id and user_id
                session_id = data.get('session_id')
                user_id = data.get('user_id')
                
                if session_id and user_id:
                    room = f"session_{session_id}"
                    quiz_room = f"quiz_session_{session_id}"
                    await sio.enter_room(sid, room)
                    await sio.enter_room(sid, quiz_room)
                    
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
                    
                    # AUTO-START: Send theme selection automatically (backend-controlled, secure)
                    print(f"[AUTO-START] Sending theme selection to {sid} for session {session_id}")
                    
                    # Get 4 random themes
                    all_themes = ThemeRepository.get_active_themes() or ThemeRepository.get_all_themes()
                    if all_themes and len(all_themes) > 0:
                        selected_themes = random.sample(all_themes, min(4, len(all_themes)))
                        
                        # Send theme_selection to this user only (not broadcast)
                        await sio.emit('theme_selection', {
                            'type': 'theme_selection',
                            'question': 'Select a theme for the quiz:',
                            'themes': selected_themes,
                            'session_id': session_id
                        }, room=sid)
                        
                        print(f"[AUTO-START] Theme selection sent to {sid}")
                    
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
            from database.datarepository import AnswerRepository
            
            session_id = data.get('session_id')
            user_id = data.get('userId') or data.get('user_id')
            question_id = data.get('questionId') or data.get('question_id')
            answer_id = data.get('answerId') or data.get('answer_id')
            time_taken = data.get('time_taken', 0)
            
            print(f"[ANSWER] Session {session_id}, User {user_id}, Question {question_id}, Answer {answer_id}")
            
            # Check if answer is correct
            answer = AnswerRepository.get_answer_by_id(answer_id)
            is_correct = answer.get('is_correct', False) if answer else False
            
            # Calculate points (base 100 points for correct answer)
            points = 100 if is_correct else 0
            
            # Record the player's answer
            PlayerAnswerRepository.create_player_answer(
                session_id=session_id,
                user_id=user_id,
                question_id=question_id,
                answer_id=answer_id,
                is_correct=is_correct,
                points_earned=points,
                time_taken=time_taken
            )
            
            # Update session player score
            SessionPlayerRepository.update_player_score(
                session_id=session_id,
                user_id=user_id,
                points_to_add=points,
                is_correct=is_correct
            )
            
            # Send response to the player who answered
            await sio.emit('answer_response', {
                'success': True,
                'is_correct': is_correct,
                'points': points,
                'correct_answer': answer.get('answer_text') if not is_correct and answer else None
            }, room=sid)
            
            print(f"[ANSWER] Result: {'✅ Correct' if is_correct else '❌ Wrong'}, Points: {points}")
            
            # Check if quiz should end early due to low collective points
            total_score = PlayerAnswerRepository.get_total_score_for_session(session_id)
            # Count distinct questions asked in this session
            questions_asked = PlayerAnswerRepository.get_distinct_question_count_for_session(session_id)
            
            # End quiz if total score is below 500 points after 3+ questions
            if questions_asked >= 3 and total_score < 500:
                print(f"[QUIZ END] Low collective score ({total_score}) after {questions_asked} questions - ending quiz")
                await end_quiz_session(session_id, "Low collective performance - quiz ended early")
                return
            
            # Broadcast to room for leaderboard updates
            room = f"quiz_session_{session_id}"
            await sio.emit('player_answered', {
                'user_id': user_id,
                'is_correct': is_correct,
                'points': points
            }, room=room)
        
        except Exception as e:
            print(f"[ERROR] Answer submission failed: {e}")
            import traceback
            traceback.print_exc()
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
        """Handle theme voting - delegates to quiz_timer_system"""
        from utils.quiz_timer_system import handle_theme_vote
        await handle_theme_vote(sio, sid, data)


    
    
    @sio.on('request_question')
    async def handle_request_question(sid, data):
        """Handle request for next question - broadcasts to entire session"""
        try:
            from database.datarepository import QuestionRepository, AnswerRepository
            import random
            
            session_id = data.get('session_id')
            theme_id = data.get('theme_id')
            
            if not session_id:
                await sio.emit('error', {'message': 'Session ID required'}, room=sid)
                return
            
            # Get all active questions
            questions = QuestionRepository.get_all_questions()
            active_questions = [q for q in questions if q.get('isActive') or q.get('is_active')]
            
            # Filter by theme if specified
            if theme_id:
                active_questions = [q for q in active_questions if q.get('themeId') == theme_id or q.get('theme_id') == theme_id]
            
            if not active_questions:
                await sio.emit('error', {'message': 'No active questions found'}, room=sid)
                return
            
            # Pick a random question
            question = random.choice(active_questions)
            question_id = question.get('id')
            
            # Get answers for this question
            answers = AnswerRepository.get_all_answers_for_question(question_id)
            
            # Broadcast to all players in the session
            room = f"quiz_session_{session_id}"
            await sio.emit('new_question', {
                'session_id': session_id,
                'question': question,
                'answers': answers
            }, room=room)
            
            print(f"[QUESTION] Broadcast question {question_id} to room {room}")
        
        except Exception as e:
            print(f"[ERROR] Failed to broadcast question: {e}")
            await sio.emit('error', {'message': str(e)}, room=sid)


async def end_quiz_session(session_id, reason="Quiz ended"):
    """End a quiz session and notify all players"""
    try:
        from database.datarepository import QuizSessionRepository
        
        # Update session status to ended
        QuizSessionRepository.update_session_status(session_id, 3)  # 3 = ended
        
        # Broadcast quiz end to all players
        room = f"quiz_session_{session_id}"
        await sio.emit('quiz_end', {
            'session_id': session_id,
            'reason': reason,
            'final_scores': True
        }, room=room)
        
        print(f"[QUIZ END] Session {session_id} ended: {reason}")
    
    except Exception as e:
        print(f"[ERROR] Failed to end quiz session {session_id}: {e}")


    print("✅ ALL SOCKET.IO HANDLERS REGISTERED")
    print("📋 Events: connect, disconnect, join, ping, theme_selected, request_question")
