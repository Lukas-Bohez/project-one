import socketio
import asyncio
import uvicorn
from datetime import datetime,timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
import time
import traceback
from threading import Thread, Event, Lock
import socket
# Import the new ThemeRepository
from fastapi.responses import HTMLResponse,JSONResponse
from database.datarepository import QuestionRepository, AnswerRepository, ThemeRepository,UserRepository, IpAddressRepository, UserIpAddressRepository,QuizSessionRepository,SensorDataRepository,AuditLogRepository,PlayerItemRepository,ItemRepository,ChatLogRepository,SessionPlayerRepository,PlayerAnswerRepository
from models.models import (
    QuestionBase, QuestionCreate, QuestionResponse, QuestionUpdate,
    QuestionStatusUpdate, ErrorNotFound, QuestionWithAnswers,
    ThemeBase, ThemeCreate, ThemeUpdate, ThemeResponse, # Import new Theme models
    DifficultyLevelResponse, QuestionSearchResult,
    RandomQuestionRequest, QuestionMetadataUpdate,
    QuestionActivationNotification,
    AnswerBase, AnswerCreate, AnswerListResponse, AnswerResponse, 
    AnswerStatusUpdate, AnswerUpdate, CorrectAnswerResponse,IpAddressPayload,AppealPayload,ServoCommand,BroadcastMessage,DirectMessage, ClientActivity,SessionSensorData,MultiSessionSensorResponse,UserUpdateNames,UserCredentials,AnswerInput,QuestionInput, ThemeInput,
    UserPublic,UserPublicWithIp,UserIpAddress,BanIpRequest,AuditLogResponse,ChatMessage,ChatMessageCreate,ShutdownRequest
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
# Socket.IO event handlers
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
    }, skip_sid=sid) # <--- This is the key line for 'client_connected'
    print(f"Server emitted 'client_connected' for new client {sid}. Total clients: {len(connected_clients)}")



@sio.event
async def disconnect(sid): # <--- You need a disconnect handler!
    print(f"Client {sid} disconnected")
    if sid in connected_clients:
        connected_clients.remove(sid)

    # Notify all remaining clients about the disconnection
    await sio.emit('client_disconnected', {
        'client_id': sid,
        'total_clients': len(connected_clients),
        'timestamp': datetime.now().isoformat()
    })
    print(f"Server emitted 'client_disconnected' for client {sid}. Total clients: {len(connected_clients)}")



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


# Start background task when the app starts
@app.on_event("startup")
async def startup_event():
    # Uncomment the next line to enable periodic updates
    # asyncio.create_task(background_task())
    print("Server started - Socket.IO backend is ready!")

# Mount Socket.IO on the same app
app.mount("/socket.io", socketio.ASGIApp(sio, app))



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












@app.get("/api/questions/active/count")
async def get_active_questions_count():
    try:
        # Fetch all active questions
        active_questions = QuestionRepository.get_active_questions()
        
        # Count them manually (if result is a list)
        count = len(active_questions) if active_questions else 0
        
        return JSONResponse(content={"count": count})
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to retrieve active questions count: {str(e)}"}
        )



@app.get("/api/users/active/count")
async def get_active_questions_count():
    try:
        # Fetch all active questions
        users = UserRepository.get_all_users()
        
        # Count them manually (if result is a list)
        count = len(users) if users else 0
        
        return JSONResponse(content={"count": count})
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to retrieve active questions count: {str(e)}"}
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





# ----------------------------------------------------
# Special Answer Operations
# ----------------------------------------------------




# ----------------------------------------------------
# FastAPI Endpoints - Themes (NEW)
# ----------------------------------------------------


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
@app.get(
    ENDPOINT + "/users/",
    response_model=List[UserPublicWithIp], # Updated response model
    summary="Get all users with IP information",
    tags=["Users"]
)
async def get_all_users():
    users = UserRepository.get_all_users()
    users_with_ip = []
    
    for user in users:
        # Get IP addresses for this user
        user_ip_data = UserIpAddressRepository.get_user_ip_addresses(user['id'])
        
        # Convert IP data to UserIpAddress objects
        ip_addresses = []
        for ip_data in user_ip_data:
            ip_addresses.append(UserIpAddress(
                id=ip_data['id'],
                ip_address=ip_data['ip_address'],
                is_banned=ip_data['is_banned'],
                ban_reason=ip_data['ban_reason'],
                ban_date=ip_data['ban_date'],
                ban_expires_at=ip_data['ban_expires_at'],
                usage_count=ip_data['usage_count'],
                last_used=ip_data['last_used'],
                is_primary=ip_data['is_primary']
            ))
        
        # Create user object with IP information
        user_with_ip = UserPublicWithIp(
            **user,  # Spread all existing user fields
            ip_addresses=ip_addresses
        )
        users_with_ip.append(user_with_ip)
    
    return users_with_ip

# Alternative: If you want to keep the original endpoint and add a separate one for IP info
@app.get(
    ENDPOINT + "/users/with-ip/",
    response_model=List[UserPublicWithIp],
    summary="Get all users with detailed IP information",
    tags=["Users"]
)
async def get_all_users_with_ip():
    users = UserRepository.get_all_users()
    users_with_ip = []
    
    for user in users:
        user_ip_data = UserIpAddressRepository.get_user_ip_addresses(user['id'])
        
        ip_addresses = []
        for ip_data in user_ip_data:
            ip_addresses.append(UserIpAddress(
                id=ip_data['id'],
                ip_address=ip_data['ip_address'],
                is_banned=ip_data['is_banned'],
                ban_reason=ip_data['ban_reason'],
                ban_date=ip_data['ban_date'],
                ban_expires_at=ip_data['ban_expires_at'],
                usage_count=ip_data['usage_count'],
                last_used=ip_data['last_used'],
                is_primary=ip_data['is_primary']
            ))
        
        user_with_ip = UserPublicWithIp(
            **user,
            ip_addresses=ip_addresses
        )
        users_with_ip.append(user_with_ip)
    
    return users_with_ip

# Keep the original endpoint if you still need it without IP data
@app.get(
    ENDPOINT + "/users/basic/",
    response_model=List[UserPublic],
    summary="Get all users (basic info only)",
    tags=["Users"]
)
async def get_all_users_basic():
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
















@app.get("/api/v1/sensor-data", response_model=MultiSessionSensorResponse)
async def get_multi_session_sensor_data(session_ids: str = "1,2", limit: int = 1000, include_chat: bool = True, include_answers: bool = True):
    # Convert and sort session IDs in descending order (newest first)
    requested_session_ids = sorted(
        [int(sid.strip()) for sid in session_ids.split(',')],
        reverse=True
    )
   
    response_sessions_data = []
   
    for session_id in requested_session_ids:
        session_data = QuizSessionRepository.get_session_by_id(session_id)
        if not session_data:
            continue
           
        current_session_id = session_data['id']
        current_session_name = session_data['name']
       
        # Get sensor data and sort by timestamp descending
        sensor_readings = SensorDataRepository.get_all_data_for_session(current_session_id)
        # Assuming sensor_readings is a list of dictionaries with 'timestamp' key
        sensor_readings_sorted = sorted(
            sensor_readings,
            key=lambda x: x.get('timestamp') or datetime.min,
            reverse=True
        )
       
        temperatures = []
        light_intensities = []
        servo_positions = []
       
        for reading in sensor_readings_sorted:  # Process sorted readings
            timestamp = reading.get('timestamp')
            timestamp_iso = timestamp.isoformat() if timestamp else None
           
            # Convert values to float if they are strings
            try:
                temp_value = float(reading.get('temperature (°C)'))
            except (ValueError, TypeError):
                temp_value = None
           
            try:
                light_value = float(reading.get('lightIntensity (lux)'))
            except (ValueError, TypeError):
                light_value = None
           
            try:
                servo_value = float(reading.get('servoPosition (°)'))
            except (ValueError, TypeError):
                servo_value = None
                
            temperatures.append({
                "timestamp": timestamp_iso,
                "value": temp_value
            })
            light_intensities.append({
                "timestamp": timestamp_iso,
                "value": light_value
            })
            servo_positions.append({
                "timestamp": timestamp_iso,
                "value": servo_value
            })
        
        # Get chat data if requested - sort by created_at descending
        chat_messages = []
        if include_chat:
            chat_data = ChatLogRepository.get_chat_messages_by_session(current_session_id, limit)
            if chat_data:  # Check if chat_data is not None
                chat_data_sorted = sorted(
                    chat_data,
                    key=lambda x: x.get('created_at') or datetime.min,
                    reverse=True
                )
                chat_messages = [
                    {
                        "id": msg.get('id'),
                        "userId": msg.get('userId'),
                        "username": msg.get('username'),
                        "message": msg.get('message'),
                        "created_at": msg.get('created_at').isoformat() if msg.get('created_at') else None
                    }
                    for msg in chat_data_sorted
                ]
        
        # Get player answers if requested - sort by answered_at descending
        player_answers_data = []
        if include_answers:
            session_questions = QuestionRepository.get_questions_by_session(current_session_id)
            
            if session_questions:  # Check if session_questions is not None
                for question in session_questions:
                    question_id = question.get('id')
                    question_with_answers = PlayerAnswerRepository.get_question_with_player_answers(question_id)
                    
                    if question_with_answers and question_with_answers.get('player_answers'):
                        # Sort player answers by answered_at descending
                        sorted_answers = sorted(
                            question_with_answers['player_answers'],
                            key=lambda x: x.get('answered_at') or datetime.min,
                            reverse=True
                        )
                        formatted_answers = []
                        for answer in sorted_answers:
                            formatted_answers.append({
                                "player_answer_id": answer.get('player_answer_id'),
                                "sessionId": answer.get('sessionId'),
                                "userId": answer.get('userId'),
                                "first_name": answer.get('first_name'),
                                "last_name": answer.get('last_name'),
                                "questionId": answer.get('questionId'),
                                "answerId": answer.get('answerId'),
                                "answer_text": answer.get('answer_text'),
                                "is_correct": answer.get('is_correct'),
                                "points_earned": answer.get('points_earned'),
                                "time_taken": answer.get('time_taken'),
                                "answered_at": answer.get('answered_at').isoformat() if answer.get('answered_at') else None
                            })
                        
                        player_answers_data.append({
                            "question_id": question_id,
                            "question_text": question_with_answers.get('question_text'),
                            "player_answers": formatted_answers
                        })
       
        response_sessions_data.append(SessionSensorData(
            session_id=current_session_id,
            session_name=current_session_name,
            temperatures=temperatures,
            light_intensities=light_intensities,
            servo_positions=servo_positions,
            chat_messages=chat_messages,
            player_answers=player_answers_data
        ))
   
    return MultiSessionSensorResponse(sessions=response_sessions_data)


from fastapi import APIRouter, HTTPException, Depends, Request, Header
from datetime import datetime

# Add this import for the IP address repository
# from your_repositories import IpAddressRepository  # Adjust import path as needed

def get_client_ip(request: Request) -> str:
    """Extract client IP address from request headers."""
    # Check for forwarded IP first (in case of proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded_for.split(",")[0].strip()
    
    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct client IP
    return request.client.host if request.client else "unknown"

