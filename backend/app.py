import socketio
import asyncio
import uvicorn
from datetime import datetime  
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
import time
import traceback
from threading import Thread, Event, Lock
import socket
# Import the new ThemeRepository
from fastapi.responses import HTMLResponse,JSONResponse
from database.datarepository import QuestionRepository, AnswerRepository, ThemeRepository,UserRepository, IpAddressRepository, UserIpAddressRepository,QuizSessionRepository
from models.models import (
    QuestionBase, QuestionCreate, QuestionResponse, QuestionUpdate,
    QuestionStatusUpdate, ErrorNotFound, QuestionWithAnswers,
    ThemeBase, ThemeCreate, ThemeUpdate, ThemeResponse, # Import new Theme models
    DifficultyLevelResponse, QuestionSearchResult,
    RandomQuestionRequest, QuestionMetadataUpdate,
    QuestionActivationNotification,
    AnswerBase, AnswerCreate, AnswerListResponse, AnswerResponse, 
    AnswerStatusUpdate, AnswerUpdate, CorrectAnswerResponse,IpAddressPayload,AppealPayload,ServoCommand,BroadcastMessage,DirectMessage
)
from typing import Dict, Any, Optional, List
from fastapi import Request
from fastapi import Query, Depends
from models.models import User, UserCreate, UserUpdate, UserPublic # Import your new user models
from database.datarepository import UserRepository
from models.models import ErrorMessage,ErrorNotFound
import queue
try:
    from raspberryPi5.RFIDYReaderske import HardcoreRFID
    from raspberryPi5.servomotor import ServoMotor
    from raspberryPi5.temperature import TemperatureSensor
    from raspberryPi5.mcpLighty import LightSensor
    from raspberryPi5.lcd import LCD1602A
    RPI_COMPONENTS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Raspberry Pi components not found or failed to import: {e}")
    print("The Pi-related background thread will not start.")
    RPI_COMPONENTS_AVAILABLE = False


# ----------------------------------------------------
# App setup
# ----------------------------------------------------

app = FastAPI(title="Socket.IO Messaging Backend", version="1.0.0")

# CORS middleware for FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Socket.IO server setup
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi',
    logger=False
)

ENDPOINT = "/api/v1"  # API base endpoint

# Store connected clients
connected_clients = set()


# ----------------------------------------------------
# Socket.IO event handlers
# ----------------------------------------------------
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")
    connected_clients.add(sid)
    
    # Send welcome message to the newly connected client
    await sio.emit('welcome', {
        'message': 'Successfully connected to the server',
        'client_id': sid,
        'timestamp': datetime.now().isoformat()
    }, room=sid)
    
    # Notify all other clients about new connection
    await sio.emit('client_connected', {
        'client_id': sid,
        'total_clients': len(connected_clients),
        'timestamp': datetime.now().isoformat()
    }, skip_sid=sid)

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")
    connected_clients.discard(sid)
    
    # Notify all remaining clients about disconnection
    await sio.emit('client_disconnected', {
        'client_id': sid,
        'total_clients': len(connected_clients),
        'timestamp': datetime.now().isoformat()
    })

@sio.event
async def message(sid, data):
    print(f"Received message from {sid}: {data}")
    
    # Echo the message back to all clients including sender
    await sio.emit('message_received', {
        'from': sid,
        'data': data,
        'timestamp': datetime.now().isoformat()
    })

@sio.event
async def join_room(sid, data):
    room = data.get('room')
    if room:
        await sio.enter_room(sid, room)
        await sio.emit('room_joined', {
            'room': room,
            'client_id': sid,
            'timestamp': datetime.now().isoformat()
        }, room=room)

@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    if room:
        await sio.leave_room(sid, room)
        await sio.emit('room_left', {
            'room': room,
            'client_id': sid,
            'timestamp': datetime.now().isoformat()
        }, room=room)

# ----------------------------------------------------
# HTTP API endpoints
# ----------------------------------------------------
@app.get(f"{ENDPOINT}/health")
async def health_check():
    return {
        "status": "healthy",
        "connected_clients": len(connected_clients),
        "timestamp": datetime.now().isoformat()
    }

