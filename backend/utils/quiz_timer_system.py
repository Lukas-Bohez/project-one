"""
Quiz Timer and Voting System
Handles theme voting with countdown timers
"""

import asyncio
from collections import Counter
from utils.state_manager import theme_votes, theme_votes_lock, active_timers
from database.datarepository import ThemeRepository, QuestionRepository, AnswerRepository, SessionPlayerRepository
import random


async def handle_theme_vote(sio, sid, data):
    """
    Handle a user voting for a theme
    Starts timer on first vote, speeds up with more votes
    """
    print(f"[VOTE] Received vote from {sid}")
    
    try:
        session_id = data.get('session_id') or data.get('sessionId')
        theme_id = data.get('themeId') or data.get('theme_id')
        user_id = data.get('userId') or data.get('user_id')
        
        if not all([session_id, theme_id, user_id]):
            print(f"[VOTE] ERROR: Missing data")
            await sio.emit('error', {'message': 'Missing vote data'}, room=sid)
            return
        
        # Initialize voting
        if session_id not in theme_votes:
            theme_votes[session_id] = {}
        
        # Record vote
        theme_votes[session_id][user_id] = theme_id
        vote_count = len(theme_votes[session_id])
        
        # Get player count
        players = SessionPlayerRepository.get_session_players(session_id) or []
        total_players = max(1, len(players))
        
        print(f"[VOTE] Session {session_id}: {vote_count}/{total_players} voted for theme {theme_id}")
        
        room = f"quiz_session_{session_id}"
        
        # Calculate timer based on votes (5-20 seconds range)
        if vote_count == 1:
            timer_value = 20
        else:
            # Speed up: 20s - (votes * 3s), minimum 5s, maximum 20s
            timer_value = max(5, min(20, 20 - (vote_count * 3)))
        
        # Broadcast vote update
        await sio.emit('vote_update', {
            'votes': vote_count,
            'total': total_players,
            'timer': timer_value
        }, room=room)
        
        # Start timer on first vote
        if vote_count == 1 and session_id not in active_timers:
            active_timers[session_id] = True
            asyncio.create_task(run_voting_timer(sio, session_id, total_players))
            print(f"[TIMER] Started 30s countdown for session {session_id}")
        
        # All voted? End immediately
        if vote_count >= total_players:
            print(f"[VOTE] ALL PLAYERS VOTED! Ending voting now")
            if session_id in active_timers:
                del active_timers[session_id]
            await end_voting_and_start_quiz(sio, session_id)
    
    except Exception as e:
        print(f"[VOTE] ERROR: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit('error', {'message': str(e)}, room=sid)


async def run_voting_timer(sio, session_id, total_players):
    """Countdown timer for theme voting"""
    timer = 30
    room = f"quiz_session_{session_id}"
    
    print(f"[TIMER] Countdown started for session {session_id}")
    
    while timer > 0 and session_id in active_timers:
        await asyncio.sleep(1)
        timer -= 1
        
        # Check if all voted (early exit)
        vote_count = len(theme_votes.get(session_id, {}))
        if vote_count >= total_players:
            print(f"[TIMER] All voted, stopping early at {timer}s")
            break
        
        # Broadcast timer every 5 seconds or last 5 seconds
        if timer % 5 == 0 or timer <= 5:
            await sio.emit('timer_update', {'time': timer}, room=room)
            print(f"[TIMER] Session {session_id}: {timer}s remaining")
    
    # Timer expired or all voted
    if session_id in active_timers:
        del active_timers[session_id]
        print(f"[TIMER] Time's up for session {session_id}")
        await end_voting_and_start_quiz(sio, session_id)


async def end_voting_and_start_quiz(sio, session_id):
    """Count votes and start quiz with winning theme"""
    print(f"[QUIZ] Processing votes for session {session_id}")
    
    room = f"quiz_session_{session_id}"
    votes = theme_votes.get(session_id, {})
    
    if not votes:
        print(f"[QUIZ] No votes recorded, picking random theme")
        all_themes = ThemeRepository.get_active_themes()
        winning_theme_id = random.choice(all_themes).get('id') if all_themes else 1
    else:
        # Count votes
        vote_counts = Counter(votes.values())
        winning_theme_id, vote_count = vote_counts.most_common(1)[0]
        print(f"[QUIZ] Winning theme: {winning_theme_id} with {vote_count} votes")
    
    # Clear votes
    if session_id in theme_votes:
        del theme_votes[session_id]
    
    # Get theme details
    theme = ThemeRepository.get_theme_by_id(winning_theme_id)
    if not theme:
        await sio.emit('error', {'message': 'Theme not found'}, room=room)
        return
    
    theme_data = {
        'id': theme.get('id') if isinstance(theme, dict) else theme[0],
        'name': theme.get('name') if isinstance(theme, dict) else theme[1],
        'description': theme.get('description') if isinstance(theme, dict) else (theme[2] if len(theme) > 2 else '')
    }
    
    print(f"[QUIZ] Displaying theme: {theme_data['name']}")
    
    # Show theme description with skip button
    await sio.emit('theme_display', {
        'theme_data': theme_data,
        'message': f"Theme: {theme_data['name']}",
        'description': theme_data['description'],
        'skip_button': True
    }, room=room)
    
    # Wait 3 seconds for theme display
    await asyncio.sleep(3)
    
    # Get questions from theme
    questions = QuestionRepository.get_questions_by_theme(winning_theme_id, active_only=True)
    if not questions:
        await sio.emit('error', {'message': 'No questions available'}, room=room)
        return
    
    # Pick random question
    question = random.choice(questions)
    answers = AnswerRepository.get_all_answers_for_question(question.get('id'))
    
    print(f"[QUIZ] Sending question {question.get('id')} with {len(answers)} answers")
    
    # Broadcast question to all in session
    await sio.emit('new_question', {
        'session_id': session_id,
        'question': question,
        'answers': answers,
        'type': 'question'
    }, room=room)
    
    print(f"[QUIZ] Quiz started for session {session_id}")


def emit_theme_selection_if_needed(sio, loop):
    """Legacy compatibility - no longer needed with auto-start"""
    pass