def log_user_ip_address(user_id: int, ip_address: str):
    """Log the IP address for a user."""
    try:
        # Get or create IP address record
        ip_record = IpAddressRepository.get_ip_address_by_string(ip_address)
        if not ip_record:
            # If IP doesn't exist, you'll need to create it
            # This assumes you have a method to create IP addresses
            # You may need to add this method to your IpAddressRepository
            ip_id = IpAddressRepository.create_ip_address(ip_address)
        else:
            ip_id = ip_record['id']
        
        # Create/update the user-IP link
        UserIpAddressRepository.create_user_ip_address_link(user_id, ip_id)
    except Exception as e:
        # Log the error but don't fail the main operation
        print(f"Failed to log IP address for user {user_id}: {e}")

@app.patch("/api/v1/users/{rfid_code}")
async def update_user_names(rfid_code: str, user_update: UserUpdateNames, request: Request):
    # Get client IP address
    client_ip = get_client_ip(request)
    
    all_users = UserRepository.get_all_users()
    target_user_id = None

    for user in all_users:
        # Check if first and last name already exist for any user
        if user['first_name'] == user_update.first_name and user['last_name'] == user_update.last_name:
            # Found a user with matching name
            if user['rfid_code'] == rfid_code:
                # Name and RFID match: This is the user attempting to log in
                target_user_id = user['id']
                UserRepository.update_user_last_active(target_user_id, datetime.now())
                
                # Log IP address
                log_user_ip_address(target_user_id, client_ip)
                break
            else:
                # Name matches, but RFID does not
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this name already exists, but the provided RFID does not match."
                )
    
    # If no user found by name or if the loop completed without a direct match
    if target_user_id is None:
        # Check if the RFID is associated with an 'open' account
        existing_user_by_rfid = UserRepository.get_user_by_rfid(rfid_code)
        if existing_user_by_rfid:
            if existing_user_by_rfid['first_name'] == 'Open' and existing_user_by_rfid['last_name'] == 'Open':
                # RFID linked to an 'Open' account, update its details
                success = UserRepository.update_user_names_by_rfid(
                    rfid_code,
                    user_update.first_name,
                    user_update.last_name
                )
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update 'Open' user account."
                    )
                target_user_id = existing_user_by_rfid['id'] # Return the ID of the updated user
                UserRepository.update_user_last_active(target_user_id, datetime.now())
                
                # Log IP address
                log_user_ip_address(target_user_id, client_ip)
            else:
                # RFID exists but is not "Open" and doesn't match the provided name
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"RFID code '{rfid_code}' is already associated with another user and is not an 'Open' account."
                )
        else:
            # RFID not found at all.
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with RFID code '{rfid_code}' not found and no 'Open' account to update."
            )

    return {"user_id": target_user_id}





























async def add_user_to_active_session(user_id: int):
    try:
        active_session_id = get_active_session_id()
        if not active_session_id:
            logger.info(f"User {user_id} logged in, but no active session was found.")
            return

        active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
        if not active_session_info:
            logger.error(f"Active session ID {active_session_id} returned no session info.")
            return

        if not SessionPlayerRepository.get_session_player(active_session_id, user_id):
            SessionPlayerRepository.add_player_to_session(active_session_id, user_id)
            logger.info(f"Added user {user_id} to session {active_session_id}")
        else:
            logger.info(f"User {user_id} is already in session {active_session_id}")

    except Exception as e:
        logger.error(f"Failed to add user {user_id} to active session: {e}", exc_info=True)

@app.post("/api/v1/register", status_code=status.HTTP_201_CREATED)
async def register_user(user_credentials: UserCredentials, request: Request):
    try:
        if UserRepository.get_user_by_name(user_credentials.first_name, user_credentials.last_name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this first and last name already exists. Please choose another name or login."
            )

        hashed_info = UserRepository.hash_password(user_credentials.password)
        
        user_data = {
            'first_name': user_credentials.first_name,
            'last_name': user_credentials.last_name,
            'password_hash': hashed_info['password_hash'],
            'salt': hashed_info['salt'],
            'userRoleId': 1,
            'soul_points': 4,
            'limb_points': 4,
            'updated_by': 1
        }
        
        user_id = UserRepository.create_user_with_password(user_data)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A critical error occurred while creating the user."
            )
        
        log_user_ip_address(user_id, get_client_ip(request))
        await add_user_to_active_session(user_id)
        
        logger.info(f"User '{user_credentials.first_name} {user_credentials.last_name}' registered successfully with ID: {user_id}")
        return {"message": "User registered successfully", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred during user registration: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred."
        )

@app.post("/api/v1/login")
async def login_user(user_credentials: UserCredentials, request: Request):
    try:
        user_id = UserRepository.authenticate_user(
            user_credentials.first_name,
            user_credentials.last_name,
            user_credentials.password
        )
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid first name, last name, or password."
            )
        
        log_user_ip_address(user_id, get_client_ip(request))
        await add_user_to_active_session(user_id)
        
        logger.info(f"User ID {user_id} logged in successfully.")
        return {"message": "Login successful", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred during login for user '{user_credentials.first_name}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred."
        )

def calculate_player_score(session_id: int, user_id: int) -> int:
    try:
        all_answers = PlayerAnswerRepository.get_all_player_answers_for_user_in_session(session_id, user_id)
        
        user_score = sum(answer.get('points_earned', 0) for answer in all_answers if answer.get('points_earned'))
        return user_score
    
    except Exception as e:
        logger.error(f"Could not calculate score for user {user_id} in session {session_id}: {e}")
        return 0


@sio.on('request_user_data')
async def handle_user_data_request(sid, data):
    try:
        # Validate input data
        if not data or 'user_id' not in data:
            logger.warning(f"Invalid request data from SID {sid}: {data}")
            await sio.emit('error', {'message': 'Missing user_id'}, room=sid)
            return

        requesting_user_id = data['user_id']
        logger.info(f"Processing user data request from user {requesting_user_id} (SID: {sid})")

        # Get active session
        active_session_id = get_active_session_id()
        logger.debug(f"Active session ID: {active_session_id}")
        
        if not active_session_id:
            logger.info("No active session found")
            await sio.emit('all_users_data_updated', {
                'session_id': None,
                'session_name': "No Active Session",
                'players': [],
                'total_players': 0
            }, room=sid)
            return

        # Get session players
        logger.debug(f"Fetching players for session {active_session_id}")
        player_records = SessionPlayerRepository.get_session_players(active_session_id)
        logger.debug(f"Raw players data from DB: {player_records}")

        if not player_records:
            logger.warning(f"No players found in session {active_session_id}")
            active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
            await sio.emit('all_users_data_updated', {
                'session_id': active_session_id,
                'session_name': active_session_info.get('name', f'Session {active_session_id}') if active_session_info else "Unknown Session",
                'players': [],
                'total_players': 0,
                'requesting_user_position': 1
            }, room=sid)
            return

        # Process all players
        all_players_data = []
        logger.debug(f"Processing {len(player_records)} players")
        
        for player in player_records:
            user_id = player.get('userId')  # Changed from 'user_id' to 'id'
            if not user_id:
                logger.warning(f"Player record missing id: {player}")
                continue

            logger.debug(f"Fetching details for user {user_id}")
            user_details = UserRepository.get_user_by_id(user_id)
            
            if not user_details:
                logger.warning(f"User {user_id} not found but exists in session {active_session_id}")
                continue

            logger.debug(f"Calculating score for user {user_id}")
            session_score = calculate_player_score(active_session_id, user_id)
            questions_answered = get_user_questions_answered_count(user_id, active_session_id)

            player_data = {
                'user_id': user_id,
                'username': f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
                'first_name': user_details.get('first_name', ''),
                'last_name': user_details.get('last_name', ''),
                'soul_points': user_details.get('soul_points', 0),
                'limb_points': user_details.get('limb_points', 0),
                'session_score': session_score,
                'total_questions_answered': questions_answered,
                'is_requesting_user': user_id == requesting_user_id
            }
            
            logger.debug(f"Processed player data: {player_data}")
            all_players_data.append(player_data)

        # Final response
        active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
        response = {
            'session_id': active_session_id,
            'session_name': active_session_info.get('name', f'Session {active_session_id}') if active_session_info else "Unknown Session",
            'players': all_players_data,
            'total_players': len(all_players_data),
            'requesting_user_position': next(
                (i+1 for i, p in enumerate(all_players_data) if p['is_requesting_user']),
                len(all_players_data)+1)
        }

        logger.debug(f"Final response data: {response}")
        await sio.emit('all_users_data_updated', response, room=sid)
        logger.info(f"Sent user data for session {active_session_id} to user {requesting_user_id}")

    except Exception as e:
        logger.error(f"Error in handle_user_data_request: {str(e)}", exc_info=True)
        await sio.emit('error', {
            'message': 'Failed to process user data request',
            'details': str(e)
        }, room=sid)








async def get_complete_user_data(user_id: int):
    try:
        user_details = UserRepository.get_user_by_id(user_id)
        if not user_details:
            logger.warning(f"User not found: {user_id}")
            return None
        
        active_session_id = get_active_session_id()
        session_score = 0
        
        if active_session_id:
            session_score = calculate_player_score(active_session_id, user_id)
        
        user_data = {
            'user_id': user_id,
            'username': f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
            'first_name': user_details.get('first_name', ''),
            'last_name': user_details.get('last_name', ''),
            'soul_points': user_details.get('soul_points', 0),
            'limb_points': user_details.get('limb_points', 0),
            'session_score': session_score,
            'total_questions_answered': get_user_questions_answered_count(user_id, active_session_id),
        }
        
        return user_data
        
    except Exception as e:
        logger.error(f"Error retrieving complete user data for user {user_id}: {e}", exc_info=True)
        return None

async def process_answer_submission(user_id: int, question_id: int, answer_index: int):
    try:
        return {
            'success': True,
            'is_correct': True,
            'points_earned': 10,
            'feedback': "Answer submitted successfully!"
        }
        
    except Exception as e:
        logger.error(f"Error processing answer submission: {e}", exc_info=True)
        return {'success': False, 'error': 'Failed to process answer'}

async def process_theme_selection(user_id: int, theme_id: int, theme_name: str):
    try:
        active_session_id = get_active_session_id()
        if not active_session_id:
            return {'success': False, 'error': 'No active session'}
        
        return {
            'success': True,
            'feedback': f"Selected theme: {theme_name}"
        }
        
    except Exception as e:
        logger.error(f"Error processing theme selection: {e}", exc_info=True)
        return {'success': False, 'error': 'Failed to process theme selection'}

def get_user_questions_answered_count(user_id: int, session_id: int):
    try:
        if not session_id:
            return 0
        
        answers = PlayerAnswerRepository.get_all_player_answers_for_user_in_session(session_id, user_id)
        return len(answers) if answers else 0
        
    except Exception as e:
        logger.error(f"Error getting questions answered count for user {user_id}: {e}")
        return 0



































# Fixed API endpoints with proper error handling and validation

from datetime import datetime, timedelta
from fastapi import HTTPException, Depends, Header, Request, status
from typing import Optional
import json