@app.get(f"{ENDPOINT}/clients")
async def get_connected_clients():
    return {
        "connected_clients": list(connected_clients),
        "total": len(connected_clients),
        "timestamp": datetime.now().isoformat()
    }

@app.post(f"{ENDPOINT}/broadcast")
async def broadcast_message(message: BroadcastMessage):
    """
    Broadcast a message to all connected clients or to a specific room
    """
    try:
        if message.room:
            # Send to specific room
            await sio.emit(message.event, {
                **message.data,
                'timestamp': datetime.now().isoformat(),
                'broadcast': True,
                'room': message.room
            }, room=message.room)
        else:
            # Send to all connected clients
            await sio.emit(message.event, {
                **message.data,
                'timestamp': datetime.now().isoformat(),
                'broadcast': True
            })
        
        return {
            "success": True,
            "message": f"Message broadcasted to {'room ' + message.room if message.room else 'all clients'}",
            "event": message.event,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{ENDPOINT}/send")
async def send_direct_message(message: DirectMessage):
    """
    Send a message to a specific client
    """
    try:
        if message.client_id not in connected_clients:
            raise HTTPException(status_code=404, detail="Client not connected")
        
        await sio.emit(message.event, {
            **message.data,
            'timestamp': datetime.now().isoformat(),
            'direct': True
        }, room=message.client_id)
        
        return {
            "success": True,
            "message": f"Message sent to client {message.client_id}",
            "event": message.event,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{ENDPOINT}/notify")
async def send_notification():
    """
    Send a sample notification to all clients
    """
    try:
        notification_data = {
            'title': 'Server Notification',
            'message': 'This is a test notification from the server',
            'type': 'info',
            'timestamp': datetime.now().isoformat()
        }
        
        await sio.emit('notification', notification_data)
        
        return {
            "success": True,
            "message": "Notification sent to all clients",
            "data": notification_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Background task example - sends periodic updates
async def background_task():
    """
    Example background task that sends periodic data to all clients
    """
    counter = 0
    while True:
        if connected_clients:  # Only send if there are connected clients
            counter += 1
            await sio.emit('periodic_update', {
                'counter': counter,
                'timestamp': datetime.now().isoformat(),
                'connected_clients': len(connected_clients)
            })
        await asyncio.sleep(30)  # Send update every 30 seconds

# Start background task when the app starts
@app.on_event("startup")
async def startup_event():
    # Uncomment the next line to enable periodic updates
    # asyncio.create_task(background_task())
    print("Server started - Socket.IO backend is ready!")

# Mount Socket.IO on the same app
app.mount("/socket.io", socketio.ASGIApp(sio, app))

# ----------------------------------------------------
# HTTP API endpoints
# ----------------------------------------------------
@app.get(f"{ENDPOINT}/health")
async def health_check():
    return {
        "status": "healthy",
        "connected_clients": len(connected_clients),
        "timestamp": datetime.now().isoformat()
    }

@app.get(f"{ENDPOINT}/clients")
async def get_connected_clients():
    return {
        "connected_clients": list(connected_clients),
        "total": len(connected_clients),
        "timestamp": datetime.now().isoformat()
    }

@app.post(f"{ENDPOINT}/broadcast")
async def broadcast_message(message: BroadcastMessage):
    """
    Broadcast a message to all connected clients or to a specific room
    """
    try:
        if message.room:
            # Send to specific room
            await sio.emit(message.event, {
                **message.data,
                'timestamp': datetime.now().isoformat(),
                'broadcast': True,
                'room': message.room
            }, room=message.room)
        else:
            # Send to all connected clients
            await sio.emit(message.event, {
                **message.data,
                'timestamp': datetime.now().isoformat(),
                'broadcast': True
            })
        
        return {
            "success": True,
            "message": f"Message broadcasted to {'room ' + message.room if message.room else 'all clients'}",
            "event": message.event,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{ENDPOINT}/send")
async def send_direct_message(message: DirectMessage):
    """
    Send a message to a specific client
    """
    try:
        if message.client_id not in connected_clients:
            raise HTTPException(status_code=404, detail="Client not connected")
        
        await sio.emit(message.event, {
            **message.data,
            'timestamp': datetime.now().isoformat(),
            'direct': True
        }, room=message.client_id)
        
        return {
            "success": True,
            "message": f"Message sent to client {message.client_id}",
            "event": message.event,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{ENDPOINT}/notify")
async def send_notification():
    """
    Send a sample notification to all clients
    """
    try:
        notification_data = {
            'title': 'Server Notification',
            'message': 'This is a test notification from the server',
            'type': 'info',
            'timestamp': datetime.now().isoformat()
        }
        
        await sio.emit('notification', notification_data)
        
        return {
            "success": True,
            "message": "Notification sent to all clients",
            "data": notification_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Background task example - sends periodic updates
async def background_task():
    """
    Example background task that sends periodic data to all clients
    """
    counter = 0
    while True:
        if connected_clients:  # Only send if there are connected clients
            counter += 1
            await sio.emit('periodic_update', {
                'counter': counter,
                'timestamp': datetime.now().isoformat(),
                'connected_clients': len(connected_clients)
            })
        await asyncio.sleep(30)  # Send update every 30 seconds

# Start background task when the app starts
@app.on_event("startup")
async def startup_event():
    # Uncomment the next line to enable periodic updates
    # asyncio.create_task(background_task())
    print("Server started - Socket.IO backend is ready!")

# Mount Socket.IO on the same app
app.mount("/socket.io", socketio.ASGIApp(sio))


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






@app.get("/api/v1/client-ip")
async def get_client_ip(request: Request):
    try:
        ip_address = request.headers.get("X-Forwarded-For") or request.client.host
        return {"ip_address": ip_address}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get client IP: {e}")

@app.post("/api/v1/ip-status")
async def check_ip_status_and_track(payload: IpAddressPayload):
    client_ip_str = payload.ip_address

    try:
        is_banned_db = IpAddressRepository.is_ip_banned(client_ip_str)
        if is_banned_db:
            return {"ip_address": client_ip_str, "is_banned": True}

        ip_data = IpAddressRepository.get_ip_address_by_string(client_ip_str)
        if not ip_data:
            ip_id = IpAddressRepository.create_ip_address(client_ip_str)
            if not ip_id:
                print(f"WARNING: Failed to create new IP {client_ip_str} in database.")

        return {"ip_address": client_ip_str, "is_banned": False}
    except Exception as e:
        print(f"Error in /api/v1/ip-status for IP {client_ip_str}: {e}")
        raise HTTPException(status_code=500, detail="Error processing IP status.")



@app.get("/banned", response_class=HTMLResponse, status_code=403)
async def banned_page(request: Request):
    client_ip_str = request.headers.get("X-Forwarded-For") or request.client.host
    ban_details = None
    is_currently_banned = False
    can_appeal = False # Flag for showing appeal button

    if client_ip_str:
        try:
            ban_details = IpAddressRepository.get_ip_address_by_string(client_ip_str)
            if ban_details and ban_details.get('is_banned'):
                # Check if ban is still active
                if ban_details.get('ban_expires_at') and datetime.now() >= ban_details['ban_date'] + (ban_details['ban_expires_at'] - ban_details['ban_date']) / 2:
                    is_currently_banned = False # Ban has expired
                    can_appeal = True
                else:
                    is_currently_banned = True # Ban is still active or permanent (NULL expiry)
        except Exception as e:
            print(f"Error fetching ban details for {client_ip_str}: {e}")
            ban_details = None # Reset to avoid incomplete data

    # Default values if no ban details or errors
    ban_reason = "No specific reason provided."
    ban_date_str = "N/A"
    ban_expires_str = "Permanent"
    ban_status_message = "Your access to Quizanistan is restricted."
    button_html = "" # No appeal button by default

    if ban_details:
        if is_currently_banned:
            ban_reason = ban_details.get('ban_reason', 'No specific reason provided.') or 'No specific reason provided.'
            if ban_details.get('ban_date'):
                ban_date_str = ban_details['ban_date'].strftime('%Y-%m-%d %H:%M:%S')
            if ban_details.get('ban_expires_at'):
                ban_expires_str = ban_details['ban_expires_at'].strftime('%Y-%m-%d %H:%M:%S')
                ban_status_message = f"Your access to Quizanistan is restricted until {ban_expires_str}."
            else:
                ban_status_message = "Your access to Quizanistan is permanently restricted."
        elif can_appeal:
            ban_reason = ban_details.get('ban_reason', 'Your previous restriction has expired.') or 'Your previous restriction has expired.'
            if ban_details.get('ban_date'):
                ban_date_str = ban_details['ban_date'].strftime('%Y-%m-%d %H:%M:%S')
            ban_expires_str = "Expired"
            ban_status_message = "Your previous restriction has expired. You may appeal to regain full access."
            # Appeal button HTML
            button_html = f"""
            <button id="appealBanBtn" class="c-btn c-btn--primary">Reintegrate into Quizanistan</button>

            <div id="appealModal" class="modal">
                <div class="modal-content">
                    <span class="close-button">&times;</span>
                    <h2>Reintegrate into Quizanistan</h2>
                    <p>Are you ready to reintegrate into Quizanistan, the land of infinite wisdom?</p>
                    <p>Prove your readiness with a fitting quote:</p>
                    <textarea id="appealQuote" rows="4" placeholder="Type your inspiring quote here..."></textarea>
                    <button id="submitAppealBtn" class="c-btn c-btn--success">Submit Appeal</button>
                    <div id="appealMessage" style="margin-top: 10px; color: green;"></div>
                </div>
            </div>

            <script>
                document.addEventListener('DOMContentLoaded', () => {{
                    const appealBtn = document.getElementById('appealBanBtn');
                    const modal = document.getElementById('appealModal');
                    const closeBtn = document.querySelector('.modal-content .close-button');
                    const submitAppealBtn = document.getElementById('submitAppealBtn');
                    const appealQuote = document.getElementById('appealQuote');
                    const appealMessage = document.getElementById('appealMessage');

                    if(appealBtn) {{
                        appealBtn.onclick = () => {{ modal.style.display = 'block'; }};
                    }}
                    if(closeBtn) {{
                        closeBtn.onclick = () => {{ modal.style.display = 'none'; }};
                    }}
                    window.onclick = (event) => {{
                        if (event.target == modal) {{ modal.style.display = 'none'; }}
                    }};

                    if(submitAppealBtn) {{
                        submitAppealBtn.onclick = async () => {{
                            const ipAddress = "{client_ip_str}";
                            const quote = appealQuote.value.trim();

                            if (quote.length < 10) {{
                                appealMessage.style.color = 'red';
                                appealMessage.innerText = 'Please provide a more substantial quote.';
                                return;
                            }}

                            appealMessage.style.color = 'blue';
                            appealMessage.innerText = 'Submitting appeal...';

                            try {{
                                const response = await fetch(`${{lanIP}}/api/v1/appeal-ban`, {{
                                    method: 'POST',
                                    headers: {{ 'Content-Type': 'application/json' }},
                                    body: JSON.stringify({{ ip_address: ipAddress, quote: quote }})
                                }});

                                const data = await response.json();
                                if (response.ok) {{
                                    appealMessage.style.color = 'green';
                                    appealMessage.innerText = data.message;
                                    appealBtn.disabled = true;
                                    appealBtn.innerText = 'Appeal Submitted';
                                    setTimeout(() => {{
                                        modal.style.display = 'none';
                                        window.location.reload();
                                    }}, 2000);
                                }} else {{
                                    appealMessage.style.color = 'red';
                                    appealMessage.innerText = data.detail || 'Appeal failed.';
                                }}
                            }} catch (error) {{
                                console.error('Appeal network error:', error);
                                appealMessage.style.color = 'red';
                                appealMessage.innerText = 'Network error during appeal. Please try again.';
                            }}
                        }};
                    }}
                }});
            </script>
            """
    else:
        ban_reason = "Unable to retrieve ban details. Access is denied."
        ban_status_message = "Your access to Quizanistan is restricted."


    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Denied - Quizanistan</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; color: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
            .container {{ background-color: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15); text-align: center; max-width: 600px; width: 100%; position: relative; }}
            h1 {{ color: #e74c3c; margin-bottom: 15px; font-size: 2.5em; }}
            p {{ font-size: 1.1em; line-height: 1.6; color: #555; margin-bottom: 10px; }}
            .icon {{ font-size: 5em; color: #e74c3c; margin-bottom: 25px; }}
            .details {{ background-color: #fdfdfd; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-top: 25px; text-align: left; }}
            .details strong {{ color: #444; }}
            .c-btn {{
                background-color: #3498db;
                color: white;
                padding: 12px 25px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1.1em;
                margin-top: 25px;
                transition: background-color 0.3s ease;
            }}
            .c-btn:hover {{
                background-color: #2980b9;
            }}
            .c-btn--success {{ background-color: #28a745; }}
            .c-btn--success:hover {{ background-color: #218838; }}

            /* Modal Styles */
            .modal {{
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.6);
                justify-content: center;
                align-items: center;
            }}
            .modal-content {{
                background-color: #fefefe;
                margin: auto;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                width: 90%;
                max-width: 500px;
                text-align: center;
                position: relative;
            }}
            .close-button {{
                color: #aaa;
                float: right;
                font-size: 30px;
                font-weight: bold;
                position: absolute;
                top: 10px;
                right: 20px;
                cursor: pointer;
            }}
            .close-button:hover,
            .close-button:focus {{
                color: black;
                text-decoration: none;
            }}
            .modal-content h2 {{ color: #3498db; margin-bottom: 20px; }}
            .modal-content textarea {{
                width: calc(100% - 20px);
                padding: 10px;
                margin-bottom: 15px;
                border: 1px solid #ccc;
                border-radius: 5px;
                font-size: 1em;
                resize: vertical;
            }}
        </style>
        <script>
            const lanIP = "{request.url.scheme}://{request.url.netloc}";
        </script>
    </head>
    <body>
        <div class="container">
            <div class="icon">&#9888;</div>
            <h1>Access Denied</h1>
            <p>{ban_status_message}</p>
            <div class="details">
                <p><strong>Your IP Address:</strong> {client_ip_str}</p>
                <p><strong>Reason:</strong> {ban_reason}</p>
                <p><strong>Banned On:</strong> {ban_date_str}</p>
                <p><strong>Ban Expires:</strong> {ban_expires_str}</p>
            </div>
            {button_html}
        </div>
    </body>
    </html>
    """
    return html_content

@app.post("/api/v1/appeal-ban", response_class=JSONResponse)
async def appeal_ban(payload: AppealPayload, request: Request):
    client_ip_str = payload.ip_address
    quote = payload.quote

    # Basic validation for the quote
    if not quote or len(quote.strip()) < 10:
        raise HTTPException(status_code=400, detail="Quote too short or empty. Please provide a more substantial quote.")

    try:
        ban_details = IpAddressRepository.get_ip_address_by_string(client_ip_str)

        if not ban_details or not ban_details.get('is_banned'):
            raise HTTPException(status_code=400, detail="This IP is not currently banned or no ban record found.")

        # Check if the ban has actually expired before allowing appeal via this API
        if ban_details.get('ban_expires_at') and ban_details['ban_expires_at'] > datetime.now():
            raise HTTPException(status_code=403, detail="Ban has not yet expired. Please wait.")

        # If we reach here, the ban has expired or was permanent and we're allowing appeal.
        # Log the appeal attempt (e.g., to a separate log file or a database table for appeals)
        print(f"IP {client_ip_str} appealing ban with quote: '{quote}'")
        # You might want to store the quote and appeal attempt in a dedicated 'appeals' table
        # For this example, we directly clear the ban if the criteria are met.

        success = IpAddressRepository.appeal_ban(client_ip_str)

        if success:
            return JSONResponse(status_code=200, content={"message": "Appeal successful! Welcome back to Quizanistan."})
        else:
            raise HTTPException(status_code=500, detail="Failed to process appeal.")

    except HTTPException as e:
        raise e # Re-raise FastAPI HTTP exceptions
    except Exception as e:
        print(f"Error during ban appeal for IP {client_ip_str}: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred during appeal.")




































# I will also add endpoints for:
# - Login (e.g., POST /api/v1/users/login with username/password, returns token/session info)
# - Logout (e.g., POST /api/v1/users/logout)
# - Get user by RFID (if needed for specific frontend flows)


# Global flag to signal the background thread to stop
stop_thread_event = Event()
servo_command_queue = queue.Queue()
# --- Raspberry Pi Script Logic (adapted into a function) ---

# Constants (re-declare or import if they were in a separate config for the Pi script)
REFRESH_INTERVAL = 1  # seconds
RFID_DISPLAY_TIME = 6  # seconds to display RFID code (matches RFID cooldown)
SERVO_IDLE_ANGLE = 90  # Neutral position when idle

def get_ip_address():
    """Get the IP address of the Raspberry Pi"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "No IP"

def format_second_row(temp, lux, angle):
    """Format the second row of the LCD with sensor data"""
    return f"{temp:.1f}C {lux:.0f}L {angle}deg"

def format_second_row(temp, lux, angle):
    return f"{temp:.1f}C {lux:.0f}L {angle}deg"

def raspberry_pi_main_thread(stop_event, sio, loop):
    if not RPI_COMPONENTS_AVAILABLE:
        print("Skipping Raspberry Pi thread start due to component import errors.")
        return

    # Initialize components
    lcd = None
    rfid = None
    servo = None
    temp_sensor = None
    light_sensor = None
    try:
        lcd = LCD1602A()
        rfid = HardcoreRFID()
        servo = ServoMotor()
        temp_sensor = TemperatureSensor()
        light_sensor = LightSensor()
    except Exception as e:
        print(f"Failed to initialize Raspberry Pi components in thread: {e}")
        print(traceback.format_exc())
        stop_event.set()
        return

    # Initial positions
    if servo:
        servo.set_angle(SERVO_IDLE_ANGLE)
    current_angle = SERVO_IDLE_ANGLE

    # State variables
    last_refresh = 0
    rfid_display_start = 0
    showing_rfid = False
    rfid_code = ""

    # Initial display setup
    if lcd:
        lcd.clear()
        ip_address = get_ip_address()
        lcd.write_line(0, ip_address[:16])

    try:
        while not stop_event.is_set():
            current_time = time.time()

            # --- Check for active Quiz Session ---
            # This section will run every loop iteration
            try:
                active_sessions = QuizSessionRepository.get_active_sessions()
                if active_sessions:
                    # If any sessions are active, do nothing for now as per requirement
                    # print(f"Active quiz session detected: {active_sessions[0]['name']}")
                    pass # Placeholder for future logic
                else:
                    # No active sessions, continue with normal sensor/RFID functions
                    # print("No active quiz sessions.")
                    pass
            except Exception as e:
                print(f"Error checking active quiz sessions: {e}")
                # Decide how to handle this error: e.g., proceed with other functions, or pause.

            # --- RFID and Sensor Logic (only if no active session or if desired to run concurrently) ---
            # For now, let's assume RFID/sensor logic can run alongside the session check.
            # If you want to disable RFID/sensors during an active quiz, you'd wrap this:
            # if not active_sessions:
            if not showing_rfid: # Only check for RFID if we're not currently displaying an RFID
                if rfid:
                    uid = rfid.read_card()
                    if uid:
                        rfid_code = uid
                        rfid_display_start = current_time
                        showing_rfid = True
                        print(f"RFID Scanned: {rfid_code}")
                        if lcd:
                            lcd.write_line(1, f"RFID:{rfid_code}")

            # Manage RFID display time
            if showing_rfid and (current_time - rfid_display_start) >= RFID_DISPLAY_TIME:
                showing_rfid = False
                if lcd:
                    lcd.clear()
                    lcd.write_line(0, ip_address[:16])
                last_refresh = 0 # Force immediate normal display update

            # Update normal display at regular intervals (only when not showing RFID)
            if not showing_rfid and (current_time - last_refresh) >= REFRESH_INTERVAL:
                try:
                    if temp_sensor and light_sensor and servo and lcd:
                        temp = temp_sensor.read_temperature()
                        lux = light_sensor()
                        current_angle = servo.read_degrees() # Read current angle of servo
                        lcd.write_line(1, format_second_row(temp, lux, current_angle)[:16])
                        last_refresh = current_time
                        #print(format_second_row(temp, lux, current_angle)[:16])
                        sensor_data_to_emit = {
                                'temperature': temp,
                                'illuminance': lux,
                                'servo_angle': current_angle,
                            }   
                        try:
                            asyncio.run_coroutine_threadsafe(
                                sio.emit('sensor_data', sensor_data_to_emit),
                                loop 
                            )
                        except Exception as e:
                            print(f"Error emitting sensor_data from thread: {e}")
                            time.sleep(0.05)

                except Exception as e:
                    print(f"Sensor read error: {e}")
                    if lcd:
                        lcd.write_line(1, "Sensor Error")
                    last_refresh = current_time

            # --- Handle Servo Commands from Queue ---
            try:
                # Non-blocking check for commands
                command = servo_command_queue.get(block=False)
                if command == "SWEEP_SERVO":
                    print("Received SWEEP_SERVO command.")
                    # Perform the servo sweep
                    if servo and lcd and temp_sensor and light_sensor:
                        sweep_start_time = time.time()
                        sweep_duration = 1.0
                        start_angle = 0
                        end_angle = 180

                        while (time.time() - sweep_start_time < sweep_duration) and not stop_event.is_set():
                            elapsed = time.time() - sweep_start_time
                            progress = elapsed / sweep_duration
                            if progress > 1.0:
                                progress = 1.0

                            raw_angle = start_angle + (end_angle - start_angle) * progress
                            angle = round(raw_angle / 5) * 5

                            servo.set_angle(angle)
                            temp = temp_sensor.read_temperature()
                            lux = light_sensor()
                            current_degrees = servo.read_degrees()
                            lcd.write_line(1, format_second_row(temp, lux, current_degrees)[:16])
                            sensor_data_to_emit = {
                                    'temperature': temp,
                                    'illuminance': lux,
                                    'servo_angle': current_angle,
                                }   
                            try:
                                asyncio.run_coroutine_threadsafe(
                                    sio.emit('sensor_data', sensor_data_to_emit),
                                    loop 
                                )
                            except Exception as e:
                                print(f"Error emitting sensor_data from thread: {e}")
                                time.sleep(0.05)

                        if not stop_event.is_set():
                            servo.set_angle(180) # Ensure it reaches the end point
                            time.sleep(0.1)
                            servo.set_angle(SERVO_IDLE_ANGLE) # Return to idle
                            current_angle = servo.read_degrees()

                        print("Servo sweep complete.")
                        # Clear display or update after sweep
                        if lcd:
                            lcd.clear()
                            lcd.write_line(0, ip_address[:16])
                            last_refresh = 0 # Force refresh
            except queue.Empty:
                pass # No command in queue
            except Exception as e:
                print(f"Error processing servo command: {e}")
                print(traceback.format_exc())


            time.sleep(0.05)

    except Exception as e:
        print(f"Fatal error in Pi thread: {e}")
        print(traceback.format_exc())
    finally:
        print("Pi thread cleanup initiated.")
        try:
            if servo:
                servo.set_angle(SERVO_IDLE_ANGLE)
                time.sleep(0.5)
                servo.cleanup()
            if lcd:
                lcd.clear()
                lcd.cleanup()
            print("Pi thread cleanup complete.")
        except Exception as e:
            print(f"Pi thread cleanup error: {e}")

servo_lock = Lock()
last_servo_command_time = 0.0 # Stores the Unix timestamp (seconds since epoch) of the last command
SERVO_COOLDOWN_SECONDS = 3.0 # The duration of the cooldown
servo_cooldown_lock = Lock() # A dedicated lock to protect access to last_servo_command_time

@app.post("/api/v1/trigger-servo")
async def trigger_servo(cmd: ServoCommand):
    global last_servo_command_time # <--- MOVE THIS TO THE TOP OF THE FUNCTION

    if cmd.command != "SWEEP_SERVO":
        raise HTTPException(status_code=400, detail="Invalid servo command.")

    # 1. Check for active quiz sessions (KEEP THIS AS IS)
    try:
        active_sessions = QuizSessionRepository.get_active_sessions()
        if active_sessions:
            active_session_info = active_sessions[0] if active_sessions else None
            raise HTTPException(
                status_code=409,
                detail="A quiz session is currently active. Servo movement is restricted.",
                headers={"X-Active-Session": "true", "X-Session-Name": active_session_info.name}
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking active quiz sessions during servo trigger: {e}")
        raise HTTPException(status_code=500, detail="Internal server error checking quiz status.")

    # --- NEW LOGIC: Cooldown Check ---
    with servo_cooldown_lock:
        current_time = time.time()
        if current_time - last_servo_command_time < SERVO_COOLDOWN_SECONDS:
            remaining_cooldown = SERVO_COOLDOWN_SECONDS - (current_time - last_servo_command_time)
            raise HTTPException(
                status_code=429,
                detail=f"Servo is on cooldown. Please wait {remaining_cooldown:.1f} seconds before trying again."
            )
        # The 'global' declaration is now at the top, so this modification is fine here.
        last_servo_command_time = current_time
    # --- END NEW LOGIC ---

    # 2. Acquire the existing lock for queue access
    if not servo_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Servo command queue is temporarily locked by another request.")

    try:
        # 3. Attempt to put the command into the queue
        servo_command_queue.put_nowait("SWEEP_SERVO")
        return {"message": "Servo sweep command sent to Raspberry Pi."}
    except queue.Full:
        raise HTTPException(status_code=503, detail="Raspberry Pi command queue is full, try again soon.")
    finally:
        servo_lock.release()



# --- FastAPI Application Lifecycle Events ---

@app.on_event("startup")
async def startup_event():
    global main_asyncio_loop # Declare that you're using the global variable
    print("FastAPI app starting up...")

    if RPI_COMPONENTS_AVAILABLE:
        # Get the main asyncio event loop when FastAPI starts.
        # This is the loop on which Socket.IO emits will be scheduled.
        main_asyncio_loop = asyncio.get_running_loop()
        print(f"Main asyncio loop obtained: {main_asyncio_loop}")

        # Start the Raspberry Pi script in a new thread
        # Pass the sio instance and the main_asyncio_loop to the thread
        pi_thread = Thread(
            target=raspberry_pi_main_thread,
            args=(stop_thread_event, sio, main_asyncio_loop), # <--- MODIFIED ARGS HERE
            daemon=True
        )
        pi_thread.start()
        print("Raspberry Pi script thread started.")
    else:
        print("Raspberry Pi thread will not be started due to import errors.")

    print("Server started - Socket.IO backend is ready!")


@app.on_event("shutdown")
async def shutdown_event():
    print("FastAPI app shutting down...")
    # Signal the background thread to stop
    stop_thread_event.set()
    # Give the thread a moment to clean up (optional, as it's a daemon thread)
    # If the thread is not a daemon, you'd want to join it: pi_thread.join(timeout=5)
    print("Shutdown signal sent to Raspberry Pi thread.")


# --- FastAPI Endpoints ---

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Site Quiz Backend!"}

@app.get("/api/v1/users/", response_model=List[UserPublic])
async def get_all_users(request: Request):
    """
    Fetches all users from the database.
    """
    try:
        users = UserRepository.get_all_users()
        # Your console log shows it's a list of dictionaries, so this should work.
        return [UserPublic(**user) for user in users]
    except Exception as e:
        print(f"Error in get_all_users endpoint: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to retrieve users.")

# Example of a middleware to log requests (if you still have this)
@app.middleware("http")
async def log_request(request: Request, call_next):
    # print(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    # print(f"Outgoing response status: {response.status_code}")
    return response



# ----------------------------------------------------
# Run the app
# ----------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"]
    )