# Helper function to safely convert values
def safe_int_convert(value, default=1):
    """Safely convert a value to integer with a default fallback"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

# Helper function to calculate ban expiry
def calculate_ban_expiry(duration_value: int, duration_unit: str) -> Optional[datetime]:
    """Calculate ban expiry datetime based on duration and unit"""
    if duration_unit == "permanent":
        return None
    
    now = datetime.now()
    if duration_unit == "minutes":
        return now + timedelta(minutes=duration_value)
    elif duration_unit == "hours":
        return now + timedelta(hours=duration_value)
    elif duration_unit == "days":
        return now + timedelta(days=duration_value)
    else:
        raise ValueError(f"Invalid duration unit: {duration_unit}")

# Helper function to get client IP (assuming this exists)
def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

# Helper function to log user IP (assuming this exists)
def log_user_ip_address(user_id: int, ip_address: str):
    """Log user IP address"""
    # Implementation depends on your logging system
    pass

# The verify_user function as provided
def verify_user(user_id: int, rfid_code: str) -> str:
    user = UserRepository.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['rfid_code'] != rfid_code:
        raise HTTPException(status_code=403, detail="Invalid credentials")
    
    role = user['userRoleId']
    
    if role == 1:
        return "user"
    elif role == 2:
        return "moderator"
    elif role == 3:
        return "admin"
    else:
        raise HTTPException(status_code=403, detail="Unknown role")

# Fixed dependency function
async def get_current_user_info(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_rfid: str = Header(None, alias="X-RFID")
):
    if not x_user_id or not x_rfid:
        raise HTTPException(status_code=401, detail="Missing user credentials")
    
    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # Log IP address for authenticated requests
    client_ip = get_client_ip(request)
    log_user_ip_address(user_id, client_ip)
    
    return {
        "id": user_id,
        "role": verify_user(user_id, x_rfid)
    }

def convert_difficulty_to_id(difficulty_string: str) -> int:
    difficulty_mapping = {
        "easy": 1,
        "medium": 2,
        "hard": 3,
        "expert": 4
    }
    # Convert to lowercase for case-insensitive matching
    difficulty_lower = difficulty_string.lower()
    
    if difficulty_lower in difficulty_mapping:
        return difficulty_mapping[difficulty_lower]
    else:
        # Default to medium if unknown difficulty
        return 2

# Fixed create question endpoint - Log first, create second
@app.post("/api/v1/questions")
async def create_question_endpoint(
    question_data: QuestionInput,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins and moderators can create questions
    if role not in ["admin", "moderator"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and moderators can create questions"
        )
    
    # LOG THE ATTEMPT FIRST - NOTHING ELSE
    new_values = {
        "question_text": question_data.question_text,
        "created_by": user_id,
        "role": role,
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        AuditLogRepository.create_audit_log(
            table_name="questions",
            record_id=0,
            action="CREATE",
            old_values=None,
            new_values=json.dumps(new_values),
            changed_by=user_id,
            ip_address=client_ip
        )
    except Exception as audit_error:
        print(f"Audit log creation failed: {audit_error}")
        # Continue execution even if audit logging fails
    
    # NOW CREATE THE QUESTION
    # Moderator questions are inactive by default
    is_active = True if role == "admin" else False
    
    try:
        # Convert IDs to integers with safe conversion
        theme_id = safe_int_convert(question_data.themeId, 1)
        difficulty_id = safe_int_convert(question_data.difficultyLevelId, 1)
        
        # Validate required fields
        if not question_data.question_text or not question_data.question_text.strip():
            raise HTTPException(status_code=400, detail="Question text is required")
        
        if not question_data.answers or len(question_data.answers) == 0:
            raise HTTPException(status_code=400, detail="At least one answer is required")
        
        # Create the question
        question_id = QuestionRepository.create_question(
            question_text=question_data.question_text.strip(),
            themeId=theme_id,
            difficultyLevelId=difficulty_id,
            explanation=question_data.explanation or "",
            Url=question_data.Url or "",
            time_limit=safe_int_convert(question_data.time_limit, 30),
            think_time=safe_int_convert(question_data.think_time, 5),
            points=safe_int_convert(question_data.points, 10),
            is_active=is_active,
            no_answer_correct=bool(question_data.no_answer_correct),
            createdBy=user_id,
            LightMax=safe_int_convert(question_data.LightMax, 100),
            LightMin=safe_int_convert(question_data.LightMin, 0),
            TempMax=safe_int_convert(question_data.TempMax, 30),
            TempMin=safe_int_convert(question_data.TempMin, 10)
        )

        if not question_id:
            raise HTTPException(status_code=500, detail="Failed to create question")
        
        # Create answers
        created_answers = []
        for answer in question_data.answers:
            if not answer.answer_text or not answer.answer_text.strip():
                continue  # Skip empty answers
                
            try:
                answer_id = AnswerRepository.create_answer(
                    question_id=question_id,
                    answer_text=answer.answer_text.strip(),
                    is_correct=bool(answer.is_correct)
                )
                
                if answer_id:
                    created_answers.append(answer_id)
                        
            except Exception as answer_error:
                print(f"Failed to create answer: {answer_error}")
                # Continue with other answers
        
        if len(created_answers) == 0:
            raise HTTPException(status_code=400, detail="No valid answers were created")
        
        return {
            "status": "success",
            "question_id": question_id,
            "answers_created": len(created_answers),
            "is_active": is_active
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Question creation error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create question")


# Fixed update question endpoint - Log first, update second
@app.patch("/api/v1/questions/{question_id}")
async def update_question_endpoint(
    question_id: int,
    question_data: QuestionInput,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins can edit questions
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can edit questions")
    
    # LOG THE UPDATE ATTEMPT FIRST - NOTHING ELSE
    new_values = {
        "question_id": question_id,
        "question_text": question_data.question_text,
        "updated_by": user_id,
        "role": role,
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        AuditLogRepository.create_audit_log(
            table_name="questions",
            record_id=question_id,
            action="UPDATE",
            old_values=None,
            new_values=json.dumps(new_values),
            changed_by=user_id,
            ip_address=client_ip
        )
    except Exception as audit_error:
        print(f"Audit log creation failed: {audit_error}")
        # Continue execution even if audit logging fails
    
    # NOW UPDATE THE QUESTION
    try:
        # Validate question exists
        existing_question = QuestionRepository.get_question_by_id(question_id)
        if not existing_question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Convert difficulty string to integer if needed
        difficulty_id = question_data.difficultyLevelId
        if isinstance(difficulty_id, str):
            difficulty_id = convert_difficulty_to_id(difficulty_id)
        else:
            difficulty_id = safe_int_convert(difficulty_id, 1)
        
        # Convert themeId to integer
        theme_id = safe_int_convert(question_data.themeId, 1)
        
        # Validate required fields
        if not question_data.question_text or not question_data.question_text.strip():
            raise HTTPException(status_code=400, detail="Question text is required")
        
        # Update the question
        update_success = QuestionRepository.update_question(
            question_id=question_id,
            question_text=question_data.question_text.strip(),
            themeId=theme_id,
            difficultyLevelId=difficulty_id,
            explanation=question_data.explanation or "",
            Url=question_data.Url or "",
            time_limit=safe_int_convert(question_data.time_limit, 30),
            think_time=safe_int_convert(question_data.think_time, 5),
            points=safe_int_convert(question_data.points, 10),
            is_active=bool(question_data.is_active),
            no_answer_correct=bool(question_data.no_answer_correct),
            LightMax=safe_int_convert(question_data.LightMax, 100),
            LightMin=safe_int_convert(question_data.LightMin, 0),
            TempMax=safe_int_convert(question_data.TempMax, 30),
            TempMin=safe_int_convert(question_data.TempMin, 10)
        )
        
        if not update_success:
            raise HTTPException(status_code=500, detail="Failed to update question")
        
        # Handle answers: delete all existing answers and create new ones
        created_answers = []
        if question_data.answers:
            try:
                # Delete all existing answers for this question
                delete_success = AnswerRepository.delete_all_answers_for_question(question_id)
                if not delete_success:
                    print(f"Warning: Failed to delete existing answers for question {question_id}")
                
                # Create new answers
                for answer in question_data.answers:
                    if not answer.answer_text or not answer.answer_text.strip():
                        continue  # Skip empty answers
                        
                    try:
                        answer_id = AnswerRepository.create_answer(
                            question_id=question_id,
                            answer_text=answer.answer_text.strip(),
                            is_correct=bool(answer.is_correct)
                        )
                        
                        if answer_id:
                            created_answers.append(answer_id)
                                
                    except Exception as answer_error:
                        print(f"Failed to create answer: {answer_error}")
                        continue
                        
            except Exception as answer_handling_error:
                print(f"Error handling answers: {answer_handling_error}")
                raise HTTPException(status_code=500, detail="Failed to update answers")
        
        return {
            "status": "success",
            "message": "Question updated successfully",
            "question_id": question_id,
            "updated_answers": len(created_answers),
            "is_active": bool(question_data.is_active),
            "role": role,
            "difficulty_id": difficulty_id,
            "theme_id": theme_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update question: {str(e)}")


# Fixed delete question endpoint
@app.delete("/api/v1/questions/{question_id}")
async def delete_question_endpoint(
    question_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins can delete questions
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete questions")
    
    try:
        # Check if question exists
        existing_question = QuestionRepository.get_question_by_id(question_id)
        if not existing_question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # First, delete all associated answers for this question
        try:
            delete_answers_success = AnswerRepository.delete_all_answers_for_question(question_id)
            if not delete_answers_success:
                print(f"Warning: Failed to delete associated answers for question {question_id}")
        except Exception as e:
            print(f"Error deleting answers: {e}")
            # Continue with question deletion even if answer deletion fails
        
        # Then delete the question
        delete_success = QuestionRepository.delete_question(question_id)
        
        if not delete_success:
            raise HTTPException(status_code=500, detail="Failed to delete question")
        
        # Create audit log for question deletion
        new_values = {
            "deleted_by": user_id,
            "question_id": question_id,
            "action": "DELETE",
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            AuditLogRepository.create_audit_log(
                table_name="questions",
                record_id=question_id,
                action="DELETE",
                old_values=None,
                new_values=json.dumps(new_values),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"Delete audit log creation failed: {audit_error}")
        
        return {
            "status": "success",
            "message": "Question deleted successfully",
            "question_id": question_id,
            "role": role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")


# Fixed create theme endpoint - Log first, create second
@app.post("/api/v1/themes")
async def create_theme_endpoint(
    theme_data: ThemeInput,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
   
    if role not in ["admin", "moderator"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and moderators can create themes"
        )
   
    # Moderators can't create active themes by default
    if role == "moderator":
        theme_data.is_active = False
   
    # LOG THE THEME CREATION ATTEMPT FIRST - NOTHING ELSE
    new_values = {
        "name": theme_data.name,
        "description": theme_data.description,
        "is_active": theme_data.is_active,
        "created_by": user_id,
        "role": role,
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        AuditLogRepository.create_audit_log(
            table_name="themes",
            record_id=0,
            action="CREATE",
            old_values=None,
            new_values=json.dumps(new_values),
            changed_by=user_id,
            ip_address=client_ip
        )
    except Exception as audit_error:
        print(f"Audit log creation failed: {audit_error}")
        # Continue execution even if audit logging fails
    
    # NOW CREATE THE THEME
    try:
        # Create the theme without logoUrl
        theme_id = ThemeRepository.create_theme(
            name=theme_data.name,
            description=theme_data.description,
            is_active=theme_data.is_active
        )
       
        if not theme_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create theme - no ID returned"
            )
       
        return {
            "status": "success",
            "theme_id": theme_id,
            "is_active": theme_data.is_active,
            "role": role
        }
       
    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Validation error: {str(ve)}"
        )
    except Exception as e:
        print(f"Error creating theme: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create theme: {str(e)}"
        )


# Fixed delete theme endpoint
@app.delete("/api/v1/themes/{theme_id}")
async def delete_theme_endpoint(
    theme_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins and moderators can delete themes
    if role not in ["admin", "moderator"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins and moderators can delete themes"
        )
    
    try:
        # Check if theme exists
        existing_theme = ThemeRepository.get_theme_by_id(theme_id)
        if not existing_theme:
            raise HTTPException(status_code=404, detail="Theme not found")
        
        # Delete the theme
        delete_success = ThemeRepository.delete_theme(theme_id)
        
        if not delete_success:
            raise HTTPException(status_code=500, detail="Failed to delete theme")
        
        # Create audit log for theme deletion
        new_values = {
            "deleted_by": user_id,
            "theme_id": theme_id,
            "action": "DELETE",
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            AuditLogRepository.create_audit_log(
                table_name="themes",
                record_id=theme_id,
                action="DELETE",
                old_values=None,
                new_values=json.dumps(new_values),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"Theme delete audit log creation failed: {audit_error}")
        
        return {
            "status": "success",
            "message": "Theme deleted successfully",
            "theme_id": theme_id,
            "role": role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting theme: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete theme: {str(e)}")


# Fixed delete user endpoint
@app.delete("/api/v1/users/{user_id}")
async def delete_user_endpoint(
    user_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    current_user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins can delete users
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    # Prevent admin from deleting themselves
    if current_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    try:
        # Check if user exists
        existing_user = UserRepository.get_user_by_id(user_id)
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete the user
        delete_success = UserRepository.delete_user(user_id)
        
        if not delete_success:
            raise HTTPException(status_code=500, detail="Failed to delete user")
        
        # Create audit log for user deletion
        new_values = {
            "deleted_by": current_user_id,
            "user_id": user_id,
            "action": "DELETE",
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            AuditLogRepository.create_audit_log(
                table_name="users",
                record_id=user_id,
                action="DELETE",
                old_values=None,
                new_values=json.dumps(new_values),
                changed_by=current_user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"User delete audit log creation failed: {audit_error}")
        
        return {
            "status": "success",
            "message": "User deleted successfully",
            "user_id": user_id,
            "role": role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")



# Fixed ban IP endpoint
@app.post("/api/v1/ban-ip")
async def ban_ip_address(
    ban_request: BanIpRequest,
    current_user: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_role = current_user["role"]
    user_id = current_user["id"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Check permissions
    if user_role not in ["moderator", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only moderators and admins can ban IP addresses"
        )
    
    # Validate ban duration based on role
    if user_role == "moderator":
        # Moderators can ban up to 1 minute
        if ban_request.ban_duration_unit == "minutes" and ban_request.ban_duration_value > 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Moderators can only ban for up to 1 minute"
            )
        elif ban_request.ban_duration_unit in ["hours", "days", "permanent"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Moderators can only use minutes for ban duration"
            )
    elif user_role == "admin":
        # Admins can ban up to a week (or permanent)
        if ban_request.ban_duration_unit == "days" and ban_request.ban_duration_value > 7:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins can ban for up to 7 days maximum"
            )
        elif ban_request.ban_duration_unit == "hours" and ban_request.ban_duration_value > 168:  # 7 days in hours
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ban duration exceeds 7 day limit"
            )
        elif ban_request.ban_duration_unit == "minutes" and ban_request.ban_duration_value > 10080:  # 7 days in minutes
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ban duration exceeds 7 day limit"
            )
    
    try:
        # Get IP address record
        ip_record = IpAddressRepository.get_ip_address_by_string(ban_request.ip_address)
        if not ip_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IP address {ban_request.ip_address} not found"
            )
        
        # Calculate ban expiry
        try:
            ban_expires_at = calculate_ban_expiry(
                ban_request.ban_duration_value,
                ban_request.ban_duration_unit
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        
        # Update IP address with ban information
        success = IpAddressRepository.update_ip_address(
            ip_id=ip_record['id'],
            is_banned=True,
            ban_reason=ban_request.ban_reason or "No reason provided",
            ban_date=datetime.now(),
            banned_by=user_id,
            ban_expires_at=ban_expires_at
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to ban IP address"
            )
        
        # Create audit log for IP ban
        new_ip_values = {
            "ip_address": ban_request.ip_address,
            "is_banned": True,
            "ban_reason": ban_request.ban_reason or "No reason provided",
            "ban_date": datetime.now().isoformat(),
            "banned_by": user_id,
            "ban_expires_at": ban_expires_at.isoformat() if ban_expires_at else None
        }
        
        try:
            AuditLogRepository.create_audit_log(
                table_name="ip_addresses",
                record_id=ip_record['id'],
                action="BAN",
                old_values=None,
                new_values=json.dumps(new_ip_values),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"IP ban audit log creation failed: {audit_error}")
        
        # Log the ban action
        log_user_ip_address(user_id, client_ip)
        
        return {
            "message": f"IP address {ban_request.ip_address} has been banned successfully",
            "ban_expires_at": ban_expires_at,
            "banned_by": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error banning IP address: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ban IP address: {str(e)}"
        )

















import json

# Fixed FastAPI endpoint
@app.get(
    ENDPOINT + "/audit-logs/",
    summary="Get recent audit logs",
    response_model=List[AuditLogResponse],
    responses={
        200: {"description": "List of audit logs (may be empty)"}
    },
    tags=["Audit Logs"]
)
async def get_recent_audit_logs(limit: int = 15) -> List[AuditLogResponse]:
    """
    Get the most recent audit log entries.
    
    Args:
        limit: Maximum number of logs to return (default: 15)
    
    Returns:
        List of audit log entries with all required fields
    """
    try:
        audit_logs_data = AuditLogRepository.get_recent_audit_logs(limit)
        
        # Check if we got a valid list result
        if not isinstance(audit_logs_data, list):
            print(f"Expected list but got {type(audit_logs_data)}: {audit_logs_data}")
            return []
        
        # Convert to Pydantic models
        audit_logs = []
        for log_data in audit_logs_data:
            try:
                # Parse JSON strings more robustly
                old_values = None
                new_values = None
                
                # Handle old_values
                if log_data.get('old_values'):
                    if isinstance(log_data['old_values'], str):
                        try:
                            # Handle potential double-encoded JSON
                            raw_old = log_data['old_values']
                            if raw_old.startswith('"') and raw_old.endswith('"'):
                                # Remove outer quotes if double-encoded
                                raw_old = raw_old[1:-1].replace('\\"', '"')
                            old_values = json.loads(raw_old)
                        except json.JSONDecodeError as e:
                            print(f"Failed to parse old_values for log {log_data.get('id')}: {e}")
                            print(f"Raw old_values: {repr(log_data['old_values'])}")
                            old_values = None
                    else:
                        old_values = log_data['old_values']
                
                # Handle new_values
                if log_data.get('new_values'):
                    if isinstance(log_data['new_values'], str):
                        try:
                            # Handle potential double-encoded JSON
                            raw_new = log_data['new_values']
                            if raw_new.startswith('"') and raw_new.endswith('"'):
                                # Remove outer quotes if double-encoded
                                raw_new = raw_new[1:-1].replace('\\"', '"')
                            new_values = json.loads(raw_new)
                        except json.JSONDecodeError as e:
                            print(f"Failed to parse new_values for log {log_data.get('id')}: {e}")
                            print(f"Raw new_values: {repr(log_data['new_values'])}")
                            new_values = None
                    else:
                        new_values = log_data['new_values']
                
                # Create AuditLogResponse object
                audit_log = AuditLogResponse(
                    id=log_data['id'],
                    table_name=log_data['table_name'],
                    record_id=str(log_data['record_id']),
                    action=log_data['action'],
                    old_values=old_values,
                    new_values=new_values,
                    changed_by=str(log_data['changed_by']),
                    ip_address=log_data['ip_address']
                )
                audit_logs.append(audit_log)
                
            except Exception as model_error:
                print(f"Error creating AuditLogResponse for log {log_data.get('id')}: {model_error}")
                print(f"Log data: {log_data}")
                continue
        
        print(f"Successfully processed {len(audit_logs)} out of {len(audit_logs_data)} audit logs")
        return audit_logs
        
    except Exception as e:
        print(f"Error retrieving audit logs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving audit logs"
        )
    


# FastAPI Endpoint
@app.get("/api/v1/answers/percentage")
async def get_correct_answers_percentage():
    """
    Returns the percentage of correct answers as an integer.
    """
    try:
        percentage = PlayerAnswerRepository.get_correct_answers_percentage()
        return percentage
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate answers percentage"
        )
    

# FastAPI Endpoint
@app.get("/api/v1/items")
async def get_all_items():
    """
    Returns all active items from the database.
    """
    try:
        items = ItemRepository.get_all_items()
        return {"items": items}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve items"
        )
    














# Add endpoint to get active sessions
@app.get("/api/v1/sessions/active")
async def get_active_sessions():
    """
    Get all currently active quiz sessions.
    """
    try:
        active_sessions = QuizSessionRepository.get_sessions_by_status(2)

        # Check if active_sessions is a list of tuples or dictionaries
        # Let's add a robust check and assume it's most likely dictionaries now given previous fixes
        # Or, if it's still tuples, keep session[0].
        # For safety, let's try to get the first element and check its type.
        
        # This assumes get_sessions_by_status returns at least one session if active sessions exist
        if active_sessions and isinstance(active_sessions[0], dict):
            # If it's a list of dictionaries, access by key
            active_session_ids = [session['sessionId'] for session in active_sessions]
        else:
            # If it's a list of tuples (or empty), access by index 0 (as previously assumed)
            active_session_ids = [session[0] for session in active_sessions]
        
        # Return as a dictionary with a clear key for JSON serialization
        return {"active_session_ids": active_session_ids}
    except Exception as e:
        # For better debugging, log the actual exception and traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to retrieve active sessions due to an unexpected error.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active sessions"
        )


import logging # Import the logging module

# Configure basic logging. This will show INFO messages and above.
# The 'logger.exception()' calls will print a full traceback.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Assume ChatMessageCreate, QuizSessionRepository, ChatLogRepository, and sio are imported and defined

user_last_request_time = {}
RATE_LIMIT_SECONDS = 0.25

@app.post("/api/v1/chat/messages")
async def create_chat_message(request: ChatMessageCreate):
    """
    Create a new chat message in the database and broadcast it via Socket.IO.
    """
    try:
        current_time = time.time()
        user_id = request.user_id

        if user_id in user_last_request_time:
            if current_time - user_last_request_time[user_id] < RATE_LIMIT_SECONDS:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {RATE_LIMIT_SECONDS} second(s) before sending another message."
                )
        user_last_request_time[user_id] = current_time

        logger.info("Starting create_chat_message endpoint.")
        
        active_sessions = QuizSessionRepository.get_sessions_by_status(2)
        active_session_ids = [session[0] for session in active_sessions]
        logger.info(f"Active session IDs: {active_session_ids}")
        
        if request.session_id not in active_session_ids:
            logger.warning(f"Session {request.session_id} not found in active sessions.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is not active or does not exist"
            )

        logger.info("Attempting to create chat message in DB.")
        message_id = ChatLogRepository.create_chat_message(
            session_id=request.session_id,
            message_text=request.message_text,
            user_id=request.user_id,
            message_type=request.message_type,
            reply_to_id=request.reply_to_id
        )
        
        if message_id is None:
            logger.error("Message ID is None after create_chat_message. Database insertion might have failed.")
            raise Exception("Failed to create message: message_id is None")

        logger.info(f"Message created successfully with ID: {message_id}")

        logger.info("Emitting 'message_sent' globally via Socket.IO.")
        await sio.emit('message_sent', {
            'session_id': request.session_id
        })
        
        logger.info("Global Socket.IO emit completed successfully.")

        return {
            "message_id": message_id,
            "status": "sent",
            "broadcast": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unhandled exception in create_chat_message: {e}")
        print(f"Error creating chat message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create chat message"
        )


# Updated endpoint for getting chat messages by session
@app.get("/api/v1/chat/messages/{session_id}")
async def get_chat_messages(session_id: int) -> Dict[str, List[Dict]]:
    try:
        messages = ChatLogRepository.get_chat_messages_by_session(session_id)
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "username": msg.get("username", "Unknown User"),
                "message": msg.get("message", ""),
                "is_flagged": msg.get("is_flagged", False),
                "flagged_by": msg.get("flagged_by"),
                "flagged_reason": msg.get("flagged_reason")
            })
        return {"messages": formatted_messages}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat messages"
        )

# New endpoint to get chat statistics for a session
@app.get("/api/v1/chat/stats/{session_id}")
async def get_chat_stats(session_id: int):
    """
    Get chat statistics for a specific session.
    """
    try:
        # Verify the session is active
        active_sessions = QuizSessionRepository.get_sessions_by_status(2)
        active_session_ids = [session['sessionId'] for session in active_sessions]
        
        if session_id not in active_session_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is not active or does not exist"
            )

        # Call the new get_chat_statistics method from the repository
        stats = ChatLogRepository.get_chat_statistics(session_id)
        
        return {
            "session_id": session_id,
            "stats": stats,
            "is_active": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat statistics"
        )

# Socket.IO event handlers for enhanced chat functionality
@sio.on('join')
async def join_room(sid, room_name):
    await sio.enter_room(sid, room_name)
    print(f"Client {sid} joined room: {room_name}")
    return {'status': 'success'} # Send acknowledgment back to client

@sio.event
async def user_left_quiz(sid, data):
    """
    Handle when a user leaves a quiz session.
    """
    try:
        session_id = data.get('sessionId')
        user_id = data.get('userId')
        username = data.get('username')
        
        if not all([session_id, user_id, username]):
            return False
            
        # Leave the quiz session room
        await sio.leave_room(sid, f'quiz_session_{session_id}')
        await sio.leave_room(sid, 'quiz_general')
        
        # Broadcast that user left
        await sio.emit('user_left_chat', {
            'userId': user_id,
            'username': username,
            'sessionId': session_id,
            'timestamp': datetime.now().isoformat()
        }, room=f'quiz_session_{session_id}')
        
        # Log the leave event
        ChatLogRepository.create_chat_message(
            session_id=session_id,
            message_text=f"{username} left the quiz",
            user_id=user_id,
            message_type="system"
        )
        
        return True
        
    except Exception as e:
        print(f"Error in user_left_quiz: {e}")
        return False

@sio.event
async def disconnect(sid):
    """
    Handle client disconnection.
    """
    print(f"Client {sid} disconnected")

# Additional endpoint to broadcast system messages
@app.post("/api/v1/chat/system-message")
async def send_system_message(session_id: int, message: str, message_type: str = "system"):
    """
    Send a system message to all users in a quiz session.
    """
    try:
        # Verify the session is active
        active_sessions = QuizSessionRepository.get_sessions_by_status(2)
        active_session_ids = [session['sessionId'] for session in active_sessions]
        
        if session_id not in active_session_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session is not active or does not exist"
            )

        # Create system message in database
        message_id = ChatLogRepository.create_chat_message(
            session_id=session_id,
            message_text=message,
            user_id=0,  # System user ID
            message_type=message_type
        )

        # Broadcast the system message
        await sio.emit('new_chat_message', {
            'messageId': message_id,
            'sessionId': session_id,
            'sender': 'System',
            'message': message,
            'userId': 0,
            'messageType': message_type,
            'timestamp': datetime.now().isoformat()
        }, room=f'quiz_session_{session_id}')

        return {
            "message_id": message_id,
            "status": "sent",
            "broadcast": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send system message"
        )

import subprocess
from fastapi import Body,Request




@app.post("/api/shutdown")
async def immediate_shutdown(
    x_user_id: str = Header(..., alias="X-User-ID"),
    x_rfid: str = Header(..., alias="X-RFID")
):
    # Verify admin privileges
    if not verify_user(x_user_id, x_rfid) == "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    # Execute IMMEDIATE shutdown (no delay)
    try:
        subprocess.Popen(["sudo", "poweroff"], 
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)
        return {"message": "System powering off NOW"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shutdown failed: {str(e)}")





























































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




# --- Global Variables and Constants ---
servo = None
temp_sensor = None
light_sensor = None
RPI_COMPONENTS_AVAILABLE = True  # Placeholder
SERVO_IDLE_ANGLE = 90
RFID_DISPLAY_TIME = 3
REFRESH_INTERVAL = 1
servo_command_queue = queue.Queue() # Assuming this is defined elsewhere

# --- RFID Reader Thread ---
def rfid_reader_thread(rfid_sensor, rfid_queue, stop_event):
    """
    This function runs in a dedicated thread to continuously read from the RFID sensor.
    It puts any detected card UIDs into a thread-safe queue.
    
    Args:
        rfid_sensor: The initialized RFID sensor object.
        rfid_queue (queue.Queue): The queue to place scanned UIDs into.
        stop_event (threading.Event): The event to signal when the thread should stop.
    """
    print("RFID reader thread started.")
    while not stop_event.is_set():
        try:
            # This is a blocking call, but it's now in its own thread.
            uid = rfid_sensor.read_card()
            if uid:
                rfid_queue.put(str(uid)) # Add the scanned UID to the queue
        except Exception as e:
            print(f"Error in RFID reader thread: {e}")
            # Avoid rapid-fire error logging on persistent hardware failure
            time.sleep(2)
    print("RFID reader thread finished.")

# --- Main Raspberry Pi Thread ---
def raspberry_pi_main_thread(stop_event, sio, loop):
    global servo, light_sensor, temp_sensor
    if not RPI_COMPONENTS_AVAILABLE:
        print("Skipping Raspberry Pi thread start due to component import errors.")
        return

    # Initialize components
    lcd, rfid, temp_sensor, light_sensor, servo = (None,) * 5
    rfid_thread = None

    try:
        lcd = LCD1602A()
        rfid = HardcoreRFID()
        temp_sensor = TemperatureSensor()
        light_sensor = LightSensor()
        servo = ServoMotor()
        
        # Create a thread-safe queue for RFID data
        rfid_queue = queue.Queue()

        # Create and start the dedicated RFID reader thread
        rfid_thread = Thread(
            target=rfid_reader_thread, 
            args=(rfid, rfid_queue, stop_event),
            daemon=True
        )
        rfid_thread.start()

    except Exception as e:
        print(f"Failed to initialize Raspberry Pi components in thread: {e}")
        print(traceback.format_exc())
        stop_event.set()
        return

    # Initial positions and state
    if servo:
        servo.set_angle(SERVO_IDLE_ANGLE)
    last_refresh = 0
    rfid_display_start = 0
    showing_rfid = False
    
    if lcd:
        lcd.clear()
        ip_address = get_ip_address()
        lcd.write_line(0, ip_address[:16])

    try:
        while not stop_event.is_set():
            current_time = time.time()

            # --- Step 1: Check for new RFID scans from the queue ---
            try:
                # Check the queue for a newly scanned card (non-blocking)
                rfid_code = rfid_queue.get_nowait()
                
                showing_rfid = True
                rfid_display_start = current_time

                # Centralized logic to handle the RFID scan
                if lcd:
                    lcd.clear()
                    lcd.write_line(0, f"RFID:{rfid_code[:16]}")
                
                existing_user = UserRepository.get_user_by_rfid(rfid_code)
                if existing_user:
                    if lcd:
                        name_line = f"{existing_user['first_name']} {existing_user['last_name']}"
                        lcd.write_line(1, name_line[:16])
                else:
                    open_user_data = {
                        'last_name': 'Open', 'first_name': 'Open',
                        'password': 'temp_password_for_open_user', 'rfid_code': rfid_code,
                        'userRoleId': 2, 'soul_points': 4, 'limb_points': 4, 'updated_by': 1
                    }
                    new_user_id = UserRepository.create_user(open_user_data)
                    if lcd:
                        if new_user_id:
                            print(f"Created user ID: {new_user_id}")
                            lcd.write_line(1, "New user created!")
                        else:
                            print("User creation failed!")
                            lcd.write_line(1, "Creation failed!")
            
            except queue.Empty:
                # This is normal; it just means no new card has been scanned.
                pass
            except Exception as e:
                print(f"Error processing RFID from queue: {e}")


            # --- Step 2: Handle Display and Sensor Logic ---
            
            # Reset display after showing RFID info for a few seconds
            if showing_rfid and (current_time - rfid_display_start) >= RFID_DISPLAY_TIME:
                showing_rfid = False
                if lcd:
                    lcd.clear()
                    lcd.write_line(0, ip_address[:16])
                last_refresh = 0 # Force immediate refresh of sensor data

            # Update sensor display if not showing RFID info
            if not showing_rfid and (current_time - last_refresh) >= REFRESH_INTERVAL:
                try:
                    if all((temp_sensor, light_sensor, servo, lcd)):
                        temp = temp_sensor.read_temperature()
                        lux = light_sensor()
                        current_angle = servo.read_degrees()
                        lcd.write_line(1, format_second_row(temp, lux, current_angle)[:16])
                        last_refresh = current_time
                        
                        # Emit sensor data (whether quiz is active or not)
                        sensor_data = {'temperature': temp, 'illuminance': lux, 'servo_angle': current_angle}
                        emit_sensor_data(sensor_data, sio, loop)

                except Exception as e:
                    print(f"Sensor read/display error: {e}")
                    if lcd:
                        lcd.write_line(1, "Sensor Error")
                    last_refresh = current_time

            # --- Step 3: Handle Quiz Session Specific Logic ---
            try:
                active_sessions = QuizSessionRepository.get_sessions_by_status(2)
                if active_sessions:
                    # Logic specific to an active quiz can be placed here
                    # For example, logging sensor data to the quiz session
                    if should_update_quiz_session(current_time):
                        session_id = get_active_session_id()
                        sensor_data = read_sensor_data(temp_sensor, light_sensor, servo)
                        log_quiz_sensor_data(session_id, sensor_data)
                        emit_theme_selection_if_needed(sio, loop)
                else:
                    # Logic for when no quiz is active
                    # This could involve processing servo commands from a queue, etc.
                    pass # Most of the "normal" logic is already handled above

            except Exception as e:
                print(f"Error in quiz session logic block: {e}")

            time.sleep(0.05) # Main loop delay

    except Exception as e:
        print(f"Fatal error in Pi thread: {e}")
        print(traceback.format_exc())
    finally:
        print("Pi thread cleanup initiated.")
        stop_event.set() # Signal all threads to stop
        
        if rfid_thread and rfid_thread.is_alive():
            print("Waiting for RFID thread to finish...")
            rfid_thread.join(timeout=2) # Wait for the thread to terminate

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

# Helper functions to be defined elsewhere
def emit_sensor_data(sensor_data, sio, loop):
    try:
        asyncio.run_coroutine_threadsafe(
            sio.emit('sensor_data', sensor_data),
            loop
        )
    except Exception as e:
        print(f"Error emitting sensor_data from thread: {e}")

servo_lock = Lock()
last_servo_command_time = 0.0 # Stores the Unix timestamp (seconds since epoch) of the last command
SERVO_COOLDOWN_SECONDS = 3.0 # The duration of the cooldown
servo_cooldown_lock = Lock() # A dedicated lock to protect access to last_servo_command_time

@app.post("/api/v1/trigger-servo")
async def trigger_servo(cmd: ServoCommand):
    import json
    global last_servo_command_time
    
    # 1. FIRST - Check for active quiz sessions before doing ANYTHING else
    try:
        active_session_id = get_active_session_id()
        print(f"DEBUG: active_session_id = {active_session_id}")
        
        if active_session_id:
            # Get the full session details using the ID
            active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
            print(f"DEBUG: active_session_info = {active_session_info}")
            
            if active_session_info:
                session_name = active_session_info.get('name', f'Session ID {active_session_id}')
                print(f"DEBUG: session_name = {session_name}")
                
                # Return a normal 200 response with the message
                return {
                    "message": f"Servo test is currently unavailable. The system is busy with an active quiz session (ID: {active_session_id}) named '{session_name}'. Please wait until the quiz session ends before testing the servo."
                }
            else:
                # Session ID exists but we couldn't fetch details
                print(f"DEBUG: Could not fetch session details for ID {active_session_id}")
                
                return {
                    "message": f"Servo test is currently unavailable. The system is busy with an active quiz session (ID: {active_session_id}). Please wait until the quiz session ends before testing the servo."
                }
        else:
            print("DEBUG: No active session found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking active quiz sessions during servo trigger: {e}")
        raise HTTPException(status_code=500, detail="Internal server error checking quiz status.")
    
    # 2. Only check command validity if no active quiz session
    if cmd.command != "SWEEP_SERVO":
        raise HTTPException(status_code=400, detail="Invalid servo command.")
    
    # --- NEW LOGIC: Cooldown Check ---
    with servo_cooldown_lock:
        current_time = time.time()
        if current_time - last_servo_command_time < SERVO_COOLDOWN_SECONDS:
            remaining_cooldown = SERVO_COOLDOWN_SECONDS - (current_time - last_servo_command_time)
            raise HTTPException(
                status_code=429,
                detail=f"Servo is on cooldown. Please wait {remaining_cooldown:.1f} seconds before trying again."
            )
        last_servo_command_time = current_time
    # --- END NEW LOGIC ---
    
    # 3. Acquire the existing lock for queue access
    if not servo_lock.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Servo command queue is temporarily locked by another request.")
    
    try:
        # 4. Attempt to put the command into the queue
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








# Module level variable
last_update_time = 0

def should_update_quiz_session(current_time):
    """Check if we should update based on time threshold."""
    global last_update_time
    if current_time - last_update_time >= 1:
        last_update_time = current_time
        return True
    return False


def read_sensor_data(temp_sensor, light_sensor, servo):
    """Read all sensor values with proper temperature validation."""
    try:
        # Read temperature and validate/clamp the value
        raw_temp = temp_sensor.read_temperature()
        
        # Clamp temperature to reasonable range (-50°C to 100°C)
        # This prevents database truncation errors
        if raw_temp is None or not isinstance(raw_temp, (int, float)):
            temperature = 0.0
        else:
            temperature = max(-50.0, min(100.0, float(raw_temp)))
            # Round to 2 decimal places to avoid precision issues
            temperature = round(temperature, 2)
        
        return {
            'temperature': temperature,
            'illuminance': light_sensor(),
            'servo_angle': servo.read_degrees()
        }
    except Exception as e:
        print(f"Error reading sensor data: {e}")
        # Return safe default values
        return {
            'temperature': 0.0,
            'illuminance': 0,
            'servo_angle': 0
        }

def log_quiz_sensor_data(session_id, sensor_data):
    """Log sensor data to quiz session."""
    try:
        SensorDataRepository.create_sensor_data(
            sessionId=session_id,
            temperature=sensor_data['temperature'],
            lightIntensity=sensor_data['illuminance'],
            servoPosition=sensor_data['servo_angle'],
            timestamp=datetime.now()
        )
    except Exception as e:
        print(f"Error logging sensor data: {e}")

def emit_sensor_data(sensor_data, sio, loop):
    """Emit sensor data via socket.io."""
    try:
        asyncio.run_coroutine_threadsafe(
            sio.emit('sensor_data', sensor_data),
            loop
        )
    except Exception as e:
        print(f"Error emitting sensor_data: {e}")


#item functions
def activateAdvertFlood():
    """Call this function to trigger the 60-second ad flood on all clients"""
    sio.emit('B2F_addItem', {}, broadcast=True)



# sio emits for quiz data

import asyncio































# ---------- Modular Quiz Timer System with Servo Integration ----------
from collections import defaultdict
from threading import Lock, Thread
import random
import time
import asyncio

# Global state management
theme_votes = {}  # Format: {session_id: {"votes": {theme_id: count}, "user_votes": {user_id: theme_id}}}
quiz_sessions = {}  # Format: {session_id: {"phase": "voting/theme_display/quiz", "current_question": None, ...}}
theme_votes_lock = Lock()
timer_lock = Lock()
session_lock = Lock()
active_timers = {}

# Global servo variable (assumed to be initialized elsewhere)
# servo = ServoController()  # This should be initialized in your main application

def get_active_session_id():
    """Get the ID of the first active session."""
    active_sessions = QuizSessionRepository.get_sessions_by_status(2)
    return active_sessions[0][0] if active_sessions else None  # Access first column of first row

def get_winning_theme(session_id):
    """Returns random top theme in case of tie"""
    with theme_votes_lock:
        session_data = theme_votes.get(session_id, {})
        votes = session_data.get("votes", {})
        if not votes:
            return None
        max_votes = max(votes.values())
        top_themes = [theme_id for theme_id, count in votes.items() if count == max_votes]
        return random.choice(top_themes)

def get_session_phase(session_id):
    """Get current phase of a session"""
    with session_lock:
        return quiz_sessions.get(session_id, {}).get('phase', 'voting')

def set_session_phase(session_id, phase):
    """Set current phase of a session"""
    with session_lock:
        if session_id not in quiz_sessions:
            quiz_sessions[session_id] = {}
        quiz_sessions[session_id]['phase'] = phase

def move_servo_smoothly(start_angle, end_angle, duration, reverse=False):
    """
    Move servo smoothly from start_angle to end_angle over duration seconds
    reverse=True means we're going backwards (post-timer)
    """
    try:
        if 'servo' not in globals():
            print("Warning: servo not available")
            return
            
        steps = max(1, duration)  # At least 1 step
        sleep_time = duration / steps
        
        for i in range(steps + 1):
            progress = i / steps
            if reverse:
                # For post-timer, reverse the progress calculation
                progress = 1 - progress
                
            raw_angle = start_angle + (end_angle - start_angle) * progress
            angle = round(raw_angle / 5) * 5  # Round to nearest 5 degrees
            servo.set_angle(angle)
            
            if i < steps:  # Don't sleep after the last step
                time.sleep(sleep_time)
                
    except Exception as e:
        print(f"Servo movement error: {e}")

def emit_timer_update(sio, loop, session_id, time_remaining, phase, total_time, **extra_data):
    """
    Emit both timer_update and quiz_timer events for frontend compatibility
    Also handle servo movement during timer
    """
    try:
        # Calculate servo position (0 degrees at start, 180 degrees at end)
        if total_time > 0:
            progress = (total_time - time_remaining) / total_time
            raw_angle = 0 + (180 - 0) * progress
            angle = round(raw_angle / 5) * 5
            
            if 'servo' in globals():
                servo.set_angle(angle)
        
        # Prepare timer data
        timer_data = {
            'session_id': session_id,
            'time_remaining': time_remaining,
            'phase': phase,
            'total_time': total_time,
            **extra_data
        }
        
        # Emit both events for compatibility
        future1 = asyncio.run_coroutine_threadsafe(
            sio.emit('timer_update', timer_data),
            loop
        )
        future2 = asyncio.run_coroutine_threadsafe(
            sio.emit('quiz_timer', timer_data),
            loop
        )
        
        # Wait for both emissions to complete
        future1.result(timeout=1)
        future2.result(timeout=1)
        
    except Exception as e:
        print(f"Error emitting timer update: {e}")

def emit_timer_finished(sio, loop, session_id, phase, **extra_data):
    """
    Emit timer finished events and handle post-timer servo movement
    """
    try:
        # Post-timer servo movement (180 to 0 degrees, reverse direction)
        thread = Thread(target=move_servo_smoothly, args=(180, 0, 2, True), daemon=True)
        thread.start()
        
        # Prepare finish data
        finish_data = {
            'session_id': session_id,
            'phase': phase,
            **extra_data
        }
        
        # Emit both events for compatibility
        future1 = asyncio.run_coroutine_threadsafe(
            sio.emit('timer_finished', finish_data),
            loop
        )
        future2 = asyncio.run_coroutine_threadsafe(
            sio.emit('quiz_timer_finished', finish_data),
            loop
        )
        
        # Wait for both emissions to complete
        future1.result(timeout=1)
        future2.result(timeout=1)
        
    except Exception as e:
        print(f"Error emitting timer finished: {e}")

def start_generic_timer(sio, loop, session_id, timer_config):
    """
    Generic timer function that handles different phases
    timer_config: {
        'voting_time': 60,
        'theme_display_time': 10,
        'question_time': 10,
        'explanation_time': 5
    }
    """
    with timer_lock:
        if session_id in active_timers:
            return False  # Timer already running
        
        def timer_task():
            try:
                current_phase = get_session_phase(session_id)
                print(f"Starting timer for session {session_id}, phase: {current_phase}")
                
                if current_phase == 'voting':
                    handle_voting_phase(sio, loop, session_id, timer_config.get('voting_time', 60))
                elif current_phase == 'theme_display':
                    handle_theme_display_phase(sio, loop, session_id, timer_config.get('theme_display_time', 10))
                elif current_phase == 'quiz':
                    handle_quiz_phase(sio, loop, session_id, timer_config)
                    
            except Exception as e:
                print(f"Timer error for session {session_id}: {e}")
                traceback.print_exc()
            finally:
                with timer_lock:
                    active_timers.pop(session_id, None)
        
        # Start timer thread
        timer_thread = Thread(target=timer_task, daemon=True)
        active_timers[session_id] = timer_thread
        timer_thread.start()
        return True

def handle_voting_phase(sio, loop, session_id, voting_time):
    """Handle the voting countdown phase"""
    print(f"Starting voting phase for session {session_id}")
    
    # Emit voting phase start
    future = asyncio.run_coroutine_threadsafe(
        sio.emit('phase_started', {
            'session_id': session_id,
            'phase': 'voting',
            'duration': voting_time
        }),
        loop
    )
    future.result(timeout=1)
    
    # Reset servo to start position
    if 'servo' in globals():
        servo.set_angle(0)
    
    # Voting countdown with servo movement
    for current_time in range(voting_time, -1, -1):
        emit_timer_update(sio, loop, session_id, current_time, 'voting', voting_time)
        
        if current_time <= 0:
            break
        time.sleep(1)
    
    # Emit timer finished
    emit_timer_finished(sio, loop, session_id, 'voting')
    
    # Process voting results
    winning_theme = get_winning_theme(session_id)
    print(f"Voting finished for session {session_id}, winning theme: {winning_theme}")
    
    if winning_theme:
        # Update session theme in database immediately
        success = QuizSessionRepository.update_session_theme(session_id, winning_theme)
        print(f"Database update result: {success}")
        
        if success:
            # Move to theme display phase
            set_session_phase(session_id, 'theme_display')
            
            # Get the winning theme data
            winning_theme_data = ThemeRepository.get_theme_by_id(winning_theme)
            winning_theme_name = winning_theme_data['name']

            # Structure the data to exactly match theme_selection format
            combined_data = {
                'id': 'voting_result',
                'question': f'The winning theme is: {winning_theme_name}',
                'type': 'theme_selection',
                'themes': [{
                    'id': winning_theme_data['id'],
                    'name': winning_theme_data['name'],
                    'description': winning_theme_data.get('description', ''),
                    'logoUrl': winning_theme_data.get('logoUrl', None),
                    'is_active': winning_theme_data.get('is_active', 1)
                }],
                'count': 1,
                'active_only': True,  # Assuming we want only active themes
                'timestamp': time.time(),
                'winning_theme': winning_theme,  # Additional voting-specific field
                'session_id': session_id  # Additional voting-specific field
            }

            future = asyncio.run_coroutine_threadsafe(
                sio.emit('questionData', combined_data),
                loop
        )
            future.result(timeout=1)
            
            # Continue to theme display phase immediately
            handle_theme_display_phase(sio, loop, session_id, 10)
        else:
            emit_error(sio, loop, session_id, 'Failed to save theme selection')
    else:
        emit_error(sio, loop, session_id, 'No theme was selected')
    
    # Cleanup votes
    with theme_votes_lock:
        if session_id in theme_votes:
            del theme_votes[session_id]

def handle_theme_display_phase(sio, loop, session_id, display_time):
    """Handle the theme display countdown phase"""
    print(f"Starting theme display phase for session {session_id}")
    
    # Get theme data for display
    session_info = QuizSessionRepository.get_session_by_id(session_id)
    if not session_info or not session_info.get('themeId'):
        emit_error(sio, loop, session_id, 'No theme found for session')
        return
        
    theme_data = ThemeRepository.get_theme_by_id(session_info['themeId'])
    
    # Emit theme display start
    future = asyncio.run_coroutine_threadsafe(
        sio.emit('phase_started', {
            'session_id': session_id,
            'phase': 'theme_display',
            'duration': display_time,
            'theme_data': theme_data
        }),
        loop
    )
    future.result(timeout=1)
    
    # Reset servo to start position
    if 'servo' in globals():
        servo.set_angle(0)
    
    # Theme display countdown with servo movement
    for current_time in range(display_time, -1, -1):
        emit_timer_update(sio, loop, session_id, current_time, 'theme_display', display_time, theme_data=theme_data)
        
        if current_time <= 0:
            break
        time.sleep(1)
    
    # Emit timer finished
    emit_timer_finished(sio, loop, session_id, 'theme_display', theme_data=theme_data)
    
    # Theme display finished - move to quiz phase
    set_session_phase(session_id, 'quiz')
    
    future = asyncio.run_coroutine_threadsafe(
        sio.emit('theme_display_finished', {
            'session_id': session_id,
            'theme_data': theme_data
        }),
        loop
    )
    future.result(timeout=1)
    
    print(f"Theme display finished for session {session_id}, ready for quiz")

def handle_quiz_phase(sio, loop, session_id, timer_config):
    """Handle the quiz questions phase with sensor-based question selection."""
    print(f"Starting quiz phase for session {session_id}")

    # Get session and theme info
    session_info = QuizSessionRepository.get_session_by_id(session_id)
    if not session_info or not session_info.get('themeId'):
        emit_error(sio, loop, session_id, 'No theme found for quiz')
        return

    theme_id = session_info['themeId']
    all_questions = QuestionRepository.get_questions_by_theme(theme_id, active_only=True)

    if not all_questions:
        emit_error(sio, loop, session_id, 'No questions found for this theme')
        return

    # Create a mutable list of available questions to ask
    available_questions = list(all_questions)
    num_questions_to_ask = len(available_questions)
    
    question_time = timer_config.get('question_time', 10)
    explanation_time = timer_config.get('explanation_time', 5)

    for i in range(num_questions_to_ask):
        print(f"\n--- Selecting Question {i+1} of {num_questions_to_ask} ---")
        
        # Use the new function to select the next question
        question = select_question_based_on_sensors(available_questions, temp_sensor, light_sensor)
        
        if not question:
            emit_error(sio, loop, session_id, 'Failed to select a question; ending quiz.')
            break # Exit the loop if no question could be selected

        # Remove the selected question from the available pool to prevent repeats
        available_questions.remove(question)
        
        # --- The rest of the logic remains the same ---

        # Show question
        asyncio.run_coroutine_threadsafe(
            sio.emit('question_started', {
                'session_id': session_id, 'question': question, 'duration': question_time
            }), loop
        ).result(timeout=1)
        
        # Reset servo to start position
        if 'servo' in globals():
            servo.set_angle(0)

        # Question countdown with servo movement
        for current_time in range(question_time, -1, -1):
            emit_timer_update(sio, loop, session_id, current_time, 'question', question_time, question_id=question['id'])
            if current_time <= 0: break
            time.sleep(1)
        
        emit_timer_finished(sio, loop, session_id, 'question', question_id=question['id'])

        # Show explanation
        asyncio.run_coroutine_threadsafe(
            sio.emit('explanation_started', {
                'session_id': session_id, 'question': question, 
                'explanation': question.get('explanation', ''), 'duration': explanation_time
            }), loop
        ).result(timeout=1)

        # Reset servo for explanation
        if 'servo' in globals():
            servo.set_angle(0)

        # Explanation countdown
        for current_time in range(explanation_time, -1, -1):
            emit_timer_update(sio, loop, session_id, current_time, 'explanation', explanation_time, question_id=question['id'])
            if current_time <= 0: break
            time.sleep(1)

        emit_timer_finished(sio, loop, session_id, 'explanation', question_id=question['id'])

    # Quiz finished
    print(f"\n--- Quiz finished for session {session_id} ---")
    session_id = get_active_session_id()
    QuizSessionRepository.update_session_status(session_id,3)
    asyncio.run_coroutine_threadsafe(
        sio.emit('quiz_finished', {'session_id': session_id}), loop
    ).result(timeout=1)

def emit_error(sio, loop, session_id, error_message):
    """Emit error message to clients"""
    future = asyncio.run_coroutine_threadsafe(
        sio.emit('quiz_error', {
            'session_id': session_id,
            'error': error_message
        }),
        loop
    )
    future.result(timeout=1)

def emit_combined_theme_selection(sio, loop, active_only=True):
    """
    Emit theme selection question with theme options via socket.io.
    """
    try:
        if active_only:
            themes = ThemeRepository.get_active_themes()
        else:
            themes = ThemeRepository.get_all_themes()
            
        if not themes:
            error_data = {
                'error': 'not_found',
                'message': 'No themes found',
                'status_code': 404
            }
            try:
                future = asyncio.run_coroutine_threadsafe(
                    sio.emit('theme_selection_error', error_data),
                    loop
                )
            except Exception as e:
                print(f"Failed to schedule 'theme_selection_error' emit: {e}")
        else:
            theme_names = [t.get('name') or t.get('title') for t in themes]
            combined_data = {
                'id': 'theme_selection',
                'question': 'Choose a theme?',
                'type': 'theme_selection',
                'themes': themes,
                'count': len(themes),
                'active_only': active_only,
                'timestamp': time.time()
            }
            try:
                future = asyncio.run_coroutine_threadsafe(
                    sio.emit('questionData', combined_data),
                    loop
                )
            except Exception as e:
                print(f"Failed to schedule 'theme_selection_data' emit: {e}")

    except Exception as e:
        print(f"An unexpected error occurred during emit_combined_theme_selection: {e}")


def check_sensor_data(temp_sensor, light_sensor):
    """Read all sensor values with proper temperature validation."""
    try:
        # Read temperature and validate/clamp the value
        raw_temp = temp_sensor.read_temperature()
        
        # Clamp temperature to reasonable range (-50°C to 100°C)
        # This prevents database truncation errors
        if raw_temp is None or not isinstance(raw_temp, (int, float)):
            temperature = 0.0
        else:
            temperature = max(-50.0, min(100.0, float(raw_temp)))
            # Round to 2 decimal places to avoid precision issues
            temperature = round(temperature, 2)
        
        return {
            'temperature': temperature,
            'illuminance': light_sensor(),
        }
    except Exception as e:
        print(f"Error reading sensor data: {e}")
        # Return safe default values
        return {
            'temperature': 0.0,
            'illuminance': 0,
        }

def emit_combined_question_and_answers(question_id, sio, loop):
    """
    Fetches a question and its answers, combines them into a single structured
    object, and emits it via socket.io on the 'questionData' channel.

    This function replaces the separate emit_question_by_id and 
    emit_answers_for_question functions.
    """
    try:
        # 1. Fetch the primary resource: the question
        question = QuestionRepository.get_question_by_id(question_id)

        # Handle case where the question doesn't exist
        if not question:
            error_data = {
                'error': 'not_found',
                'message': f"Question with ID {question_id} not found",
                'status_code': 404
            }
            # Emit the error and stop execution
            asyncio.run_coroutine_threadsafe(
                sio.emit('question_error', error_data), loop
            )
            return

        # 2. Fetch the related resources: the answers for that question
        answers = AnswerRepository.get_all_answers_for_question(question_id)

        # 3. Combine all data into a single, consistent payload
        combined_data = {
            'id': question.get('id'),
            'question': question.get('question_text'),
            'type': question.get('type', 'multiple_choice'), # Provide a default type
            'answers': answers, # Nest the answers within the payload
            'count': len(answers),
            'timestamp': time.time()
        }

        # 4. Emit the unified data on a single, predictable channel
        asyncio.run_coroutine_threadsafe(
            sio.emit('questionData', combined_data), loop
        )

    except Exception as e:
        # Catch any other unexpected errors during the process
        print(f"An unexpected error occurred during emit_combined_question_and_answers: {e}")
        error_data = {
            'error': 'server_error',
            'message': 'An internal error occurred while preparing the question.',
            'status_code': 500
        }
        asyncio.run_coroutine_threadsafe(
            sio.emit('question_error', error_data), loop
        )

def emit_theme_selection_if_needed(sio, loop):
    global light_sensor
    global temp_sensor
    """
    Emit theme selection only if active session has no theme - called every second in main loop
    This is the main coordination function called from your main loop
    """
    try:
        active_session_id = get_active_session_id()
        
        if active_session_id:
            # Get the full session details using the ID
            active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
            
            if not active_session_info.get('themeId'):
                # No theme set - check if we should start voting or emit theme selection
                current_phase = get_session_phase(active_session_id)
                is_timer_running = is_timer_active(active_session_id)
                
                if current_phase == 'voting' and not is_timer_running:
                    # Voting phase but no timer running - emit theme selection to allow voting
                    emit_combined_theme_selection(sio, loop)
                elif current_phase not in ['voting', 'theme_display', 'quiz']:
                    # No phase set - initialize voting phase and emit theme selection
                    set_session_phase(active_session_id, 'voting')
                    emit_combined_theme_selection(sio, loop)
            else:
                # Theme is already set - check if we need to transition phases
                current_phase = get_session_phase(active_session_id)
                is_timer_running = is_timer_active(active_session_id)
                
                if current_phase == 'voting' and not is_timer_running:
                    # Theme exists but we're stuck in voting phase - move to theme display
                    set_session_phase(active_session_id, 'theme_display')
                    timer_config = {
                        'voting_time': 60,
                        'theme_display_time': 10,
                        'question_time': 10,
                        'explanation_time': 5
                    }
                    start_generic_timer(sio, loop, active_session_id, timer_config)
                elif current_phase == 'theme_display' and not is_timer_running:
                    # Theme display finished but stuck - move to quiz
                    set_session_phase(active_session_id, 'quiz')
                    timer_config = {
                        'voting_time': 60,
                        'theme_display_time': 10,
                        'question_time': 10,
                        'explanation_time': 5
                    }
                    start_generic_timer(sio, loop, active_session_id, timer_config)

                
                elif current_phase == 'quiz':
                    sensor_data = check_sensor_data(temp_sensor, light_sensor) #{'temperature': 31.69, 'illuminance': 18.57282502443793}


                elif not current_phase or (current_phase not in ['voting', 'theme_display', 'quiz'] and not is_timer_running):
                    # No phase set but theme exists - start theme display
                    set_session_phase(active_session_id, 'quiz')
                    
    except Exception as e:
        print(f"Error checking theme selection: {e}")

# ---------- Socket Handler ----------
@sio.on('theme_selected')
async def handle_theme_selection(sid, data):
    """
    Handle theme selection votes and start voting timer when first vote is cast
    """
    try:
        # Get active session and check phase
        active_session_id = get_active_session_id()
        
        if not active_session_id:
            await sio.emit('answer_response', {
                'success': False,
                'error': 'No active session found'
            })
            return
        
        # Check if we're in voting phase
        current_phase = get_session_phase(active_session_id)
        if current_phase != 'voting':
            await sio.emit('answer_response', {
                'success': False,
                'error': f'Cannot vote during {current_phase} phase'
            })
            return
            
        # Get the full session details using the ID
        active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
        
        if not active_session_info:
            await sio.emit('answer_response', {
                'success': False,
                'error': 'Session not found'
            })
            return
            
        # Check if theme is already set
        if active_session_info.get('themeId'):
            await sio.emit('answer_response', {
                'success': False,
                'error': 'Theme already selected for this session'
            })
            return
        
        user_id = data.get('userId', 1)
        theme_id = int(data['themeId'])
        session_id = active_session_id
        
        with theme_votes_lock:
            # Initialize session structure
            if session_id not in theme_votes:
                theme_votes[session_id] = {
                    "votes": defaultdict(int),
                    "user_votes": {}
                }
            
            session_data = theme_votes[session_id]
            votes = session_data["votes"]
            user_votes = session_data["user_votes"]
            
            # Remove previous vote
            if user_id in user_votes:
                old_theme = user_votes[user_id]
                votes[old_theme] -= 1
                if votes[old_theme] <= 0:
                    del votes[old_theme]
            
            # Add new vote
            votes[theme_id] += 1
            user_votes[user_id] = theme_id
        
        # Broadcast vote updates
        await sio.emit('theme_votes_update', {
            'session_id': session_id,
            'votes': dict(votes)
        })
        
        # Start timer on first vote
        total_votes = sum(votes.values())
        if total_votes == 1:
            print(f"Starting voting timer for session {session_id}")
            timer_config = {
                'voting_time': 60,
                'theme_display_time': 10,
                'question_time': 10,
                'explanation_time': 5
            }
            set_session_phase(session_id, 'voting')
            start_generic_timer(sio, asyncio.get_event_loop(), session_id, timer_config)
        
        await sio.emit('answer_response', {'success': True})
        
    except Exception as e:
        print(f"Error in handle_theme_selection: {e}")
        traceback.print_exc()
        await sio.emit('answer_response', {
            'success': False,
            'error': 'Vote failed: ' + str(e)
        })

# ---------- Manual Timer Control (for testing/debugging) ----------
@sio.on('start_timer_manually')
async def handle_manual_timer_start(sid, data):
    """
    Manual timer start for testing purposes
    """
    try:
        session_id = data.get('session_id')
        phase = data.get('phase', 'voting')
        
        if not session_id:
            session_id = get_active_session_id()
            
        if not session_id:
            await sio.emit('timer_error', {'error': 'No active session found'})
            return
            
        timer_config = {
            'voting_time': data.get('voting_time', 60),
            'theme_display_time': data.get('theme_display_time', 10),
            'question_time': data.get('question_time', 10),
            'explanation_time': data.get('explanation_time', 5)
        }
        
        set_session_phase(session_id, phase)
        success = start_generic_timer(sio, asyncio.get_event_loop(), session_id, timer_config)
        
        await sio.emit('timer_start_response', {
            'success': success,
            'session_id': session_id,
            'phase': phase
        })
        
    except Exception as e:
        print(f"Error in manual timer start: {e}")
        await sio.emit('timer_error', {'error': str(e)})

# ---------- Utility Functions ----------
def stop_timer(session_id):
    """Manually stop a timer if needed"""
    with timer_lock:
        if session_id in active_timers:
            active_timers.pop(session_id, None)
            # Reset servo to 0 position when stopping timer
            if 'servo' in globals():
                servo.set_angle(0)
            
def get_session_votes(session_id):
    """Get current vote counts for a session"""
    with theme_votes_lock:
        session_data = theme_votes.get(session_id, {})
        return dict(session_data.get("votes", {}))

def clear_session_votes(session_id):
    """Clear votes for a specific session"""
    with theme_votes_lock:
        if session_id in theme_votes:
            del theme_votes[session_id]

def is_timer_active(session_id):
    """Check if a timer is currently running for a session"""
    with timer_lock:
        return session_id in active_timers

def get_timer_status():
    """Get status of all active timers"""
    with timer_lock:
        return list(active_timers.keys())

# ---------- Frontend Events Reference ----------
"""
Frontend will receive these events:

Core Timer Events:
1. 'quiz_timer' - Regular countdown updates (what your frontend expects)
   Data: {session_id, time_remaining, phase, total_time, [extra_data]}

2. 'quiz_timer_finished' - When timer ends (what your frontend expects)
   Data: {session_id, phase, [extra_data]}

Legacy/Compatibility Events:
3. 'timer_update' - Also emitted for backward compatibility
4. 'timer_finished' - Also emitted for backward compatibility

Phase Events:
5. 'phase_started' - When any phase begins
   Data: {session_id, phase: 'voting'/'theme_display'/'quiz', duration, [theme_data]}

6. 'voting_finished' - When voting ends
   Data: {session_id, winning_theme, theme_data}

7. 'theme_display_finished' - When theme display ends
   Data: {session_id, theme_data}

8. 'question_started' - When a new question appears
   Data: {session_id, question, duration}

9. 'explanation_started' - When explanation shows
   Data: {session_id, question, explanation, duration}

10. 'quiz_finished' - When all questions are done
    Data: {session_id}

Error Events:
11. 'quiz_error' - When something goes wrong
    Data: {session_id, error}

Vote Events:
12. 'theme_votes_update' - Vote count updates
    Data: {session_id, votes}

Manual Control Events (for testing):
13. 'timer_start_response' - Response to manual timer start
14. 'timer_error' - Timer-related errors
"""

@sio.on('answer_submitted')
async def handle_answer_submission(sid, data):
    try:
        user_id = data.get('userId')
        question_id = data.get('questionId')
        answer_index = data.get('answerIndex')
        request_user_data = data.get('request_user_data', False)
        
        if not all([user_id, question_id is not None, answer_index is not None]):
            await sio.emit('answer_response', {
                'success': False,
                'error': 'Missing required data for answer submission'
            }, room=sid)
            return
        
        result = await process_answer_submission(user_id, question_id, answer_index)
        
        response_data = {
            'success': result.get('success', False),
            'feedback': result.get('feedback'),
            'points_earned': result.get('points_earned', 0)
        }
        
        if request_user_data and result.get('success'):
            await handle_user_data_request(sid, {'user_id': user_id})
        
        await sio.emit('answer_response', response_data, room=sid)
        
        logger.info(f"Processed answer submission for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error handling answer submission: {e}", exc_info=True)
        await sio.emit('answer_response', {
            'success': False,
            'error': 'An error occurred while processing your answer'
        }, room=sid)

def select_question_based_on_sensors(available_questions, temp_sensor, light_sensor):
    """
    Selects a question based on sensor data with fallback mechanisms.

    Args:
        available_questions (list): A list of question dictionaries to choose from.
        temp_sensor: The temperature sensor object.
        light_sensor: The light sensor object.

    Returns:
        dict: The selected question dictionary, or None if no question could be selected.
    """
    if not available_questions:
        return None

    sensor_data = check_sensor_data(temp_sensor, light_sensor)
    current_temp = sensor_data['temperature']
    current_lux = sensor_data['illuminance']
    print(f"Selecting question with sensor data: Temp={current_temp}°C, Lux={current_lux}")

    # --- Attempt 1: Targeted selection based on sensors (50 tries) ---
    for _ in range(50):
        question = random.choice(available_questions)
        
        # Get sensor ranges from question, with safe defaults if keys are missing
        min_temp = question.get('min_temp', -float('inf'))
        max_temp = question.get('max_temp', float('inf'))
        min_lux = question.get('min_lux', -float('inf'))
        max_lux = question.get('max_lux', float('inf'))

        # Check if current sensor values are within the question's defined range
        temp_match = (min_temp is None or current_temp >= min_temp) and \
                     (max_temp is None or current_temp <= max_temp)
        lux_match = (min_lux is None or current_lux >= min_lux) and \
                    (max_lux is None or current_lux <= max_lux)

        if temp_match and lux_match:
            print(f"Found matching question (ID: {question['id']}) on targeted attempt.")
            return question

    # --- Attempt 2: Fallback to any random question (50 more tries) ---
    print("No ideal sensor-matched question found after 50 tries. Selecting any random question.")
    for _ in range(50):
        question = random.choice(available_questions)
        if question:
            print(f"Selected fallback random question (ID: {question['id']}).")
            return question

    # --- Failure Condition ---
    print("Could not select a question after 100 total attempts. Stopping quiz.")
    return None






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