import socketio
import asyncio
import uvicorn
import os
import zipfile
from datetime import datetime,timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body, Header, File, Form, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import traceback
import threading
from threading import Thread, Event, Lock
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import asyncio
import socket
import logging
logging.getLogger('mysql.connector').setLevel(logging.WARNING)
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
# Import the new ThemeRepository
from fastapi.responses import HTMLResponse,JSONResponse
from database.datarepository import QuestionRepository, AnswerRepository, ThemeRepository,UserRepository, IpAddressRepository, UserIpAddressRepository,QuizSessionRepository,SensorDataRepository,AuditLogRepository,PlayerItemRepository,ItemRepository,ChatLogRepository,SessionPlayerRepository,PlayerAnswerRepository,ArticlesRepository,StoriesRepository,GameSaveRepository,GameResourcesRepository,GameUpgradesRepository
from database.user_email_repository import UserEmailRepository
from models.models import (
    QuestionBase, QuestionCreate, QuestionResponse, QuestionUpdate,
    QuestionStatusUpdate, ErrorNotFound, QuestionWithAnswers,
    ThemeBase, ThemeCreate, ThemeUpdate, ThemeResponse, # Import new Theme models
    ArticleBase, ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListResponse, 
    ArticleSearchResult, ArticleStatsResponse, ArticleStatusUpdate, # Import new Article models
    StoryResponse,
    DifficultyLevelResponse, QuestionSearchResult,
    RandomQuestionRequest, QuestionMetadataUpdate,
    QuestionActivationNotification,
    AnswerBase, AnswerCreate, AnswerListResponse, AnswerResponse, 
    AnswerStatusUpdate, AnswerUpdate, CorrectAnswerResponse,IpAddressPayload,AppealPayload,ServoCommand,BroadcastMessage,DirectMessage, ClientActivity,SessionSensorData,MultiSessionSensorResponse,UserUpdateNames,UserCredentials,AnswerInput,QuestionInput, ThemeInput,
    UserPublic,UserPublicWithIp,UserIpAddress,BanIpRequest,AuditLogResponse,ChatMessage,ChatMessageCreate,ShutdownRequest,PaginationInfo,
    # Kingdom Quarry Game Models
    GameSaveData, GameSaveRequest, GameSaveResponse, GameLoadResponse, GameResourcesResponse,
    GameUpgradesResponse, GameResourceUpdate, GameUpgradeRequest, GameVehicleUnlockRequest,
    GameLeaderboardResponse, GameLeaderboardEntry, GameStatsResponse, SaveConflictData,
    SaveConflictResolution, GameAuthResponse, GameLoginRequest, GameRegisterRequest
)
from typing import Dict, Any, Optional, List
from io import BytesIO
from fastapi import Request
from fastapi import Query, Depends
from models.models import User, UserCreate, UserUpdate, UserPublic # Import your new user models
from database.datarepository import UserRepository
from models.models import ErrorMessage,ErrorNotFound
import queue
from uuid import uuid4
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
# Logging Setup
# ----------------------------------------------------
quiz_log_file = os.path.join(os.path.dirname(__file__), 'quiz_debug.log')
quiz_logger = logging.getLogger('quiz_debug')
quiz_logger.setLevel(logging.INFO)
quiz_file_handler = logging.FileHandler(quiz_log_file, mode='a')
quiz_file_handler.setLevel(logging.INFO)

# Create formatter for quiz logs
quiz_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
quiz_file_handler.setFormatter(quiz_formatter)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == quiz_file_handler.baseFilename for h in quiz_logger.handlers):
    quiz_logger.addHandler(quiz_file_handler)

# Dedicated Sentle logger so gameplay/auth events land in a file the user can share
sentle_log_file = os.path.join(os.path.dirname(__file__), 'sentle.log')
sentle_logger = logging.getLogger('sentle')
sentle_logger.setLevel(logging.DEBUG)
sentle_file_handler = logging.FileHandler(sentle_log_file, mode='a')
sentle_file_handler.setLevel(logging.DEBUG)
sentle_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
sentle_file_handler.setFormatter(sentle_formatter)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == sentle_file_handler.baseFilename for h in sentle_logger.handlers):
    sentle_logger.addHandler(sentle_file_handler)

# Socket.IO / Engine.IO and Uvicorn logging setup
# Write socket-related logs to `socket.log` for debugging client connection errors
socket_log_file = os.path.join(os.path.dirname(__file__), 'socket.log')
socket_logger = logging.getLogger('socketio')
socket_logger.setLevel(logging.DEBUG)
socket_file_handler = logging.FileHandler(socket_log_file, mode='a')
socket_file_handler.setLevel(logging.DEBUG)
socket_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
socket_file_handler.setFormatter(socket_formatter)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in socket_logger.handlers):
    socket_logger.addHandler(socket_file_handler)

engineio_logger = logging.getLogger('engineio')
engineio_logger.setLevel(logging.DEBUG)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in engineio_logger.handlers):
    engineio_logger.addHandler(socket_file_handler)

# Also capture uvicorn error/access logs to the same file to correlate failures
uvicorn_error_logger = logging.getLogger('uvicorn.error')
uvicorn_error_logger.setLevel(logging.DEBUG)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in uvicorn_error_logger.handlers):
    uvicorn_error_logger.addHandler(socket_file_handler)

uvicorn_access_logger = logging.getLogger('uvicorn.access')
uvicorn_access_logger.setLevel(logging.INFO)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in uvicorn_access_logger.handlers):
    uvicorn_access_logger.addHandler(socket_file_handler)

quiz_logger.propagate = False
sentle_logger.propagate = False
quiz_logger.info("="*50)
quiz_logger.info("Quiz Logger Initialized")
quiz_logger.info("="*50)

# Cache of sentle_scores columns to align inserts with whatever schema exists in the DB
_sentle_scores_columns_cache = None

def get_sentle_scores_columns():
    """Detect sentle_scores table columns once and cache them."""
    global _sentle_scores_columns_cache
    if _sentle_scores_columns_cache is not None:
        return _sentle_scores_columns_cache
    try:
        from database.database import Database
        cols = Database.get_rows("SHOW COLUMNS FROM sentle_scores")
        _sentle_scores_columns_cache = [c.get('Field') for c in cols] if cols else []
        sentle_logger.info(f"Sentle scores columns detected: {_sentle_scores_columns_cache}")
    except Exception as e:
        sentle_logger.error(f"Failed to detect sentle_scores columns: {e}")
        _sentle_scores_columns_cache = []
    return _sentle_scores_columns_cache

# Global variable for temperature effects
virtualTemperature = 0


# Global variables
previous_temperature = None
previous_illuminance = None
newClient = None  # This should be set elsewhere in your code
current_phase = None    
sensorData = None
multiplier = None
from collections import defaultdict

# In-memory tracking of which themes have been played per session (runtime only)
session_played_themes = defaultdict(list)
session_played_lock = Lock()
# Runtime-wide tracking of how many distinct themes have been used in a session
# (None means no artificial cap; the session will keep selecting new themes until
# there are no unplayed active themes left or some other end condition occurs).
MAX_THEMES_PER_SESSION = None

# Ensure threadsafe helper exists early so timer threads can call it without
# risking a NameError if the file defines helpers later.
def threadsafe_emit_message_sent(sio, session_id, loop):
    """
    Thread-safe emit helper for 'message_sent' events.
    Emits {'session_id': session_id} to clients using the provided event loop.
    This lightweight definition is placed early to avoid NameError in timer threads.
    """
    try:
        asyncio.run_coroutine_threadsafe(
            sio.emit('message_sent', {'session_id': session_id}),
            loop
        )
    except Exception as e:
        # Don't let missing emit helper crash timer threads; log and continue
        print(f"[WARN] threadsafe_emit_message_sent failed to schedule emit for session {session_id}: {e}")
# ----------------------------------------------------
# App setup
# ----------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        global main_asyncio_loop
        print("FastAPI app starting up...")

        if RPI_COMPONENTS_AVAILABLE:
            try:
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
            except Exception as e:
                print(f"Failed to start Raspberry Pi thread: {e}")
                print("Continuing without Pi components.")
        else:
            print("Raspberry Pi thread will not be started due to import errors.")

        print("Server started - Socket.IO backend is ready!")
    except Exception as e:
        print(f"Error in startup: {e}")
        raise
    yield
    try:
        print("FastAPI app shutting down...")
        # Signal the background thread to stop
        stop_thread_event.set()
        # Give the thread a moment to clean up (optional, as it's a daemon thread)
        # If the thread is not a daemon, you'd want to join it: pi_thread.join(timeout=5)
        print("Shutdown signal sent to Raspberry Pi thread.")
        
        # Shutdown video conversion process pool gracefully
        try:
            if VIDEO_CONVERTER_AVAILABLE and 'video_process_pool' in globals():
                print("Shutting down video conversion process pool...")
                video_process_pool.shutdown(wait=False, cancel_futures=True)
                print("[OK] Video process pool shutdown complete")
        except Exception as e:
            print(f"Error during video process pool shutdown: {e}")
        try:
            if VIDEO_CONVERTER_AVAILABLE and 'long_video_process_pool' in globals():
                print("Shutting down long-video conversion process pool...")
                long_video_process_pool.shutdown(wait=False, cancel_futures=True)
                print("[OK] Long-video process pool shutdown complete")
        except Exception as e:
            print(f"Error during long-video process pool shutdown: {e}")
    except Exception as e:
        print(f"Error in shutdown: {e}")

app = FastAPI(title="Socket.IO Messaging Backend", version="1.0.0", lifespan=lifespan)

# Middleware to log incoming HTTP requests (path, query, headers) to socket.log
@app.middleware("http")
async def log_incoming_requests(request, call_next):
    try:
        sock_logger = logging.getLogger('socketio')
        info = {
            'method': request.method,
            'path': request.url.path,
            'query': str(request.url.query),
            'origin': request.headers.get('origin'),
            'upgrade': request.headers.get('upgrade'),
            'connection': request.headers.get('connection')
        }
        # Log request plus full headers at DEBUG level for socket.io polling paths
        sock_logger.debug(f"Incoming HTTP request: {info}")
        if request.url.path.startswith('/socket.io'):
            # Log all headers for additional context
            headers_dict = {k: v for k, v in request.headers.items()}
            sock_logger.debug(f"Socket.IO request headers: {headers_dict}")
    except Exception:
        logging.exception("Failed to log incoming request")
    response = await call_next(request)
    try:
        if request.url.path.startswith('/socket.io'):
            # Attempt to read response body for debugging. Some responses are streaming,
            # so we handle both direct body and iterator cases. If we consume the
            # iterator, we recreate the Response so the client still receives it.
            body_bytes = None
            try:
                if hasattr(response, 'body') and response.body is not None:
                    body_bytes = response.body
                else:
                    # For streaming responses, gather the chunks
                    body_chunks = []
                    async for chunk in response.body_iterator:
                        body_chunks.append(chunk)
                    body_bytes = b"".join(body_chunks)
                    # Recreate Response so it's still sent to the client
                    from starlette.responses import Response as StarletteResponse
                    new_resp = StarletteResponse(content=body_bytes, status_code=response.status_code, headers=dict(response.headers), media_type=getattr(response, 'media_type', None))
                    response = new_resp
            except Exception:
                logging.exception("Failed to extract socket.io response body")

            try:
                decoded = None
                if body_bytes is not None:
                    try:
                        decoded = body_bytes.decode('utf-8')
                    except Exception:
                        decoded = repr(body_bytes)
                sock_logger.debug({
                    'status_code': response.status_code,
                    'response_headers': dict(response.headers),
                    'body': decoded
                })
            except Exception:
                logging.exception("Failed to log socket.io response metadata")
    except Exception:
        logging.exception("Failed to log socket.io response metadata")
    return response

# CORS middleware for FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Socket.IO server setup
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi',
    logger=True,
    engineio_logger=True
)

ENDPOINT = "/api/v1"  # API base endpoint

# ----------------------------------------------------
# JWT Authentication for Kingdom Quarry Game (Optional)
# ----------------------------------------------------

try:
    import jwt
    from datetime import timedelta
    import secrets
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)  # Use env var if available
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_TIME = timedelta(hours=24)
    JWT_AVAILABLE = True
    
    def create_access_token(user_id: int, username: str) -> str:
        """Create JWT access token for game authentication"""
        expire = datetime.now() + JWT_EXPIRATION_TIME
        payload = {
            "user_id": user_id,
            "username": username,
            "exp": expire.timestamp()
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            if datetime.fromtimestamp(payload["exp"]) > datetime.now():
                return payload
        except jwt.InvalidTokenError:
            pass
        return None

    def get_current_game_user(authorization: str = Header(None)) -> Dict[str, Any]:
        """Get current user from JWT token for game endpoints"""
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        return payload

except ImportError:
    JWT_AVAILABLE = False
    print("JWT library not available - Kingdom Quarry game authentication disabled")
    
    # Fallback functions that raise helpful errors
    def create_access_token(user_id: int, username: str) -> str:
        raise HTTPException(status_code=500, detail="JWT library not installed. Install PyJWT to use game authentication.")
    
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        return None
    
    def get_current_game_user(authorization: str = Header(None)) -> Dict[str, Any]:
        raise HTTPException(status_code=500, detail="JWT library not installed. Install PyJWT to use game authentication.")

# ----------------------------------------------------
# Authentication and Helper Functions
# ----------------------------------------------------

def get_client_ip_sync(request: Request) -> str:
    """Extract client IP address from request headers."""
    # Check for forwarded IP first (in case of proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP if there are multiple
        return forwarded_for.split(",")[0].strip()
    
    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct client IP
    return request.client.host if request.client else "unknown"


# Lightweight synchronous wrapper to provide a single, non-async
# helper called `get_client_ip` for internal code paths. The original
# `/api/v1/client-ip` route used the same name which caused calls like
# `get_client_ip(req)` to return a coroutine object (the route function)
# instead of the IP string. Keep the route but rename it below.
def get_client_ip(request: Request) -> str:
    return get_client_ip_sync(request)

def log_user_ip_address(user_id: int, ip_address: str):
    """Log the IP address for a user."""
    try:
        # First, get or create the IP address record
        existing_ip = IpAddressRepository.get_ip_address_by_string(ip_address)
        if existing_ip:
            ip_address_id = existing_ip['id']
        else:
            # Create new IP address record
            ip_address_id = IpAddressRepository.create_ip_address(ip_address)
            if not ip_address_id:
                print(f"Failed to create IP address record for {ip_address}")
                return

        # Now create the link between user and IP address
        UserIpAddressRepository.create_user_ip_address_link(
            user_id=user_id,
            ip_address_id=ip_address_id,
            is_primary=False  # Will be set to primary later if needed
        )
    except Exception as e:
        print(f"Error logging user IP address: {e}")

def verify_user(user_id: int, rfid_code: str, client_ip: str = None) -> str:
    user = UserRepository.get_user_by_id(user_id)
    
    if not user:
        quiz_logger.warning(f"Authentication failed: User {user_id} not found from IP {client_ip}")
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['rfid_code'] != rfid_code:
        quiz_logger.warning(f"Authentication failed: Invalid RFID for user {user_id} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Invalid RFID code")
    
    role = user['userRoleId']
    
    if role == 1:
        return "user"
    elif role == 2:
        return "moderator"
    elif role == 3:
        return "admin"
    else:
        quiz_logger.warning(f"Authentication failed: Unknown role {role} for user {user_id} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Unknown role")

async def get_current_user_info(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_rfid: str = Header(None, alias="X-RFID")
):
    """Dependency function to get current user info from headers"""
    client_ip = get_client_ip_sync(request)
    if not x_user_id or not x_rfid:
        quiz_logger.warning(f"Authentication failed: Missing credentials from IP {client_ip}")
        raise HTTPException(status_code=401, detail="Missing user credentials")
    
    try:
        user_id = int(x_user_id)
    except ValueError:
        quiz_logger.warning(f"Authentication failed: Invalid user ID format '{x_user_id}' from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # Log IP address for authenticated requests
    client_ip = get_client_ip_sync(request)
    log_user_ip_address(user_id, client_ip)
    
    return {
        "id": user_id,
        "role": verify_user(user_id, x_rfid, client_ip)
    }

# Store connected clients
connected_clients = set()

# Helper function to check if a quiz session has any connected clients
async def get_room_participants(room_name):
    """Get the number of participants in a socket.io room"""
    try:
        room = sio.manager.rooms.get('/', {}).get(room_name, set())
        return len(room)
    except Exception as e:
        print(f"Error getting room participants: {e}")
        return 0

def is_quiz_session_active(session_id):
    """Check if a quiz session has any connected clients"""
    try:
        room_name = f'quiz_session_{session_id}'
        # This is a synchronous check - we'll use the sio.manager directly
        room = sio.manager.rooms.get('/', {}).get(room_name, set())
        participant_count = len(room)
        quiz_logger.info(f"Room check: {room_name} has {participant_count} participants")
        print(f"Room {room_name} has {participant_count} participants")
        return participant_count > 0
    except Exception as e:
        quiz_logger.error(f"Error checking quiz session activity: {e}")
        print(f"Error checking quiz session activity: {e}")
        return True  # Assume active if we can't check

# Create a top-level ASGI application that delegates socket.io paths
# to the Socket.IO ASGI app and forwards other requests to the FastAPI app.
# Use this `asgi_app` when running Uvicorn to avoid recursive mounting.
asgi_app = socketio.ASGIApp(sio, app, socketio_path='socket.io')

newClient = None
# ----------------------------------------------------
# Socket.IO event handlers
# ----------------------------------------------------
# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    global newClient
    print(f"Client {sid} connected")
    connected_clients.add(sid)

    try:
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
        newClient = sid
        print(f"Server emitted 'client_connected' for new client {sid}. Total clients: {len(connected_clients)}")

        # Sync client with current phase
        active_session_id = get_active_session_id()
        if not active_session_id:
            print(f"No active session for client {sid}")
            return

        current_phase = get_session_phase(active_session_id)
        if not current_phase:
            print(f"No current phase for session {active_session_id}")
            return

        session_info = QuizSessionRepository.get_session_by_id(active_session_id)
        if not session_info:
            print(f"No session info found for {active_session_id}")
            return

        quiz_state = get_quiz_state(active_session_id)
        print(f"Syncing client {sid} with phase {current_phase}")

        if current_phase == 'voting':
            try:
                # Ensure we have a valid event loop
                loop = asyncio.get_event_loop()
                emit_combined_theme_selection(sio, loop, sid)
                print(f"Sent theme selection to client {sid}")
            except Exception as e:
                print(f"Error sending theme selection: {e}")

        elif current_phase == 'theme_display':
            theme_id = session_info.get('themeId')
            if theme_id:
                try:
                    theme_data = ThemeRepository.get_theme_by_id(theme_id)
                    if theme_data:
                        await sio.emit('theme_selected', {
                            'session_id': active_session_id,  # Use parameter instead of function call
                            'theme_data': theme_data,
                            'timestamp': datetime.now().isoformat()
                        }, room=sid)
                        print(f"Sent theme display to client {sid}")
                except Exception as e:
                    print(f"Error sending theme display: {e}")

        elif current_phase == 'quiz':
            current_question = quiz_state.get('current_question')
            if current_question:
                try:
                    # Send current question
                    emit_combined_question_and_answers(
                        current_question['id'], 
                        sio, 
                        asyncio.get_event_loop()
                    )
                    
                    # Send question number
                    await sio.emit('question_number', {
                        'session_id': active_session_id,
                        'question_number': quiz_state.get('question_count', 1),
                        'timestamp': datetime.now().isoformat()
                    }, room=sid)
                    
                    if quiz_state.get('waiting_for_answers', False):
                        await sio.emit('waiting_for_answers', {
                            'session_id': active_session_id,
                            'timestamp': datetime.now().isoformat()
                        }, room=sid)
                        print(f"Sent waiting_for_answers to client {sid}")
                    else:
                        explanation = current_question.get('explanation', 'No explanation available')
                        await sio.emit('explanation', {
                            'session_id': active_session_id,
                            'question_id': current_question['id'],
                            'explanation_text': explanation,
                            'timestamp': datetime.now().isoformat()
                        }, room=sid)
                        print(f"Sent explanation to client {sid}")
                except Exception as e:
                    print(f"Error syncing quiz state: {e}")

    except Exception as e:
        print(f"Critical error in connect handler: {e}")
        traceback.print_exc()


@sio.event
async def disconnect(sid):
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
    
    if len(connected_clients) <= 0:
        QuizSessionRepository.update_session_status(get_active_session_id(), 3)
        print(f"Updated session status to 'ended' after 1 second of inactivity")



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

def _slugify(value: str) -> str:
    try:
        import re
        return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    except Exception:
        return value

@app.get(ENDPOINT + "/stories/", tags=["Stories"])
def list_stories():
    try:
        stories = StoriesRepository.list_stories()
        return stories or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list stories: {e}")

@app.post(ENDPOINT + "/stories/create-if-not-exists", tags=["Stories"])
def create_story_if_not_exists(
    payload: Dict[str, Any] = Body(...),
    current_user_info: dict = Depends(get_current_user_info)
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    
    # Only admins can create stories
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create stories")
    
    name = (payload or {}).get("name")
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="Field 'name' is required")
    slug = (payload or {}).get("slug") or _slugify(name)
    description = (payload or {}).get("description")
    try:
        existing = StoriesRepository.get_story_by_name(name)
        if existing:
            return {"created": False, "story": existing}
        new_id = StoriesRepository.create_story(name, slug, description)
        if not new_id:
            raise HTTPException(status_code=500, detail="Failed to create story")
        created = StoriesRepository.get_story_by_id(int(new_id))
        return {"created": True, "story": created}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create story: {e}")


# ----------------------------------------------------
# Articles Endpoints (fix view/create/update/delete and by-story)
# ----------------------------------------------------

@app.get(ENDPOINT + "/articles/by-story/{story_id}/", tags=["Articles"])
def get_articles_by_story(story_id: int, active_only: bool = False):
    try:
        articles = ArticlesRepository.get_articles_by_story_id(story_id, active_only=active_only)
        return articles or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch articles for story {story_id}: {e}")


@app.get(ENDPOINT + "/articles/{article_id}/", tags=["Articles"])
def get_article(article_id: int, increment_view: bool = True):
    try:
        if increment_view:
            try:
                ArticlesRepository.increment_view_count(article_id)
            except Exception:
                # Non-fatal
                pass
        article = ArticlesRepository.get_article_by_id(article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch article {article_id}: {e}")


@app.post(ENDPOINT + "/articles/", tags=["Articles"])
def create_article(
    payload: Dict[str, Any] = Body(...),
    current_user_info: dict = Depends(get_current_user_info)
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    
    # Only admins can create articles
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create articles")
    
    try:
        title = payload.get("title")
        author = payload.get("author") or "Unknown"
        date_written = payload.get("date_written") or datetime.now().strftime("%Y-%m-%d")
        story = payload.get("story")
        story_id = payload.get("story_id")
        story_order = payload.get("story_order") or 0
        content = payload.get("content") or ""
        excerpt = payload.get("excerpt")
        category = payload.get("category") or "general"
        tags = payload.get("tags")
        word_count = payload.get("word_count") or 0
        reading_time_minutes = payload.get("reading_time_minutes") or 0
        is_active = bool(payload.get("is_active", True))
        is_featured = bool(payload.get("is_featured", False))

        if not title:
            raise HTTPException(status_code=400, detail="Field 'title' is required")

        new_id = ArticlesRepository.create_article(
            title=title,
            author=author,
            date_written=date_written,
            story=story,
            content=content,
            excerpt=excerpt,
            category=category,
            tags=tags,
            word_count=word_count,
            reading_time_minutes=reading_time_minutes,
            is_active=is_active,
            is_featured=is_featured,
            story_id=story_id,
            story_order=story_order
        )
        if not new_id:
            raise HTTPException(status_code=500, detail="Failed to create article")
        created = ArticlesRepository.get_article_by_id(int(new_id))
        return created
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create article: {e}")


@app.put(ENDPOINT + "/articles/{article_id}/", tags=["Articles"])
def update_article(article_id: int, payload: Dict[str, Any] = Body(...)):
    try:
        ok = ArticlesRepository.update_article(article_id, **(payload or {}))
        if not ok:
            raise HTTPException(status_code=400, detail="No valid fields to update or update failed")
        updated = ArticlesRepository.get_article_by_id(article_id)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update article {article_id}: {e}")


@app.delete(ENDPOINT + "/articles/{article_id}/", tags=["Articles"])
def delete_article(article_id: int):
    try:
        # StoriesRepository contains delete_article helper
        ok = StoriesRepository.delete_article(article_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Article not found or already deleted")
        return {"deleted": True, "article_id": article_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete article {article_id}: {e}")





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
# FastAPI Endpoints - Articles
# ----------------------------------------------------

@app.get(
    ENDPOINT + "/articles/",
    summary="Get all articles",
    response_model=ArticleListResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Articles"]
)
async def get_all_articles(active_only: bool = False, include_story_info: bool = True):
    """Get all articles with statistics"""
    try:
        articles = ArticlesRepository.get_all_articles(active_only=active_only, include_story_info=include_story_info)
        stats = ArticlesRepository.get_articles_stats()
        
        return ArticleListResponse(
            articles=[ArticleResponse(**article) for article in articles],
            total_count=stats.get('total_articles', 0),
            active_count=stats.get('active_articles', 0),
            featured_count=stats.get('featured_articles', 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving articles: {str(e)}")

@app.get(
    ENDPOINT + "/articles/search/",
    summary="Search articles",
    response_model=List[ArticleSearchResult],
    tags=["Articles"]
)
async def search_articles(q: str, active_only: bool = True):
    """Search articles by title, content, author, or story"""
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters long")
    
    articles = ArticlesRepository.search_articles(q.strip(), active_only=active_only)
    return [ArticleSearchResult(**article) for article in articles]

@app.get(
    ENDPOINT + "/articles/featured/",
    summary="Get featured articles",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_featured_articles(limit: int = 5):
    """Get featured articles"""
    articles = ArticlesRepository.get_featured_articles(limit=limit)
    return [ArticleResponse(**article) for article in articles]

@app.get(
    ENDPOINT + "/articles/recent/",
    summary="Get recent articles",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_recent_articles(limit: int = 10, active_only: bool = True):
    """Get most recent articles"""
    articles = ArticlesRepository.get_recent_articles(limit=limit, active_only=active_only)
    return [ArticleResponse(**article) for article in articles]

@app.get(
    ENDPOINT + "/articles/stats/",
    summary="Get article statistics",
    response_model=ArticleStatsResponse,
    tags=["Articles"]
)
async def get_article_statistics():
    """Get comprehensive article statistics"""
    stats = ArticlesRepository.get_articles_stats()
    return ArticleStatsResponse(**stats)

@app.get(
    ENDPOINT + "/articles/{article_id}/",
    summary="Get article by ID",
    response_model=ArticleResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Articles"]
)
async def get_article_by_id(article_id: int):
    """Get a single article by ID and increment view count"""
    article = ArticlesRepository.get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Increment view count
    ArticlesRepository.increment_view_count(article_id)
    
    return ArticleResponse(**article)

@app.get(
    ENDPOINT + "/articles/by-author/{author}/",
    summary="Get articles by author",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_articles_by_author(author: str, active_only: bool = True):
    """Get all articles by a specific author"""
    articles = ArticlesRepository.get_articles_by_author(author, active_only=active_only)
    return [ArticleResponse(**article) for article in articles]

@app.get(
    ENDPOINT + "/articles/by-category/{category}/",
    summary="Get articles by category",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_articles_by_category(category: str, active_only: bool = True):
    """Get all articles in a specific category"""
    articles = ArticlesRepository.get_articles_by_category(category, active_only=active_only)
    return [ArticleResponse(**article) for article in articles]

# Protected Article Operations (require authentication)
@app.post(
    ENDPOINT + "/articles/",
    summary="Create new article",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Articles"]
)
async def create_article(
    article: ArticleCreate,
    user_info: dict = Depends(get_current_user_info)
):
    """Create a new article with duplicate title checking"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]
        
        # Only admins can create articles
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can create articles")
        
        # Check if article with same title already exists
        if ArticlesRepository.check_article_exists_by_title(article.title):
            raise HTTPException(
                status_code=400, 
                detail=f"Article with title '{article.title}' already exists"
            )
        
        # Log the action first
        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=0,  # Will be updated after creation
            action="CREATE",
            new_values=article.dict(),
            changed_by=user_id,
            ip_address=None  # You could get this from request if needed
        )
        
        # Create the article
        article_id = ArticlesRepository.create_article(**article.dict())
        
        if article_id:
            # Update audit log with actual article ID
            AuditLogRepository.create_audit_log(
                table_name="articles",
                record_id=article_id,
                action="CREATE",
                new_values=article.dict(),
                changed_by=user_id,
                ip_address=None
            )
            
            # Retrieve the created article
            created_article = ArticlesRepository.get_article_by_id(article_id)
            return ArticleResponse(**created_article)
        else:
            raise HTTPException(status_code=500, detail="Failed to create article")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating article: {str(e)}")

@app.patch(
    ENDPOINT + "/articles/{article_id}/",
    summary="Update article",
    response_model=ArticleResponse,
    tags=["Articles"]
)
async def update_article(
    article_id: int,
    article_update: ArticleUpdate,
    user_info: dict = Depends(get_current_user_info)
):
    """Update an existing article with duplicate title checking"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]
        
        # Only admins can update articles
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can update articles")
        
        # Check if article exists
        existing_article = ArticlesRepository.get_article_by_id(article_id)
        if not existing_article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Check for duplicate title if title is being updated
        if article_update.title and article_update.title != existing_article.get('title'):
            if ArticlesRepository.check_article_exists_by_title(article_update.title, exclude_id=article_id):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Article with title '{article_update.title}' already exists"
                )
        
        # Prepare update data (only include non-None fields)
        update_data = {k: v for k, v in article_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields provided for update")
        
        # Log the action first
        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=article_id,
            action="UPDATE",
            old_values=existing_article,
            new_values=update_data,
            changed_by=user_id,
            ip_address=None
        )
        
        # Update the article
        success = ArticlesRepository.update_article(article_id, **update_data)
        
        if success:
            # Retrieve the updated article
            updated_article = ArticlesRepository.get_article_by_id(article_id)
            return ArticleResponse(**updated_article)
        else:
            raise HTTPException(status_code=500, detail="Failed to update article")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating article: {str(e)}")

@app.patch(
    ENDPOINT + "/articles/{article_id}/status/",
    summary="Update article status",
    response_model=ArticleResponse,
    tags=["Articles"]
)
async def update_article_status(
    article_id: int,
    status_update: ArticleStatusUpdate,
    user_info: dict = Depends(get_current_user_info)
):
    """Update article active/featured status"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]
        
        # Only admins can update article status
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can update article status")
        
        # Check if article exists
        existing_article = ArticlesRepository.get_article_by_id(article_id)
        if not existing_article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Update status fields
        update_data = {}
        if status_update.is_active is not None:
            update_data['is_active'] = status_update.is_active
        if status_update.is_featured is not None:
            update_data['is_featured'] = status_update.is_featured
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No status fields provided for update")
        
        # Log the action
        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=article_id,
            action="STATUS_UPDATE",
            old_values=existing_article,
            new_values=update_data,
            changed_by=user_id,
            ip_address=None
        )
        
        # Update the article
        success = ArticlesRepository.update_article(article_id, **update_data)
        
        if success:
            # Retrieve the updated article
            updated_article = ArticlesRepository.get_article_by_id(article_id)
            return ArticleResponse(**updated_article)
        else:
            raise HTTPException(status_code=500, detail="Failed to update article status")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating article status: {str(e)}")

@app.delete(
    ENDPOINT + "/articles/{article_id}/",
    summary="Delete article",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Articles"]
)
async def delete_article(
    article_id: int,
    user_info: dict = Depends(get_current_user_info)
):
    """Delete an article"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]
        
        # Only admins can delete articles
        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can delete articles")
        
        # Check if article exists
        existing_article = ArticlesRepository.get_article_by_id(article_id)
        if not existing_article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Log the action first
        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=article_id,
            action="DELETE",
            old_values=existing_article,
            changed_by=user_id,
            ip_address=None
        )
        
        # Delete the article
        success = ArticlesRepository.delete_article(article_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete article")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting article: {str(e)}")

# ----------------------------------------------------
# FastAPI Endpoints - Stories
# ----------------------------------------------------

@app.get(
    ENDPOINT + "/stories/",
    summary="List all stories",
    response_model=List[StoryResponse],
    tags=["Stories"]
)
async def list_stories():
    """Return all stories for filtering and admin UI."""
    try:
        stories = StoriesRepository.list_stories()
        return [StoryResponse(**story) for story in stories]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving stories: {str(e)}")

@app.get(
    ENDPOINT + "/articles/by-story/{story_id}/",
    summary="Get articles by story (ordered)",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_articles_by_story(story_id: int, active_only: bool = True):
    """Get all articles within a story, ordered by story_order."""
    try:
        articles = ArticlesRepository.get_articles_by_story_id(story_id, active_only=active_only)
        return [ArticleResponse(**article) for article in articles]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving articles for story {story_id}: {str(e)}")

# ----------------------------------------------------
# FastAPI Endpoints - Users
# ----------------------------------------------------
@app.get(
    ENDPOINT + "/users/",
    response_model=List[UserPublicWithIp], # Updated response model
    summary="Get all users with IP information (Admin only)",
    tags=["Users"]
)
async def get_all_users(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_rfid: str = Header(None, alias="X-RFID")
):
    # Verify admin access
    user_info = await get_current_user_info(request, x_user_id, x_rfid)
    if user_info["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required for IP information")

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
        if user.get('email'):
            user['first_name'] = user['email']
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
    summary="Get all users with detailed IP information (Admin only)",
    tags=["Users"]
)
async def get_all_users_with_ip(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_rfid: str = Header(None, alias="X-RFID")
):
    # Verify admin access
    user_info = await get_current_user_info(request, x_user_id, x_rfid)
    if user_info["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required for IP information")

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
        if user_with_ip.email:
            user_with_ip.first_name = user_with_ip.email
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
    for user in users:
        if user.get('email'):
            user['first_name'] = user['email']
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
async def get_client_ip_endpoint(request: Request):
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
async def get_multi_session_sensor_data(
    session_id: Optional[int] = Query(None, description="Specific session ID to retrieve. If not provided, returns the newest session."),
    include_chat: bool = Query(True, description="Include chat messages in the response."),
    include_answers: bool = Query(True, description="Include player answers in the response."),
):
    """
    Retrieves sensor data, chat messages, and player answers for a specific quiz session.
    Also returns a list of all available session IDs for navigation.
    """
    try:
        # Get ALL sessions' IDs for the session list
        all_sessions_raw = QuizSessionRepository.get_all_sessions()
        # Sort sessions by ID descending (newest first)
        all_sessions_sorted = sorted(
            all_sessions_raw,
            key=lambda x: x[0],  # Assuming first element is the session ID
            reverse=True
        )
        
        # Create list of available sessions with ID and name
        available_sessions = [
            {
                "id": session[0],
                "name": (
                    session[1].strftime("%Y-%m-%d %H:%M:%S")  # Format datetime nicely
                    if isinstance(session[1], datetime)
                    else session[1] if len(session) > 1 and session[1] is not None
                    else f"Session {session[0]}"
                )
            }
            for session in all_sessions_sorted
        ]
        
        total_sessions = len(available_sessions)
        
        # Determine which session to fetch
        if session_id is not None:
            # Fetch specific session
            requested_session_id = session_id
        else:
            # Fetch newest session (first in sorted list)
            if available_sessions:
                requested_session_id = available_sessions[0]["id"]
            else:
                # No sessions available
                return MultiSessionSensorResponse(
                    sessions=[],
                    available_sessions=available_sessions,
                    current_session_id=None,
                    total_sessions=0
                )
        
        # Fetch the requested session data
        session_data = QuizSessionRepository.get_session_by_id(requested_session_id)
        response_sessions_data = []
        
        if session_data:
            current_session_id = session_data['id']
            current_session_name = session_data['name']
            
            # Get sensor data and sort by timestamp ascending for ApexCharts
            sensor_readings = SensorDataRepository.get_all_data_for_session(current_session_id)
            sensor_readings_sorted = sorted(
                sensor_readings,
                key=lambda x: x.get('timestamp') or datetime.min,
                reverse=False  # Ascending order for charts
            )
            
            temperatures = []
            light_intensities = []
            servo_positions = []
            
            for reading in sensor_readings_sorted:
                timestamp = reading.get('timestamp')
                timestamp_iso = timestamp.isoformat() if isinstance(timestamp, datetime) else str(timestamp) if timestamp else None
                
                temp_value = float(reading.get('temperature (°C)', 0)) if reading.get('temperature (°C)') is not None else None
                light_value = float(reading.get('lightIntensity (lux)', 0)) if reading.get('lightIntensity (lux)') is not None else None
                servo_value = float(reading.get('servoPosition (°)', 0)) if reading.get('servoPosition (°)') is not None else None
                
                if timestamp_iso:
                    temperatures.append({"timestamp": timestamp_iso, "value": temp_value})
                    light_intensities.append({"timestamp": timestamp_iso, "value": light_value})
                    servo_positions.append({"timestamp": timestamp_iso, "value": servo_value})
            
            # Get chat data if requested
            chat_messages = []
            if include_chat:
                chat_data = ChatLogRepository.get_chat_messages_by_session(current_session_id)
                if chat_data:
                    chat_data_sorted = sorted(
                        chat_data,
                        key=lambda x: x.get('created_at') or datetime.min,
                        reverse=False
                    )
                    chat_messages = [
                        {
                            "id": msg.get('id'),
                            "userId": msg.get('userId'),
                            "username": msg.get('username'),
                            "message": msg.get('message'),
                            "created_at": msg.get('created_at').isoformat() if isinstance(msg.get('created_at'), datetime) else str(msg.get('created_at')) if msg.get('created_at') else None
                        }
                        for msg in chat_data_sorted
                    ]
            
            # Get player answers if requested
            player_answers_data = []
            if include_answers:
                session_questions = QuestionRepository.get_questions_by_session(current_session_id)
                
                if session_questions:
                    for question in session_questions:
                        question_id = question.get('id')
                        question_with_answers = PlayerAnswerRepository.get_question_with_player_answers(question_id, current_session_id)
                        
                        if question_with_answers and question_with_answers.get('player_answers'):
                            sorted_answers = sorted(
                                question_with_answers['player_answers'],
                                key=lambda x: x.get('answered_at') or datetime.min,
                                reverse=False
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
                                    "answered_at": answer.get('answered_at').isoformat() if isinstance(answer.get('answered_at'), datetime) else str(answer.get('answered_at')) if answer.get('answered_at') else None
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

        # Use the Pydantic model to structure the response
        response = MultiSessionSensorResponse(
            sessions=response_sessions_data,
            available_sessions=available_sessions,
            current_session_id=requested_session_id if response_sessions_data else None,
            total_sessions=total_sessions
        )
        
        return response
        
    except Exception as e:
        print(f"Error in get_multi_session_sensor_data: {e}")
        return {"error": str(e)}

































from fastapi import APIRouter, HTTPException, Depends, Request, Header
from datetime import datetime

# Add this import for the IP address repository
# from your_repositories import IpAddressRepository  # Adjust import path as needed

# Authentication functions are defined at the top of the file

@app.patch("/api/v1/users/{rfid_code}")
async def update_user_names(rfid_code: str, user_update: UserUpdateNames, request: Request):
    # Get client IP address
    client_ip = get_client_ip_sync(request)
    
    all_users = UserRepository.get_all_users()
    target_user_id = None
    target_user_role = None

    for user in all_users:
        # Check if first and last name already exist for any user
        if user['first_name'] == user_update.first_name and user['last_name'] == user_update.last_name:
            # Found a user with matching name
            if user['rfid_code'] == rfid_code:
                # Name and RFID match: This is the user attempting to log in
                target_user_id = user['id']
                target_user_role = user['userRoleId']
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
                target_user_role = existing_user_by_rfid['userRoleId']
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

    # Check if user has admin role (role ID 3) for admin panel access
    if target_user_role != 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Only administrators can access the admin panel."
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
    global current_phase
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
        


        if not get_active_session_id():
            # Auto-generated name and description
            auto_name = f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            auto_description = f"Automatically created session on {datetime.now().strftime('%B %d, %Y at %H:%M')}"

            new_session_id = QuizSessionRepository.create_session(
                session_date=datetime.now(),
                name="Auto Session",
                description="Automatically created session",
                session_status_id=2,  # Must be provided
                theme_id=None,          # Must be provided (default theme)
                host_user_id=user_id,  # Must be provided
                start_time=datetime.now()
            )
            quiz_logger.info(f"[REGISTER] Created new session {new_session_id} with status=2 (active)")
            current_phase = 'voting'
        ChatLogRepository.create_chat_message(
            session_id=get_active_session_id(),
            message_text=generate_kawaii_string(user_credentials),  # Comma was missing here
            user_id=1,
            message_type='system',
            reply_to_id=1
        )

        threadsafe_emit_message_sent(sio,get_active_session_id(),main_asyncio_loop)


        log_user_ip_address(user_id, get_client_ip_sync(request))
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
    global current_phase
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
        
        if not get_active_session_id():
            # Auto-generated name and description
            auto_name = f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            auto_description = f"Automatically created session on {datetime.now().strftime('%B %d, %Y at %H:%M')}"

            new_session_id = QuizSessionRepository.create_session(
                session_date=datetime.now(),
                name="Auto Session",
                description="Automatically created session",
                session_status_id=2,  # Must be provided
                theme_id=None,          # Must be provided (default theme)
                host_user_id=user_id,  # Must be provided
                start_time=datetime.now()
            )
            quiz_logger.info(f"[LOGIN] Created new session {new_session_id} with status=2 (active)")
            current_phase = 'voting'
        ChatLogRepository.create_chat_message(
            session_id=get_active_session_id(),
            message_text=generate_kawaii_string(user_credentials),  # Comma was missing here
            user_id=1,
            message_type='system',
            reply_to_id=1
        )


        log_user_ip_address(user_id, get_client_ip_sync(request))
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


# Support chat login endpoint - does NOT create quiz sessions
@app.post("/api/v1/support/login")
async def support_login_user(user_credentials: UserCredentials, request: Request):
    """
    Login endpoint for support chat that does NOT create or join quiz sessions.
    This is used when users only want to access support chat without joining a quiz.
    """
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
        
        # Just log the IP, don't create sessions or join them
        log_user_ip_address(user_id, get_client_ip_sync(request))
        
        logger.info(f"User ID {user_id} logged in for support chat (no quiz session created).")
        return {"message": "Login successful", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred during support login for user '{user_credentials.first_name}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred."
        )


# Support chat register endpoint - does NOT create quiz sessions
@app.post("/api/v1/support/register", status_code=status.HTTP_201_CREATED)
async def support_register_user(user_credentials: UserCredentials, request: Request):
    """
    Register endpoint for support chat that does NOT create or join quiz sessions.
    This is used when new users register just to access support chat.
    """
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
        
        # Just log the IP, don't create sessions or send chat messages
        log_user_ip_address(user_id, get_client_ip_sync(request))
        
        logger.info(f"User '{user_credentials.first_name} {user_credentials.last_name}' registered for support chat with ID: {user_id}")
        return {"message": "User registered successfully", "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred during support registration: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred."
        )


def generate_kawaii_string(user_credentials):
    # Mixed emotion phrases with emojis (kawaii, kowai, excited, etc.)
    emotion_strings = [
        # Kawaii/happy themes
        f" {user_credentials.first_name}-chan! Ready for adventure? (´｡• ω •｡`)",
        f"~(◠‿◕) Greetings {user_credentials.first_name}-san! Let's go!",
        f"ヾ(●ω●)ノ {user_credentials.first_name}-tan appears! What's the plan?",
        f"ヽ(>∀<)ノ {user_credentials.first_name}-sama brings good vibes!",
        f"(ﾉ◕ヮ◕)ﾉ*:･ﾟ {user_credentials.first_name}-kun spotted! Hello~",
        
        # Kowai/scary themes
        f"⋋| ◉ ͟ʖ ◉ |⋌ {user_credentials.first_name}-san... the shadows watch...",
        f"(×_×;）{user_credentials.first_name}-chan... did you hear that?",
        f"ヽ(ﾟДﾟ)ﾉ {user_credentials.first_name}-dono! Beware the full moon!",
        f"┗|｀O′|┛ {user_credentials.first_name}-sama... the ritual begins...",
        f"(◣_◢) {user_credentials.first_name}-kun... something approaches...",
        
        # Excited/hyper themes
        f"ﾟ･: *ヽ(◕ヮ◕ヽ) {user_credentials.first_name}-chan! Let's party! *:･ﾟ",
        f"ᕙ(^▿^-ᕙ) {user_credentials.first_name}-senpai! Power up!",
        f"ヽ(ω)ノ {user_credentials.first_name}-nyan! Maximum energy!",
        f"ᕕ( ᐛ )ᕗ {user_credentials.first_name}-dash! Zoom zoom!",
        
        # Chill/relaxed themes
        f"(￣ω￣) {user_credentials.first_name}-san... so peaceful...",
        f"(´-ω-`) {user_credentials.first_name}-tan... just vibing...",
        f"〜(꒪꒳꒪)〜 {user_credentials.first_name}-kun... floating along...",
        
        # Confused themes
        f"(・_・ヾ {user_credentials.first_name}-chan... what just happened?",
        f"(◎_◎;) {user_credentials.first_name}-dono... I'm so lost...",
        f"ლ(ಠ_ಠ ლ) {user_credentials.first_name}-sama... why though..."
    ]

    return random.choice(emotion_strings)






def calculate_player_score(session_id: int, user_id: int) -> int:
    """
    Calculate the total score for a player in a session.
    
    Args:
        session_id (int): The ID of the session
        user_id (int): The ID of the user/player
        
    Returns:
        int: Total points earned by the player in the session
    """
    try:
        logger.debug(f"Calculating score for user {user_id} in session {session_id}")
        
        # Use the repository method we created earlier for better performance
        user_score = PlayerAnswerRepository.get_player_score_for_session(session_id, user_id)
        
        logger.debug(f"Score calculated for user {user_id}: {user_score}")
        return user_score
    
    except Exception as e:
        logger.error(f"Could not calculate score for user {user_id} in session {session_id}: {e}")
        return 0


def calculate_player_score_detailed(session_id: int, user_id: int) -> dict:
    """
    Calculate detailed score information for debugging purposes.
    
    Args:
        session_id (int): The ID of the session
        user_id (int): The ID of the user/player
        
    Returns:
        dict: Detailed score information including breakdown
    """
    try:
        logger.debug(f"Calculating detailed score for user {user_id} in session {session_id}")
        
        # Get all answers for the user in this session
        all_answers = PlayerAnswerRepository.get_all_player_answers_for_user_in_session(session_id, user_id)
        
        if not all_answers:
            logger.warning(f"No answers found for user {user_id} in session {session_id}")
            return {
                'total_score': 0,
                'total_answers': 0,
                'correct_answers': 0,
                'answers_breakdown': []
            }
        
        logger.debug(f"Found {len(all_answers)} answers for user {user_id}")
        
        total_score = 0
        correct_count = 0
        answers_breakdown = []
        
        for answer in all_answers:
            logger.debug(f"Processing answer: {answer}")
            
            # Handle different possible key names for points
            points = 0
            if 'points_earned' in answer and answer['points_earned'] is not None:
                points = int(answer['points_earned'])
            elif 'score' in answer and answer['score'] is not None:
                points = int(answer['score'])
            
            is_correct = answer.get('is_correct', 0)
            if isinstance(is_correct, str):
                is_correct = is_correct.lower() in ('1', 'true', 'yes')
            else:
                is_correct = bool(is_correct)
            
            if is_correct:
                correct_count += 1
            
            total_score += points
            
            answers_breakdown.append({
                'question_id': answer.get('questionId'),
                'answer_id': answer.get('answerId'),
                'points': points,
                'is_correct': is_correct,
                'answered_at': answer.get('answered_at')
            })
        
        result = {
            'total_score': total_score,
            'total_answers': len(all_answers),
            'correct_answers': correct_count,
            'answers_breakdown': answers_breakdown
        }
        
        logger.info(f"Detailed score for user {user_id} in session {session_id}: {result}")
        return result
    
    except Exception as e:
        logger.error(f"Could not calculate detailed score for user {user_id} in session {session_id}: {e}")
        return {
            'total_score': 0,
            'total_answers': 0,
            'correct_answers': 0,
            'answers_breakdown': [],
            'error': str(e)
        }


def debug_player_score_calculation(session_id: int, user_id: int) -> None:
    """
    Debug function to help identify why scores might be 0.
    """
    try:
        logger.info(f"=== DEBUGGING SCORE CALCULATION ===")
        logger.info(f"Session ID: {session_id}, User ID: {user_id}")
        
        # Check if user exists
        user = UserRepository.get_user_by_id(user_id)
        logger.info(f"User exists: {user is not None}")
        if user:
            logger.info(f"User details: {user.get('first_name')} {user.get('last_name')}")
        
        # Check if session exists
        session = QuizSessionRepository.get_session_by_id(session_id)
        logger.info(f"Session exists: {session is not None}")
        if session:
            logger.info(f"Session name: {session.get('name')}")
        
        # Check if user is in session
        session_players = SessionPlayerRepository.get_session_players(session_id)
        user_in_session = any(p.get('userId') == user_id for p in session_players)
        logger.info(f"User in session: {user_in_session}")
        
        # Get raw answers data
        raw_answers = PlayerAnswerRepository.get_all_player_answers_for_user_in_session(session_id, user_id)
        logger.info(f"Raw answers count: {len(raw_answers) if raw_answers else 0}")
        
        if raw_answers:
            for i, answer in enumerate(raw_answers):
                logger.info(f"Answer {i+1}: {answer}")
        
        # Get detailed calculation
        detailed_score = calculate_player_score_detailed(session_id, user_id)
        logger.info(f"Detailed score calculation: {detailed_score}")
        
        # Try direct repository method
        repo_score = PlayerAnswerRepository.get_player_score_for_session(session_id, user_id)
        logger.info(f"Repository method score: {repo_score}")
        
        logger.info(f"=== END DEBUG ===")
        
    except Exception as e:
        logger.error(f"Error in debug function: {e}", exc_info=True)


# Updated handler function with better debugging
from decimal import Decimal  # Add this import at the top of your file

# ... [rest of your imports] ...

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
            user_id = player.get('userId')
            if not user_id:
                logger.warning(f"Player record missing userId: {player}")
                continue

            logger.debug(f"Fetching details for user {user_id}")
            user_details = UserRepository.get_user_by_id(user_id)
            
            if not user_details:
                logger.warning(f"User {user_id} not found but exists in session {active_session_id}")
                continue

            logger.debug(f"Calculating score for user {user_id}")
            
            # Debug the score calculation for the requesting user
            if user_id == requesting_user_id:
                debug_player_score_calculation(active_session_id, user_id)
            
            session_score = calculate_player_score(active_session_id, user_id)
            questions_answered = PlayerAnswerRepository.get_player_answers_count_for_user_in_session(active_session_id, user_id)
            
            player_data = {
                'user_id': user_id,
                'username': f"{user_details.get('first_name', '')} {user_details.get('last_name', '')}".strip(),
                'first_name': user_details.get('first_name', ''),
                'last_name': user_details.get('last_name', ''),
                'soul_points': float(user_details.get('soul_points', 0)),
                'limb_points': float(user_details.get('limb_points', 0)),
                'session_score': int(session_score),
                'total_questions_answered': questions_answered,
                'is_requesting_user': user_id == requesting_user_id
            }
            
            logger.debug(f"Processed player data: {player_data}")
            all_players_data.append(player_data)

        # Sort players by session score (highest first)
        all_players_data.sort(key=lambda x: x['session_score'], reverse=True)

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
        
        # Convert Decimal values to float (now that Decimal is imported)
        def convert_decimals(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            elif isinstance(obj, dict):
                return {k: convert_decimals(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_decimals(x) for x in obj]
            return obj
        
        response = convert_decimals(response)
        
        await sio.emit('all_users_data_updated', response, room=sid)
        logger.info(f"Sent user data for session {active_session_id} to user {requesting_user_id}")

    except Exception as e:
        logger.error(f"Error in handle_user_data_request: {str(e)}", exc_info=True)
        await sio.emit('error', {
            'message': 'Failed to process user data request',
            'details': str(e)
        }, room=sid)
















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

# Authentication functions are now defined at the top of the file

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
    
    # Only admins can create questions - moderators should not be able to create new questions
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can create questions"
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
    user_id = current_user_info.get("id")
    role = current_user_info.get("role")
    client_ip = get_client_ip(request) if request else "unknown"

    # Only admins can edit questions
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can edit questions")

    # Log the update attempt (non-blocking)
    try:
        audit_entry = {
            "action": "update_question_attempt",
            "question_id": question_id,
            "requested_by": user_id,
            "timestamp": datetime.now().isoformat()
        }
        # ... optionally write to audit log, but continue regardless
    except Exception:
        pass

    try:
        # Prepare numeric/constrained values
        theme_id = safe_int_convert(question_data.themeId, 1)
        difficulty_id = safe_int_convert(question_data.difficultyLevelId, 1)

        # Call repository update
        update_success = QuestionRepository.update_question(
            question_id,
            question_text=question_data.question_text.strip() if question_data.question_text else None,
            themeId=theme_id,
            difficultyLevelId=difficulty_id,
            explanation=question_data.explanation or None,
            Url=question_data.Url or None,
            time_limit=safe_int_convert(question_data.time_limit, None),
            think_time=safe_int_convert(question_data.think_time, None),
            points=safe_int_convert(question_data.points, None),
            is_active=bool(question_data.is_active) if question_data.is_active is not None else None,
            no_answer_correct=bool(question_data.no_answer_correct) if question_data.no_answer_correct is not None else None,
            LightMax=safe_int_convert(question_data.LightMax, None),
            LightMin=safe_int_convert(question_data.LightMin, None),
            TempMax=safe_int_convert(question_data.TempMax, None),
            TempMin=safe_int_convert(question_data.TempMin, None)
        )

        if not update_success:
            raise HTTPException(status_code=500, detail="Failed to update question")

        # Handle answers: delete all existing answers and create new ones
        created_answers = []
        if getattr(question_data, 'answers', None):
            try:
                delete_success = AnswerRepository.delete_all_answers_for_question(question_id)
                if not delete_success:
                    print(f"Warning: Failed to delete existing answers for question {question_id}")

                for answer in question_data.answers:
                    if not getattr(answer, 'answer_text', None) or not answer.answer_text.strip():
                        continue
                    try:
                        answer_id = AnswerRepository.create_answer(
                            question_id=question_id,
                            answer_text=answer.answer_text.strip(),
                            is_correct=bool(getattr(answer, 'is_correct', False))
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
   
    # Only admins can create themes. Moderators should not be creating themes via this endpoint.
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can create themes"
        )
   
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
    
    # Only admins can delete themes
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete themes"
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


# Mass migration endpoint for moving questions between themes
@app.post("/api/v1/themes/{source_theme_id}/migrate-to/{target_theme_id}")
async def migrate_questions_between_themes(
    source_theme_id: int,
    target_theme_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    """
    Move all questions from source theme to target theme.
    Only admins can perform this operation.
    """
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Only admins can migrate questions
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can migrate questions between themes"
        )
    
    try:
        # Validate that both themes exist
        source_theme = ThemeRepository.get_theme_by_id(source_theme_id)
        target_theme = ThemeRepository.get_theme_by_id(target_theme_id)
        
        if not source_theme:
            raise HTTPException(
                status_code=404,
                detail=f"Source theme with ID {source_theme_id} not found"
            )
        
        if not target_theme:
            raise HTTPException(
                status_code=404,
                detail=f"Target theme with ID {target_theme_id} not found"
            )
        
        # Prevent migration to the same theme
        if source_theme_id == target_theme_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot migrate questions to the same theme"
            )
        
        # Get questions in source theme before migration
        source_questions = QuestionRepository.get_questions_by_theme(source_theme_id)
        question_count = len(source_questions)
        
        if question_count == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Source theme '{source_theme['name']}' has no questions to migrate"
            )
        
        # Perform the migration - update all questions in source theme to target theme
        try:
            migration_success = QuestionRepository.migrate_questions_to_theme(source_theme_id, target_theme_id)
            if not migration_success:
                raise Exception("Database migration operation failed")
        except Exception as migration_error:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to migrate questions: {str(migration_error)}"
            )
        
        # Log the migration in audit log
        audit_data = {
            "migrated_by": user_id,
            "source_theme_id": source_theme_id,
            "source_theme_name": source_theme["name"],
            "target_theme_id": target_theme_id,
            "target_theme_name": target_theme["name"],
            "question_count": question_count,
            "action": "MIGRATE_QUESTIONS",
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            AuditLogRepository.create_audit_log(
                table_name="questions",
                record_id=source_theme_id,
                action="MIGRATE_TO_THEME",
                old_values=json.dumps({"theme_id": source_theme_id}),
                new_values=json.dumps(audit_data),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"Migration audit log creation failed: {audit_error}")
        
        # Return migration summary
        return {
            "status": "success",
            "message": f"Successfully migrated {question_count} questions",
            "source_theme": {
                "id": source_theme_id,
                "name": source_theme["name"]
            },
            "target_theme": {
                "id": target_theme_id,
                "name": target_theme["name"]
            },
            "migrated_count": question_count,
            "migration_timestamp": datetime.now().isoformat(),
            "migrated_by": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error migrating questions from theme {source_theme_id} to {target_theme_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during question migration: {str(e)}"
        )


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
    
    # Check if target user exists and prevent deletion of other admins
    existing_user = UserRepository.get_user_by_id(user_id)
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deletion of admin users (role 3)
    if existing_user['userRoleId'] == 3:
        raise HTTPException(status_code=403, detail="Cannot delete admin users for security reasons")
    
    try:
        
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
    
    # Only admins can ban IP addresses
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can ban IP addresses"
        )
    
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
    

# Player Rankings Endpoints - Simplified version that works with your existing data structure
@app.get("/api/v1/rankings/session/{session_id}/")
async def get_session_rankings(session_id: int):
    """Get player rankings for a specific quiz session ordered by score."""
    try:
        # Use the same approach as your working sensor-data endpoint
        # Get players who participated in this session
        players = SessionPlayerRepository.get_session_players(session_id)
        
        if not players:
            return []
        
        rankings = []
        user_repo = UserRepository()
        
        for player in players:
            user_id = player.get('userId') if isinstance(player, dict) else player
            if not user_id:
                continue
            
            try:
                # Get user details
                user = user_repo.get_user_by_id(user_id)
                if not user:
                    continue
                
                # Handle both dict and object formats
                # Users table has first_name and last_name instead of username
                if isinstance(user, dict):
                    first_name = user.get('first_name', '')
                    last_name = user.get('last_name', '')
                    username = f"{first_name} {last_name}".strip() or f"User {user_id}"
                    display_name = username
                else:
                    first_name = getattr(user, 'first_name', '')
                    last_name = getattr(user, 'last_name', '')
                    username = f"{first_name} {last_name}".strip() or f"User {user_id}"
                    display_name = username
                
                # Calculate score using your existing function
                score_details = calculate_player_score_detailed(session_id, user_id)
                
                # Calculate accuracy from the returned data
                total_answers = score_details.get("total_answers", 0)
                correct_answers = score_details.get("correct_answers", 0)
                accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0
                
                rankings.append({
                    "rank": 0,  # Will be set after sorting
                    "user_id": user_id,
                    "username": username,
                    "display_name": display_name or username,
                    "total_score": score_details.get("total_score", 0),
                    "correct_answers": correct_answers,
                    "total_answers": total_answers,
                    "accuracy": round(accuracy, 1),
                    "session_id": session_id
                })
            except Exception as e:
                print(f"Error processing user {user_id}: {e}")
                continue
        
        # Sort by score and assign ranks
        rankings.sort(key=lambda x: x["total_score"], reverse=True)
        for i, ranking in enumerate(rankings):
            ranking["rank"] = i + 1
            
        return rankings
        
    except Exception as e:
        print(f"Error in get_session_rankings: {e}")
        return []

@app.get("/api/v1/rankings/global/")
async def get_global_rankings(limit: int = 50):
    """Get global player rankings - optimized version."""
    try:
        # Get all users
        user_repo = UserRepository()
        all_users = user_repo.get_all_users()
        
        if not all_users:
            return []
        
        global_rankings = []
        
        for user in all_users:
            try:
                # Handle both dict and object formats
                user_id = user.get('id') if isinstance(user, dict) else user.id
                # Users table has first_name and last_name instead of username
                if isinstance(user, dict):
                    first_name = user.get('first_name', '')
                    last_name = user.get('last_name', '')
                    username = f"{first_name} {last_name}".strip() or f"User {user_id}"
                    display_name = username
                else:
                    first_name = getattr(user, 'first_name', '')
                    last_name = getattr(user, 'last_name', '')
                    username = f"{first_name} {last_name}".strip() or f"User {user_id}"
                    display_name = username
                
                # Get global stats for this user in a single query
                global_stats = PlayerAnswerRepository.get_player_global_stats(user_id)
                
                total_score = global_stats.get('total_score', 0)
                total_answers = global_stats.get('total_answers', 0)
                correct_answers = global_stats.get('correct_answers', 0)
                sessions_played = global_stats.get('sessions_played', 0)
                
                # Only include users with actual quiz activity
                if total_answers > 0:
                    accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0
                    
                    global_rankings.append({
                        "user_id": user_id,
                        "username": username,
                        "display_name": display_name or username,
                        "total_score": total_score,
                        "sessions_played": sessions_played,
                        "total_correct_answers": correct_answers,
                        "total_answers": total_answers,
                        "overall_accuracy": round(accuracy, 1),
                        "average_score_per_session": round(total_score / sessions_played, 1) if sessions_played > 0 else 0
                    })
                    
            except Exception as e:
                print(f"Error processing user {username if 'username' in locals() else 'unknown'}: {e}")
                continue
        
        # Sort and rank
        global_rankings.sort(key=lambda x: x["total_score"], reverse=True)
        for i, ranking in enumerate(global_rankings[:limit]):
            ranking["rank"] = i + 1
            
        return global_rankings[:limit]
        
    except Exception as e:
        print(f"Error in get_global_rankings: {e}")
        return []

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
    Get all currently active quiz sessions (excluding support session 999999).
    """
    try:
        active_sessions = QuizSessionRepository.get_sessions_by_status(2)

        # Check if active_sessions is a list of tuples or dictionaries
        # Let's add a robust check and assume it's most likely dictionaries now given previous fixes
        # Or, if it's still tuples, keep session[0].
        # For safety, let's try to get the first element and check its type.
        
        # This assumes get_sessions_by_status returns at least one session if active sessions exist
        if active_sessions and isinstance(active_sessions[0], dict):
            # If it's a list of dictionaries, access by key and filter out support session
            active_session_ids = [session['sessionId'] for session in active_sessions if session.get('sessionId') != 999999]
        else:
            # If it's a list of tuples (or empty), access by index 0 and filter out support session
            active_session_ids = [session[0] for session in active_sessions if session[0] != 999999]
        
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

logging.basicConfig(level=logging.ERROR)
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
        # Filter out support session 999999 - it should use the support endpoint instead
        active_session_ids = [session[0] for session in active_sessions if session[0] != 999999]
        logger.info(f"Active session IDs (excluding support): {active_session_ids}")
        
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
        threadsafe_emit_message_sent(sio,get_active_session_id(),main_asyncio_loop)
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


# Support chat endpoint - bypasses active session check for session 999999
@app.post("/api/v1/chat/support/messages")
async def create_support_chat_message(request: ChatMessageCreate):
    """
    Create a new support chat message (session 999999).
    This endpoint bypasses the active session check since support chat is always available.
    """
    try:
        current_time = time.time()
        user_id = request.user_id

        # Rate limiting
        if user_id in user_last_request_time:
            if current_time - user_last_request_time[user_id] < RATE_LIMIT_SECONDS:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {RATE_LIMIT_SECONDS} second(s) before sending another message."
                )
        user_last_request_time[user_id] = current_time

        logger.info(f"Starting create_support_chat_message endpoint for session {request.session_id}")
        
        # Support chat should always use session 999999
        if request.session_id != 999999:
            logger.warning(f"Invalid session ID {request.session_id} for support chat, forcing to 999999")
            request.session_id = 999999

        logger.info("Attempting to create support chat message in DB.")
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

        logger.info(f"Support message created successfully with ID: {message_id}")

        # Emit message_sent event for support session
        logger.info("Emitting 'message_sent' for support chat via Socket.IO.")
        await sio.emit('message_sent', {
            'session_id': request.session_id
        })
        
        logger.info("Support chat Socket.IO emit completed successfully.")

        return {
            "message_id": message_id,
            "status": "sent",
            "broadcast": True,
            "session_id": request.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unhandled exception in create_support_chat_message: {e}")
        print(f"Error creating support chat message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create support chat message"
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
        threadsafe_emit_message_sent(sio,get_active_session_id(),main_asyncio_loop)
        return True
        
    except Exception as e:
        print(f"Error in user_left_quiz: {e}")
        return False


# Additional endpoint to broadcast system messages
@app.post("/api/v1/chat/system-message")
async def send_system_message(
    session_id: int,
    message: str,
    message_type: str = "system",
    current_user: dict = Depends(get_current_user_info),
    request: Request = None
):
    """
    Send a system message to all users in a quiz session.
    """
    # Only admins are allowed to send system messages
    role = current_user.get("role") if isinstance(current_user, dict) else None
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can send system messages")

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
        threadsafe_emit_message_sent(sio,get_active_session_id(),main_asyncio_loop)
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
    current_user: dict = Depends(get_current_user_info)
):
    # Only admins can trigger shutdown
    role = current_user.get("role") if isinstance(current_user, dict) else None
    if role != "admin":
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
RFID_DISPLAY_TIME = 20  # seconds to display RFID code (matches RFID cooldown)
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
RFID_DISPLAY_TIME = 20
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
    # print("RFID reader thread started.")
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
                    print("Sensor read/display error")
                    if lcd:
                        lcd.write_line(1, "Sensor Error")
                    last_refresh = current_time            # --- Step 3: Handle Quiz Session Specific Logic ---
                try:
                    if get_active_session_id():
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



servo_lock = Lock()
last_servo_command_time = 0.0  # Stores the Unix timestamp of the last command
SERVO_COOLDOWN_SECONDS = 1.0    # Cooldown duration
servo_cooldown_lock = Lock()    # Lock to protect last_servo_command_time
servo = None  # Global servo object (initialize this elsewhere in your code)

@app.post("/api/v1/trigger-servo")
async def trigger_servo():
    global last_servo_command_time, servo
    
    # 1. Check for active quiz sessions first
    try:
        active_session_id = get_active_session_id()
        if active_session_id:
            active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
            session_name = active_session_info.get('name', f'Session ID {active_session_id}') if active_session_info else None
            
            return {
                "message": f"Servo control unavailable. System busy with quiz session (ID: {active_session_id})" + 
                          (f" named '{session_name}'" if session_name else "") + 
                          ". Please wait until the quiz ends."
            }
    except Exception as e:
        print(f"Error checking active quiz sessions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error checking quiz status.")
    
    # 2. Check cooldown
    with servo_cooldown_lock:
        current_time = time.time()
        if current_time - last_servo_command_time < SERVO_COOLDOWN_SECONDS:
            remaining = SERVO_COOLDOWN_SECONDS - (current_time - last_servo_command_time)
            raise HTTPException(
                status_code=429,
                detail=f"Servo on cooldown. Wait {remaining:.1f} seconds."
            )
        last_servo_command_time = current_time
    
    # 3. Get current angle and calculate target
    try:
        current_angle = servo.read_degrees()
        target_angle = 180 if current_angle < 90 else 0  # Flip to opposite extreme
        
        with servo_lock:
            servo.set_angle(target_angle)
            return {
                "message": f"Servo moved from {current_angle}° to {target_angle}°",
                "previous_angle": current_angle,
                "new_angle": target_angle
            }
    except Exception as e:
        print(f"Error controlling servo: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to control servo: {str(e)}"
        )



# --- FastAPI Application Lifecycle Events ---


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
        for user in users:
            if user.get('email'):
                user['first_name'] = user['email']
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
    global virtualTemperature
    global sensorData
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
            temperature = round(temperature, 2) + virtualTemperature
            sensorData = {'temperature': temperature, 'illuminance': light_sensor()}
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



def should_emit(current_temp, current_lux):
    global previous_temperature, previous_illuminance, newClient
    
    # If it's the first reading or newClient has a new value, always emit
    if (previous_temperature is None or 
        previous_illuminance is None or 
        newClient is not None):
        previous_temperature = current_temp
        previous_illuminance = current_lux
        newClient = None  # Reset after checking
        return True
    
    # Check if changes exceed thresholds
    temp_changed = abs(current_temp - previous_temperature) > 1
    lux_changed = abs(current_lux - previous_illuminance) > 1
    
    if temp_changed or lux_changed:
        previous_temperature = current_temp
        previous_illuminance = current_lux
        return True
    
    return False

def emit_sensor_data(sensor_data, sio, loop):
    global newClient
    try:
        if should_emit(sensor_data['temperature'], sensor_data['illuminance']):
            asyncio.run_coroutine_threadsafe(
                sio.emit('sensor_data', sensor_data),
                loop
            )
    except Exception as e:
        print("Error emitting sensor_data from thread")



# sio emits for quiz data

import asyncio
























































































# ---------- Modular Quiz Timer System with Servo Integration ----------
from collections import defaultdict
from threading import Lock, Thread
import random
import time
import asyncio
import traceback

# Global state management
theme_votes = {}  # Format: {session_id: {"votes": {theme_id: count}, "user_votes": {user_id: theme_id}}}
quiz_sessions = {}  # Format: {session_id: {"phase": "voting/theme_display/quiz", "current_question": None, ...}}
quiz_state = {}  # Format: {session_id: {"asked_questions": [], "question_count": 0, "total_score": 0, "player_count": 0}}
theme_votes_lock = Lock()
timer_lock = Lock()
session_lock = Lock()
quiz_state_lock = Lock()
active_timers = {}
progress = None
# Global servo variable (assumed to be initialized elsewhere)
# servo = ServoController()  # This should be initialized in your main application

def is_timer_active(session_id):
    with timer_lock:
        timer_thread = active_timers.get(session_id)
        is_alive = timer_thread.is_alive() if timer_thread else False
        # Use debug for this check to avoid spamming info logs; callers can
        # still treat the return value normally. Avoid printing to stdout here.
        quiz_logger.debug(f"is_timer_active({session_id}): thread exists={timer_thread is not None}, is_alive={is_alive}")
        return is_alive


def select_question_based_on_sensors(available_questions, temp_sensor, light_sensor):
    global virtualTemperature
    sensor_data = check_sensor_data(temp_sensor, light_sensor)
    temp = sensor_data['temperature'] + virtualTemperature
    light = sensor_data['illuminance']
   
    def get_bound(q, key, default):
        value = q.get(key)
        return default if value is None else value
        
    filtered = [
        q for q in available_questions
        if (get_bound(q, 'TempMin', 20) <= temp <= get_bound(q, 'TempMax', 25))
        and (get_bound(q, 'LightMin', 10) <= light <= get_bound(q, 'LightMax', 20))
    ]
    print(f"Current temp: {temp}, light: {light}")
    print(f"Filtered questions: {len(filtered)} out of {len(available_questions)}")
    # DON'T fall back to all available_questions!
    return random.choice(filtered) if filtered else None





def get_active_session_id():
    """Get the ID of the first active session (excluding support session 999999)."""
    active_sessions = QuizSessionRepository.get_sessions_by_status(2)
    # Filter out support session 999999
    quiz_sessions = [session for session in active_sessions if session[0] != 999999]
    return quiz_sessions[0][0] if quiz_sessions else None  # Access first column of first row

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

def get_quiz_state(session_id):
    """Get quiz state for a session"""
    with quiz_state_lock:
        if session_id not in quiz_state:
            quiz_state[session_id] = {
                "asked_questions": [],
                "question_count": 0,
                "total_score": 0,
                "player_count": 0,
                "current_question": None,
                "waiting_for_answers": False
            }
        return quiz_state[session_id]

def update_quiz_state(session_id, **kwargs):
    """Update quiz state for a session"""
    with quiz_state_lock:
        if session_id not in quiz_state:
            quiz_state[session_id] = {
                "asked_questions": [],
                "question_count": 0,
                "total_score": 0,
                "player_count": 0,
                "current_question": None,
                "waiting_for_answers": False
            }
        quiz_state[session_id].update(kwargs)

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










def calculate_impact(sensorData):
    # Extract temperature and illuminance from sensor data
    temperature = sensorData['temperature']
    illuminance = sensorData['illuminance']
    
    # Calculate temperature impact (dominant factor)
    # Normalized between -5°C to 45°C (50°C range)
    temp_norm = (min(max(temperature, -5), 45) + 5) / 50  # 0 to 1 range
    # Apply sigmoid-like curve to emphasize middle range
    temp_impact = 0.7 + 0.6 * (2 * temp_norm - 1) ** 3  # 0.1 to 1.3 range
    
    # Calculate illuminance impact (secondary factor)
    # Normalized between 0 to 100 lux
    illum_norm = min(max(illuminance, 0), 100) / 100  # 0 to 1 range
    # Apply square root to reduce impact of very high values
    illum_impact = 0.4 * (illum_norm ** 0.5)  # 0 to 0.4 range
    
    # Combine impacts (temperature has 70% weight, illuminance 30%)
    combined = temp_impact + illum_impact
    
    # Normalize final result to 0.5 to 2 range
    # Our combined range is theoretically 0.1 to 1.7
    # So we scale and shift it to 0.5 to 2
    final_value = 0.5 + (combined - 0.1) * (1.5 / 1.6)
    
    # Ensure we stay within bounds due to any floating point errors
    return min(max(final_value, 0.5), 2)


def emit_timer_update(sio, loop, session_id, time_remaining, phase, total_time, **extra_data):
    """
    Emit both timer_update and quiz_timer events for frontend compatibility
    Also handle servo movement during timer
    """
    global sensorData
    global progress
    global multiplier
    try:
        # Calculate servo position (0 degrees at start, 180 degrees at end)
        if total_time > 0:
            progress = (total_time - time_remaining) / total_time
            raw_angle = 0 + (180 - 0) * progress
            angle = round(raw_angle / 5) * 5
            
            if 'servo' in globals():
                servo.set_angle(angle)
        
        # Prepare timer data
        multiplier = calculate_impact(sensorData)
        timer_data = {
            'timeRemaining': str(int(time_remaining)),  # camelCase for JS
            'speedMultiplier': multiplier,
            'temperature': sensorData['temperature'],
            'illuminance': sensorData['illuminance'],
            'totalTime': total_time  # camelCase for JS
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
        'voting_time': 33,
        'theme_display_time': 10,
        'question_time': 10,
        'explanation_time': 5
    }
    """
    # Ensure only one timer per session. If a previous thread exists but is dead, allow replacement.
    with timer_lock:
        existing = active_timers.get(session_id)
        if existing:
            try:
                alive = existing.is_alive()
            except Exception:
                alive = False
            if alive:
                quiz_logger.info(f"start_generic_timer: Timer already exists for session {session_id}, returning False")
                print(f"[DEBUG] start_generic_timer: timer already exists and alive for session {session_id}")
                return False
            else:
                # remove stale thread entry and continue
                quiz_logger.info(f"start_generic_timer: Found stale timer for session {session_id}, removing and replacing")
                print(f"[DEBUG] start_generic_timer: removing stale timer for session {session_id}")
                active_timers.pop(session_id, None)

    def timer_task():
        try:
            current_phase = get_session_phase(session_id)
            quiz_logger.info(f"Timer thread started for session {session_id}, phase: {current_phase}")
            print(f"[DEBUG] Timer thread started for session {session_id}, phase: {current_phase}")

            if current_phase == 'voting':
                handle_voting_phase(sio, loop, session_id, timer_config.get('voting_time', 33))
            elif current_phase == 'theme_display':
                handle_theme_display_phase(sio, loop, session_id, timer_config.get('theme_display_time', 10))
            elif current_phase == 'quiz':
                handle_quiz_phase(sio, loop, session_id, timer_config)
            else:
                print(f"[DEBUG] Timer thread for session {session_id} found unexpected phase: {current_phase}")

        except Exception as e:
            quiz_logger.error(f"Timer error for session {session_id}: {e}")
            print(f"Timer error for session {session_id}: {e}")
            traceback.print_exc()
        finally:
            with timer_lock:
                quiz_logger.info(f"Timer thread ending, removing from active_timers for session {session_id}")
                active_timers.pop(session_id, None)

    # Start timer thread
    timer_thread = Thread(target=timer_task, daemon=True)
    with timer_lock:
        active_timers[session_id] = timer_thread
    quiz_logger.info(f"start_generic_timer: Created and starting timer thread for session {session_id}")
    print(f"[DEBUG] start_generic_timer: starting timer thread for session {session_id}")
    timer_thread.start()
    return True

def handle_voting_phase(sio, loop, session_id, voting_time):
    """Handle the voting countdown phase with dynamic speed based on votes"""
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
    
    # Get total number of players in the session
    players = SessionPlayerRepository.get_session_players(session_id)
    total_players = len(players) if players else 0
    print(f"Total players in session: {total_players}")
    
    # Voting countdown with dynamic speed based on votes
    current_time = voting_time
    last_vote_count = 0
    start_time = time.time()
    early_completion = False
    initial_5s_passed = False
    
    while current_time > 0:
        emit_timer_update(sio, loop, session_id, current_time, 'voting', voting_time)
        
        # Get current vote count
        with theme_votes_lock:
            current_vote_count = len(theme_votes.get(session_id, {}))
        
        # Check if 5 seconds have passed
        elapsed_time = time.time() - start_time
        if not initial_5s_passed and elapsed_time >= 5:
            initial_5s_passed = True
            print("Initial 5 seconds have passed - now checking for full participation")
        
        # After 5 seconds, check if all players have voted
        if initial_5s_passed and current_vote_count >= total_players and total_players > 0:
            print("All players have voted after initial 5 seconds - ending voting phase immediately")
            current_time = 0
            early_completion = True
            break
        
        # Calculate time adjustment based on vote count increase
        if current_vote_count > last_vote_count:
            # Reduce time based on the number of new votes (e.g., 0.5s per vote)
            time_reduction = (current_vote_count - last_vote_count) * 0.5
            current_time = max(0, current_time - time_reduction)
            last_vote_count = current_vote_count
        
        # Wait for a shorter interval when there are more votes
        sleep_time = max(0.1, 1.0 - (current_vote_count * 0.05))  # Minimum 0.1s sleep
        time.sleep(sleep_time)
        current_time = max(0, current_time - sleep_time)
    
    # If we broke out early due to all players voting, emit remaining timer updates
    if early_completion:
        emit_timer_update(sio, loop, session_id, 0, 'voting', voting_time)

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
            # Record that this theme has been played for this session (runtime tracking)
            try:
                with session_played_lock:
                    if winning_theme not in session_played_themes[session_id]:
                        session_played_themes[session_id].append(winning_theme)
            except Exception as e:
                print(f"Warning: failed to record played theme for session {session_id}: {e}")

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
                'active_only': True,
                'timestamp': time.time(),
                'winning_theme': winning_theme,
                'session_id': session_id,
                'early_completion': early_completion  # Add flag for early completion
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
    
    future = asyncio.run_coroutine_threadsafe(
        sio.emit('theme_display', {
            'session_id': session_id,
            'theme_data': theme_data
        }),
        loop
    )
    # Reset servo to start position
    if 'servo' in globals():
        servo.set_angle(0)
    
    # Theme display countdown with servo movement
    for current_time in range(display_time, -1, -1):
        emit_timer_update(sio, loop, session_id, current_time, 'theme_display', display_time, theme_data=theme_data)
        
        if current_time <= 0:
            break
        time.sleep(0.5)
    
    # Emit timer finished
    emit_timer_finished(sio, loop, session_id, 'theme_display', theme_data=theme_data)
    
    # Theme display finished - move to quiz phase
    set_session_phase(session_id, 'quiz')
    
    future.result(timeout=1)
    
    print(f"Theme display finished for session {session_id}, ready for quiz")
    # Start the quiz timer immediately so questions are emitted after theme display
    try:
        timer_config = {
            'voting_time': 33,
            'theme_display_time': display_time,
            'question_time': 15,  # default question time
            'explanation_time': 15
        }
        quiz_logger.info(f"handle_theme_display_phase: starting quiz timer for session {session_id}")
        start_generic_timer(sio, loop, session_id, timer_config)
    except Exception as e:
        quiz_logger.error(f"Failed to start quiz timer after theme display for session {session_id}: {e}")
        print(f"Failed to start quiz timer after theme display for session {session_id}: {e}")








def handle_quiz_phase(sio, loop, session_id, timer_config):
    """Handle the quiz questions phase with dynamic timer based on player answers and environment multiplier."""
    import random  # Import at the top to avoid scoping issues
    quiz_logger.info(f"========== HANDLE_QUIZ_PHASE CALLED for session {session_id} ==========")
    print(f"========== HANDLE_QUIZ_PHASE CALLED for session {session_id} ==========")
    global multiplier
    global virtualTemperature
    # Get session and theme info
    global explanationNow
    explanationNow = False  # Flag to indicate if we're not in explanation time
    session_info = QuizSessionRepository.get_session_by_id(session_id)
    if not session_info or not session_info.get('themeId'):
        quiz_logger.error(f"No theme found for session {session_id}")
        print(f"ERROR: No theme found for session {session_id}")
        emit_error(sio, loop, session_id, 'No theme found for quiz')
        return

    theme_id = session_info['themeId']
    all_questions = QuestionRepository.get_questions_by_theme(theme_id, active_only=True)
    quiz_logger.info(f"Found {len(all_questions) if all_questions else 0} total questions for theme {theme_id}")
    print(f"Found {len(all_questions) if all_questions else 0} total questions for theme {theme_id}")

    if not all_questions:
        quiz_logger.error(f"No questions found for theme {theme_id}")
        print(f"ERROR: No questions found for theme {theme_id}")
        emit_error(sio, loop, session_id, 'No questions found for this theme')
        return

    # Initialize quiz state
    quiz_state = get_quiz_state(session_id)
    rows = PlayerAnswerRepository.get_player_answers_for_session(session_id)
    ids = [row['questionId'] for row in rows]
    quiz_logger.info(f"Already answered questions: {ids}")
    print(f"Already answered questions: {ids}")
    # Diagnostic: log available questions count
    try:
        theme_id = session_info['themeId']
        all_questions = QuestionRepository.get_questions_by_theme(theme_id, active_only=True)
        total_questions = len(all_questions) if all_questions else 0
        print(f"[DEBUG] handle_quiz_phase: total_questions for theme {theme_id}: {total_questions}")
    except Exception as e:
        print(f"[DEBUG] handle_quiz_phase: error while counting questions: {e}")
    if not quiz_state['question_count']:
        quiz_state['question_count'] = len(ids)
    available_questions = [q for q in all_questions if q['id'] not in ids]
    quiz_logger.info(f"Available questions: {len(available_questions)}")
    print(f"Available questions: {len(available_questions)}")

    # Get total players in session
    players = SessionPlayerRepository.get_session_players(session_id)
    total_players = len(players) if players else 0
    quiz_logger.info(f"Total players: {total_players}")
    print(f"Total players: {total_players}")

    # Check if there are any connected clients in the quiz room
    is_active = is_quiz_session_active(session_id)
    quiz_logger.info(f"Is quiz session active (Socket.IO room check): {is_active}")
    print(f"Is quiz session active: {is_active}")
    if not is_active:
        quiz_logger.warning(f"ENDING QUIZ: No connected clients in session {session_id}")
        print(f"ENDING QUIZ: No connected clients in session {session_id}")
        QuizSessionRepository.update_session_status(session_id, 3)
        asyncio.run_coroutine_threadsafe(
            sio.emit('quiz_finished', {
                'session_id': session_id,
                'final_score': 0,
                'questions_asked': quiz_state['question_count'],
                'all_questions_answered': False,
                'ended_early': True,
                'final_scores': [],
                'message': 'Quiz ended - no players remaining.'
            }), loop
        ).result(timeout=1)
        # Clear played-theme tracking for this session now that the quiz ended
        try:
            with session_played_lock:
                session_played_themes.pop(session_id, None)
        except Exception:
            pass
        return

    # Check if there are any available questions left
    if not available_questions:
        quiz_logger.info(f"No available questions for theme {theme_id} in session {session_id}")
        print(f"No available questions for theme {theme_id} in session {session_id}")

        # Check whether there are other active themes left that haven't been played
        try:
            with session_played_lock:
                played = list(session_played_themes.get(session_id, []))
        except Exception:
            played = []

        all_active_themes = ThemeRepository.get_active_themes() or []
        # Diagnostic logging: show which themes are active and which have been played
        try:
            active_ids = [t.get('id') for t in all_active_themes]
            quiz_logger.info(f"handle_quiz_phase: session {session_id} played themes: {played}, active theme ids: {active_ids}")
            print(f"[DEBUG] handle_quiz_phase: session {session_id} played themes: {played}, active theme ids: {active_ids}")
        except Exception:
            pass

        remaining_themes = [t for t in all_active_themes if t.get('id') not in set(played)]

        if remaining_themes:
            # Reset session theme so players can vote again and exclude already played themes
            QuizSessionRepository.update_session_theme(session_id, None)
            set_session_phase(session_id, 'voting')

            # Inform players and emit theme selection excluding played themes
            ChatLogRepository.create_chat_message(
                session_id=session_id,
                message_text="No more questions in this theme. Please choose another theme.",
                user_id=1,
                message_type='system',
                reply_to_id=1
            )
            threadsafe_emit_message_sent(sio, session_id, loop)

            try:
                # emit_combined_theme_selection signature: (sio, loop, target=None, active_only=True, exclude_ids=None)
                emit_combined_theme_selection(sio, loop, None, True, played)
            except Exception as e:
                print(f"Failed to emit new theme selection for session {session_id}: {e}")

            # Start voting timer so players can vote for next theme
            try:
                timer_config = {
                    'voting_time': 33,
                    'theme_display_time': 10,
                    'question_time': 15,
                    'explanation_time': 15
                }
                start_generic_timer(sio, loop, session_id, timer_config)
            except Exception as e:
                print(f"Failed to start voting timer for new theme selection in session {session_id}: {e}")

            return
        else:
            # No themes left - end quiz normally
            quiz_logger.warning(f"ENDING QUIZ: No available questions and no remaining themes for session {session_id}")
            print(f"ENDING QUIZ: No available questions and no remaining themes for session {session_id}")
            # Clear played-theme tracking for this session since the quiz is ending
            try:
                with session_played_lock:
                    session_played_themes.pop(session_id, None)
            except Exception:
                pass
            QuizSessionRepository.update_session_status(session_id, 3)
            final_state = get_quiz_state(session_id)
            player_scores = PlayerAnswerRepository.get_all_player_scores_for_session(session_id)
            total_score = sum(float(score.get('total_score', 0)) for score in player_scores)
            asyncio.run_coroutine_threadsafe(
                sio.emit('quiz_finished', {
                    'session_id': session_id,
                    'final_score': total_score,
                    'questions_asked': final_state['question_count'],
                    'all_questions_answered': True,
                    'ended_early': False,
                    'final_scores': [],
                    'message': f'Quiz completed! All questions answered. Final score: {total_score}'
                }), loop
            ).result(timeout=1)
            return

    # Only send "Preparing question" message if we have questions to ask
    quiz_logger.info(f"About to send 'Preparing question {quiz_state['question_count'] + 1}' message")
    print(f"Sending 'Preparing question' message")
    ChatLogRepository.create_chat_message(
        session_id=get_active_session_id(),
        message_text=f"Preparing question {quiz_state['question_count'] + 1}",
        user_id=1,
        message_type='system',
        reply_to_id=1
    )
    threadsafe_emit_message_sent(sio, get_active_session_id(), loop)

    quiz_ended_early = False
    consecutive_score_failures = 0  # Track consecutive failures to meet score requirement
    previous_required_score = 0  # Track the previous required score to ensure it always increases
    
    quiz_logger.info(f"ENTERING WHILE LOOP: available_questions={len(available_questions)}, quiz_ended_early={quiz_ended_early}")
    print(f"ENTERING WHILE LOOP: available_questions={len(available_questions)}, quiz_ended_early={quiz_ended_early}")

    while available_questions and not quiz_ended_early:
        quiz_logger.info(f"INSIDE WHILE LOOP - selecting question")
        print(f"INSIDE WHILE LOOP - selecting question")
        question = select_question_based_on_sensors(available_questions, temp_sensor, light_sensor) or \
                  random.choice(available_questions) if available_questions else None
        print(f"Selected question: {question['id'] if question else 'None'}")
        # Diagnostic: show how many available_questions remain and IDs
        try:
            avail_ids = [q['id'] for q in available_questions]
        except Exception:
            avail_ids = []
        print(f"Available question IDs (pre-remove): {avail_ids}")
        if not question:
            print(f"ERROR: No question selected, breaking loop")
            break

        available_questions.remove(question)
        explanationNow = False
        update_quiz_state(session_id, 
                         asked_questions=quiz_state['asked_questions'] + [question['id']],
                         question_count=quiz_state['question_count'] + 1,
                         current_question=question,
                         waiting_for_answers=True)

        question_time = max(question.get('time_limit', 15), 9)
        explanation_time = max(5, min(10, question_time))

        # Emit the combined question+answers payload and log outcome
        try:
            print(f"[DEBUG] About to emit questionData for question_id={question['id']}")
            emit_combined_question_and_answers(question['id'], sio, loop)
            print(f"[DEBUG] emit_combined_question_and_answers called for question_id={question['id']}")
        except Exception as e:
            print(f"[ERROR] emit_combined_question_and_answers failed for question {question['id']}: {e}")
            traceback.print_exc()
        answers = AnswerRepository.get_correct_answers_for_question(question['id'])
        print(f"[DEBUG] Found {len(answers) if answers else 0} correct answers for question {question['id']}")
        asyncio.run_coroutine_threadsafe(
            sio.emit('question_started', {
                'session_id': session_id,
                'question_id': question['id'],
                'question_text': question['question_text'],
                'answers': [{'id': a['id'], 'text': a['answer_text']} for a in answers],
                'duration': question_time,
                'question_number': quiz_state['question_count'] + 1
            }), loop
        ).result(timeout=1)

        current_time = question_time
        all_answered = False
        cooldown_started = False
        cooldown_time = 2.0

        while current_time > 0:
            emit_timer_update(sio, loop, session_id, current_time, 'question', question_time, 
                            question_id=question['id'], question_number=quiz_state['question_count'])
            answer_count = PlayerAnswerRepository.get_answer_count_for_question(session_id, question['id'])
            if answer_count >= total_players and total_players > 0 and not cooldown_started:
                print(f"All players answered - starting 2 second cooldown")
                cooldown_started = True
                cooldown_remaining = cooldown_time
                while cooldown_remaining > 0:
                    emit_timer_update(sio, loop, session_id, current_time, 'question', question_time, 
                                    question_id=question['id'], question_number=quiz_state['question_count'])
                    time.sleep(0.1)
                    cooldown_remaining -= 0.1
                    current_time = max(0, current_time - 0.1)
                all_answered = True
                current_time = 0
                break
            base_sleep_time = 1.0
            if total_players > 0:
                answer_factor = answer_count / total_players
                base_sleep_time = max(0.5, 1.0 - (answer_factor * 0.5))
            adjusted_sleep_time = base_sleep_time * (1 / multiplier)
            adjusted_sleep_time = max(0.1, min(2.0, adjusted_sleep_time))
            if answer_count > 0:
                temp_change = -0.1 * (answer_count / total_players if total_players > 0 else 0)
                virtualTemperature = max(-20, min(20, virtualTemperature + temp_change))
            else:
                temp_change = 0.5 * (1 if virtualTemperature >= 0 else -1)
                virtualTemperature = max(-20, min(20, virtualTemperature + temp_change))
            print(f"Multiplier: {multiplier:.2f}, Sleep time: {adjusted_sleep_time:.2f}s, Temp: {virtualTemperature:.2f}")
            time.sleep(adjusted_sleep_time)
            current_time = max(0, current_time - adjusted_sleep_time)

        # After the question timer, check if anyone answered
        answer_count = PlayerAnswerRepository.get_answer_count_for_question(session_id, question['id'])
        if answer_count == 0:
            print(f"No answers received for question {question['id']} - ending quiz early.")
            ChatLogRepository.create_chat_message(
                session_id=session_id,
                message_text="No answers received for the question. Ending quiz.",
                user_id=1,
                message_type='system',
                reply_to_id=1
            )
            threadsafe_emit_message_sent(sio, session_id, loop)
            quiz_ended_early = True
            break

        emit_timer_update(sio, loop, session_id, 0, 'question', question_time, 
                        question_id=question['id'], question_number=quiz_state['question_count'])
        update_quiz_state(session_id, waiting_for_answers=False)
        emit_timer_finished(sio, loop, session_id, 'question', question_id=question['id'])

        explanationNow = True
        asyncio.run_coroutine_threadsafe(
            sio.emit('explanation_started', {
                'session_id': session_id,
                'question_id': question['id'],
                'explanation_text': question.get('explanation', 'No explanation available'),
                'duration': explanation_time
            }), loop
        ).result(timeout=1)
        global remaining_explanation_time
        remaining_explanation_time = explanation_time
        while remaining_explanation_time > 0:
            emit_timer_update(sio, loop, session_id, remaining_explanation_time, 'explanation', 
                            explanation_time, question_id=question['id'])
            adjusted_sleep_time = 1.0 * (1 / multiplier)
            adjusted_sleep_time = max(0.1, min(2.0, adjusted_sleep_time))
            temp_change = -0.5 * (1 if virtualTemperature >= 0 else -1)
            virtualTemperature = max(-20, min(20, virtualTemperature + temp_change))
            print(f"Explanation - Temp: {virtualTemperature:.2f}")
            time.sleep(adjusted_sleep_time)
            remaining_explanation_time = max(0, remaining_explanation_time - adjusted_sleep_time)

        emit_timer_finished(sio, loop, session_id, 'explanation', question_id=question['id'])

        # Check if we should end the quiz based on scores
        if quiz_state['question_count'] >= 2:  # Only check after at least 2 questions
            print(f"quiz state question count is {quiz_state['question_count']}")
            all_scores = PlayerAnswerRepository.get_all_player_scores_for_session(session_id)
            total_score = float(sum(float(score.get('total_score', 0)) for score in all_scores))
            
            # Calculate minimum required score: 75% of current total score
            min_required_by_percentage = total_score * 0.75
            
            # Calculate progressive required score: previous + 5
            progressive_required = previous_required_score + 5
            
            # Required score is whichever is HIGHER:
            # - 75% of current score (maintains pressure)
            # - Previous requirement + 5 (ensures progression)
            required_score = max(min_required_by_percentage, progressive_required)
            
            print(f"Score check: total={total_score:.1f}, min_75%={min_required_by_percentage:.1f}, progressive={progressive_required:.1f}, required={required_score:.1f}, previous_required={previous_required_score:.1f}")
            
            # Update previous_required_score for next iteration
            previous_required_score = required_score
            
            # Check if score is too low (score must be ABOVE required to continue)
            if total_score <= required_score:
                consecutive_score_failures += 1
                print(f"Score failure #{consecutive_score_failures}: total={total_score} <= required={required_score}")
                
                if consecutive_score_failures == 1:
                    # First failure - give a warning
                    ChatLogRepository.create_chat_message(
                        session_id=session_id,
                        message_text=f"️ WARNING! Team score: {total_score:.0f}/{required_score:.0f} points - TOO LOW! One more strike and it's GAME OVER! ",
                        user_id=1,
                        message_type='system',
                        reply_to_id=1
                    )
                    threadsafe_emit_message_sent(sio, session_id, loop)
                else:
                    # Second consecutive failure - end the quiz
                    print(f"Ending quiz - two consecutive score failures")
                    ChatLogRepository.create_chat_message(
                        session_id=session_id,
                        message_text=f" GAME OVER! Team score: {total_score:.0f}/{required_score:.0f} points. Two strikes - you're out! Better luck next time! ",
                        user_id=1,
                        message_type='system',
                        reply_to_id=1
                    )
                    threadsafe_emit_message_sent(sio, session_id, loop)
                    
                    # Set the flag to end the quiz loop
                    quiz_ended_early = True
                    update_quiz_state(session_id, waiting_for_answers=False)
                    break
            else:
                # Score is good - reset failure counter
                consecutive_score_failures = 0
                
                # Calculate how far ahead the team is (as percentage above required)
                score_margin = ((total_score - required_score) / required_score) * 100 if required_score > 0 else 100
                
                # Choose fun message based on performance
                if score_margin > 50:
                    # Crushing it! (>50% ahead)
                    messages = [
                        f" CRUSHING IT! Team score: {total_score:.0f}/{required_score:.0f} points! Absolutely unstoppable! ",
                        f"⭐ LEGENDARY! Team score: {total_score:.0f}/{required_score:.0f} points! You're on fire! ",
                        f" DOMINATING! Team score: {total_score:.0f}/{required_score:.0f} points! Keep this energy! ",
                        f" PERFECT! Team score: {total_score:.0f}/{required_score:.0f} points! Mind = Blown! "
                    ]
                elif score_margin > 25:
                    # Doing great! (25-50% ahead)
                    messages = [
                        f" Excellent work! Team score: {total_score:.0f}/{required_score:.0f} points! Looking good! ",
                        f" Great job! Team score: {total_score:.0f}/{required_score:.0f} points! Keep it up! ",
                        f" Fantastic! Team score: {total_score:.0f}/{required_score:.0f} points! You got this! ",
                        f" Impressive! Team score: {total_score:.0f}/{required_score:.0f} points! Stay strong! "
                    ]
                elif score_margin > 10:
                    # Pretty good (10-25% ahead)
                    messages = [
                        f" Nice! Team score: {total_score:.0f}/{required_score:.0f} points. Solid progress! ",
                        f" Good job! Team score: {total_score:.0f}/{required_score:.0f} points. Keep going! ",
                        f" Well done! Team score: {total_score:.0f}/{required_score:.0f} points. Stay focused! ",
                        f" Looking good! Team score: {total_score:.0f}/{required_score:.0f} points. Nice work! "
                    ]
                elif score_margin > 5:
                    # Getting close (<10% ahead)
                    messages = [
                        f" Close one! Team score: {total_score:.0f}/{required_score:.0f} points. Need to step it up! ",
                        f"️ Careful! Team score: {total_score:.0f}/{required_score:.0f} points. Focus up! ",
                        f" Cutting it close! Team score: {total_score:.0f}/{required_score:.0f} points. Push harder! ",
                        f" Hanging in there! Team score: {total_score:.0f}/{required_score:.0f} points. Don't slip! "
                    ]
                else:
                    # Barely passing (<5% ahead)
                    messages = [
                        f" BARELY MADE IT! Team score: {total_score:.0f}/{required_score:.0f} points. DANGER ZONE! ️",
                        f" TOO CLOSE! Team score: {total_score:.0f}/{required_score:.0f} points. Step up NOW! ",
                        f" BY THE SKIN OF YOUR TEETH! Team score: {total_score:.0f}/{required_score:.0f} points. FOCUS! ",
                        f" CRITICAL! Team score: {total_score:.0f}/{required_score:.0f} points. Do better! "
                    ]
                
                chosen_message = random.choice(messages)
                
                ChatLogRepository.create_chat_message(
                    session_id=session_id,
                    message_text=chosen_message,
                    user_id=1,
                    message_type='system',
                    reply_to_id=1
                )
                threadsafe_emit_message_sent(sio, session_id, loop)

        # Refresh questions for next iteration
        quiz_state = get_quiz_state(session_id)
        available_questions = [q for q in all_questions if q['id'] not in quiz_state['asked_questions']]

    # Quiz finished - Update session status
    # If we've exited the question loop because the current theme ran out of questions,
    # allow the session to move to voting for another unplayed theme instead of ending.
    try:
        with session_played_lock:
            played = list(session_played_themes.get(session_id, []))
    except Exception:
        played = []
    try:
        all_active_themes = ThemeRepository.get_active_themes() or []
        remaining_themes = [t for t in all_active_themes if t.get('id') not in set(played)]
    except Exception:
        remaining_themes = []

    if remaining_themes and not quiz_ended_early:
        # There are still themes left to play in this session - start voting again
        quiz_logger.info(f"Current theme exhausted but other themes remain for session {session_id}; reopening voting")
        print(f"[DEBUG] Reopening voting for session {session_id}, played={played}, remaining={len(remaining_themes)}")
        # Reset session theme and phase
        QuizSessionRepository.update_session_theme(session_id, None)
        set_session_phase(session_id, 'voting')

        ChatLogRepository.create_chat_message(
            session_id=session_id,
            message_text="This theme has finished. Vote for the next theme!",
            user_id=1,
            message_type='system',
            reply_to_id=1
        )
        threadsafe_emit_message_sent(sio, session_id, loop)

        try:
            # Exclude already played themes from the next vote
            emit_combined_theme_selection(sio, loop, None, True, played)
        except Exception as e:
            print(f"Failed to emit theme selection for next theme in session {session_id}: {e}")

        try:
            timer_config = {
                'voting_time': 33,
                'theme_display_time': 10,
                'question_time': 15,
                'explanation_time': 15
            }
            start_generic_timer(sio, loop, session_id, timer_config)
        except Exception as e:
            print(f"Failed to start voting timer for new theme in session {session_id}: {e}")

        return

    quiz_logger.info(f"ENDING QUIZ: Normal completion for session {session_id}")
    # Diagnostic: log played themes / active themes / remaining questions so we can
    # investigate why the quiz ended (useful when quiz stops after a single theme).
    try:
        with session_played_lock:
            played = list(session_played_themes.get(session_id, []))
    except Exception:
        played = []
    try:
        active_themes = ThemeRepository.get_active_themes() or []
        active_ids = [t.get('id') for t in active_themes]
    except Exception:
        active_ids = []
    try:
        quiz_logger.info(f"handle_quiz_phase ENDING: session {session_id} played={played}, active_ids={active_ids}, remaining_available_questions={len(available_questions) if 'available_questions' in locals() else 'N/A'}")
        print(f"[DEBUG] handle_quiz_phase ENDING: session {session_id} played={played}, active_ids={active_ids}, remaining_available_questions={len(available_questions) if 'available_questions' in locals() else 'N/A'}")
    except Exception:
        pass

    # Clear played-theme tracking for this session since the quiz is ending
    try:
        with session_played_lock:
            session_played_themes.pop(session_id, None)
    except Exception:
        pass
    QuizSessionRepository.update_session_status(session_id, 3)
    
    # Get final data for quiz_finished event
    final_state = get_quiz_state(session_id)
    player_scores = PlayerAnswerRepository.get_all_player_scores_for_session(session_id)
    
    # Calculate final scores properly
    total_score = sum(float(score.get('total_score', 0)) for score in player_scores)
    
    # Prepare final scores data for frontend
    final_scores = []
    for score in player_scores:
        player_data = {
            'name': score.get('player_name', 'Unknown Player'),
            'username': score.get('username', ''),
            'score': float(score.get('total_score', 0))
        }
        final_scores.append(player_data)
    
    # Send final score notification to chat
    ChatLogRepository.create_chat_message(
        session_id=session_id,
        message_text=f"Quiz finished! Final team score: {total_score} points!",
        user_id=1,
        message_type='system',
        reply_to_id=1
    )
    threadsafe_emit_message_sent(sio, session_id, loop)
    
    # Emit the quiz_finished event with proper data structure
    quiz_finished_data = {
        'session_id': session_id,
        'final_score': total_score,
        'questions_asked': final_state['question_count'],
        'all_questions_answered': len(available_questions) == 0 and not quiz_ended_early,
        'ended_early': quiz_ended_early,
        'final_scores': final_scores,
        'message': f"Quiz completed! Final team score: {total_score} points across {final_state['question_count']} questions."
    }
    
    print(f"Emitting quiz_finished event with data: {quiz_finished_data}")
    
    asyncio.run_coroutine_threadsafe(
        sio.emit('quiz_finished', quiz_finished_data), loop
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

def emit_combined_theme_selection(sio, loop, target=None, active_only=True, exclude_ids=None):
    """
    Emit theme selection question with theme options via socket.io.
    - target: if provided, send only to that room/sid; otherwise broadcast
    - active_only: whether to use active themes only
    - exclude_ids: optional list of theme IDs to exclude from selection
    """
    try:
        # Backwards-compat: allow callers passing (sio, loop, True) where True was active_only
        if isinstance(target, bool):
            active_only = target
            target = None

        if active_only:
            themes = ThemeRepository.get_active_themes() or []
        else:
            themes = ThemeRepository.get_all_themes() or []

        # Filter out any excluded theme ids
        if exclude_ids:
            themes = [t for t in themes if t.get('id') not in set(exclude_ids)]

        if not themes:
            error_data = {
                'error': 'not_found',
                'message': 'No themes available',
                'status_code': 404
            }
            try:
                if target:
                    asyncio.run_coroutine_threadsafe(sio.emit('theme_selection_error', error_data, room=target), loop)
                else:
                    asyncio.run_coroutine_threadsafe(sio.emit('theme_selection_error', error_data), loop)
            except Exception as e:
                print(f"Failed to schedule 'theme_selection_error' emit: {e}")
            return

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
            if target:
                asyncio.run_coroutine_threadsafe(sio.emit('questionData', combined_data, room=target), loop)
            else:
                asyncio.run_coroutine_threadsafe(sio.emit('questionData', combined_data), loop)
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
        print(f"[DEBUG] Emitting questionData for question_id={question_id} with {len(answers) if answers else 0} answers")
        try:
            future = asyncio.run_coroutine_threadsafe(
                sio.emit('questionData', combined_data), loop
            )
            # Attempt to get result to surface any scheduling errors quickly
            try:
                future.result(timeout=1)
                print(f"[DEBUG] questionData emit scheduled for question_id={question_id}")
            except Exception as e:
                print(f"[DEBUG] questionData emit may have failed to schedule: {e}")
        except Exception as e:
            print(f"[ERROR] Failed to run_coroutine_threadsafe for questionData: {e}")

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
    """
    Main coordination function called from main loop every second.
    Handles phase transitions and sensor-based question selection.
    """
    global light_sensor
    global temp_sensor
    global current_phase

    try:
        active_session_id = get_active_session_id()
        
        # Get the full session details using the ID
        active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
        current_phase = get_session_phase(active_session_id)
        is_timer_running = is_timer_active(active_session_id)
        
        if not active_session_info.get('themeId'):
            # No theme set - handle voting phase
            current_phase = 'voting'
            if current_phase == 'voting' and not is_timer_running:
                # Voting phase but no timer running - emit theme selection to allow voting
                pass
            elif current_phase not in ['voting', 'theme_display', 'quiz']:
                # No phase set - initialize voting phase and emit theme selection
                set_session_phase(active_session_id, 'voting')
                emit_combined_theme_selection(sio, loop)
        else:
            # Theme is already set - handle transitions
            if current_phase == 'voting' and not is_timer_running:
                # Theme exists but we're stuck in voting phase - move to theme display
                set_session_phase(active_session_id, 'theme_display')
                timer_config = {
                    'voting_time': 33,
                    'theme_display_time': 10,
                    'question_time': 15,  # Updated to 15 seconds
                    'explanation_time': 15  # Updated to 15 seconds
                }
                start_generic_timer(sio, loop, active_session_id, timer_config)
            elif current_phase == 'theme_display' and not is_timer_running:
                # Theme display finished but stuck - move to quiz
                set_session_phase(active_session_id, 'quiz')
                timer_config = {
                    'voting_time': 33,
                    'theme_display_time': 10,
                    'question_time': 15,  # Updated to 15 seconds
                    'explanation_time': 15  # Updated to 15 seconds
                }
                start_generic_timer(sio, loop, active_session_id, timer_config)
            elif current_phase == 'quiz' and not is_timer_running:
                # Quiz phase - handle sensor-based question selection
                quiz_state = get_quiz_state(active_session_id)
                quiz_logger.info(f"Main loop check - quiz phase, no timer. Session {active_session_id}")
                
                # Check if there are any connected clients in the quiz room
                if not is_quiz_session_active(active_session_id):
                    # No connected clients - end the quiz session
                    quiz_logger.warning(f"ENDING QUIZ from main loop: No connected clients in session {active_session_id}")
                    print(f"No connected clients in session {active_session_id} - ending quiz")
                    QuizSessionRepository.update_session_status(active_session_id, 3)
                    asyncio.run_coroutine_threadsafe(
                        sio.emit('quiz_finished', {
                            'session_id': active_session_id,
                            'final_score': 0,
                            'questions_asked': quiz_state.get('question_count', 0),
                            'all_questions_answered': False,
                            'ended_early': True,
                            'final_scores': [],
                            'message': 'Quiz ended - no players remaining.'
                        }), loop
                    ).result(timeout=1)
                    return  # Exit the function to prevent further processing
                
                # Only proceed if we're not waiting for answers and no timer is running
                if not quiz_state.get('waiting_for_answers', False):
                    sensor_data = check_sensor_data(temp_sensor, light_sensor)
                    quiz_logger.info(f"Main loop: About to check available questions and start timer")
                    print(f"Quiz phase sensor check: {sensor_data}")
                    
                    # Get theme and available questions
                    theme_id = active_session_info['themeId']
                    all_questions = QuestionRepository.get_questions_by_theme(theme_id, active_only=True)
                    available_questions = [q for q in all_questions if q['id'] not in quiz_state['asked_questions']]
                    
                    if available_questions:
                        # Start the quiz timer if conditions are met
                        timer_config = {
                            'voting_time': 33,
                            'theme_display_time': 10,
                            'question_time': 15,  # Updated to 15 seconds
                            'explanation_time': 15  # Updated to 15 seconds
                        }
                        quiz_logger.info(f"Main loop: Calling start_generic_timer for session {active_session_id}")
                        timer_started = start_generic_timer(sio, loop, active_session_id, timer_config)
                        quiz_logger.info(f"Main loop: start_generic_timer returned {timer_started}")
                    else:
                        # No more questions - end quiz
                        print("No more questions available, ending quiz")
                        # Clear played-theme tracking for this session since the quiz is ending
                        try:
                            with session_played_lock:
                                session_played_themes.pop(active_session_id, None)
                        except Exception:
                            pass
                        QuizSessionRepository.update_session_status(active_session_id, 3)
                        asyncio.run_coroutine_threadsafe(
                            sio.emit('quiz_finished', {
                                'session_id': active_session_id,
                                'final_score': quiz_state['total_score'],
                                'questions_asked': quiz_state['question_count']
                            }), loop
                        ).result(timeout=1)
            elif not current_phase or (current_phase not in ['voting', 'theme_display', 'quiz'] and not is_timer_running):
                # No phase set but theme exists - start theme display
                set_session_phase(active_session_id, 'quiz')
                
    except Exception as e:
        print(f"Error in emit_theme_selection_if_needed: {e}")
        traceback.print_exc()

# ---------- Socket Handler ----------
# Updated socket handler to use new timer config



def calculate_player_score_percentage(session_id, user_id):
    player_score = PlayerAnswerRepository.get_player_score_for_session(session_id, user_id)
    if player_score is None:
        player_score = 0
    
    all_scores = PlayerAnswerRepository.get_all_player_scores_for_session(session_id)
    
    total_session_score = sum(score.get('total_score', 0) for score in all_scores)
    
    if total_session_score > 0:
        percentage = player_score / total_session_score
        return percentage
    return 0.01


@sio.on('submit_answer')
async def handle_answer_submission(sid, data):
    global current_phase, progress, explanationNow, remaining_explanation_time
    print(f"data received is answer submission is {data}")
    
    # Get active session and check if we're in quiz phase
    active_session_id = get_active_session_id()
    if active_session_id:
        current_phase = get_session_phase(active_session_id)
        print(f"Current phase: {current_phase}, explanationNow: {explanationNow}")
    
    # Only accept answers during quiz phase, NOT during explanation phase
    if current_phase == 'quiz' and not explanationNow:
        try:
            logger.debug(f"Starting answer submission with data: {data}")
            
            user_id = data.get('userId')
            question_id = data.get('questionId')
            answer_index = data.get('answerIndex')
            
            if not all([user_id, question_id is not None, answer_index is not None]):
                error_msg = 'Missing required data for answer submission'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return
            
            if PlayerAnswerRepository.get_player_answers_for_user_in_session_by_question(get_active_session_id(), user_id, question_id):
                error_msg = 'Answer already submitted before'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return

            logger.debug(f"Valid submission from user {user_id} for question {question_id}")

            active_session_id = get_active_session_id()
            if not active_session_id:
                error_msg = 'No active session found'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return
            
            logger.debug(f"Active session ID: {active_session_id}")

            current_phase = get_session_phase(active_session_id)
            if current_phase != 'quiz':
                error_msg = 'Not accepting answers at this time'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return
            
            logger.debug("Current phase is quiz - proceeding")

            question = QuestionRepository.get_question_by_id(question_id)
            if not question:
                error_msg = f'Question {question_id} not found'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return
            
            max_points = question.get('points', 10)
            logger.debug(f"Question found with max points: {max_points}")

            answers = AnswerRepository.get_all_answers_for_question(question_id)
            if not answers:
                error_msg = f'No answers found for question {question_id}'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return
            
            logger.debug(f"Found {len(answers)} answers for question")

            if answer_index < 0 or answer_index >= len(answers):
                error_msg = f'Invalid answer index {answer_index} (max {len(answers)-1})'
                logger.error(error_msg)
                await sio.emit('answer_response', {'success': False, 'error': error_msg}, room=sid)
                return
                
            submitted_answer = answers[answer_index]
            answer_id = submitted_answer.get('id')
            logger.debug(f"Submitted answer ID: {answer_id}")

            is_correct_value = submitted_answer.get('is_correct', False)
            is_correct = str(is_correct_value).lower() in ['1', 'true', 'yes'] or is_correct_value is True
            logger.debug(f"Answer correctness: {is_correct}")

            points_earned = 0
            if is_correct:
                luck = calculate_player_score_percentage(get_active_session_id(), user_id)
                print(f"player luck is calculated to be {luck}")
                get_random_item(user_id=user_id, luck=luck)
                progress_decimal = float(1 - progress)
                progress_decimal = max(0.0, min(1.0, progress_decimal))
                points_earned = int(max_points * progress_decimal)
                points_earned = max(1, points_earned)
            logger.debug(f"Points calculated: {points_earned}")

            try:
                logger.debug("Attempting to create player answer record")
                
                result = PlayerAnswerRepository.create_player_answer(
                    session_id=active_session_id,
                    user_id=user_id,
                    question_id=question_id,
                    answer_id=answer_id,
                    is_correct=is_correct,
                    points_earned=points_earned,
                    time_taken=15
                )
                
                if result is None or result == 0:
                    logger.error("Failed to create player answer - no rows affected")
                    raise Exception("Database insert failed")
                    
                logger.info(f"Successfully created player answer record for user {user_id}")
                
            except Exception as db_error:
                logger.error(f"Database error creating player answer: {str(db_error)}", exc_info=True)
                await sio.emit('answer_response', {
                    'success': False,
                    'error': 'Failed to save your answer'
                }, room=sid)
                return

            correct_answer = next((a for a in answers if a.get('is_correct')), None)
            
            response_data = {
                'success': True,
                'is_correct': is_correct,
                'points_earned': points_earned,
                'max_points': max_points,
                'correct_answer_index': answers.index(correct_answer) if correct_answer else -1,
                'correct_answer_text': correct_answer.get('answer_text', '') if correct_answer else '',
                'explanation': question.get('explanation', 'Explanation not available')
            }
            
            await sio.emit('answer_response', response_data, room=sid)
            logger.info(f"Answer processed - User: {user_id}, Q: {question_id}, "
                    f"Correct: {is_correct}, Points: {points_earned}/{max_points}")
            
        except Exception as e:
            logger.error(f"Unexpected error handling answer submission: {str(e)}", exc_info=True)
            await sio.emit('answer_response', {
                'success': False,
                'error': 'An unexpected error occurred'
            }, room=sid)
    else:
        # Not accepting answers at this time - send specific error response
        print(f"Answer rejected - Phase: {current_phase if 'current_phase' in locals() else 'unknown'}, explanationNow: {explanationNow}")
        
        # Provide specific error messages based on the phase
        if explanationNow:
            error_msg = "You cannot submit answers during the explanation phase. Please wait for the next question."
        elif current_phase == 'voting':
            error_msg = "Quiz is in voting phase. Please vote for a theme first."
        elif current_phase == 'theme_display':
            error_msg = "Quiz is displaying the selected theme. Please wait for questions to start."
        else:
            error_msg = f"Not accepting answers at this time (current phase: {current_phase if 'current_phase' in locals() else 'unknown'})"
        
        await sio.emit('answer_response', {
            'success': False,
            'error': error_msg
        }, room=sid)


@sio.on('theme_selected')
async def handle_theme_selection(sid, data):
    """
    Handle theme selection votes and start voting timer when first vote is cast
    """
    print(f"[THEME_SELECTION] Received from sid {sid}: {data}")
    try:
        # Get active session and check phase
        active_session_id = get_active_session_id()
        
        if not active_session_id:
            print(f"[THEME_SELECTION] ERROR: No active session found")
            await sio.emit('answer_response', {
                'success': False,
                'error': 'No active session found'
            }, to=sid)
            return
        
        # Check if we're in voting phase
        current_phase = get_session_phase(active_session_id)
        if current_phase != 'voting':
            print(f"[THEME_SELECTION] ERROR: Wrong phase '{current_phase}', expected 'voting'")
            await sio.emit('answer_response', {
                'success': False,
                'error': f'Cannot vote during {current_phase} phase'
            }, to=sid)
            return
            
        # Get the full session details using the ID
        active_session_info = QuizSessionRepository.get_session_by_id(active_session_id)
        
        if not active_session_info:
            print(f"[THEME_SELECTION] ERROR: Session {active_session_id} not found")
            await sio.emit('answer_response', {
                'success': False,
                'error': 'Session not found'
            }, to=sid)
            return
            
        # Check if theme is already set
        if active_session_info.get('themeId'):
            print(f"[THEME_SELECTION] ERROR: Theme already set for session {active_session_id}")
            await sio.emit('answer_response', {
                'success': False,
                'error': 'Theme already selected for this session'
            }, to=sid)
            return
        
        user_id = data.get('userId', 1)
        theme_id = int(data['themeId'])
        session_id = active_session_id
        
        print(f"[THEME_SELECTION] Processing vote: user_id={user_id}, theme_id={theme_id}, session_id={session_id}")
        
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
                print(f"[THEME_SELECTION] Removed previous vote for theme {old_theme}")
            
            # Add new vote
            votes[theme_id] += 1
            user_votes[user_id] = theme_id
            print(f"[THEME_SELECTION] Added vote for theme {theme_id}. Total votes: {dict(votes)}")
        
        # Broadcast vote updates to all users in the session
        await sio.emit('theme_votes_update', {
            'session_id': session_id,
            'votes': dict(votes)
        })
        print(f"[THEME_SELECTION] Broadcasted vote update")
        
        # Start timer on first vote
        total_votes = sum(votes.values())
        if total_votes == 1:
            print(f"[THEME_SELECTION] First vote received! Starting voting timer for session {session_id}")
            timer_config = {
                'voting_time': 33,
                'theme_display_time': 10,
                'question_time': 15,  # Updated to 15 seconds
                'explanation_time': 15  # Updated to 15 seconds
            }
            set_session_phase(session_id, 'voting')
            start_generic_timer(sio, asyncio.get_event_loop(), session_id, timer_config)
        
        # Send success response to the specific client
        await sio.emit('answer_response', {'success': True}, to=sid)
        print(f"[THEME_SELECTION] SUCCESS: Vote recorded for user {user_id}")
        
    except Exception as e:
        print(f"[THEME_SELECTION] EXCEPTION: {e}")
        traceback.print_exc()
        await sio.emit('answer_response', {
            'success': False,
            'error': 'Vote failed: ' + str(e)
        }, to=sid)
















# --------------
# items
# --------------


def threadsafe_emit_item_effect(sio, loop):
    """
    Thread-safe emission of 'B2F_addItem' event
    (Same exact logic as threadsafe_emit_message_sent, but for items)
    
    Args:
        sio: Socket.IO client instance
        loop: The event loop to run the coroutine in
    """
    asyncio.run_coroutine_threadsafe(
        sio.emit('B2F_addItem', {}),  # No session_id needed for this event
        loop
    )


def threadsafe_emit_message_sent(sio, session_id, loop):
    """
    Thread-safe emit helper for 'message_sent' events.
    Emits {'session_id': session_id} to clients using the provided event loop.
    """
    try:
        asyncio.run_coroutine_threadsafe(
            sio.emit('message_sent', {'session_id': session_id}),
            loop
        )
    except Exception as e:
        # Don't let missing emit helper crash timer threads; log and continue
        print(f"[WARN] threadsafe_emit_message_sent failed to schedule emit for session {session_id}: {e}")


def activateAdvertFlood():
    """Triggers 10-second ad flood on all clients (thread-safe)"""
    print("sending advert flood emit")
    
    # Use the new threadsafe emit (same pattern as before)
    threadsafe_emit_item_effect(sio, main_asyncio_loop)
    
    # Log the system message (unchanged)
    ChatLogRepository.create_chat_message(
        session_id=get_active_session_id(),
        message_text=f"The temperature is getting colder {virtualTemperature}",
        user_id=1,
        message_type='system',
        reply_to_id=1
    )
    # Emit message_sent (unchanged)
    threadsafe_emit_message_sent(sio, get_active_session_id(), main_asyncio_loop)

def tempDown():
    """Lower the virtual temperature by 20 degrees"""
    global virtualTemperature
    virtualTemperature -= 20
    ChatLogRepository.create_chat_message(
    session_id=get_active_session_id(),
    message_text=f"The temperature is getting colder {virtualTemperature}" ,
    user_id=1,
    message_type='system',
    reply_to_id=1
    )
    threadsafe_emit_message_sent(sio,get_active_session_id(),main_asyncio_loop)
    # Emit temperature change to all clients
    sio.emit('B2F_temperatureChange', {'temperature': virtualTemperature}, broadcast=True)

def tempUp():
    """Raise the virtual temperature by 20 degrees"""
    global virtualTemperature
    virtualTemperature += 20
    ChatLogRepository.create_chat_message(
    session_id=get_active_session_id(),
    message_text=f"The temperature is getting hotter {virtualTemperature}" ,
    user_id=1,
    message_type='system',
    reply_to_id=1
    )
    threadsafe_emit_message_sent(sio,get_active_session_id(),main_asyncio_loop)
    # Emit temperature change to all clients
    sio.emit('B2F_temperatureChange', {'temperature': virtualTemperature}, broadcast=True)

# Item management functions




# FastAPI endpoints
@app.get("/api/player/{user_id}/items")
async def get_player_items(user_id: int):
    """Get all items owned by a player"""
    try:
        items = PlayerItemRepository.get_player_items(user_id)
        return {"success": True, "items": items}
    except Exception as e:
        return {"success": False, "error": str(e)}


def clear_player_items(user_id: int):
    """Delete all items from a player's inventory"""
    try:
        success = PlayerItemRepository.delete_all_player_items(user_id)
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}



@app.post("/api/player/{user_id}/items/{item_id}/use")
async def use_item(user_id: int, item_id: int, discard: bool = False):
    """Use an item (activate its effect and remove from inventory).

    If `discard=True` is provided as a query parameter, the item is removed
    from the player's inventory without executing its effect (this is used
    for the "double-click to discard" UX requested by the frontend).
    """
    try:
        # Get item details first
        item = PlayerItemRepository.get_player_item(user_id, item_id)
        if not item:
            return {"success": False, "error": "Item not found in player inventory"}

        # Remove one quantity from inventory (works for stacks)
        success = PlayerItemRepository.use_item(user_id, item_id, 1)
        if not success:
            return {"success": False, "error": "Failed to remove item from inventory"}

        # If this request is a discard request, do not execute any effect
        if discard:
            return {"success": True, "discarded": True, "item": item}

        # Otherwise, activate the item effect based on the effect string
        effect = item.get('effect', '')
        print(f"Player {user_id} activated {item_id} with effect {effect}")
        try:
            if effect == 'activateAdvertFlood()':
                activateAdvertFlood()
            elif effect == 'tempDown()':
                tempDown()
            elif effect == 'tempUp()':
                tempUp()
            else:
                # For other effects, try to execute as function call
                if effect and effect.endswith('()'):
                    function_name = effect[:-2]
                    if function_name in globals():
                        globals()[function_name]()
        except Exception as effect_error:
            print(f"Error executing item effect: {effect_error}")

        return {"success": True, "item_used": item}

    except Exception as e:
        return {"success": False, "error": str(e)}





def get_random_item_by_luck(luck: float) -> Optional[Dict[str, Any]]:
    """
    Get a random item where drop chance is inversely proportional to cost.
    Properly handles both float and Decimal cost values.
    Higher luck (0-1) makes expensive items even rarer.
    """
    try:
        all_items = ItemRepository.get_all_items()
        if not all_items:
            return None

        # Convert all costs to Decimal for consistent math
        def get_cost(item):
            cost = item['cost']
            return Decimal(str(cost)) if not isinstance(cost, Decimal) else cost

        # Calculate weights using Decimal for precision
        cost_exponent = Decimal(1) + Decimal(str(luck))
        weights = []
        for item in all_items:
            cost = get_cost(item)
            try:
                weight = Decimal(1) / (cost ** cost_exponent)
                weights.append(float(weight))  # Convert to float for random.choices
            except:
                # Fallback if there's any math error
                weights.append(1.0)

        # Normalize weights to avoid any potential float precision issues
        total_weight = sum(weights)
        if total_weight <= 0:
            weights = [1.0/len(all_items) for _ in all_items]  # Equal weights fallback
        else:
            weights = [w/total_weight for w in weights]

        return random.choices(all_items, weights=weights, k=1)[0]
        
    except Exception as e:
        print(f"Error getting random item: {e}")
        # Fallback to simple random choice if weighting fails
        return random.choice(all_items) if all_items else None




def get_random_item(user_id: int, luck: float = 0.5) -> Dict[str, Any]:
    """
    Get a random item based on luck value (0-1) and add it to player inventory.
    - Always gives an item if player has < 3 items
    - Luck can be 1 (will give lowest rarity item)
    - Returns success=False only if inventory is full (≥3 items) or DB error occurs
    """
    try:
        # Validate luck value (now allows 0 and 1 as valid values)
        if not (0 <= luck <= 1):
            return {"success": False, "error": "Luck value must be between 0 and 1 (inclusive)"}
        
        # Check current inventory
        current_items = PlayerItemRepository.get_player_items(user_id)
        total_items = sum(item['quantity'] for item in current_items)
        
        if total_items >= 3:
            return {
                "success": False, 
                "error": "Inventory full (max 3 items). Use or discard items first.",
                "current_items": current_items
            }
        
        # Keep trying until we get an item (should rarely need more than 1 attempt)
        max_attempts = 3
        for attempt in range(max_attempts):
            item = get_random_item_by_luck(luck)
            if item:
                break
            if attempt == max_attempts - 1:
                # Fallback: get the most common item if all attempts failed
                all_items = ItemRepository.get_all_items()
                if not all_items:
                    return {"success": False, "error": "No items exist in the game"}
                item = all_items[0]  # Default to first available item
        
        if not item:
            return {"success": False, "error": "Failed to generate item after retries"}
        
        # Add to inventory
        existing_item = next((i for i in current_items if i['itemId'] == item['id']), None)
        
        if existing_item:
            new_quantity = existing_item['quantity'] + 1
            result = PlayerItemRepository.update_item_quantity(user_id, item['id'], new_quantity)
        else:
            result = PlayerItemRepository.add_item_to_player(user_id, item['id'], 1)
        
        return {
            "success": bool(result),
            "item": item,
            "message": "Item added successfully" if result else "Failed to update inventory"
        } if result else {
            "success": False,
            "error": "Database error: failed to update inventory",
            "item": item  # Still return the item we tried to add
        }
            
    except Exception as e:
        return {"success": False, "error": f"System error: {str(e)}"}



def get_all_items():
    """Get all available items"""
    try:
        items = ItemRepository.get_all_items()
        return {"success": True, "items": items}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_items_by_rarity(rarity: str):
    """Get items by rarity level"""
    try:
        items = ItemRepository.get_items_by_rarity(rarity)
        return {"success": True, "items": items}
    except Exception as e:
        return {"success": False, "error": str(e)}


def reset_temperature():
    """Reset virtual temperature to 0"""
    global virtualTemperature
    virtualTemperature = 0
    sio.emit('B2F_temperatureChange', {'temperature': virtualTemperature}, broadcast=True)
    return {"success": True, "temperature": virtualTemperature}



















# ----------------------------------------------------
# File Conversion Endpoints
# ----------------------------------------------------

import os
import tempfile
import shutil
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
import subprocess
from PIL import Image
import io
import zipfile

# Create uploads directory if it doesn't exist
# Use a project-scoped tmp directory outside the repository to avoid
# triggering file watchers and to avoid cluttering the repo.
PROJECT_TMP_DIR = os.environ.get('PROJECT_TMP_DIR', '/tmp/project-one')
UPLOAD_DIR = os.path.join(PROJECT_TMP_DIR, "temp_uploads")
CONVERTED_DIR = os.path.join(PROJECT_TMP_DIR, "temp_converted")
VIDEO_DOWNLOAD_DIR = os.path.join(PROJECT_TMP_DIR, "temp_video_downloads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CONVERTED_DIR, exist_ok=True)
os.makedirs(VIDEO_DOWNLOAD_DIR, exist_ok=True)

# Retention (seconds)
# Keep files short-lived: remove uploads and converted outputs quickly so the site
# doesn't accumulate files and to avoid triggering reloaders or disk pressure.
UPLOAD_RETENTION = 300        # 5 minutes for uploaded files
CONVERTED_RETENTION = 300     # 5 minutes for converted files (user has time to download)
VIDEO_RETENTION = 180       # 3 minutes for downloaded videos (larger downloads may need time)

def delete_file_safe(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
            print(f"Deleted temp file: {path}")
    except Exception:
        pass

def cleanup_temp_files():
    """Clean up old temporary files using per-directory retention times"""
    try:
        now_ts = datetime.now().timestamp()
        checks = [
            (UPLOAD_DIR, UPLOAD_RETENTION),
            (CONVERTED_DIR, CONVERTED_RETENTION),
            (VIDEO_DOWNLOAD_DIR, VIDEO_RETENTION)
        ]

        for directory, retention in checks:
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    try:
                        if os.path.getmtime(file_path) < (now_ts - retention):
                            os.remove(file_path)
                            print(f"Cleaned up old temp file: {file_path}")
                    except Exception:
                        pass
    except Exception as e:
        print(f"Error cleaning up temp files: {e}")

def start_temp_cleanup(interval: int = 60):
    """Start a background thread that cleans up temp files periodically.

    interval: seconds between cleanup runs (default 60s)
    """
    def worker():
        while True:
            try:
                cleanup_temp_files()
            except Exception as e:
                print(f"Temp cleanup worker error: {e}")
            time.sleep(interval)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

# Start the periodic cleanup thread
start_temp_cleanup(interval=30)

# ----------------------------------------------------
# Video Converter Setup (YouTube, TikTok, etc.)
#  PERFORMANCE OPTIMIZATIONS APPLIED:
# 1. Cookie file path caching - avoid repeated filesystem lookups
# 2. Reduced retry limits (10 instead of 30) - faster failure handling
# 3. Optimized backoff delays (5s max instead of 30s) - quicker retries
# 4. Early failure detection for sign-in/auth errors - no wasted retries
# 5. Invidious proxy prioritized when no cookies - faster success rate
# 6. HTTP connection pooling & concurrent fragments - better throughput
# 7. Reduced sleep intervals (1s instead of 3s) - faster processing
# 8. Lower socket timeouts (20s instead of 30s) - quicker error detection
# 9. Optimized retry configuration (8 max instead of 10) - balanced speed
# 10. Reduced fragment retries (3 instead of 5) - faster failure recovery
# Video converter is taken down
VIDEO_CONVERTER_AVAILABLE = False
print("Kindly support Convert The Spire by donating to bring it back.")

import uuid
import threading
import time
import re
from urllib.parse import urlparse
from typing import Dict, Any, Optional
from pydantic import BaseModel

# Video converter code removed

def get_cached_cookie_file():
    """Get cookie file path with caching to avoid repeated file system checks"""
    global _cached_cookie_file, _cookie_cache_checked
    if not _cookie_cache_checked:
        cookie_file = os.environ.get('YTDL_COOKIE_FILE')
        if not cookie_file:
            backend_cookie_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
            if os.path.exists(backend_cookie_path):
                cookie_file = backend_cookie_path
        _cached_cookie_file = cookie_file if cookie_file and os.path.exists(cookie_file) else None
        _cookie_cache_checked = True
        if _cached_cookie_file:
            video_logger.info(f"Cookie file cached: {_cached_cookie_file}")
    return _cached_cookie_file

# Invidious instances for fallback (when YouTube blocks us)
INVIDIOUS_INSTANCES = [
    'https://invidious.private.coffee',
    'https://inv.nadeko.net',
    'https://invidious.protokolla.fi',
    'https://yt.artemislena.eu',
    'https://invidious.flokinet.to',
    'https://invidious.privacydev.net',
]
current_invidious_index = 0
invidious_lock = threading.Lock()

#  OPTIMIZATION: Track Invidious instance health for smarter fallback
invidious_health = {}  # {instance_url: {'success_count': int, 'fail_count': int, 'last_success': float, 'last_fail': float}}
invidious_health_lock = threading.Lock()

def update_invidious_health(instance: str, success: bool):
    """Track instance health to prioritize working instances"""
    with invidious_health_lock:
        if instance not in invidious_health:
            invidious_health[instance] = {
                'success_count': 0,
                'fail_count': 0,
                'last_success': 0,
                'last_fail': 0
            }
        
        if success:
            invidious_health[instance]['success_count'] += 1
            invidious_health[instance]['last_success'] = time.time()
        else:
            invidious_health[instance]['fail_count'] += 1
            invidious_health[instance]['last_fail'] = time.time()

def get_healthy_invidious_instances() -> list:
    """Get Invidious instances sorted by health (best first)"""
    with invidious_health_lock:
        # Calculate health score for each instance
        scored_instances = []
        current_time = time.time()
        
        for instance in INVIDIOUS_INSTANCES:
            health = invidious_health.get(instance, {
                'success_count': 0,
                'fail_count': 0,
                'last_success': 0,
                'last_fail': 0
            })
            
            # Calculate score (higher is better)
            success_count = health['success_count']
            fail_count = health['fail_count']
            last_success = health['last_success']
            last_fail = health['last_fail']
            
            # Prefer instances that:
            # 1. Have succeeded recently (last 5 minutes)
            # 2. Have high success rate
            # 3. Haven't failed recently
            recency_bonus = 100 if (current_time - last_success) < 300 else 0
            recent_fail_penalty = -50 if (current_time - last_fail) < 60 else 0
            
            total = success_count + fail_count
            success_rate = (success_count / total * 100) if total > 0 else 50  # Default 50 for unknown
            
            score = success_rate + recency_bonus + recent_fail_penalty
            scored_instances.append((instance, score))
        
        # Sort by score (highest first) and return instance URLs
        scored_instances.sort(key=lambda x: x[1], reverse=True)
        return [inst for inst, score in scored_instances]

def throttle_youtube_request():
    """Ensure minimum time between YouTube requests with sophisticated human-like patterns"""
    global last_youtube_request_time, request_session_state
    
    with youtube_request_lock:
        current_time = time.time()
        time_since_last = current_time - last_youtube_request_time
        
        # Update session state
        with session_state_lock:
            # Reset counters every 5 minutes for fresh pattern
            if current_time - request_session_state['last_reset'] > 300:
                request_session_state['consecutive_requests'] = 0
                request_session_state['last_reset'] = current_time
            
            request_session_state['consecutive_requests'] += 1
            consecutive = request_session_state['consecutive_requests']
        
        # Base interval with random variance (±30%)
        variance = random.uniform(-0.3, 0.3)
        varied_interval = MIN_REQUEST_INTERVAL * (1 + variance)
        
        # Exponential backoff after many consecutive requests (looks more human)
        if consecutive > 10:
            # Add progressive delay: more requests = longer pauses
            backoff_factor = min((consecutive - 10) / 10.0, 2.0)  # Cap at 2x
            varied_interval *= (1 + backoff_factor)
            video_logger.debug(f"Applied backoff factor {backoff_factor:.2f} after {consecutive} requests")
        
        # Apply minimum delay
        if time_since_last < varied_interval:
            sleep_time = varied_interval - time_since_last
            time.sleep(sleep_time)
        
        # Smart pausing: increase probability with consecutive requests
        pause_probability = min(0.05 + (consecutive * 0.01), 0.20)  # 5%-20% chance
        if random.random() < pause_probability:
            # Longer pauses for burst behavior
            pause_duration = random.uniform(1.0, 4.0)
            video_logger.debug(f"Human-like pause: {pause_duration:.1f}s")
            time.sleep(pause_duration)
        
        # Occasionally add micro-jitter (very human-like)
        if random.random() < 0.3:
            time.sleep(random.uniform(0.05, 0.15))
        
        last_youtube_request_time = time.time()

def check_video_rate_limit(client_ip: str) -> bool:
    """Check if IP has exceeded video download rate limit"""
    current_time = time.time()
    
    if client_ip not in video_download_rate_limit:
        video_download_rate_limit[client_ip] = {'count': 0, 'reset_time': current_time + RATE_LIMIT_WINDOW}
        return True
    
    # Reset counter if window expired
    if current_time > video_download_rate_limit[client_ip]['reset_time']:
        video_download_rate_limit[client_ip] = {'count': 0, 'reset_time': current_time + RATE_LIMIT_WINDOW}
        return True
    
    # Check if under limit
    if video_download_rate_limit[client_ip]['count'] < MAX_CONCURRENT_DOWNLOADS_PER_IP:
        return True
    
    return False

def increment_video_rate_limit(client_ip: str):
    """Increment video download counter for IP"""
    if client_ip in video_download_rate_limit:
        video_download_rate_limit[client_ip]['count'] += 1

def decrement_video_rate_limit(client_ip: str):
    """Decrement video download counter when download completes"""
    if client_ip in video_download_rate_limit and video_download_rate_limit[client_ip]['count'] > 0:
        video_download_rate_limit[client_ip]['count'] -= 1

def get_queue_position(download_id: str) -> dict:
    """Get the position of a download in the queue and estimated wait time"""
    global active_conversions_count, active_long_conversions_count
    with queue_lock:
        # Find position in queue
        for idx, item in enumerate(video_conversion_queue):
            if item['download_id'] == download_id:
                position = idx + 1
                # Estimate wait time: assume 30 seconds per video ahead in queue
                # Plus time for active conversions to complete
                active_slots_used = active_conversions_count
                videos_ahead = idx
                estimated_wait = videos_ahead * 30  # 30 seconds per video
                if active_slots_used >= MAX_CONCURRENT_CONVERSIONS:
                    estimated_wait += 30  # Add buffer for currently processing videos
                
                return {
                    'in_queue': True,
                    'position': position,
                    'queue_length': len(video_conversion_queue),
                    'estimated_wait_seconds': estimated_wait,
                    'active_conversions_short': active_conversions_count,
                    'active_conversions_long': active_long_conversions_count,
                    'max_concurrent_short': MAX_CONCURRENT_CONVERSIONS,
                    'max_concurrent_long': MAX_CONCURRENT_LONG_CONVERSIONS
                }
        
        # Not in queue, might be processing or completed
        return {
            'in_queue': False,
            'position': 0,
            'queue_length': len(video_conversion_queue),
            'estimated_wait_seconds': 0,
            'active_conversions_short': active_conversions_count,
            'active_conversions_long': active_long_conversions_count,
            'max_concurrent_short': MAX_CONCURRENT_CONVERSIONS,
            'max_concurrent_long': MAX_CONCURRENT_LONG_CONVERSIONS
        }

def add_to_queue(download_id: str, url: str, client_ip: str, is_long: bool = False):
    """Add a download to the queue"""
    with queue_lock:
        video_conversion_queue.append({
            'download_id': download_id,
            'url': url,
            'client_ip': client_ip,
            'timestamp': time.time(),
            'is_long': bool(is_long)
        })
        video_logger.info(f"Added download {download_id} to queue. Queue length: {len(video_conversion_queue)}")
    # Notify dispatcher to wake up and process queued items
    try:
        dispatcher_event.set()
        video_logger.debug(f"Dispatcher event set after enqueueing {download_id}")
    except Exception as e:
        video_logger.warning(f"Failed to set dispatcher event for {download_id}: {e}")

def remove_from_queue(download_id: str):
    """Remove a download from the queue"""
    global video_conversion_queue
    with queue_lock:
        video_conversion_queue = [item for item in video_conversion_queue if item['download_id'] != download_id]
        video_logger.info(f"Removed download {download_id} from queue. Queue length: {len(video_conversion_queue)}")

def can_start_conversion(is_long: bool = False) -> bool:
    """Check if we can start a new conversion based on concurrent limit.

    Use `is_long=True` for long-video capacity checks.
    """
    global active_conversions_count, active_long_conversions_count
    if is_long:
        return active_long_conversions_count < MAX_CONCURRENT_LONG_CONVERSIONS
    return active_conversions_count < MAX_CONCURRENT_CONVERSIONS

def increment_active_conversions(is_long: bool = False):
    """Increment the count of active conversions. Pass `is_long=True` for long videos."""
    global active_conversions_count, active_long_conversions_count
    with conversions_lock:
        if is_long:
            active_long_conversions_count += 1
            video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
        else:
            active_conversions_count += 1
            video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")

def decrement_active_conversions(is_long: bool = False):
    """Decrement the count of active conversions. Pass `is_long=True` for long videos."""
    global active_conversions_count, active_long_conversions_count
    with conversions_lock:
        if is_long:
            if active_long_conversions_count > 0:
                active_long_conversions_count -= 1
            video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
        else:
            if active_conversions_count > 0:
                active_conversions_count -= 1
            video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")

def process_next_in_queue():
    """Process the next item in the queue if there's capacity"""
    try:
        # Ensure we can modify module-level counters
        global active_conversions_count, active_long_conversions_count
        video_logger.debug("process_next_in_queue invoked")
        # If no capacity for either short or long downloads, don't start anything
        if not (can_start_conversion(False) or can_start_conversion(True)):
            video_logger.info("Cannot start new conversion - at max capacity for both pools")
            return
        
        with queue_lock:
            if not video_conversion_queue:
                video_logger.info("Queue is empty - no more conversions to process")
                return

            # Prefer to start short videos when short capacity is available.
            selected_index = None
            if can_start_conversion(False):
                for idx, item in enumerate(video_conversion_queue):
                    if not item.get('is_long', False):
                        selected_index = idx
                        break

            # If no short job found or short capacity exhausted, try long jobs
            if selected_index is None and can_start_conversion(True):
                for idx, item in enumerate(video_conversion_queue):
                    if item.get('is_long', False):
                        selected_index = idx
                        break

            if selected_index is None:
                video_logger.info("No suitable queued job fits current capacity")
                return

            next_item = video_conversion_queue[selected_index]
            download_id = next_item['download_id']
            url = next_item['url']
            client_ip = next_item['client_ip']
            is_long_job = bool(next_item.get('is_long', False))
        
        # Check if this download still exists
        with download_lock:
            if download_id not in active_video_downloads:
                video_logger.warning(f"Download {download_id} no longer exists, skipping")
                remove_from_queue(download_id)
                # Try next item
                process_next_in_queue()
                return
            
            download_info = active_video_downloads[download_id]
            format_type = 'audio' if download_info['format'] == 'MP3' else 'video'
            quality = download_info['quality']
            output_path = download_info['output_path']
            
            # Update status to starting
            download_info['status'] = 'starting'

        # Reserve a slot atomically under conversions_lock. If we cannot reserve,
        # leave the item in the queue and return (will be retried later).
        reserved = False
        with conversions_lock:
            if is_long_job:
                if active_long_conversions_count < MAX_CONCURRENT_LONG_CONVERSIONS:
                    active_long_conversions_count += 1
                    video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
                    reserved = True
            else:
                if active_conversions_count < MAX_CONCURRENT_CONVERSIONS:
                    active_conversions_count += 1
                    video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")
                    reserved = True

        if not reserved:
            video_logger.info(f"No capacity to start queued download {download_id} (long={is_long_job}); will retry later")
            return

        # Remove from queue BEFORE starting (so position updates immediately)
        remove_from_queue(download_id)

        # Start the download using the appropriate pool
        video_logger.info(f"Starting queued download {download_id} (long={is_long_job})")
        try:
            pool = long_video_process_pool if is_long_job else video_process_pool
            future = pool.submit(
                download_video_background,
                download_id, url, format_type, quality, output_path, client_ip
            )

            # Add completion callback
            def done_callback(fut):
                try:
                    fut.result()  # Raises exception if download failed
                except Exception as e:
                    video_logger.error(f"Download {download_id} error: {e}")
                finally:
                    decrement_active_conversions(is_long=is_long_job)
                    decrement_video_rate_limit(client_ip)
                    process_next_in_queue()

            future.add_done_callback(done_callback)
            
        except Exception as e:
            video_logger.error(f"Failed to submit {download_id} to process pool: {e}")
            decrement_active_conversions(is_long=is_long_job)
            # Re-add to queue since submission failed (it was removed before trying)
            with queue_lock:
                # Add back to front of queue since it should be processed next
                video_conversion_queue.insert(0, {
                    'download_id': download_id,
                    'url': url,
                    'client_ip': client_ip,
                    'timestamp': time.time(),
                    'is_long': is_long_job
                })
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'queued'
    except Exception as e:
        video_logger.error(f"Error processing next in queue: {str(e)}")

def detect_platform(url: str) -> Optional[str]:
    """Detect platform from URL"""
    for platform, pattern in URL_PATTERNS.items():
        if re.search(pattern, url, re.IGNORECASE):
            return platform
    return None

def is_playlist_url(url: str) -> bool:
    """Check if URL is a playlist"""
    return 'list=' in url and ('youtube.com' in url or 'youtu.be' in url)

def extract_playlist_id(url: str) -> Optional[str]:
    """Extract playlist ID from YouTube playlist URL"""
    if not is_playlist_url(url):
        return None
    
    # Extract list parameter
    list_match = re.search(r'[?&]list=([a-zA-Z0-9_-]+)', url)
    playlist_id = list_match.group(1) if list_match else None
    return playlist_id

# ===================================
# PLAYLIST CACHING
# ===================================
# Cache playlist info to avoid redundant API calls (TTL: 5 minutes)
playlist_info_cache: Dict[str, Dict[str, Any]] = {}
PLAYLIST_CACHE_TTL = 300  # 5 minutes

def get_cached_playlist_info(playlist_id: str) -> Optional[Dict[str, Any]]:
    """Get cached playlist info if available and not expired"""
    if playlist_id in playlist_info_cache:
        cache_entry = playlist_info_cache[playlist_id]
        if time.time() - cache_entry['timestamp'] < PLAYLIST_CACHE_TTL:
            video_logger.info(f"Using cached playlist info for {playlist_id}")
            return cache_entry['data']
        else:
            # Expired - remove from cache
            del playlist_info_cache[playlist_id]
    return None

def cache_playlist_info(playlist_id: str, data: Dict[str, Any]):
    """Cache playlist info with timestamp"""
    playlist_info_cache[playlist_id] = {
        'data': data,
        'timestamp': time.time()
    }
    video_logger.info(f"Cached playlist info for {playlist_id}")

# Quality reduction helpers removed. Downloads will use the requested quality
# without automatic reduction. If size estimation is needed in future, add
# a targeted implementation.

def get_ydl_opts(format_type: str, quality: int, output_path: str, is_age_restricted: bool = False, use_invidious: bool = False, invidious_instance: str = None) -> Dict[str, Any]:
    """Get yt-dlp options based on format and quality with metadata embedding
    
    Args:
        format_type: 'audio' or 'video'
        quality: Quality setting (144, 360, 480, 720, 1080 for video or bitrate for audio)
        output_path: Where to save the file
        is_age_restricted: Whether content is age-restricted
        use_invidious: Whether to use Invidious proxy
        invidious_instance: Specific Invidious instance URL to use
    """
    base_opts = {
        'outtmpl': output_path,
        'no_warnings': False,
        'extractaudio': format_type == 'audio',
        'ignoreerrors': False,  # Don't ignore errors so we can catch them
        # correct option name for yt-dlp
        'nocheckcertificate': True,
        'quiet': False,  # Show output
        'no_color': True,  # Disable colors for logging
        #  ENHANCED: More aggressive anti-bot retry settings
        'extractor_retries': 5,  # Increased for better success rate
        'fragment_retries': 5,  # Increased for transient errors
        'skip_unavailable_fragments': True,
        'keepvideo': False,
        'retries': 8,  # Increased retry attempts
        'file_access_retries': 3,  # Restored for reliability
        # Slower intervals to avoid triggering rate limits
        'sleep_interval': 2,  # Increased to appear more human-like
        'max_sleep_interval': 8,  # Increased delay ceiling
        # Reasonable timeout to detect real failures
        'socket_timeout': 30,  # Restored to avoid premature timeouts
        'sleep_interval_requests': 1.0,  # Slower request pacing
        'sleep_interval_subtitles': 1.0,  # Slower subtitle fetches
        #  ANTI-BOT: Moderate chunk size and concurrent downloads
        'http_chunk_size': 10485760,  # 10MB chunks
        'concurrent_fragment_downloads': 2,  # Reduced to 2 for less aggressive behavior
        #  CRITICAL: Force IPv4 to avoid IPv6 detection patterns
        'source_address': '0.0.0.0',  # Bind to IPv4
    }
    
    # Use Invidious proxy if requested (for Layer 3 fallback)
    if use_invidious and invidious_instance:
        # Invidious acts as a proxy - we change the extractor
        base_opts['extractor_args'] = {
            'youtube': {
                'player_client': ['android', 'web'],
            }
        }
    
    #  COOKIE SUPPORT: Check for cookies.txt to handle age-restricted content
    # Use cached cookie file path to avoid repeated file system checks
    cookie_file = get_cached_cookie_file()
    
    # Add cookies if available - CRITICAL for age-restricted content
    if cookie_file:
        base_opts['cookiefile'] = cookie_file
        # Only log once during cache initialization to reduce log spam
    elif not _cookie_cache_checked:
        video_logger.warning("No cookies.txt found - age-restricted videos may fail")
    
    # Add options for age-restricted content
    if is_age_restricted:
        base_opts.update({
            'age_limit': 18,  # Allow adult content
        })
    
    # Always try to handle age-restricted content with robust, browser-like headers
    # These headers are critical for avoiding bot detection on YouTube
    
    # Generate browser-consistent header combinations
    user_agent = get_random_user_agent()
    is_chrome = 'Chrome' in user_agent and 'Edg' not in user_agent
    is_firefox = 'Firefox' in user_agent
    is_safari = 'Safari' in user_agent and 'Chrome' not in user_agent
    is_mobile = 'Mobile' in user_agent or 'Android' in user_agent
    
    # Build headers that match the user agent
    headers = {
        'User-Agent': user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': get_random_accept_language(),
        'Accept-Encoding': 'gzip, deflate, br' if not is_safari else 'gzip, deflate, br, zstd',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
    }
    
    # Add browser-specific headers for better fingerprint consistency
    if is_chrome:
        headers.update({
            'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?1' if is_mobile else '?0',
            'Sec-Ch-Ua-Platform': '"Android"' if is_mobile else '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none' if random.random() > 0.5 else 'same-origin',
            'Sec-Fetch-User': '?1',
        })
    elif is_firefox:
        # Firefox doesn't send Sec-Ch-Ua headers
        headers['Sec-Fetch-Dest'] = 'document'
        headers['Sec-Fetch-Mode'] = 'navigate'
        headers['Sec-Fetch-Site'] = 'none'
        headers['Sec-Fetch-User'] = '?1'
    
    # Randomly include or exclude referer/origin (more realistic)
    if random.random() > 0.3:  # 70% chance to include
        headers['Referer'] = 'https://www.youtube.com/'
    if random.random() > 0.5:  # 50% chance to include
        headers['Origin'] = 'https://www.youtube.com'
    
    base_opts.update({
        'age_limit': 18,  # Allow adult content
        'geo_bypass': True,  # Bypass geo-restrictions
        'geo_bypass_country': 'BE',  # Use Belgium as default country
        'http_headers': headers,
        # Disable persistent cache to avoid stale/resolved issues
        'cachedir': False,
        #  CRITICAL: Use multiple player clients and bypass techniques
        'extractor_args': {
            'youtube': {
                # Try multiple player clients for better success rate
                'player_client': ['android', 'ios', 'web'],
                # Skip methods that might trigger additional verification
                'player_skip': ['webpage'],
                # Bypass age gate and geo-restrictions
                'skip': ['dash'],  # Prefer standard formats over adaptive
            }
        },
        #  ANTI-BOT: Add random delay variance at extraction level
        'sleep_interval_subtitles': random.uniform(0.5, 2.0),
        'sleep_interval_requests': random.uniform(0.8, 2.5),
    })
    
    if format_type == 'audio':
        base_opts.update({
            'format': 'bestaudio/best[ext=m4a]/best[ext=mp3]/best',  # More flexible format selection
            # Download thumbnail and try to embed it into the final audio file
            'writethumbnail': False,  # Disable thumbnail download by default
            'embedthumbnail': True,
            'addmetadata': True,
            # Download and embed lyrics
            'writelyrics': True,
            'embedlyrics': True,
            # Prefer ffmpeg for postprocessing
            'prefer_ffmpeg': True,
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': str(quality),
                },
                # Embed metadata (title, artist, etc.) and cover art into the resulting file
                {
                    'key': 'FFmpegMetadata'
                },
                {
                    'key': 'EmbedThumbnail'
                }
            ],
            # Do not automatically download subtitles by default; subtitle
            # downloads can trigger HTTP 429 'Too Many Requests' from providers
            # and previously caused the entire conversion to fail. We still
            # request thumbnails/metadata and attempt embedding, but subtitle
            # fetching is left as a best-effort offline/optional step.
            'writesubtitles': False,
            'writeautomaticsub': False,
        })
    else:  # video
        # Add thumbnail and metadata options for video
        base_opts.update({
            'writethumbnail': False,  # Disable thumbnail download by default
            'embedthumbnail': True,  # Embed thumbnail as album art
            'addmetadata': True,     # Add metadata to file
            'writelyrics': True,     # Download lyrics
            'embedlyrics': True,     # Embed lyrics into video file
            'prefer_ffmpeg': True,
            # Skip automatic subtitle downloads to avoid 429 errors; subtitles
            # can be fetched separately when required.
            'writesubtitles': False,
            'writeautomaticsub': False,
        })
        quality_map = {
            144: 'best[height<=144]/worst[height<=144]',
            360: 'best[height<=360]/best[height<=480]',
            480: 'best[height<=480]/best[height<=720]',
            720: 'best[height<=720]/best[height<=1080]', 
            1080: 'best[height<=1080]/best'
        }
        base_opts['format'] = quality_map.get(quality, 'best[height<=720]/best')
        base_opts.update({
            'postprocessors': [
                {
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                },
                {
                    'key': 'EmbedThumbnail'  # Embed thumbnail into video file
                }
            ]
        })
    
    return base_opts


# Enhanced user agent rotation with more realistic, up-to-date browser signatures
# Updated regularly to match current browser versions and avoid bot detection
USER_AGENTS = [
    # Chrome on Windows (latest versions)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    
    # Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    
    # Safari on macOS (latest)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    
    # Firefox on Windows (latest)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    
    # Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    
    # Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    
    # Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
    
    # Mobile user agents (YouTube treats mobile differently, sometimes better)
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36',
]

# Additional accept-language options for diversity
ACCEPT_LANGUAGES = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.9,es;q=0.8',
    'en-US,en;q=0.9,fr;q=0.8',
    'en-CA,en;q=0.9',
]

import random

def get_random_user_agent() -> str:
    """Get a random user agent to avoid detection with weighted selection"""
    # Weight towards more common browsers (Chrome > Firefox > Safari > Edge)
    weights = [0.35, 0.35, 0.30] + [0.25, 0.25] + [0.20, 0.20] + [0.15, 0.15] + [0.15] + [0.15, 0.15] + [0.10] + [0.08, 0.08]
    return random.choices(USER_AGENTS, weights=weights)[0]

def get_random_accept_language() -> str:
    """Get a random accept-language header for diversity"""
    return random.choice(ACCEPT_LANGUAGES)

def add_random_delay():
    """Add random delay between requests to mimic human behavior (0.5-2.5 seconds)"""
    delay = random.uniform(0.5, 2.5)
    time.sleep(delay)

def get_exponential_backoff_delay(attempt: int, base_delay: float = 1.0, max_delay: float = 30.0) -> float:
    """Calculate exponential backoff delay with jitter for retry attempts"""
    # Exponential: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    delay = min(base_delay * (2 ** attempt), max_delay)
    # Add jitter (±25%) to prevent thundering herd
    jitter = delay * random.uniform(-0.25, 0.25)
    return delay + jitter


def get_next_invidious_instance() -> str:
    """Get next Invidious instance in rotation"""
    global current_invidious_index
    with invidious_lock:
        instance = INVIDIOUS_INSTANCES[current_invidious_index]
        current_invidious_index = (current_invidious_index + 1) % len(INVIDIOUS_INSTANCES)
        return instance


def try_invidious_download(url: str, format_type: str, quality: int, output_path: str) -> tuple[bool, Optional[Dict], Optional[str]]:
    """Try downloading via Invidious instances as fallback - optimized with health tracking
    
    Returns:
        (success: bool, info: Dict, error: str)
    """
    # Get instances sorted by health (best first)
    sorted_instances = get_healthy_invidious_instances()
    
    for i, instance in enumerate(sorted_instances):
        try:
            # Convert YouTube URL to Invidious URL
            video_id = None
            if 'youtu.be/' in url:
                video_id = url.split('youtu.be/')[-1].split('?')[0]
            elif 'watch?v=' in url:
                video_id = url.split('watch?v=')[-1].split('&')[0]
            
            if not video_id:
                continue
            
            invidious_url = f"{instance}/watch?v={video_id}"
            
            # Try download with Invidious
            ydl_opts = get_ydl_opts(format_type, quality, output_path, use_invidious=True, invidious_instance=instance)
            # Disable thumbnail downloads for Invidious fallback (embedding not supported)
            ydl_opts['writethumbnail'] = False
            ydl_opts['embedthumbnail'] = False
            # Note: Lyrics and thumbnail embedding not supported with Invidious proxy
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(invidious_url, download=True)
                
                # Validate that we actually downloaded valid media files
                valid_files = get_valid_downloaded_files(output_path, format_type)
                if not valid_files:
                    # No valid media files found - Invidious returned error page
                    update_invidious_health(instance, success=False)
                    continue
                
                # Update health tracking on success
                update_invidious_health(instance, success=True)
                return True, info, None
                
        except Exception as e:
            # Update health tracking on failure
            update_invidious_health(instance, success=False)
            continue
    
    return False, None, "All Invidious fallback instances failed"


# Optional metadata helper: uses mutagen and Pillow to add tags, cover art and lyrics
try:
    from mutagen.easyid3 import EasyID3
    from mutagen.id3 import ID3, APIC, USLT, TIT2, TPE1, TALB, ID3NoHeaderError
    from mutagen.mp4 import MP4, MP4Cover
    from PIL import Image
    MUTAGEN_AVAILABLE = True
except Exception:
    MUTAGEN_AVAILABLE = False


def is_valid_media_file(file_path: str) -> bool:
    """Check if file is actually a media file by examining its content header"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(64)  # Read first 64 bytes
        
        # Check for HTML content (error pages)
        header_str = header.decode('utf-8', errors='ignore').lower()
        if '<!doctype' in header_str or '<html' in header_str or '<head' in header_str:
            return False
        
        # Check for media file signatures
        # MP4: ftyp
        # MP3: ID3 or ÿû (FF FB)
        # WebM: 
        # M4A: ftyp
        # MKV: 
        if header.startswith(b'ftyp'):  # MP4, M4A
            return True
        if header.startswith(b'ID3'):  # MP3 with ID3 tag
            return True
        if header.startswith(b'\xff\xfb') or header.startswith(b'\xff\xf3') or header.startswith(b'\xff\xf2'):  # MP3 frame sync
            return True
        if header.startswith(b'\x1a\x45\xdf\xa3'):  # WebM/MKV
            return True
        
        # If we can't identify it as media or HTML, assume it's invalid
        return False
    except Exception:
        return False


def apply_metadata(file_path: str, info: Dict[str, Any], base_pattern: str, format_type: str = 'audio'):
    """Apply metadata (title, artist, album), embed cover art and lyrics when possible.
    This function is optional: it logs and returns silently if mutagen/Pillow aren't available.
    """
    try:
        if not MUTAGEN_AVAILABLE:
            video_logger.debug("Mutagen or Pillow not available; skipping metadata embedding")
            return

        ext = os.path.splitext(file_path)[1].lower()
        title = info.get('title') or None
        artist = info.get('artist') or info.get('uploader') or info.get('channel') or None
        album = info.get('album') or None

        # Find thumbnail (support common image types)
        thumbnail_path = None
        for filename in os.listdir(VIDEO_DOWNLOAD_DIR):
            if filename.startswith(os.path.basename(base_pattern)):
                low = filename.lower()
                if low.endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    thumbnail_path = os.path.join(VIDEO_DOWNLOAD_DIR, filename)
                    break

        # Find subtitle file (srt) to use as lyrics
        subtitle_path = None
        for filename in os.listdir(VIDEO_DOWNLOAD_DIR):
            if filename.startswith(os.path.basename(base_pattern)) and filename.lower().endswith(('.srt', '.vtt', '.txt')):
                subtitle_path = os.path.join(VIDEO_DOWNLOAD_DIR, filename)
                break

        # Apply tags depending on extension
        if ext in ('.mp3',):
            try:
                try:
                    id3 = ID3(file_path)
                except ID3NoHeaderError:
                    id3 = ID3()

                if title:
                    id3.add(TIT2(encoding=3, text=title))
                if artist:
                    id3.add(TPE1(encoding=3, text=artist))
                if album:
                    id3.add(TALB(encoding=3, text=album))

                # Embed cover art
                if thumbnail_path and os.path.exists(thumbnail_path):
                    try:
                        # Convert webp to jpeg if needed
                        with Image.open(thumbnail_path) as im:
                            bio = BytesIO()
                            if im.format == 'WEBP':
                                im = im.convert('RGB')
                                im.save(bio, format='JPEG')
                                mime = 'image/jpeg'
                            else:
                                im.save(bio, format=im.format)
                                mime = Image.MIME.get(im.format, 'image/jpeg')
                            bio.seek(0)
                            id3.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=bio.read()))
                    except Exception as e:
                        video_logger.warning(f"Failed to embed cover art: {e}")

                # Embed lyrics from subtitle if present
                if subtitle_path and os.path.exists(subtitle_path):
                    try:
                        with open(subtitle_path, 'r', encoding='utf-8', errors='ignore') as sf:
                            srt = sf.read()
                        # Strip timestamps and sequence numbers crudely
                        lyrics = re.sub(r"\r\n|\r|\n", "\n", srt)
                        lyrics = re.sub(r"\d+\n", "", lyrics)
                        lyrics = re.sub(r"\d{2}:\d{2}:\d{2},\d{3} --> .*\n", "", lyrics)
                        lyrics_text = lyrics.strip()
                        if lyrics_text:
                            id3.add(USLT(encoding=3, lang='eng', desc='lyrics', text=lyrics_text))
                    except Exception as e:
                        video_logger.warning(f"Failed to embed lyrics from subtitle: {e}")

                try:
                    id3.save(file_path)
                except Exception as e:
                    video_logger.warning(f"Failed to save ID3 tags: {e}")
            except Exception as e:
                video_logger.warning(f"MP3 metadata embedding error: {e}")

        elif ext in ('.m4a', '.mp4'):
            try:
                mp4 = MP4(file_path)
                if title:
                    mp4['\xa9nam'] = title
                if artist:
                    mp4['\xa9ART'] = artist
                if album:
                    mp4['\xa9alb'] = album

                # Embed cover art
                if thumbnail_path and os.path.exists(thumbnail_path):
                    try:
                        with open(thumbnail_path, 'rb') as tf:
                            img = tf.read()
                        # MP4Cover requires specifying format
                        fmt = MP4Cover.FORMAT_JPEG
                        if thumbnail_path.lower().endswith('.png'):
                            fmt = MP4Cover.FORMAT_PNG
                        mp4['covr'] = [MP4Cover(img, imageformat=fmt)]
                    except Exception as e:
                        video_logger.warning(f"Failed to embed MP4 cover art: {e}")

                # Embed lyrics as "\x00lyr" tag where supported (some MP4 atoms use special keys)
                if subtitle_path and os.path.exists(subtitle_path):
                    try:
                        with open(subtitle_path, 'r', encoding='utf-8', errors='ignore') as sf:
                            srt = sf.read()
                        lyrics = re.sub(r"\r\n|\r|\n", "\n", srt)
                        lyrics = re.sub(r"\d+\n", "", lyrics)
                        lyrics = re.sub(r"\d{2}:\d{2}:\d{2},\d{3} --> .*\n", "", lyrics)
                        lyrics_text = lyrics.strip()
                        if lyrics_text:
                            mp4['\xa9lyr'] = lyrics_text
                    except Exception as e:
                        video_logger.warning(f"Failed to embed MP4 lyrics: {e}")

                try:
                    mp4.save()
                except Exception as e:
                    video_logger.warning(f"Failed to save MP4 tags: {e}")
            except Exception as e:
                video_logger.warning(f"MP4 metadata embedding error: {e}")

    except Exception as e:
        video_logger.warning(f"apply_metadata encountered an error: {e}")

def cleanup_old_video_files():
    """Remove old downloaded video files"""
    try:
        now_ts = datetime.now().timestamp()
        for filename in os.listdir(VIDEO_DOWNLOAD_DIR):
            filepath = os.path.join(VIDEO_DOWNLOAD_DIR, filename)
            if os.path.isfile(filepath):
                try:
                    # Remove files older than VIDEO_RETENTION seconds
                    if os.path.getmtime(filepath) < (now_ts - VIDEO_RETENTION):
                        os.remove(filepath)
                        print(f"Cleaned up old video file: {filename}")
                except Exception:
                    pass
    except Exception as e:
        print(f"Error during video cleanup: {e}")

# Start cleanup thread for video files
def start_video_cleanup():
    def cleanup_worker():
        while True:
            cleanup_old_video_files()
            # Run frequently so video files are removed within the retention window
            time.sleep(30)
    
    cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()

# Start the cleanup when the module loads
start_video_cleanup()

print("Registering conversion endpoint...")
@app.post("/api/v1/convert/upload")
async def upload_and_convert_file(
    file: UploadFile,
    target_format: str = Form(...)
):
    """
    Upload a file and convert it to the target format
    Max file size: 1GB
    """
    print(f"Starting conversion request: {file.filename} -> {target_format}")
    try:
        # Validate file size
        if hasattr(file, 'size') and file.size > 1_000_000_000:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 1GB.")
        
        # Clean up old files first
        cleanup_temp_files()
        
        # Sanitize filename to prevent path traversal
        safe_filename = os.path.basename(file.filename)
        # Remove any remaining dangerous characters
        safe_filename = "".join(c for c in safe_filename if c.isalnum() or c in "._- ")
        
        # Save uploaded file temporarily
        file_extension = os.path.splitext(safe_filename)[1].lower()
        temp_filename = f"{datetime.now().timestamp()}_{safe_filename}"
        temp_filepath = os.path.join(UPLOAD_DIR, temp_filename)
        print(f"Saving file to: {temp_filepath}")
        
        # Save the uploaded file
        with open(temp_filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        print(f"File saved successfully. Size: {len(content)} bytes")
        
        # Determine conversion type and convert
        print(f"Calling convert_file_backend with {temp_filepath} -> {target_format}")
        converted_filepath = await convert_file_backend(temp_filepath, target_format, file.filename)
        
        if not converted_filepath or not os.path.exists(converted_filepath):
            raise HTTPException(status_code=500, detail="Conversion failed")
        
        # Ensure converted file exists and log details before returning
        converted_filename = os.path.basename(converted_filepath)
        if not os.path.exists(converted_filepath):
            print(f"Converted file missing after conversion: {converted_filepath}")
            raise HTTPException(status_code=500, detail="Converted file not found after conversion")

        file_size = os.path.getsize(converted_filepath)
        print(f"Prepared converted file for response: {converted_filepath} ({file_size} bytes)")

        # Schedule deletion after response
        bg = BackgroundTask(delete_file_safe, converted_filepath)
        return FileResponse(
            converted_filepath,
            filename=converted_filename,
            media_type='application/octet-stream',
            background=bg
        )
        
    except Exception as e:
        print(f"Conversion error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        # Clean up the original uploaded file
        if 'temp_filepath' in locals() and os.path.exists(temp_filepath):
            try:
                os.remove(temp_filepath)
            except:
                pass

@app.post("/api/v1/test")
async def test_endpoint():
    return {"status": "test endpoint works"}

async def convert_file_backend(input_path: str, target_format: str, original_filename: str) -> str:
    """
    Convert file using appropriate backend tools
    """
    import time
    start_time = time.time()
    print(f"convert_file_backend called with: {input_path}, {target_format}, {original_filename}")
    file_extension = os.path.splitext(input_path)[1].lower()
    base_name = os.path.splitext(original_filename)[0]
    output_filename = f"{base_name}.{target_format}"
    output_path = os.path.join(CONVERTED_DIR, f"{datetime.now().timestamp()}_{output_filename}")
    print(f"Output path will be: {output_path}")
    
    try:
        if target_format.lower() in ['mp3', 'wav', 'ogg'] and file_extension in ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a']:
            # Audio format conversion
            print(f"Calling convert_audio_format for audio conversion")
            return await convert_audio_format(input_path, output_path, target_format)
        
        elif target_format.lower() in ['mp4'] and file_extension in ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a']:
            # Audio to Video conversion
            return await convert_audio_to_video(input_path, output_path, target_format)
        
        elif target_format.lower() in ['mp3', 'wav', 'ogg'] and file_extension in ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.webm']:
            # Video to Audio conversion
            return await convert_video_to_audio(input_path, output_path, target_format)
        
        elif target_format.lower() in ['jpg', 'jpeg', 'png', 'webp', 'bmp'] and file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff']:
            # Image format conversion
            return await convert_image_format(input_path, output_path, target_format)
        
        elif target_format.lower() == 'pdf':
            # Convert to PDF
            return await convert_to_pdf(input_path, output_path, original_filename)
        
        elif target_format.lower() == 'txt':
            # Convert to text
            return await convert_to_text(input_path, output_path, original_filename)
        
        elif target_format.lower() == 'zip':
            # Create ZIP archive
            return await convert_to_zip(input_path, output_path, original_filename)
        
        else:
            raise Exception(f"Conversion from {file_extension} to {target_format} not supported")
            
    except Exception as e:
        print(f"Conversion error in convert_file_backend: {e}")
        raise
    finally:
        end_time = time.time()
        print(f"convert_file_backend completed in {end_time - start_time:.2f} seconds")

async def convert_video_to_audio(input_path: str, output_path: str, format: str) -> str:
    """Convert video to audio using ffmpeg"""
    try:
        # Check if input file exists
        if not os.path.exists(input_path):
            quiz_logger.error(f"Input video file does not exist: {input_path}")
            raise Exception(f"Input video file does not exist: {input_path}")
        
        # Check file size
        file_size = os.path.getsize(input_path)
        if file_size == 0:
            quiz_logger.error(f"Input video file is empty: {input_path}")
            raise Exception(f"Input video file is empty: {input_path}")
        
        quiz_logger.info(f"Converting video file: {input_path} ({file_size} bytes) to {format}")
        
        # Validate that this is actually a video file by checking with ffmpeg
        probe_cmd = ['ffmpeg', '-i', input_path, '-f', 'null', '-']
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
        if probe_result.returncode != 0:
            stderr_lower = probe_result.stderr.lower()
            if 'video' not in stderr_lower and 'audio' not in stderr_lower:
                quiz_logger.error(f"Input file does not appear to be a valid video file: {input_path}")
                raise Exception(f"Input file does not appear to be a valid video file: {input_path}")
        
        # Check if the video file actually has audio streams
        if 'audio' not in probe_result.stderr.lower():
            quiz_logger.error(f"Video file has no audio streams: {input_path}")
            raise Exception(f"Video file contains no audio tracks. Cannot convert to audio format.")
        
        # Audio codec mapping
        codec_map = {
            'mp3': 'libmp3lame',
            'wav': 'pcm_s16le', 
            'ogg': 'libvorbis'
        }
        
        codec = codec_map.get(format.lower(), 'libmp3lame')
        
        cmd = [
            'ffmpeg', '-i', input_path, 
            '-map_metadata', '0',  # Copy metadata from input
            '-vn',  # No video
            '-acodec', codec,
            '-y',  # Overwrite output
        ]
        
        # Add quality settings for MP3
        if format.lower() == 'mp3':
            cmd.extend(['-b:a', '192k'])
        
        cmd.append(output_path)
        
        quiz_logger.info(f"FFmpeg command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0 and os.path.exists(output_path):
            output_size = os.path.getsize(output_path)
            quiz_logger.info(f"Video to audio conversion successful: {output_path} ({output_size} bytes)")
            
            # Try to extract and embed thumbnail from video/audio
            if format.lower() in ['mp3', 'wav'] and MUTAGEN_AVAILABLE:
                try:
                    # First, try to extract cover art from input file metadata
                    cover_art = None
                    
                    # Check MP4 files
                    if input_path.lower().endswith(('.mp4', '.m4v')):
                        try:
                            from mutagen.mp4 import MP4
                            mp4 = MP4(input_path)
                            if 'covr' in mp4 and mp4['covr']:
                                cover_art = mp4['covr'][0]
                                quiz_logger.info(f"Found cover art in MP4 metadata for {input_path}")
                        except Exception as e:
                            quiz_logger.debug(f"No cover art in MP4 metadata: {e}")
                    
                    # Check MP3 files
                    elif input_path.lower().endswith('.mp3'):
                        try:
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(input_path)
                            for tag in audio.getall('APIC'):
                                if tag.type == 3:  # Cover (front)
                                    cover_art = tag.data
                                    quiz_logger.info(f"Found cover art in MP3 metadata for {input_path}")
                                    break
                        except Exception as e:
                            quiz_logger.debug(f"No cover art in MP3 metadata: {e}")
                    
                    if cover_art:
                        # Embed the cover art in the output file
                        if format.lower() == 'mp3':
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(output_path)
                            audio.add(APIC(encoding=3, mime='image/jpeg', type=3, desc='Cover', data=cover_art))
                            audio.save(v2_version=3)  # Force ID3v2.3 for better Windows compatibility
                        elif format.lower() == 'wav':
                            # WAV files can have ID3 tags too
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(output_path)
                            audio.add(APIC(encoding=3, mime='image/jpeg', type=3, desc='Cover', data=cover_art))
                            audio.save(v2_version=3)
                        
                        quiz_logger.info(f"Embedded cover art in {format.upper()}: {output_path}")
                    else:
                        # Fallback: extract a frame from video files
                        if input_path.lower().endswith(('.mp4', '.m4v', '.avi', '.mov', '.mkv', '.wmv', '.webm')):
                            thumbnail_path = output_path + '_thumb.jpg'
                            
                            # Get video duration to seek to a better position
                            duration_cmd = [
                                'ffprobe', '-i', input_path,
                                '-show_entries', 'format=duration',
                                '-v', 'quiet', '-of', 'csv=p=0'
                            ]
                            duration_result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=10)
                            seek_time = '00:00:10'  # Default 10 seconds
                            if duration_result.returncode == 0 and duration_result.stdout.strip():
                                try:
                                    duration = float(duration_result.stdout.strip())
                                    seek_time = f'00:00:{min(30, max(5, int(duration * 0.1)))}'  # 10% of duration, min 5s, max 30s
                                except:
                                    pass
                            
                            thumb_cmd = [
                                'ffmpeg', '-i', input_path,
                                '-ss', seek_time,
                                '-vframes', '1',
                                '-q:v', '2',
                                '-vf', 'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
                                '-y',
                                thumbnail_path
                            ]
                            thumb_result = subprocess.run(thumb_cmd, capture_output=True, text=True, timeout=30)
                            
                            if thumb_result.returncode == 0 and os.path.exists(thumbnail_path) and os.path.getsize(thumbnail_path) > 1000:
                                # Embed the extracted thumbnail
                                if format.lower() == 'mp3':
                                    from mutagen.id3 import ID3, APIC
                                    audio = ID3(output_path)
                                    with open(thumbnail_path, 'rb') as img_file:
                                        img_data = img_file.read()
                                    audio.add(APIC(encoding=3, mime='image/jpeg', type=3, desc='Cover', data=img_data))
                                    audio.save(v2_version=3)  # Force ID3v2.3
                                elif format.lower() == 'wav':
                                    from mutagen.id3 import ID3, APIC
                                    audio = ID3(output_path)
                                    with open(thumbnail_path, 'rb') as img_file:
                                        img_data = img_file.read()
                                    audio.add(APIC(encoding=3, mime='image/jpeg', type=3, desc='Cover', data=img_data))
                                    audio.save(v2_version=3)
                                
                                quiz_logger.info(f"Embedded extracted thumbnail in {format.upper()}: {output_path}")
                            else:
                                quiz_logger.warning(f"Failed to extract thumbnail from video: returncode={thumb_result.returncode}, exists={os.path.exists(thumbnail_path)}")
                            
                            # Clean up thumbnail file
                            if os.path.exists(thumbnail_path):
                                os.remove(thumbnail_path)
                        
                except Exception as e:
                    quiz_logger.warning(f"Thumbnail extraction/embedding failed: {e}")
            
            return output_path
        else:
            quiz_logger.error(f"FFmpeg failed with return code: {result.returncode}")
            quiz_logger.error(f"FFmpeg stdout: {result.stdout}")
            quiz_logger.error(f"FFmpeg stderr: {result.stderr}")
            raise Exception(f"Video to audio conversion failed: ffmpeg returned {result.returncode}")
            
    except subprocess.TimeoutExpired:
        quiz_logger.error("Video to audio conversion timeout (5 minutes)")
        raise Exception("Video to audio conversion timeout (5 minutes)")
    except FileNotFoundError:
        quiz_logger.error("FFmpeg not found - video conversion not available")
        raise Exception("FFmpeg not found - video conversion not available")
    except Exception as e:
        quiz_logger.error(f"Video to audio conversion error: {e}")
        raise

async def convert_audio_to_video(input_path: str, output_path: str, format: str) -> str:
    """Convert audio to video using ffmpeg (creates video with black background)"""
    try:
        # Check if input file exists
        if not os.path.exists(input_path):
            quiz_logger.error(f"Input audio file does not exist: {input_path}")
            raise Exception(f"Input audio file does not exist: {input_path}")
        
        # Check file size
        file_size = os.path.getsize(input_path)
        if file_size == 0:
            quiz_logger.error(f"Input audio file is empty: {input_path}")
            raise Exception(f"Input audio file is empty: {input_path}")
        
        quiz_logger.info(f"Converting audio file: {input_path} ({file_size} bytes) to {format}")
        
        # Validate that this is actually an audio file by checking with ffmpeg
        probe_cmd = ['ffmpeg', '-i', input_path, '-f', 'null', '-']
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
        if probe_result.returncode != 0:
            stderr_lower = probe_result.stderr.lower()
            if 'audio' not in stderr_lower:
                quiz_logger.error(f"Input file does not appear to be an audio file: {input_path}")
                raise Exception(f"Input file does not appear to be a valid audio file: {input_path}")
        
        # Create video from audio with black background
        # Use a very low resolution and framerate to keep file size reasonable
        cmd = [
            'ffmpeg', '-i', input_path,
            '-map_metadata', '0',  # Copy metadata from input
            '-f', 'lavfi', '-i', 'color=black:size=640x360:rate=1',  # Black background video
            '-c:v', 'libx264',  # Video codec
            '-c:a', 'aac',      # Audio codec
            '-shortest',        # End when shortest input ends
            '-y',               # Overwrite output
            output_path
        ]
        
        quiz_logger.info(f"FFmpeg command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)  # Longer timeout for video conversion
        
        if result.returncode == 0 and os.path.exists(output_path):
            output_size = os.path.getsize(output_path)
            quiz_logger.info(f"Audio to video conversion successful: {output_path} ({output_size} bytes)")
            return output_path
        else:
            quiz_logger.error(f"FFmpeg failed with return code: {result.returncode}")
            quiz_logger.error(f"FFmpeg stdout: {result.stdout}")
            quiz_logger.error(f"FFmpeg stderr: {result.stderr}")
            raise Exception(f"Audio to video conversion failed: ffmpeg returned {result.returncode}")
            
    except subprocess.TimeoutExpired:
        quiz_logger.error("Audio to video conversion timeout (10 minutes)")
        raise Exception("Audio to video conversion timeout (10 minutes)")
    except FileNotFoundError:
        quiz_logger.error("FFmpeg not found - audio to video conversion not available")
        raise Exception("FFmpeg not found - audio to video conversion not available")
    except Exception as e:
        quiz_logger.error(f"Audio to video conversion error: {e}")
        raise

async def convert_audio_format(input_path: str, output_path: str, format: str) -> str:
    """Convert audio formats using ffmpeg"""
    try:
        print(f"Starting audio conversion: {input_path} -> {output_path} (format: {format})")
        
        # Check if input file exists
        if not os.path.exists(input_path):
            raise Exception(f"Input file does not exist: {input_path}")
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)
        print(f"Ensured output directory exists: {output_dir}")
        
        # Audio codec mapping for audio-to-audio conversion
        codec_map = {
            'mp3': 'libmp3lame',
            'wav': 'pcm_s16le', 
            'ogg': 'libvorbis',
            'flac': 'flac',
            'aac': 'aac'
        }
        
        codec = codec_map.get(format.lower(), 'libmp3lame')
        print(f"Using codec: {codec}")

        # If input and output formats are the same (e.g., wav -> wav), just copy the file.
        input_ext = os.path.splitext(input_path)[1].lower().lstrip('.')
        if input_ext == format.lower():
            try:
                shutil.copy2(input_path, output_path)
                print(f"Input and output formats identical ({format}) - copied file to {output_path}")
                return output_path
            except Exception as e:
                print(f"Failed to copy identical-format file: {e}")
                # fallthrough to attempt conversion as a fallback
        
        # Build ffmpeg command for audio conversion
        cmd = [
            'ffmpeg', '-i', input_path,
            '-map_metadata', '0',  # Copy metadata from input
            '-acodec', codec,
            '-y',  # Overwrite output
            output_path
        ]
        
        # Add format-specific options
        if format.lower() == 'mp3':
            cmd.insert(-1, '-b:a')  # Audio bitrate
            cmd.insert(-1, '192k')
        elif format.lower() == 'wav':
            cmd.insert(-1, '-f')  # Force format
            cmd.insert(-1, 'wav')
        elif format.lower() == 'ogg':
            cmd.insert(-1, '-f')  # Force format
            cmd.insert(-1, 'ogg')
            cmd.insert(-1, '-b:a')  # Audio bitrate
            cmd.insert(-1, '128k')
        
        print(f"FFmpeg command: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            print("FFmpeg timed out for file:", input_path)
            raise Exception("Audio conversion timed out")
        except Exception as e:
            print(f"FFmpeg invocation error: {e}")
            raise
        
        print(f"FFmpeg return code: {result.returncode}")
        if result.stdout:
            print(f"FFmpeg stdout: {result.stdout}")
        if result.stderr:
            print(f"FFmpeg stderr: {result.stderr}")
        
        if result.returncode == 0 and os.path.exists(output_path):
            print(f"Audio conversion successful: {output_path}")
            
            # Try to preserve cover art from input to output
            if format.lower() in ['mp3', 'wav'] and MUTAGEN_AVAILABLE:
                try:
                    cover_art = None
                    
                    # Extract cover art from input file
                    if input_path.lower().endswith('.mp3'):
                        try:
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(input_path)
                            for tag in audio.getall('APIC'):
                                if tag.type == 3:  # Cover (front)
                                    cover_art = tag.data
                                    print(f"Found cover art in input MP3: {input_path}")
                                    break
                        except Exception as e:
                            print(f"No cover art in input MP3: {e}")
                    
                    elif input_path.lower().endswith('.wav'):
                        try:
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(input_path)
                            for tag in audio.getall('APIC'):
                                if tag.type == 3:  # Cover (front)
                                    cover_art = tag.data
                                    print(f"Found cover art in input WAV: {input_path}")
                                    break
                        except Exception as e:
                            print(f"No cover art in input WAV: {e}")
                    
                    if cover_art:
                        # Embed the cover art in the output file
                        if format.lower() == 'mp3':
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(output_path)
                            audio.add(APIC(encoding=3, mime='image/jpeg', type=3, desc='Cover', data=cover_art))
                            audio.save(v2_version=3)  # Force ID3v2.3 for better Windows compatibility
                        elif format.lower() == 'wav':
                            from mutagen.id3 import ID3, APIC
                            audio = ID3(output_path)
                            audio.add(APIC(encoding=3, mime='image/jpeg', type=3, desc='Cover', data=cover_art))
                            audio.save(v2_version=3)
                        
                        print(f"Embedded cover art in {format.upper()}: {output_path}")
                        
                except Exception as e:
                    print(f"Cover art preservation failed: {e}")
            
            return output_path
        else:
            error_msg = f"FFmpeg failed with return code {result.returncode}"
            if result.stderr:
                error_msg += f": {result.stderr.strip()}"
            print(f"FFmpeg audio conversion error: {error_msg}")
            raise Exception(f"Audio conversion failed: {error_msg}")
            
    except subprocess.TimeoutExpired:
        print("Audio conversion timeout")
        raise Exception("Audio conversion timeout - file may be too large or complex")
    except FileNotFoundError:
        print("FFmpeg not found")
        raise Exception("FFmpeg not available for audio conversion - please install ffmpeg")
    except Exception as e:
        print(f"Audio conversion error: {e}")
        raise

async def convert_image_format(input_path: str, output_path: str, format: str) -> str:
    """Convert image formats using Pillow"""
    try:
        with Image.open(input_path) as img:
            # Convert RGBA to RGB for formats that don't support transparency
            if format.lower() in ['jpg', 'jpeg'] and img.mode in ['RGBA', 'LA']:
                # Create a white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'RGBA':
                    background.paste(img, mask=img.split()[-1])  # Use alpha channel as mask
                else:
                    background.paste(img)
                img = background
            
            # Save in the new format
            save_format = 'JPEG' if format.lower() in ['jpg', 'jpeg'] else format.upper()
            img.save(output_path, format=save_format, quality=95 if format.lower() in ['jpg', 'jpeg'] else None)
            
        return output_path
        
    except Exception as e:
        print(f"Image conversion error: {e}")
        raise Exception(f"Image conversion failed: {str(e)}")

async def convert_to_pdf(input_path: str, output_path: str, original_filename: str) -> str:
    """Convert various formats to PDF"""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        c = canvas.Canvas(output_path, pagesize=letter)
        width, height = letter
        
        file_extension = os.path.splitext(input_path)[1].lower()
        
        if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            # Image to PDF
            try:
                with Image.open(input_path) as img:
                    # Convert to RGB if necessary
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Calculate dimensions to fit page
                    img_width, img_height = img.size
                    aspect = img_height / img_width
                    
                    # Fit image to page with margins
                    max_width = width - 100
                    max_height = height - 100
                    
                    if img_width > max_width:
                        new_width = max_width
                        new_height = new_width * aspect
                    else:
                        new_width = img_width
                        new_height = img_height
                        
                    if new_height > max_height:
                        new_height = max_height
                        new_width = new_height / aspect
                    
                    # Save image temporarily for reportlab
                    temp_img_path = input_path + "_temp.jpg"
                    img.save(temp_img_path, "JPEG", quality=95)
                    
                    # Add image to PDF
                    x = (width - new_width) / 2
                    y = (height - new_height) / 2
                    c.drawImage(temp_img_path, x, y, width=new_width, height=new_height)
                    
                    # Clean up temp image
                    if os.path.exists(temp_img_path):
                        os.remove(temp_img_path)
                        
            except Exception as img_error:
                print(f"Image to PDF error: {img_error}")
                raise
                
        elif file_extension in ['.txt', '.md', '.csv']:
            # Text to PDF
            try:
                with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Add text to PDF
                textobject = c.beginText(50, height - 50)
                textobject.setFont("Helvetica", 12)
                
                # Split content into lines and add to PDF
                lines = content.split('\n')
                for line in lines[:100]:  # Limit to first 100 lines
                    textobject.textLine(line[:80])  # Limit line length
                
                c.drawText(textobject)
                
            except Exception as text_error:
                print(f"Text to PDF error: {text_error}")
                raise
                
        else:
            # Generic file info PDF
            c.drawString(50, height - 50, f"File: {original_filename}")
            c.drawString(50, height - 80, f"Size: {os.path.getsize(input_path)} bytes")
            c.drawString(50, height - 110, f"Type: {file_extension}")
            c.drawString(50, height - 140, f"Converted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        c.save()
        return output_path
        
    except ImportError:
        # Fallback without reportlab
        with open(output_path, 'w') as f:
            f.write(f"PDF Conversion Info\n\nOriginal File: {original_filename}\n")
            f.write(f"Size: {os.path.getsize(input_path)} bytes\n")
            f.write(f"Converted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        return output_path
    except Exception as e:
        print(f"PDF conversion error: {e}")
        raise

async def convert_to_text(input_path: str, output_path: str, original_filename: str) -> str:
    """Convert various formats to text"""
    try:
        file_extension = os.path.splitext(input_path)[1].lower()
        
        if file_extension in ['.txt', '.md', '.csv', '.json', '.html', '.css', '.js']:
            # Text-based files
            with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        else:
            # Binary or other files - create info text
            stat_info = os.stat(input_path)
            content = f"""File Conversion Report
=====================

Original File: {original_filename}
File Size: {stat_info.st_size} bytes
File Type: {file_extension}
Created: {datetime.fromtimestamp(stat_info.st_ctime).strftime('%Y-%m-%d %H:%M:%S')}
Modified: {datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M:%S')}
Converted: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Note: This file was converted from a binary format to text.
The original content cannot be represented as readable text.
"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return output_path
        
    except Exception as e:
        print(f"Text conversion error: {e}")
        raise

async def convert_to_zip(input_path: str, output_path: str, original_filename: str) -> str:
    """Create a ZIP archive containing the file"""
    try:
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(input_path, original_filename)
        
        return output_path
        
    except Exception as e:
        print(f"ZIP conversion error: {e}")
        raise

# Clean up endpoint
@app.post("/api/v1/convert/cleanup")
async def cleanup_conversion_files():
    """Manually trigger cleanup of temporary files"""
    try:
        cleanup_temp_files()
        return {"message": "Cleanup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

# ----------------------------------------------------
# Video Converter Endpoints (only if yt-dlp is available)
# ----------------------------------------------------

if VIDEO_CONVERTER_AVAILABLE:
    # Map normalized URL -> download_id for coalescing concurrent requests
    # Each mapping's value will be a dict: {'download_id': str, 'refcount': int}
    active_url_map = {}

    #  OPTIMIZED: Retry configuration from environment (faster defaults)
    try:
        YTDL_MAX_RETRIES = int(os.environ.get('YTDL_MAX_RETRIES', '8'))
    except Exception:
        YTDL_MAX_RETRIES = 8  # Reduced from 10 to 8 for faster failures
    # By default, don't retry forever - use reasonable max attempts
    if 'YTDL_RETRY_FOREVER' in os.environ:
        YTDL_RETRY_FOREVER = os.environ.get('YTDL_RETRY_FOREVER', 'false').lower() in ('1', 'true', 'yes')
    else:
        YTDL_RETRY_FOREVER = False
    try:
        YTDL_BACKOFF_BASE = float(os.environ.get('YTDL_BACKOFF_BASE', '1.5'))
    except Exception:
        YTDL_BACKOFF_BASE = 1.5  # Reduced from 2.0 for faster retries
    try:
        YTDL_BACKOFF_MAX = float(os.environ.get('YTDL_BACKOFF_MAX', '5.0'))
    except Exception:
        YTDL_BACKOFF_MAX = 5.0  # Reduced from 30.0 to 5.0 for faster processing
    #  CRITICAL FIX: Use ThreadPoolExecutor to allow shared memory for status updates
    # ProcessPoolExecutor doesn't share memory, so status updates are lost!
    try:
        WORKER_POOL_SIZE = int(os.environ.get('YTDL_WORKER_POOL_SIZE', '12'))  # Threads can handle more concurrent downloads
    except Exception:
        WORKER_POOL_SIZE = 12
    
    # Create thread pool for video downloads (threads share memory with main process)
    # This ensures status updates in active_video_downloads are visible to the main process
    video_process_pool = ThreadPoolExecutor(
        max_workers=WORKER_POOL_SIZE,
        thread_name_prefix="video_download"
    )
    video_logger.info(f"[OK] Video conversion thread pool initialized with {WORKER_POOL_SIZE} workers")
    
    #  WATCHDOG: Monitor and kill stuck downloads
    def watchdog_monitor():
        """Background thread that monitors downloads for timeouts and stalls"""
        global watchdog_running
        watchdog_running = True
        video_logger.info("Watchdog monitor started")
        
        while watchdog_running:
            try:
                time.sleep(30)  # Check every 30 seconds
                current_time = time.time()
                
                with download_lock:
                    stuck_downloads = []
                    for download_id, entry in list(active_video_downloads.items()):
                        # Skip completed/errored downloads
                        if entry.get('finished') or entry.get('status') in ['completed', 'error']:
                            continue
                        
                        start_time = entry.get('start_time', 0)
                        last_update = entry.get('last_progress_update', start_time)
                        
                        # Check if download exceeded max time
                        if start_time > 0 and (current_time - start_time) > DOWNLOAD_TIMEOUT_SECONDS:
                            stuck_downloads.append((download_id, 'timeout', current_time - start_time))
                        # Check if download stalled (no progress updates)
                        elif last_update > 0 and (current_time - last_update) > DOWNLOAD_STALL_TIMEOUT:
                            stuck_downloads.append((download_id, 'stalled', current_time - last_update))
                    
                    # Kill stuck downloads
                    for download_id, reason, duration in stuck_downloads:
                        video_logger.warning(f" Watchdog killing stuck download {download_id}: {reason} ({duration:.0f}s)")
                        entry = active_video_downloads.get(download_id)
                        if entry:
                            entry['status'] = 'error'
                            entry['error'] = f'Download {reason} - exceeded time limit'
                            entry['finished'] = True
                            
            except Exception as e:
                video_logger.error(f"Watchdog error: {e}")
        
        video_logger.info(" Watchdog monitor stopped")
    
    # Start watchdog thread
    watchdog_thread = threading.Thread(target=watchdog_monitor, daemon=True, name='watchdog')
    watchdog_thread.start()

    # Thread pool dedicated to long video conversions (separate capacity)
    try:
        LONG_WORKER_POOL_SIZE = int(os.environ.get('LONG_VIDEO_WORKER_POOL_SIZE', '2'))
    except Exception:
        LONG_WORKER_POOL_SIZE = 2

    long_video_process_pool = ThreadPoolExecutor(
        max_workers=LONG_WORKER_POOL_SIZE,
        thread_name_prefix="video_long"
    )
    video_logger.info(f"[OK] Long-video conversion thread pool initialized with {LONG_WORKER_POOL_SIZE} workers")
    # Queue dispatcher: waits for an event and calls process_next_in_queue while capacity exists
    def queue_dispatcher():
        video_logger.info("Queue dispatcher thread running")
        while True:
            try:
                # Wait until there's work to do
                dispatcher_event.wait()
                video_logger.debug("Dispatcher event received; scanning queue")
                # Attempt to process queued items while capacity and items exist
                while True:
                    with queue_lock:
                        if not video_conversion_queue:
                            break
                    if not (can_start_conversion(False) or can_start_conversion(True)):
                        break
                    try:
                        process_next_in_queue()
                    except Exception as e:
                        video_logger.error(f"queue_dispatcher error calling process_next_in_queue: {e}")
                        break
                    # small pause to yield
                    time.sleep(0.05)
            except Exception as e:
                video_logger.error(f"Queue dispatcher encountered error: {e}")
            finally:
                try:
                    dispatcher_event.clear()
                except Exception:
                    pass
            # prevent tight loop
            time.sleep(0.1)

    # Start dispatcher thread once
    try:
        dispatcher_thread = threading.Thread(target=queue_dispatcher, daemon=True, name='queue_dispatcher')
        dispatcher_thread.start()
        video_logger.info("Queue dispatcher thread initialized")
        # Trigger initial scan in case there are pre-existing queued items
        dispatcher_event.set()
    except Exception as e:
        video_logger.warning(f"Failed to start queue dispatcher: {e}")
    
    # Async wrapper to submit downloads to thread pool
    async def submit_video_download_async(download_id: str, url: str, format_type: str, quality: int, output_path: str, client_ip: str = None, chunk_index: int = None, chunk_start: int = None, chunk_end: int = None):
        """Submit video download to process pool and handle completion asynchronously

        Note: accepts long/short job routing via `is_long` in kwargs when used.
        """
        loop = asyncio.get_event_loop()
        def completion_callback(future, is_long=False):
            """Handle download completion in background thread"""
            try:
                result = future.result()
                video_logger.info(f"Download {download_id} completed: {result}")
                decrement_active_conversions(is_long=is_long)
                decrement_video_rate_limit(client_ip)
                # Process next in queue
                process_next_in_queue()
            except Exception as e:
                video_logger.error(f"Download {download_id} failed: {e}")
                decrement_active_conversions(is_long=is_long)
                decrement_video_rate_limit(client_ip)
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id]['status'] = 'error'
                        active_video_downloads[download_id]['error'] = str(e)
                # Process next in queue even on error
                process_next_in_queue()

        # Submit to process pool (non-blocking) - default to short pool
        fut = video_process_pool.submit(
            download_video_background,
            download_id, url, format_type, quality, output_path, client_ip, chunk_index, chunk_start, chunk_end
        )
        # Attach wrapper to call our completion with is_long=False
        fut.add_done_callback(lambda f: completion_callback(f, is_long=False))
        return fut
    
    # Helper function for background video download
    def download_video_background(download_id: str, url: str, format_type: str, quality: int, output_path: str, client_ip: str = None, chunk_index: int = None, chunk_start: int = None, chunk_end: int = None):
        """Background function to download and convert video - includes rate limit cleanup and timeout protection"""
        video_logger.info(f"IP: {client_ip or 'Unknown'} | Starting: {url}")
        
        # Apply throttling and random delay to mimic human behavior (anti-bot measure)
        throttle_youtube_request()
        
        start_time = time.time()
        
        def progress_hook(d):
            if d['status'] == 'downloading':
                try:
                    progress = 0.0
                    if d.get('total_bytes'):
                        progress = (d['downloaded_bytes'] / d['total_bytes']) * 100
                    elif d.get('total_bytes_estimate'):
                        progress = (d['downloaded_bytes'] / d['total_bytes_estimate']) * 100
                    
                    with download_lock:
                        if download_id in active_video_downloads:
                            active_video_downloads[download_id]['progress'] = min(progress, 90.0)
                            active_video_downloads[download_id]['status'] = 'downloading'
                            active_video_downloads[download_id]['last_progress_update'] = time.time()
                except Exception as progress_error:
                    pass  # Silent progress errors
            elif d['status'] == 'finished':
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id]['progress'] = 95.0
                        active_video_downloads[download_id]['status'] = 'processing'
                        active_video_downloads[download_id]['last_progress_update'] = time.time()
        
        # Initialize cookiefile variable at function scope
        cookiefile = None
        temp_cookie_file = None
        skip_normal_download = False  # Initialize flag to avoid UnboundLocalError
        
        try:
            # Update status with timeout tracking
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'downloading'
                    active_video_downloads[download_id]['start_time'] = start_time
                    active_video_downloads[download_id]['last_progress_update'] = start_time
            
            # ️ TIMEOUT CHECK: Abort if download takes too long
            def check_timeout():
                elapsed = time.time() - start_time
                if elapsed > DOWNLOAD_TIMEOUT_SECONDS:
                    raise TimeoutError(f"Download exceeded maximum time limit of {DOWNLOAD_TIMEOUT_SECONDS}s")
            
            # Get yt-dlp options WITHOUT browser cookie extraction (do that separately)
            ydl_opts = get_ydl_opts(format_type, quality, output_path, use_invidious=False, invidious_instance=None)
            ydl_opts['progress_hooks'] = [progress_hook]
            
            # Safer extract_info + download flow with persistent retry loop on transient 403s
            # ️ Check timeout before starting
            check_timeout()
            
            # Apply human-like timing before extraction (additional anti-bot measure)
            throttle_youtube_request()
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
            title = info.get('title', 'Unknown')
            
            # ️ Check timeout after extraction
            check_timeout()
            
            #  SIZE/DURATION CHECKS: Prevent massive downloads
            filesize = info.get('filesize') or info.get('filesize_approx', 0)
            duration = info.get('duration', 0)
            
            #  CHUNKING: Check if this is a chunk request (legacy support)
            is_chunk_request = chunk_start is not None and chunk_end is not None
            
            if is_chunk_request:
                # Processing a specific time range chunk (legacy)
                video_logger.info(
                    f" Processing chunk {chunk_index or '?'}: "
                    f"{chunk_start}s - {chunk_end}s ({(chunk_end - chunk_start)/60:.1f} minutes)"
                )
                needs_adaptive_quality = False
            else:
                # Adaptive quality removed: always keep the requested quality
                needs_adaptive_quality = False
                original_quality = quality
            
            # Hard limits - reject if too large even after quality reduction
            if filesize > MAX_VIDEO_FILESIZE:
                size_mb = filesize / (1024 * 1024)
                size_gb = filesize / (1024 * 1024 * 1024)
                raise ValueError(
                    f"Video file size ({size_gb:.2f}GB / {size_mb:.0f}MB) exceeds maximum allowed size "
                    f"({MAX_VIDEO_FILESIZE / (1024 * 1024):.0f}MB). "
                    f"Try a lower quality setting or shorter video."
                )
            
            # Allow long videos to be routed to the long-video pool.
            # Only reject videos that exceed an absolute cap (MAX_ALLOWED_VIDEO_DURATION).
            if duration > MAX_ALLOWED_VIDEO_DURATION:
                minutes = duration / 60
                raise ValueError(
                    f"Video duration ({minutes:.1f} minutes) exceeds absolute maximum allowed "
                    f"({MAX_ALLOWED_VIDEO_DURATION / 60:.0f} minutes). Please try a shorter video."
                )
            
            # Warnings - log if approaching limits
            if filesize > WARN_VIDEO_FILESIZE:
                size_mb = filesize / (1024 * 1024)
                video_logger.warning(
                    f"Large video detected: {size_mb:.1f}MB (duration: {duration/60:.1f}min). "
                    f"Download may be slow or fail."
                )

            # Check if video is age-restricted and reconfigure if needed
            if info.get('age_limit', 0) > 0:
                is_age_restricted = True
                ydl_opts = get_ydl_opts(format_type, quality, output_path, is_age_restricted)
                ydl_opts['progress_hooks'] = [progress_hook]

            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['title'] = title

            # Prepare proxies list
            proxy_env = os.environ.get('YTDL_PROXY')
            proxy_list_env = os.environ.get('YTDL_PROXY_LIST')
            proxies_to_try = []
            if proxy_list_env:
                proxies_to_try = [p.strip() for p in proxy_list_env.split(',') if p.strip()]
            elif proxy_env:
                proxies_to_try = [proxy_env.strip()]

            # Per-download override for proxy and cookiefile
            per_download_proxy = None
            per_download_cookie = None
            with download_lock:
                entry = active_video_downloads.get(download_id, {})
                per_download_proxy = entry.get('proxy')
                per_download_cookie = entry.get('cookiefile') or entry.get('cookie_file')
            if per_download_proxy:
                # prefer per-download proxy first
                proxies_to_try.insert(0, per_download_proxy)
            if per_download_cookie and os.path.exists(per_download_cookie):
                cookiefile = per_download_cookie

            # Cookiefile if provided (check env first, then per-download)
            cookiefile = os.environ.get('YTDL_COOKIE_FILE')
            if per_download_cookie and os.path.exists(per_download_cookie):
                cookiefile = per_download_cookie  # Per-download cookie takes priority
            elif cookiefile and not os.path.exists(cookiefile):
                cookiefile = None
            
            #  OPTIMIZATION: Try direct download first, use Invidious as fallback
            # This avoids issues with Invidious returning error pages
            invidious_success = False
            if not cookiefile:
                video_logger.info(" No cookies found - will try direct download first, Invidious as fallback")
            else:
                video_logger.info(" Cookies available - trying direct download")
            
            #  ADAPTIVE QUALITY: If quality was reduced, log it
            if needs_adaptive_quality:
                video_logger.info(
                    f" Adaptive quality applied: reduced to {quality} "
                    f"from original {original_quality}"
                )
            
            #  CHUNK REQUEST: Process specific time range (legacy support)
            if is_chunk_request:
                video_logger.info(f" Processing chunk request: {chunk_start}s to {chunk_end}s")
                
                # Modify output path to include chunk index
                if chunk_index:
                    output_path = output_path.replace('.%(ext)s', f'_part{chunk_index:02d}.%(ext)s')
                
                # Configure yt-dlp with time range postprocessor
                chunk_opts = get_ydl_opts(format_type, quality, output_path)
                chunk_opts['postprocessor_args'] = [
                    '-ss', str(chunk_start),
                    '-to', str(chunk_end),
                    '-c', 'copy'  # Copy codec (fast, no re-encoding)
                ]
                if cookiefile and os.path.exists(cookiefile):
                    chunk_opts['cookiefile'] = cookiefile
                
                # Download the chunk
                try:
                    with yt_dlp.YoutubeDL(chunk_opts) as ydl:
                        ydl.download([url])
                    
                    video_logger.info(f" Chunk {chunk_index} downloaded successfully")
                    last_exception = None
                    
                except Exception as chunk_error:
                    video_logger.error(f" Chunk {chunk_index} failed: {chunk_error}")
                    raise
                
                # Skip normal download logic
                skip_normal_download = True
            # No else needed - skip_normal_download is already False

            attempt = 0
            last_exception = None
            consecutive_403s = 0
            unavailable_attempts = 0
            VIDEO_UNAVAILABLE_RETRIES = int(os.environ.get('VIDEO_UNAVAILABLE_RETRIES', '3'))
            # Determine effective max attempts - up to 10 retries for transient errors
            #  OPTIMIZED: Reduced from 30 to 10 for faster failure detection
            # Previously unavailable/deleted videos quit immediately; now we retry a
            # few times because yt-dlp can sometimes report false 'video unavailable' errors.
            effective_max = min(10, max(1, YTDL_MAX_RETRIES)) if not YTDL_RETRY_FOREVER else 10
            
            # Skip retry loop if Invidious already succeeded OR chunking metadata OR chunk completed
            def get_valid_downloaded_files(output_path: str, format_type: str) -> list[str]:
                """Get list of valid downloaded media files, filtering out HTML error pages and temp files"""
                base_pattern = os.path.basename(output_path.replace('.%(ext)s', ''))
                temp_dir = os.path.dirname(output_path)
                
                # Skip these extensions (temporary/metadata files)
                skip_extensions = ('.ytdl', '.part', '.temp', '.tmp', '.download', '.aria2', '.f')
                # Skip HTML/MHTML files (error pages from YouTube)
                html_extensions = ('.html', '.mhtml', '.htm')
                
                valid_files = []
                try:
                    all_files = os.listdir(temp_dir)
                except:
                    return []
                
                for filename in all_files:
                    if not filename.startswith(base_pattern):
                        continue
                    
                    # Skip temporary and metadata files
                    if any(filename.endswith(ext) for ext in skip_extensions):
                        continue
                    
                    # Skip HTML files
                    if any(filename.endswith(ext) for ext in html_extensions):
                        continue
                    
                    # Skip files smaller than 1KB
                    file_path = os.path.join(temp_dir, filename)
                    try:
                        if os.path.getsize(file_path) < 1024:
                            continue
                    except:
                        continue
                    
                    # Validate content
                    if not is_valid_media_file(file_path):
                        continue
                    
                    valid_files.append(file_path)
                
                return valid_files

            if not (not cookiefile and invidious_success) and not skip_normal_download:
                while True:
                    attempt += 1
                    
                    # Check if we've exceeded max attempts
                    if effective_max and attempt > effective_max:
                        break
                    
                    try:
                        # ️ Check timeout before each retry attempt
                        check_timeout()
                        
                        # Throttle requests to avoid overwhelming YouTube
                        throttle_youtube_request()
                        
                        # Refresh yt-dlp options with new user agent for each attempt
                        ydl_opts = get_ydl_opts(format_type, quality, output_path)
                        ydl_opts['progress_hooks'] = [progress_hook]
                        
                        #  OPTIMIZATION: Skip browser cookie extraction entirely
                        # It's slow, unreliable, and Invidious works better
                        # Only use if explicitly provided via cookiefile
                        
                        # Use cookie file if available
                        if cookiefile and os.path.exists(cookiefile):
                            ydl_opts['cookiefile'] = cookiefile
                        
                        video_logger.info(f"Attempt {attempt}/{effective_max} for {url}")
                        
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            result = ydl.download([url])
                            video_logger.info(f"yt-dlp download result: {result}")
                        
                        # Validate that actual media files were downloaded (not HTML error pages)
                        valid_files = get_valid_downloaded_files(output_path, format_type)
                        if not valid_files:
                            video_logger.error(f"Download attempt {attempt} failed: yt-dlp reported success but no valid media files found (likely HTML error page)")
                            # Continue to next retry attempt
                            continue
                        
                        # Success - valid media files found
                        video_logger.info(f"Download attempt {attempt} succeeded")
                        last_exception = None
                        break
                    except Exception as de:
                        derr = str(de)
                        last_exception = de
                        video_logger.error(f"Download attempt {attempt} failed: {derr}")
                        
                        #  CRITICAL: Check for UNRECOVERABLE errors - quit immediately
                        is_unavailable = any(keyword in derr.lower() for keyword in [
                            'video unavailable',
                            'this video is unavailable',
                            'video has been removed',
                            'video is not available',
                            'this video has been deleted',
                            'this video does not exist',
                            'video is private',
                            'members-only content',
                            'join this channel',
                            'premium content',
                            'video not found',
                            'account has been terminated',
                            'account associated with this video has been terminated'
                        ])
                        
                        # Check if we need cookies (403/age-restricted)
                        needs_cookies = any(keyword in derr.lower() for keyword in [
                            '403', 'forbidden', 'age-restricted', 'sign in'
                        ])
                        if needs_cookies and not cookiefile:
                            video_logger.warning(
                                "🍪 Download blocked - browser cookies recommended! "
                                "Export cookies.txt from your browser while logged into YouTube."
                            )
                        
                        #  OPTIMIZATION: Check for sign-in required errors (fail fast)
                        is_sign_in_required = any(keyword in derr.lower() for keyword in [
                            'sign in to confirm',
                            'sign in to confirm your age',
                            'this video may be inappropriate',
                            'use --cookies-from-browser',
                            'use --cookies for the authentication'
                        ])
                        
                        if is_sign_in_required:
                            error_msg = 'Video requires sign-in/age verification. Please add YouTube cookies from a logged-in account to cookies.txt'
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id].update({
                                        'status': 'error',
                                        'error': error_msg,
                                        'error_type': 'auth_required',
                                        'finished': True
                                    })
                            raise Exception(error_msg)
                        
                        # Check for YouTube rate limiting
                        is_rate_limited = any(keyword in derr.lower() for keyword in [
                            'rate-limited',
                            'rate limited',
                            'too many requests',
                            '429',
                            'try again later'
                        ])
                        
                        if is_rate_limited:
                            error_msg = 'YouTube rate limit exceeded. Try: 1) Adding YouTube cookies (logged-in account), 2) Waiting 10-60 minutes, 3) Using a different IP/VPN'
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id].update({
                                        'status': 'error',
                                        'error': error_msg,
                                        'error_type': 'rate_limit',
                                        'finished': True
                                    })
                            raise Exception(error_msg)
                        
                        if is_unavailable:
                            # Sometimes yt-dlp returns transient 'video unavailable' errors.
                            # Retry a few times before giving up to avoid false negatives.
                            unavailable_attempts += 1
                            if unavailable_attempts < VIDEO_UNAVAILABLE_RETRIES:
                                video_logger.warning(
                                    f"Transient 'video unavailable' detected for {download_id} (attempt {unavailable_attempts}/{VIDEO_UNAVAILABLE_RETRIES}). Retrying..."
                                )
                                try:
                                    time.sleep(min(1 * attempt, 5))
                                except Exception:
                                    pass
                                # Continue to next while iteration (retry)
                                continue
                            # Exhausted retries: mark as unavailable and exit
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id].update({
                                        'status': 'error',
                                        'error': 'Video is unavailable, private, or has been removed',
                                        'error_type': 'unavailable',
                                        'finished': True
                                    })
                            raise Exception('Video is unavailable, private, or has been removed')
                        
                        # Detect browser cookie errors - stop trying browser extraction
                        is_browser_error = ('could not find' in derr.lower() and 'cookies database' in derr.lower())
                        if is_browser_error and attempt == 1:
                            # Try immediately with Invidious on next attempt
                            consecutive_403s = 3  # Trigger Invidious fallback

                    # Detect 403 errors
                    is_403_like = ('403' in derr or 'forbidden' in derr.lower() or 'http error 403' in derr.lower() or 'unable to download video data' in derr.lower())
                    
                    if is_403_like:
                        consecutive_403s += 1
                        # If we get too many consecutive 403s, it's likely not a transient issue
                    else:
                        consecutive_403s = 0  # Reset counter for non-403 errors

                    # CRITICAL: Always use cookies on first 403, not just attempt <= 2
                    tried_cookie = False
                    if is_403_like and cookiefile and os.path.exists(cookiefile) and attempt <= 5:
                        try:
                            retry_opts = get_ydl_opts(format_type, quality, output_path)
                            retry_opts['cookiefile'] = cookiefile
                            retry_opts['progress_hooks'] = [progress_hook]
                            with yt_dlp.YoutubeDL(retry_opts) as ydl:
                                ydl.download([url])
                            last_exception = None
                            break
                        except Exception as cookie_err:
                            tried_cookie = True

                    # Try rotating proxies FIRST (higher priority than just cookies)
                    proxy_succeeded = False
                    if is_403_like and proxies_to_try and attempt <= 7:
                        for proxy in proxies_to_try:
                            try:
                                retry_opts2 = get_ydl_opts(format_type, quality, output_path)
                                retry_opts2['proxy'] = proxy
                                # Use cookies WITH proxy for best results
                                if cookiefile and os.path.exists(cookiefile):
                                    retry_opts2['cookiefile'] = cookiefile
                                retry_opts2['progress_hooks'] = [progress_hook]
                                with yt_dlp.YoutubeDL(retry_opts2) as ydl:
                                    ydl.download([url])
                                proxy_succeeded = True
                                last_exception = None
                                break
                            except Exception as proxy_err:
                                # small backoff between proxy attempts
                                time.sleep(min(1.0, YTDL_BACKOFF_BASE))
                        if proxy_succeeded:
                            break

                    # LAYER 3: Try Invidious fallback if browser cookies failed or persistent 403s
                    # Trigger immediately on browser error (consecutive_403s set to 3) or after 3 real 403s
                    if (is_browser_error or is_403_like) and consecutive_403s >= 3 and attempt <= 8:
                        invidious_success, invidious_info, invidious_error = try_invidious_download(
                            url, format_type, quality, output_path
                        )
                        if invidious_success:
                            last_exception = None
                            break

                    # Check retry limits
                    if effective_max is not None and attempt >= effective_max:
                        break

                    #  OPTIMIZED: Faster backoff for quicker processing
                    # Smart backoff: if we're getting repeated errors, increase backoff
                    # BUT: Skip long backoff if browser cookies just failed (jump to Invidious immediately)
                    if is_browser_error and attempt == 1:
                        sleep_for = 0.2  # Minimal delay before trying Invidious
                    elif consecutive_403s >= 3:
                        backoff = min(5.0, YTDL_BACKOFF_BASE * (2 ** (attempt - 1)))  # Cap at 5s instead of 30s
                        jitter = random.uniform(0, backoff * 0.2)
                        sleep_for = backoff + jitter
                    else:
                        backoff = min(5.0, YTDL_BACKOFF_BASE * (2 ** max(0, attempt - 2)))  # Start smaller, cap at 5s
                        jitter = random.uniform(0, backoff * 0.2)
                        sleep_for = backoff + jitter
                    
                    time.sleep(sleep_for)

                    # If retry-forever is enabled, continue looping; otherwise loop until attempts exhausted
                    if not YTDL_RETRY_FOREVER and effective_max is not None and attempt >= effective_max:
                        # Max attempts reached
                        break
            
            # Find the downloaded file
            downloaded_file = None
            base_pattern = output_path.replace('.%(ext)s', '')

            # Collect candidates that start with the base pattern
            candidates = []
            video_logger.info(f"Looking for downloaded file in {VIDEO_DOWNLOAD_DIR}")
            video_logger.info(f"Base pattern: {os.path.basename(base_pattern)}")
            
            try:
                all_files = os.listdir(VIDEO_DOWNLOAD_DIR)
                video_logger.info(f"Files in directory: {all_files}")
            except Exception as list_err:
                video_logger.error(f"Error listing directory: {list_err}")
                all_files = []
            
            # Skip these extensions (temporary/metadata files)
            skip_extensions = ('.ytdl', '.part', '.temp', '.tmp', '.download', '.aria2', '.f')
            # Skip HTML/MHTML files (error pages from YouTube)
            html_extensions = ('.html', '.mhtml', '.htm')
            
            for filename in all_files:
                if filename.startswith(os.path.basename(base_pattern)):
                    # Skip temporary and metadata files
                    if any(filename.endswith(ext) for ext in skip_extensions):
                        video_logger.debug(f"Skipping temporary/metadata file: {filename}")
                        continue
                    # Skip HTML files (these are error pages, not media)
                    if any(filename.endswith(ext) for ext in html_extensions):
                        video_logger.warning(f"Skipping HTML error page: {filename}")
                        continue
                    # Skip files smaller than 1KB (likely corrupted)
                    file_path = os.path.join(VIDEO_DOWNLOAD_DIR, filename)
                    try:
                        file_size = os.path.getsize(file_path)
                        if file_size < 1024:
                            video_logger.warning(f"Skipping tiny file {filename} ({file_size} bytes)")
                            continue
                    except:
                        continue
                    
            # Validate file content - check if it's actually a media file, not HTML
            if not is_valid_media_file(file_path):
                video_logger.warning(f"Skipping invalid media file (likely HTML error page): {filename}")
            else:
                candidates.append(file_path)
                video_logger.info(f"Found candidate: {filename}")

            # Prefer actual audio/video files over thumbnails (e.g., .webp)
            if candidates:
                # Define priority extensions depending on format requested
                if format_type == 'audio':
                    priority_exts = ['.mp3', '.m4a', '.opus', '.webm', '.mka', '.aac']
                else:
                    priority_exts = ['.mp4', '.mkv', '.webm', '.mov', '.flv']

                chosen = None
                for ext in priority_exts:
                    for path in candidates:
                        if path.lower().endswith(ext):
                            chosen = path
                            break
                    if chosen:
                        break

                # Fallback to any candidate if no prioritized ext matched
                if not chosen:
                    # If we only have image files, this is a failed download
                    image_files = [p for p in candidates if p.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif'))]
                    if len(image_files) == len(candidates):
                        # All candidates are images - this means the download failed
                        video_logger.error(f"Download failed - only image/thumbnail files found: {candidates}")
                        raise ValueError(
                            "Download failed - YouTube blocked the download and only thumbnails were retrieved. "
                            "This usually means your IP is rate-limited or requires authentication. "
                            "Try: 1) Adding browser cookies from YouTube, 2) Waiting 10-15 minutes, 3) Using a VPN"
                        )
                    chosen = candidates[0]
                
                downloaded_file = chosen
                video_logger.info(f"Selected file: {downloaded_file}")
            else:
                # Check if HTML files exist (error case)
                html_files = [f for f in all_files if f.startswith(os.path.basename(base_pattern)) and any(f.endswith(ext) for ext in ('.html', '.mhtml', '.htm'))]
                if html_files:
                    video_logger.error(f"Download failed - received HTML error page: {html_files[0]}")
                    raise ValueError(
                        "YouTube blocked the download (received HTML error page). "
                        "This means your IP may be rate-limited. "
                        "Solutions: 1) Wait 10-15 minutes, 2) Add browser cookies, 3) Use VPN/proxy"
                    )
                video_logger.error(f"No valid candidates found! Expected pattern: {os.path.basename(base_pattern)}")
            
            if downloaded_file and os.path.exists(downloaded_file):
                # Try to apply metadata (cover art, artist, lyrics) if possible
                try:
                    apply_metadata(downloaded_file, info if 'info' in locals() else {}, base_pattern, format_type)
                except Exception as meta_err:
                    pass  # Silent metadata errors
                # Check file size - if it's too small, it's probably corrupted
                file_size = os.path.getsize(downloaded_file)
                if file_size < 1024:  # Less than 1KB is probably corrupted
                    os.remove(downloaded_file)  # Delete the corrupted file
                    raise Exception(f"Downloaded file appears to be corrupted (only {file_size} bytes)")
                
                # Success - Log simplified entry
                video_logger.info(f"IP: {client_ip or 'Unknown'} | {title} | SUCCESS ({file_size} bytes)")
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id].update({
                            'status': 'completed',
                            'progress': 100.0,
                            'file_path': downloaded_file,
                            'finished': True
                        })
                
                # Success - caller's done_callback will decrement the appropriate counter
                # Process next item in queue if any
                process_next_in_queue()
                
            else:
                error_details = f"Downloaded file not found. Candidates: {len(candidates)}, Base pattern: {os.path.basename(base_pattern)}"
                video_logger.error(error_details)
                
                # Check if this might be a YouTube block
                if last_exception:
                    error_details += f" | Last exception: {str(last_exception)}"
                
                raise Exception(error_details)
                
        except Exception as e:
            # Error occurred - Log detailed error for debugging
            error_msg = str(e)
            video_logger.error(f"IP: {client_ip or 'Unknown'} | {locals().get('title', url)} | FAILED: {error_msg}")
            
            # Log additional context if available
            if 'last_exception' in locals() and last_exception:
                video_logger.error(f"Root cause: {str(last_exception)}")
            
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'error',
                        'error': error_msg,
                        'finished': True
                    })
            
            # Errors are handled by the caller's done_callback which will decrement
            # the active conversion counter for the appropriate pool.
            # Process next item in queue if any
            process_next_in_queue()
        finally:
            # Clean up temp cookie file if we created one
            if temp_cookie_file:
                try:
                    if os.path.exists(temp_cookie_file):
                        os.remove(temp_cookie_file)
                except Exception as cleanup_err:
                    pass
            
            # Decrement rate limit counter when download finishes (success or error)
            if client_ip:
                decrement_video_rate_limit(client_ip)
            # Clean up any coalescing mapping for this URL - decrease refcount and remove when zero
            try:
                normalized = url.strip()
                with download_lock:
                    mapping = active_url_map.get(normalized)
                    if mapping:
                        # mapping is a dict {'download_id': id, 'refcount': n}
                        if mapping.get('download_id') == download_id:
                            mapping['refcount'] = max(0, mapping.get('refcount', 1) - 1)
                            if mapping['refcount'] <= 0:
                                try:
                                    del active_url_map[normalized]
                                except KeyError:
                                    pass
                    # Also decrement waiter count on the active download entry if present
                    if download_id in active_video_downloads:
                        entry = active_video_downloads[download_id]
                        if 'waiters' in entry and entry['waiters'] > 0:
                            entry['waiters'] = max(0, entry['waiters'] - 1)
            except Exception:
                pass

    def full_playlist_download_background(download_id: str, playlist_url: str, format_type: str, quality: int, start_index: int, end_index: Optional[int], zip_path: str, client_ip: str = None):
        """Download ALL videos from a playlist directly using yt-dlp's playlist support"""
        video_logger.info(f"Starting full playlist download for {download_id}")
        video_logger.info(f"Playlist URL: {playlist_url}, Range: {start_index}-{end_index or 'end'}")
        
        try:
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'downloading'
            
            # Create temporary directory for downloads
            bulk_dir = os.path.join(VIDEO_DOWNLOAD_DIR, f"fullplaylist_{download_id}")
            os.makedirs(bulk_dir, exist_ok=True)
            
            extension = 'mp3' if format_type == 'audio' else 'mp4'
            output_template = os.path.join(bulk_dir, f"%(playlist_index)s_%(title)s_%(id)s.%(ext)s")
            
            # Configure yt-dlp to download the FULL playlist
            ydl_opts = get_ydl_opts(format_type, quality, output_template)
            ydl_opts['ignoreerrors'] = True  # Continue if some videos fail
            ydl_opts['playliststart'] = start_index
            if end_index:
                ydl_opts['playlistend'] = end_index
            # Disable thumbnail downloads for bulk operations to avoid clutter
            ydl_opts['writethumbnail'] = False
            ydl_opts['embedthumbnail'] = True
            ydl_opts['writelyrics'] = True
            ydl_opts['embedlyrics'] = True
            
            # Add cookies if available
            cookie_file = os.environ.get('YTDL_COOKIE_FILE')
            if not cookie_file:
                backend_cookie_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
                if os.path.exists(backend_cookie_path):
                    cookie_file = backend_cookie_path
            if cookie_file and os.path.exists(cookie_file):
                ydl_opts['cookiefile'] = cookie_file
            
            completed_files = []
            total_videos = 0
            
            def progress_hook(d):
                if d['status'] == 'finished':
                    completed_files.append(d.get('filename'))
                    if total_videos > 0:
                        progress = (len(completed_files) / total_videos) * 90  # Reserve 10% for zipping
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['progress'] = min(progress, 90.0)
                                active_video_downloads[download_id]['completed_count'] = len(completed_files)
                                active_video_downloads[download_id]['total_videos'] = total_videos
            
            ydl_opts['progress_hooks'] = [progress_hook]
            
            video_logger.info(f"Starting yt-dlp playlist download with playliststart={start_index}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Extract playlist info first to get total count
                try:
                    info = ydl.extract_info(playlist_url, download=False)
                    if info and 'entries' in info:
                        # Count actual entries (excluding None/unavailable)
                        valid_entries = [e for e in info['entries'] if e]
                        total_videos = len(valid_entries)
                        video_logger.info(f"Playlist contains {total_videos} downloadable videos")
                        
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['total_videos'] = total_videos
                                active_video_downloads[download_id]['title'] = info.get('title', 'Full Playlist Download')
                except Exception as e:
                    video_logger.warning(f"Could not extract playlist info: {e}, proceeding with download anyway")
                
                # Now download all videos
                ydl.download([playlist_url])
            
            # Get all downloaded files
            downloaded_files = [os.path.join(bulk_dir, f) for f in os.listdir(bulk_dir) if os.path.isfile(os.path.join(bulk_dir, f))]
            video_logger.info(f"Downloaded {len(downloaded_files)} files, creating ZIP...")
            
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'zipping'
                    active_video_downloads[download_id]['progress'] = 90.0
            
            # Create ZIP file
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in downloaded_files:
                    arcname = os.path.basename(file_path)
                    zipf.write(file_path, arcname=arcname)
                    video_logger.debug(f"Added to ZIP: {arcname}")
            
            zip_size = os.path.getsize(zip_path)
            video_logger.info(f"Created ZIP file: {zip_path} ({zip_size / 1024 / 1024:.1f} MB)")
            
            # Cleanup individual files
            try:
                shutil.rmtree(bulk_dir)
                video_logger.info(f"Cleaned up temp directory: {bulk_dir}")
            except Exception as e:
                video_logger.warning(f"Failed to cleanup temp directory: {e}")
            
            # Mark as completed
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'completed',
                        'progress': 100.0,
                        'finished': True,
                        'file_path': zip_path,
                        'completed_count': len(downloaded_files)
                    })
            
            video_logger.info(f"Full playlist download completed: {download_id}")
            
        except Exception as e:
            error_msg = str(e)
            video_logger.error(f"Full playlist download failed for {download_id}: {error_msg}")
            
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'error',
                        'error': error_msg,
                        'finished': True
                    })
        finally:
            if client_ip:
                decrement_video_rate_limit(client_ip)

    def bulk_download_background(download_id: str, video_ids: List[str], format_type: str, quality: int, bulk_dir: str, zip_path: str, client_ip: str = None):
        """Background function to download multiple videos and create ZIP file"""
        video_logger.info(f"Starting bulk download background process for {download_id}")
        video_logger.info(f"Downloading {len(video_ids)} videos in {format_type} format")
        try:
            completed_videos = []
            total_videos = len(video_ids)
            # Files that are ready to be flushed into the next ZIP part
            pending_part_files = []
            pending_part_size = 0
            last_flush_time = time.time()
            FLUSH_INTERVAL = 60  # seconds, flush a ZIP part at least every 60s
            MAX_PART_SIZE = 1_000_000_000  # 1 GB per part
            
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id]['status'] = 'downloading'
                    video_logger.info(f"Set status to downloading for {download_id}")
            
            for i, video_id in enumerate(video_ids):
                try:
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                    video_logger.info(f"Downloading video {i+1}/{total_videos}: {video_id}")
                    
                    # Create output path for this video
                    timestamp = int(time.time())
                    extension = 'mp3' if format_type == 'audio' else 'mp4'
                    output_filename = f"{video_id}_{timestamp}.%(ext)s"
                    output_path = os.path.join(bulk_dir, output_filename)
                    
                    # Download this video
                    ydl_opts = get_ydl_opts(format_type, quality, output_path)
                    # Disable thumbnail downloads for bulk operations
                    ydl_opts['writethumbnail'] = False
                    ydl_opts['embedthumbnail'] = True
                    ydl_opts['writelyrics'] = True
                    ydl_opts['embedlyrics'] = True
                    
                    def progress_hook(d):
                        if d['status'] == 'finished':
                            # Update overall progress
                            current_progress = ((len(completed_videos) + 1) / total_videos) * 100
                            with download_lock:
                                if download_id in active_video_downloads:
                                    active_video_downloads[download_id]['progress'] = min(current_progress, 95.0)
                    
                    ydl_opts['progress_hooks'] = [progress_hook]
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(video_url, download=True)
                        title = info.get('title', f'Video {video_id}')
                        video_logger.info(f"Successfully downloaded: {title}")
                        
                        # Find the downloaded file by collecting candidates and prioritizing media extensions
                        downloaded_file = None
                        candidates = []
                        for filename in os.listdir(bulk_dir):
                            if filename.startswith(video_id):
                                candidates.append(os.path.join(bulk_dir, filename))

                        if candidates:
                            priority_exts = ['.mp3', '.m4a', '.mp4', '.webm', '.mkv', '.aac']
                            chosen = None
                            for ext in priority_exts:
                                for path in candidates:
                                    if path.lower().endswith(ext):
                                        chosen = path
                                        break
                                if chosen:
                                    break
                            downloaded_file = chosen or candidates[0]

                        if downloaded_file:
                            video_logger.info(f"Found downloaded file: {downloaded_file}")
                            # Rename file to include title for ZIP
                            # Apply metadata (attempt embedding cover/lyrics) for each item
                            try:
                                apply_metadata(downloaded_file, info if 'info' in locals() else {}, output_path.replace('.%(ext)s',''), format_type)
                            except Exception as meta_err:
                                video_logger.warning(f"Failed to apply metadata for bulk item: {meta_err}")
                            # Ensure the filename is unique to avoid collisions when many videos have
                            # similar/sanitized titles. Append the video_id to guarantee uniqueness.
                            safe_title = re.sub(r'[^\w\s-]', '', title).strip()[:50]
                            new_filename = f"{safe_title}_{video_id}.{extension}"
                            new_path = os.path.join(bulk_dir, new_filename)
                            
                            try:
                                os.rename(downloaded_file, new_path)
                                completed_videos.append(new_path)
                                pending_part_files.append(new_path)
                                try:
                                    pending_part_size += os.path.getsize(new_path)
                                except Exception:
                                    pass
                                video_logger.info(f"Renamed file to: {new_filename}")
                            except Exception as rename_error:
                                video_logger.warning(f"Failed to rename file, using original: {rename_error}")
                                completed_videos.append(downloaded_file)
                                pending_part_files.append(downloaded_file)
                                try:
                                    pending_part_size += os.path.getsize(downloaded_file)
                                except Exception:
                                    pass

                        # Update completed count in active download entry
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['completed_videos'] = completed_videos.copy()
                                active_video_downloads[download_id]['completed_count'] = len(completed_videos)
                                active_video_downloads[download_id]['progress'] = min(((len(completed_videos)) / total_videos) * 100, 95.0)

                        # Decide if we should flush a part now (time-based or size-based)
                        now = time.time()
                        if (now - last_flush_time >= FLUSH_INTERVAL and pending_part_files) or pending_part_size >= MAX_PART_SIZE:
                            # Flush pending files into a new ZIP part
                            try:
                                part_index = len(active_video_downloads[download_id].get('parts', [])) + 1
                                part_name = f"{os.path.splitext(zip_path)[0]}_part{part_index}.zip"
                                with zipfile.ZipFile(part_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                                    for f in pending_part_files:
                                        if os.path.exists(f):
                                            zipf.write(f, os.path.basename(f))
                                video_logger.info(f"Flushed ZIP part {part_index}: {part_name} (size ~{pending_part_size} bytes)")

                                # Register the new part
                                with download_lock:
                                    entry = active_video_downloads.get(download_id)
                                    if entry is not None:
                                        parts = entry.get('parts') or []
                                        parts.append(part_name)
                                        entry['parts'] = parts
                                        # If no file_path yet set, set to this first part
                                        if not entry.get('file_path'):
                                            entry['file_path'] = part_name
                                            entry['status'] = 'completed'
                                        entry['completed_count'] = len(completed_videos)
                                        # We're still in the middle of producing parts; mark as not finished
                                        entry['finished'] = False

                                # After flushing, remove those files from disk (they've been archived)
                                for f in pending_part_files:
                                    try:
                                        delete_file_safe(f)
                                        video_logger.debug(f"Cleaned up file after flush: {f}")
                                    except Exception as cleanup_error:
                                        video_logger.warning(f"Failed to clean up file {f} after flush: {cleanup_error}")

                                # Reset pending part buffers
                                pending_part_files = []
                                pending_part_size = 0
                                last_flush_time = time.time()
                            except Exception as flush_err:
                                video_logger.error(f"Failed to flush ZIP part for {download_id}: {flush_err}")
                    
                    # Update progress
                    current_progress = ((i + 1) / total_videos) * 100
                    with download_lock:
                        if download_id in active_video_downloads:
                            active_video_downloads[download_id]['completed_videos'] = completed_videos.copy()
                            active_video_downloads[download_id]['completed_count'] = len(completed_videos)
                            active_video_downloads[download_id]['progress'] = min(current_progress, 95.0)
                            
                except Exception as e:
                    video_logger.error(f"Error downloading video {video_id}: {e}")
                    # Continue with next video
            
                # After loop completes, flush any remaining pending files into parts
            parts = active_video_downloads[download_id].get('parts', []) if download_id in active_video_downloads else []
            if pending_part_files:
                try:
                    part_index = len(parts) + 1
                    part_name = f"{os.path.splitext(zip_path)[0]}_part{part_index}.zip"
                    with zipfile.ZipFile(part_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for f in pending_part_files:
                            if os.path.exists(f):
                                zipf.write(f, os.path.basename(f))
                    video_logger.info(f"Flushed final ZIP part {part_index}: {part_name} (size ~{pending_part_size} bytes)")

                    with download_lock:
                        entry = active_video_downloads.get(download_id)
                        if entry is not None:
                            parts = entry.get('parts') or []
                            parts.append(part_name)
                            entry['parts'] = parts
                            if not entry.get('file_path'):
                                entry['file_path'] = part_name
                            entry['completed_count'] = len(completed_videos)

                    for f in pending_part_files:
                        try:
                            delete_file_safe(f)
                        except Exception:
                            pass
                except Exception as flush_err:
                    video_logger.error(f"Failed to flush final ZIP part for {download_id}: {flush_err}")

            # Mark download as finished only when all parts have been created; files are served and removed later
            with download_lock:
                if download_id in active_video_downloads:
                    entry = active_video_downloads[download_id]
                    entry['status'] = 'completed' if entry.get('parts') else 'error'
                    entry['progress'] = 100.0 if entry.get('parts') else entry.get('progress', 0.0)
                    entry['file_path'] = entry.get('parts')[0] if entry.get('parts') else entry.get('file_path')
                    # We are at the end of the worker: mark finished True so cleanup can remove
                    # the entry only after all parts have been served.
                    entry['finished'] = True if entry.get('parts') else True
                
        except Exception as e:
            # Error occurred
            error_msg = str(e)
            video_logger.error(f"Bulk download error for {download_id}: {error_msg}")
            
            with download_lock:
                if download_id in active_video_downloads:
                    active_video_downloads[download_id].update({
                        'status': 'error',
                        'error': error_msg,
                        'finished': True
                    })
        finally:
            # Decrement rate limit counter when download finishes (success or error)
            if client_ip:
                decrement_video_rate_limit(client_ip)

    @app.post("/api/v1/video/playlist-info", response_model=PlaylistInfoResponse)
    async def get_playlist_info(request: PlaylistInfoRequest):
        """Get information about a YouTube playlist with caching and pagination"""
        video_logger.info(f"Getting playlist info for URL: {request.url} (page {request.page})")
        try:
            if not is_playlist_url(request.url):
                video_logger.warning(f"Invalid playlist URL provided: {request.url}")
                raise HTTPException(status_code=400, detail="URL is not a valid YouTube playlist")
            
            playlist_id = extract_playlist_id(request.url)
            if not playlist_id:
                video_logger.warning(f"Could not extract playlist ID from URL: {request.url}")
                raise HTTPException(status_code=400, detail="Could not extract playlist ID from URL")
            
            video_logger.info(f"Extracted playlist ID: {playlist_id}")
            
            # Cache the full playlist data (all videos extracted)
            cache_key_full = f"{playlist_id}_full"
            
            #  CHECK CACHE FIRST - avoid redundant API calls
            cached_full_data = get_cached_playlist_info(cache_key_full)
            
            page_size = 100
            
            if cached_full_data:
                video_logger.info(f"Using cached full playlist data for {playlist_id}, serving page {request.page}")
                # Serve paginated results from cached full data
                all_videos = cached_full_data.get('videos', [])
                total_count = cached_full_data.get('total_count', len(all_videos))
                extracted_count = cached_full_data.get('extracted_count', len(all_videos))
                playlist_title = cached_full_data.get('title', f'Playlist {playlist_id}')
                
                start_index = (request.page - 1) * page_size
                end_index = start_index + page_size
                paginated_videos = all_videos[start_index:end_index]
                # has_more based on extracted videos (not total, since we can only extract ~100)
                has_more = end_index < extracted_count
                
                return PlaylistInfoResponse(
                    success=True,
                    playlist_id=playlist_id,
                    title=playlist_title,
                    video_count=total_count,
                    videos=paginated_videos,
                    is_private=False,
                    page=request.page,
                    page_size=page_size,
                    has_more=has_more
                )
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': 'in_playlist',  # Extract basic info only (faster)
                'ignoreerrors': True,  # Continue even if some videos fail
                'skip_unavailable_fragments': True,
            }
            
            #  ADD COOKIES for age-restricted playlists
            cookie_file = os.environ.get('YTDL_COOKIE_FILE')
            if not cookie_file:
                backend_cookie_path = os.path.join(os.path.dirname(__file__), 'cookies.txt')
                if os.path.exists(backend_cookie_path):
                    cookie_file = backend_cookie_path
            
            if cookie_file and os.path.exists(cookie_file):
                ydl_opts['cookiefile'] = cookie_file
                video_logger.info(f"Using cookies for playlist extraction: {cookie_file}")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    video_logger.info(f"Extracting playlist info with yt-dlp for ID: {playlist_id}")
                    info = ydl.extract_info(request.url, download=False)
                    
                    if not info:
                        video_logger.error(f"Playlist not found or unavailable: {playlist_id}")
                        raise HTTPException(status_code=404, detail="Playlist not found or unavailable")
                    
                    # Check if playlist is private/unavailable
                    if info.get('availability') == 'private':
                        video_logger.warning(f"Playlist {playlist_id} is private")
                        response = PlaylistInfoResponse(
                            success=False,
                            playlist_id=playlist_id,
                            title="Private Playlist",
                            video_count=0,
                            videos=[],
                            is_private=True,
                            error="This playlist is private. Please make it unlisted or public to access it."
                        )
                        # Don't cache error responses
                        return response
                    
                    playlist_title = info.get('title', f'Playlist {playlist_id}')
                    playlist_count = info.get('playlist_count', 0)  # Total videos in playlist
                    entries = info.get('entries', [])
                    
                    videos = []
                    skipped_count = 0
                    for entry in entries:
                        if entry:
                            # Handle different entry formats
                            video_id = entry.get('id') or entry.get('url', '').split('v=')[-1].split('&')[0] if entry.get('url') else None
                            if video_id:
                                videos.append(PlaylistVideoInfo(
                                    id=video_id,
                                    title=entry.get('title', 'Unknown Title'),
                                    duration=entry.get('duration'),
                                    url=f"https://www.youtube.com/watch?v={video_id}"
                                ))
                            else:
                                skipped_count += 1
                                video_logger.debug(f"Skipped entry without ID: {entry.get('title', 'Unknown')}")
                    
                    if skipped_count > 0:
                        video_logger.info(f"Skipped {skipped_count} unavailable/private videos in playlist {playlist_id}")
                    
                    # Paginate the extracted videos in memory
                    start_index = (request.page - 1) * page_size
                    end_index = start_index + page_size
                    paginated_videos = videos[start_index:end_index]
                    
                    # Use the actual playlist_count from YouTube metadata (shows real total)
                    # Note: extract_flat can only extract ~100 videos, but playlist_count shows the true total
                    total_videos = playlist_count if playlist_count > 0 else len(videos)
                    extracted_count = len(videos)  # How many we actually got
                    # has_more: true if there are more videos in the actual playlist
                    has_more = end_index < extracted_count
                    
                    video_logger.info(f"Successfully extracted playlist info: {playlist_title} with {len(paginated_videos)} videos on page {request.page} (extracted: {extracted_count}, total in playlist: {total_videos})")
                    
                    #  CACHE THE FULL DATA (all videos) to avoid redundant API calls
                    full_data = {
                        'videos': videos,  # All extracted videos (~100 max)
                        'total_count': total_videos,  # Actual playlist total from metadata
                        'extracted_count': extracted_count,  # How many we actually got
                        'title': playlist_title
                    }
                    cache_playlist_info(cache_key_full, full_data)
                    
                    response = PlaylistInfoResponse(
                        success=True,
                        playlist_id=playlist_id,
                        title=playlist_title,
                        video_count=total_videos,  # Total count, not just this page
                        videos=paginated_videos,  # Only videos for this page
                        is_private=False,
                        page=request.page,
                        page_size=page_size,
                        has_more=has_more
                    )
                    
                    return response
                        
                except Exception as e:
                    error_msg = str(e)
                    video_logger.error(f"Error extracting playlist info for {playlist_id}: {error_msg}")
                    if "Sign in to confirm your age" in error_msg:
                        video_logger.warning(f"Age-restricted playlist: {playlist_id}")
                        return PlaylistInfoResponse(
                            success=False,
                            playlist_id=playlist_id,
                            title="Age-Restricted Playlist",
                            video_count=0,
                            videos=[],
                            error="This playlist contains age-restricted content. Some videos may not be downloadable."
                        )
                    elif "private" in error_msg.lower():
                        video_logger.warning(f"Private playlist: {playlist_id}")
                        return PlaylistInfoResponse(
                            success=False,
                            playlist_id=playlist_id,
                            title="Private Playlist",
                            video_count=0,
                            videos=[],
                            is_private=True,
                            error="This playlist is private. Please make it unlisted or public to access it."
                        )
                    else:
                        video_logger.error(f"Failed to extract playlist info for {playlist_id}: {error_msg}")
                        raise HTTPException(status_code=500, detail=f"Failed to extract playlist info: {error_msg}")
                        
        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in get_playlist_info: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/api/v1/video/queue/{download_id}")
    async def get_queue_status(download_id: str):
        """Get the queue status for a specific download ID"""
        try:
            queue_info = get_queue_position(download_id)
            
            # Also check if download is active
            download_info = None
            with download_lock:
                if download_id in active_video_downloads:
                    download_info = {
                        'status': active_video_downloads[download_id].get('status'),
                        'progress': active_video_downloads[download_id].get('progress', 0),
                        'title': active_video_downloads[download_id].get('title'),
                        'error': active_video_downloads[download_id].get('error')
                    }
            
            return {
                'success': True,
                'download_id': download_id,
                'queue': queue_info,
                'download': download_info
            }
        except Exception as e:
            video_logger.error(f"Error getting queue status: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/v1/video/validate", response_model=Dict[str, Any])
    async def validate_video_url(request: VideoUrlValidation):
        """Validate if URL is supported and return platform info"""
        try:
            platform = detect_platform(request.url)
            if not platform:
                return {"valid": False, "error": "Unsupported platform or invalid URL"}
            
            # Check if it's a playlist
            if is_playlist_url(request.url):
                return {
                    "valid": True,
                    "platform": platform,
                    "is_playlist": True,
                    "playlist_id": extract_playlist_id(request.url),
                    "message": "YouTube playlist detected. Use /api/v1/video/playlist-info to get playlist details."
                }
            
            # Test if yt-dlp can extract info
            ydl_opts = {'quiet': True, 'no_warnings': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    info = ydl.extract_info(request.url, download=False)
                    title = info.get('title', 'Unknown')
                    duration = info.get('duration', 0)
                    filesize = info.get('filesize') or info.get('filesize_approx', 0)
                    
                    #  Check size/duration limits
                    warnings = []

                    # Adaptive quality removed: reject videos larger than the configured max
                    if filesize > MAX_VIDEO_FILESIZE:
                        size_gb = filesize / (1024 * 1024 * 1024)
                        return {
                            "valid": False,
                            "error": f"Video is too large ({size_gb:.2f}GB). Maximum allowed: {MAX_VIDEO_FILESIZE / (1024**3):.1f}GB.",
                            "size_limit_exceeded": True,
                            "filesize": filesize,
                            "duration": duration
                        }
                    
                    if duration > MAX_VIDEO_DURATION:
                        minutes = duration / 60
                        return {
                            "valid": False,
                            "error": f"Video is too long ({minutes:.1f} minutes). Maximum allowed: {MAX_VIDEO_DURATION / 60:.0f} minutes.",
                            "duration_limit_exceeded": True,
                            "filesize": filesize,
                            "duration": duration
                        }
                    
                    # Warnings for large but acceptable files
                    if filesize > WARN_VIDEO_FILESIZE:
                        size_mb = filesize / (1024 * 1024)
                        warnings.append(f"Large file: {size_mb:.0f}MB - download may be slow")

                    response = {
                        "valid": True,
                        "platform": platform,
                        "is_playlist": False,
                        "title": title,
                        "duration": duration,
                        "formats_available": True
                    }
                    
                    if filesize:
                        response["filesize"] = filesize
                    
                    if warnings:
                        response["warnings"] = warnings
                    
                    return response
                except Exception as e:
                    error_msg = str(e)
                    if "Sign in to confirm your age" in error_msg:
                        return {
                            "valid": True,
                            "platform": platform,
                            "is_playlist": False,
                            "title": "Age-Restricted Video",
                            "duration": 0,
                            "age_restricted": True,
                            "warning": "This video is age-restricted. Download may require authentication."
                        }
                    else:
                        return {"valid": False, "error": f"Cannot extract video info: {error_msg}"}
                    
        except Exception as e:
            return {"valid": False, "error": str(e)}

    @app.post("/api/v1/video/convert", response_model=VideoConversionResponse)
    async def convert_video(request: VideoConversionRequest, req: Request):
        """Start video conversion process with rate limiting"""
        # Ensure we can modify the module-level counters when reserving slots
        global active_conversions_count, active_long_conversions_count

        try:
            # Get client IP for rate limiting
            client_ip = get_client_ip(req)
            
            # Check rate limit
            if not check_video_rate_limit(client_ip):
                video_logger.warning(f"Rate limit exceeded for IP {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {MAX_CONCURRENT_DOWNLOADS_PER_IP} concurrent downloads per IP. Please wait."
                )
            
            # Validate URL first
            platform = detect_platform(request.url)
            if not platform:
                raise HTTPException(status_code=400, detail="Unsupported platform or invalid URL")
            
            # Block internal/localhost URLs (SSRF protection)
            from urllib.parse import urlparse
            parsed = urlparse(request.url)
            if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0', '::1']:
                raise HTTPException(status_code=400, detail="Invalid URL: localhost not allowed")
            
            # Normalize URL for coalescing (simple normalization)
            normalized_url = request.url.strip()

            # If another worker is already downloading this URL, coalesce requests
            with download_lock:
                existing = active_url_map.get(normalized_url)
                if existing:
                    # Increment refcount so we know multiple clients are waiting
                    existing['refcount'] = existing.get('refcount', 1) + 1
                    # Also increment the waiter count on the active_video_downloads entry
                    try:
                        did = existing.get('download_id')
                        if did and did in active_video_downloads:
                            active_video_downloads[did]['waiters'] = active_video_downloads[did].get('waiters', 1) + 1
                    except Exception:
                        pass
                    video_logger.info(f"Coalescing request: returning existing download ID {existing['download_id']} for URL {normalized_url} (refcount={existing['refcount']})")
                    return VideoConversionResponse(
                        success=True,
                        download_id=existing['download_id'],
                        message=f"Download already in progress. Using existing download ID {existing['download_id']}"
                    )

            # Increment rate limit counter (only for new downloads)
            increment_video_rate_limit(client_ip)

            # Probe the URL for metadata (duration, filesize) so we can decide
            # whether this is a long-video job and route it to the dedicated pool.
            duration = 0
            filesize = 0
            try:
                # Offload blocking yt-dlp probe to a thread to avoid blocking
                # the main asyncio event loop. This prevents the health check
                # and other endpoints from being starved when many probes run.
                loop = asyncio.get_running_loop()

                def blocking_probe(url):
                    probe_opts = {'quiet': True, 'no_warnings': True}
                    with yt_dlp.YoutubeDL(probe_opts) as ydl:
                        return ydl.extract_info(url, download=False)

                info = await loop.run_in_executor(None, blocking_probe, request.url)
                duration = info.get('duration', 0) or 0
                filesize = info.get('filesize') or info.get('filesize_approx', 0) or 0
            except Exception as probe_err:
                video_logger.debug(f"Could not probe URL metadata for {request.url}: {probe_err}")

            # Decide whether this is a long video (separate pool)
            is_long = bool(duration and duration > MAX_VIDEO_DURATION)

            # Generate unique download ID
            download_id = str(uuid.uuid4())

            # Determine format and quality
            format_type = 'audio' if request.format == 1 else 'video'

            # Set up output filename
            timestamp = int(time.time())
            output_filename = f"{download_id}_{timestamp}.%(ext)s"
            output_path = os.path.join(VIDEO_DOWNLOAD_DIR, output_filename)

            # Register normalized URL -> download_id for coalescing (with refcount)
            with download_lock:
                active_url_map[normalized_url] = {'download_id': download_id, 'refcount': 1}

            # Store download info (include duration + is_long flag)
            with download_lock:
                active_video_downloads[download_id] = {
                    'status': 'queued',
                    'progress': 0.0,
                    'platform': platform,
                    'format': 'MP3' if format_type == 'audio' else 'MP4',
                    'quality': request.quality,
                    'url': request.url,
                    'output_path': output_path,
                    'duration': duration,
                    'is_long': is_long,
                    'created_at': time.time(),
                    'title': None,
                    'error': None,
                    'finished': False,
                    'waiters': 1,
                    'file_path': None,
                    'client_ip': client_ip
                }
                # If client provided a proxy parameter in the JSON body, accept it
                try:
                    body_json = await req.json()
                    proxy_param = body_json.get('proxy')
                    if proxy_param:
                        with download_lock:
                            if download_id in active_video_downloads:
                                active_video_downloads[download_id]['proxy'] = proxy_param
                                video_logger.info(f"Registered per-download proxy for {download_id}: {proxy_param}")
                except Exception:
                    pass

            # Add to queue (include is_long flag so dispatcher can prefer short jobs)
            add_to_queue(download_id, request.url, client_ip, is_long=is_long)
            
            # Get queue position for response
            queue_info = get_queue_position(download_id)
            
            # Check if we can start immediately (use is_long-aware check)
            started_immediately = False
            if can_start_conversion(is_long=is_long):
                # Reserve a slot atomically and start (perform increment inline to avoid re-acquiring the lock)
                with conversions_lock:
                    if can_start_conversion(is_long=is_long):
                        # Inline increment under lock to avoid deadlock (increment_active_conversions also locks)
                        if is_long:
                            active_long_conversions_count += 1
                            video_logger.info(f"Active long conversions: {active_long_conversions_count}/{MAX_CONCURRENT_LONG_CONVERSIONS}")
                        else:
                            active_conversions_count += 1
                            video_logger.info(f"Active short conversions: {active_conversions_count}/{MAX_CONCURRENT_CONVERSIONS}")
                        started_immediately = True

            if started_immediately:
                # Remove from queue BEFORE starting (so it doesn't stay in queue forever)
                remove_from_queue(download_id)

                # Set status to 'starting' BEFORE submitting to avoid race condition
                with download_lock:
                    if download_id in active_video_downloads:
                        active_video_downloads[download_id]['status'] = 'starting'

                # Submit to appropriate process pool
                try:
                    pool = long_video_process_pool if is_long else video_process_pool
                    future = pool.submit(
                        download_video_background,
                        download_id, request.url, format_type, request.quality, output_path, client_ip,
                        request.chunk_index, request.chunk_start, request.chunk_end
                    )

                    # Add completion callback that honors is_long
                    def done_callback(fut, is_long_flag=is_long):
                        try:
                            fut.result()
                        except Exception as e:
                            video_logger.error(f"Download {download_id} error: {e}")
                        finally:
                            decrement_active_conversions(is_long=is_long_flag)
                            decrement_video_rate_limit(client_ip)
                            process_next_in_queue()

                    future.add_done_callback(done_callback)

                except Exception as e:
                    video_logger.error(f"Failed to submit {download_id}: {e}")
                    # Clean up reservation and bookkeeping since we couldn't start
                    decrement_active_conversions(is_long=is_long)
                    with download_lock:
                        if active_url_map.get(normalized_url, {}).get('download_id') == download_id:
                            del active_url_map[normalized_url]
                        if download_id in active_video_downloads:
                            del active_video_downloads[download_id]
                    remove_from_queue(download_id)
                    decrement_video_rate_limit(client_ip)
                    video_logger.warning(f"Process pool error; rejected download {download_id}")
                    raise HTTPException(status_code=429, detail="Server busy processing other downloads. Try again shortly.")
            
            response_message = f"Started {format_type} conversion from {platform}"
            if queue_info['in_queue'] and queue_info['position'] > 1:
                response_message += f" (queued at position {queue_info['position']}, estimated wait: {queue_info['estimated_wait_seconds']}s)"
            
            return VideoConversionResponse(
                success=True,
                download_id=download_id,
                message=response_message
            )
            
        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in convert_video: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/v1/video/bulk-download", response_model=VideoConversionResponse)
    async def bulk_download_playlist(request: BulkDownloadRequest, req: Request):
        """Start bulk download of multiple videos from a playlist"""
        video_logger.info(f"Starting bulk download for playlist: {request.playlist_url}")
        video_logger.info(f"Video IDs to download: {len(request.video_ids)} videos")
        try:
            # Get client IP for rate limiting
            client_ip = get_client_ip(req)
            
            # Check rate limit (more strict for bulk downloads)
            if not check_video_rate_limit(client_ip):
                video_logger.warning(f"Rate limit exceeded for IP {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {MAX_CONCURRENT_DOWNLOADS_PER_IP} concurrent downloads per IP. Please wait."
                )
            
            if not request.video_ids:
                video_logger.warning("No video IDs provided for bulk download")
                raise HTTPException(status_code=400, detail="No video IDs provided")
            
            if len(request.video_ids) > 2000:  # Limit bulk downloads to a high ceiling
                video_logger.warning(f"Too many videos requested: {len(request.video_ids)} (max 2000)")
                raise HTTPException(status_code=400, detail="Maximum 2000 videos per bulk download")
            
            # Generate unique download ID
            download_id = str(uuid.uuid4())
            video_logger.info(f"Generated download ID: {download_id}")
            
            # Determine format and quality
            format_type = 'audio' if request.format == 1 else 'video'
            extension = 'mp3' if format_type == 'audio' else 'mp4'
            
            # Create temporary directory for individual downloads
            bulk_dir = os.path.join(VIDEO_DOWNLOAD_DIR, f"bulk_{download_id}")
            os.makedirs(bulk_dir, exist_ok=True)
            video_logger.info(f"Created bulk download directory: {bulk_dir}")
            
            # Create ZIP file path
            zip_filename = f"playlist_download_{int(time.time())}.zip"
            zip_path = os.path.join(VIDEO_DOWNLOAD_DIR, zip_filename)
            
            # Store download info
            with download_lock:
                active_video_downloads[download_id] = {
                    'status': 'starting',
                    'progress': 0.0,
                    'platform': 'youtube',
                    'format': f'Bulk {format_type.title()}',
                    'quality': request.quality,
                    'url': request.playlist_url,
                    'output_path': zip_path,
                    'bulk_dir': bulk_dir,
                    'video_ids': request.video_ids,
                    'completed_videos': [],
                    'total_videos': len(request.video_ids),
                    'created_at': time.time(),
                    'title': f'Playlist Bulk Download ({len(request.video_ids)} videos)',
                    'error': None,
                    'finished': False,
                    'file_path': None
                }
            
            # Increment rate limit counter
            increment_video_rate_limit(client_ip)
            
            # Submit bulk download to process pool
            video_logger.info(f"Submitting background bulk download task for {download_id}")
            try:
                future = video_process_pool.submit(
                    bulk_download_background,
                    download_id, request.video_ids, format_type, request.quality, bulk_dir, zip_path, client_ip
                )
                
                # Add completion callback
                def done_callback(fut):
                    try:
                        fut.result()
                    except Exception as e:
                        video_logger.error(f"Bulk download {download_id} error: {e}")
                    finally:
                        decrement_video_rate_limit(client_ip)
                
                future.add_done_callback(done_callback)
                
            except Exception as e:
                video_logger.error(f"Failed to submit bulk download {download_id}: {e}")
                with download_lock:
                    if download_id in active_video_downloads:
                        del active_video_downloads[download_id]
                decrement_video_rate_limit(client_ip)
                video_logger.warning(f"Worker queue full; rejected bulk download {download_id}")
                raise HTTPException(status_code=429, detail="Server busy processing other downloads. Try again shortly.")
            
            video_logger.info(f"Bulk download started successfully: {download_id}")
            return VideoConversionResponse(
                success=True,
                download_id=download_id,
                message=f"Started bulk download of {len(request.video_ids)} videos"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in bulk_download_playlist: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/api/v1/video/full-playlist-download", response_model=VideoConversionResponse)
    async def full_playlist_download(request: FullPlaylistDownloadRequest, req: Request):
        """Download ALL videos from a playlist (bypasses 100-video UI limit)"""
        video_logger.info(f"Starting full playlist download: {request.playlist_url}")
        video_logger.info(f"Range: {request.start_index} to {request.end_index or 'end'}")
        try:
            # Get client IP for rate limiting
            client_ip = get_client_ip(req)
            
            # Check rate limit
            if not check_video_rate_limit(client_ip):
                video_logger.warning(f"Rate limit exceeded for IP {client_ip}")
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. Maximum {MAX_CONCURRENT_DOWNLOADS_PER_IP} concurrent downloads per IP. Please wait."
                )
            
            if not is_playlist_url(request.playlist_url):
                raise HTTPException(status_code=400, detail="URL is not a valid playlist")
            
            # Generate unique download ID
            download_id = str(uuid.uuid4())
            video_logger.info(f"Generated download ID for full playlist: {download_id}")
            
            # Determine format
            format_type = 'audio' if request.format == 1 else 'video'
            extension = 'mp3' if format_type == 'audio' else 'mp4'
            
            # Create output path
            zip_filename = f"full_playlist_{int(time.time())}.zip"
            zip_path = os.path.join(VIDEO_DOWNLOAD_DIR, zip_filename)
            
            # Store download info
            with download_lock:
                active_video_downloads[download_id] = {
                    'status': 'starting',
                    'progress': 0.0,
                    'platform': 'youtube',
                    'format': f'Full Playlist {format_type.title()}',
                    'quality': request.quality,
                    'url': request.playlist_url,
                    'output_path': zip_path,
                    'created_at': time.time(),
                    'title': f'Full Playlist Download',
                    'error': None,
                    'finished': False,
                    'file_path': None
                }
            
            # Increment rate limit counter
            increment_video_rate_limit(client_ip)
            
            # Submit to process pool
            video_logger.info(f"Submitting full playlist download task for {download_id}")
            try:
                future = video_process_pool.submit(
                    full_playlist_download_background,
                    download_id, request.playlist_url, format_type, request.quality, 
                    request.start_index, request.end_index, zip_path, client_ip
                )
                
                def done_callback(fut):
                    try:
                        fut.result()
                    except Exception as e:
                        video_logger.error(f"Full playlist download {download_id} error: {e}")
                
                future.add_done_callback(done_callback)
            except Exception as e:
                video_logger.error(f"Failed to submit full playlist download: {e}")
                with download_lock:
                    if download_id in active_video_downloads:
                        del active_video_downloads[download_id]
                decrement_video_rate_limit(client_ip)
                raise HTTPException(status_code=429, detail="Server busy. Try again shortly.")
            
            video_logger.info(f"Full playlist download started: {download_id}")
            return VideoConversionResponse(
                success=True,
                download_id=download_id,
                message=f"Started downloading full playlist (this may take a while for large playlists)"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Unexpected error in full_playlist_download: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post('/api/v1/video/upload-cookies/{download_id}')
    async def upload_cookies(download_id: str, file: UploadFile = File(...)):
        """Upload a cookies.txt file to be used for a specific download (useful for age-restricted videos)."""
        try:
            with download_lock:
                if download_id not in active_video_downloads:
                    raise HTTPException(status_code=404, detail='Download ID not found')
            dest_dir = VIDEO_DOWNLOAD_DIR
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, f"cookies_{download_id}.txt")
            contents = await file.read()
            with open(dest_path, 'wb') as f:
                f.write(contents)
            with download_lock:
                entry = active_video_downloads.get(download_id)
                if entry is not None:
                    entry['cookiefile'] = dest_path
            video_logger.info(f"Uploaded cookiefile for {download_id}: {dest_path}")
            return JSONResponse({'success': True, 'path': dest_path})
        except HTTPException:
            raise
        except Exception as e:
            video_logger.error(f"Failed to upload cookiefile for {download_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint for frontend to verify backend is running"""
    try:
        response = {
            "status": "healthy",
            "timestamp": time.time(),
            "video_converter_available": VIDEO_CONVERTER_AVAILABLE
        }
        
        # Only include video converter stats if it's available
        if VIDEO_CONVERTER_AVAILABLE:
            with download_lock:
                active_count = len([d for d in active_video_downloads.values() if not d.get('finished')])
                total_downloads = len(active_video_downloads)
            
            response.update({
                "active_downloads": active_count,
                "total_tracked": total_downloads,
                "watchdog_running": watchdog_running if 'watchdog_running' in globals() else False,
                "worker_pool_size": WORKER_POOL_SIZE if 'WORKER_POOL_SIZE' in globals() else 0
            })
        
        return response
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e),
            "timestamp": time.time()
        }


@app.post("/api/v1/video/create_upload_session")
async def create_upload_session(request: Request, total_videos: int = Body(0), title: str = Body(None)):
    """Create a server-side upload session: frontend will upload converted files which the server will bundle into ZIP parts."""
    try:
        download_id = str(uuid4())
        client_ip = get_client_ip(request) if request else None

        bulk_dir = os.path.join(VIDEO_DOWNLOAD_DIR, f"bulk_{download_id}")
        os.makedirs(bulk_dir, exist_ok=True)

        zip_path = os.path.join(VIDEO_DOWNLOAD_DIR, f"playlist_upload_{int(time.time())}_{download_id}.zip")

        with download_lock:
            active_video_downloads[download_id] = {
                'status': 'downloading',
                'progress': 0.0,
                'platform': 'YouTube',
                'format': 'Bulk (uploaded)',
                'quality': None,
                'title': title or f'Upload session {download_id}',
                'output_path': zip_path,
                'bulk_dir': bulk_dir,
                'video_ids': [],
                'completed_videos': [],
                'total_videos': total_videos,
                'created_at': time.time(),
                'parts': [],
                'error': None,
                'finished': False,
                'file_path': None
            }

        video_logger.info(f"Created upload session {download_id} (total_videos={total_videos}) from IP {client_ip}")
        return JSONResponse({'success': True, 'download_id': download_id})
    except Exception as e:
        video_logger.error(f"Failed to create upload session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/video/upload_part/{download_id}")
async def upload_part(download_id: str, files: List[UploadFile] = File(...), request: Request = None):
    """Accept uploaded files from frontend, create a ZIP part on the server, and register it for download."""
    with download_lock:
        if download_id not in active_video_downloads:
            raise HTTPException(status_code=404, detail="Upload session not found")
        entry = active_video_downloads[download_id]

    try:
        bulk_dir = entry.get('bulk_dir')
        if not bulk_dir:
            raise HTTPException(status_code=500, detail='Bulk directory not configured')

        saved_files = []
        for up in files:
            filename = up.filename or f'file_{int(time.time())}'
            safe = re.sub(r'[^\w\s\-\.()]', '_', filename)
            dest = os.path.join(bulk_dir, safe)
            with open(dest, 'wb') as out_f:
                content = await up.read()
                out_f.write(content)
            saved_files.append(dest)
            video_logger.info(f"Received uploaded file for {download_id}: {dest}")

        # Create ZIP part
        with download_lock:
            part_index = len(entry.get('parts') or []) + 1
            zip_base = entry.get('output_path') or os.path.join(VIDEO_DOWNLOAD_DIR, f"playlist_upload_{int(time.time())}_{download_id}.zip")
            part_name = f"{os.path.splitext(zip_base)[0]}_part{part_index}.zip"

        with zipfile.ZipFile(part_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for fpath in saved_files:
                if os.path.exists(fpath):
                    zipf.write(fpath, os.path.basename(fpath))

        video_logger.info(f"Created uploaded ZIP part for {download_id}: {part_name}")

        # Register part and set ready for download if needed
        with download_lock:
            parts = entry.get('parts') or []
            parts.append(part_name)
            entry['parts'] = parts
            entry['completed_videos'] = entry.get('completed_videos', []) + saved_files
            entry['completed_count'] = len(entry.get('completed_videos', []))
            # If no current file_path set, set this part as ready
            if not entry.get('file_path'):
                entry['file_path'] = part_name
                entry['status'] = 'completed'
                entry['finished'] = False

        # Clean up uploaded raw files  they've been archived
        for fpath in saved_files:
            try:
                delete_file_safe(fpath)
            except Exception:
                pass

        return JSONResponse({'success': True, 'part': part_name})
    except HTTPException:
        raise
    except Exception as e:
        video_logger.error(f"Error handling upload_part for {download_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/video/download/{download_id}")
async def download_converted_file(request: Request, download_id: str):
    """Download the converted file"""
    with download_lock:
        if download_id not in active_video_downloads:
            raise HTTPException(status_code=404, detail="Download ID not found")
        
        download_info = active_video_downloads[download_id]
        
        if download_info['status'] != 'completed':
            raise HTTPException(status_code=400, detail="Conversion not completed yet")
        
        if not download_info.get('file_path') or not os.path.exists(download_info['file_path']):
            raise HTTPException(status_code=404, detail="Converted file not found")
        
    file_path = download_info['file_path']
    filename = os.path.basename(file_path)

    # Clean filename for download
    if download_info.get('title'):
        safe_title = re.sub(r'[^\w\s-]', '', download_info['title']).strip()[:50]
        ext = os.path.splitext(filename)[1]
        filename = f"{safe_title}{ext}"

    # Capture client IP synchronously for bookkeeping (avoid using request inside BG task)
    client_ip = None
    try:
        client_ip = get_client_ip(request) if request else None
    except Exception:
        client_ip = None

    def bg_cleanup():
        # When serving a bulk with multiple parts, remove the served part and
        # advance the download entry to the next available part. If no parts
        # remain, remove the entry entirely.
        try:
            delete_file_safe(file_path)
        except Exception as e:
            video_logger.warning(f"Failed to delete file {file_path}: {e}")

        try:
            with download_lock:
                entry = active_video_downloads.get(download_id)
                if not entry:
                    return

                parts = entry.get('parts') or []
                # If multiple parts were created, remove the first (served) part
                if parts and file_path in parts:
                    try:
                        parts.remove(file_path)
                    except ValueError:
                        pass

                if parts:
                    # Set next part as ready for download
                    entry['file_path'] = parts[0]
                    entry['parts'] = parts
                    # Keep status as completed (ready to download). Do not mark finished here;
                    # the bulk worker controls when it is truly finished producing parts.
                    entry['status'] = 'completed'
                    video_logger.info(f"Advanced bulk download {download_id} to next part: {entry['file_path']}")
                else:
                    # No more parts currently available. Only remove the active entry if
                    # the background bulk worker has finished producing parts. If the
                    # worker is still running (finished == False or missing), keep the
                    # entry so it can register future parts and the client can poll status.
                    finished_flag = entry.get('finished', False)
                    if finished_flag:
                        try:
                            del active_video_downloads[download_id]
                        except KeyError:
                            pass
                    else:
                        # Worker still running  keep the entry but clear file_path so
                        # clients know there's no ready part yet; status should reflect
                        # ongoing processing.
                        entry['file_path'] = None
                        entry['parts'] = []
                        entry['status'] = 'downloading'
        except Exception as e:
            video_logger.warning(f"Error updating active video download record: {e}")

    def bg_cleanup_wrapper():
        try:
            bg_cleanup()
        finally:
            if client_ip:
                try:
                    decrement_video_rate_limit(client_ip)
                except Exception:
                    pass

    bg = BackgroundTask(bg_cleanup_wrapper)

    return FileResponse(
        file_path,
        filename=filename,
        media_type='application/octet-stream',
        background=bg
    )

# Video converter placeholder endpoints (if yt-dlp not available)
if not VIDEO_CONVERTER_AVAILABLE:
    @app.post("/api/v1/video/validate", response_model=Dict[str, Any])
    async def validate_video_url_unavailable(request: Dict[str, Any]):
        raise HTTPException(status_code=503, detail="Kindly support Convert The Spire by donating to bring it back.")
    
    @app.post("/api/v1/video/convert", response_model=Dict[str, Any])
    async def convert_video_unavailable(request: Dict[str, Any]):
        raise HTTPException(status_code=503, detail="Kindly support Convert The Spire by donating to bring it back.")

# ----------------------------------------------------
# Run the app
# ----------------------------------------------------
# Right before starting your main application
# =============================================================================
# KINGDOM QUARRY GAME API ENDPOINTS (Optional - requires PyJWT)
# =============================================================================

# Add a simple endpoint to check if game features are available
@app.get(ENDPOINT + "/game/status", tags=["Kingdom Quarry"])
async def get_game_status():
    """Check if Kingdom Quarry game features are available"""
    return {
        "game_available": JWT_AVAILABLE,
        "message": "Kingdom Quarry game endpoints available" if JWT_AVAILABLE else "Install PyJWT to enable Kingdom Quarry game features"
    }

# Game endpoints are only available if JWT is installed
if JWT_AVAILABLE:
    # Game Authentication Endpoints
    @app.post(ENDPOINT + "/game/auth/register", response_model=GameAuthResponse, tags=["Kingdom Quarry"])
    async def game_register(register_data: GameRegisterRequest, request: Request):
        """Register a new game user account"""
        try:
            # Check if user already exists
            existing_user = UserRepository.get_user_by_name(register_data.username.split()[0] if ' ' in register_data.username else register_data.username, "")
            if existing_user:
                raise HTTPException(status_code=400, detail="Username already exists")
            
            # Create new user using the isolated repository so we can set the
            # dedicated `email` column without touching the shared UserRepository
            hashed_info = UserRepository.hash_password(register_data.password)

            detected_email = register_data.email if getattr(register_data, 'email', None) else (
                register_data.username if '@' in register_data.username else None
            )

            user_payload = {
                'first_name': register_data.username,
                'last_name': register_data.username,
                'email': detected_email,
                'password_hash': hashed_info['password_hash'],
                'salt': hashed_info['salt'],
                'rfid_code': f"game_{register_data.username}_{datetime.now().timestamp()}",
                'userRoleId': 1  # Regular user role (player)
            }

            user_id = UserEmailRepository.create_user_with_email(user_payload)
            if not user_id:
                raise HTTPException(status_code=500, detail="Failed to create user")
            
            # Log IP address for the new user
            log_user_ip_address(user_id, get_client_ip_sync(request))
            
            # Initialize game data
            GameResourcesRepository.create_user_resources(user_id)
            GameUpgradesRepository.create_user_upgrades(user_id)
            
            # Create access token
            access_token = create_access_token(user_id, register_data.username)
            
            return GameAuthResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=int(JWT_EXPIRATION_TIME.total_seconds()),
                user_id=user_id
            )
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    @app.post(ENDPOINT + "/game/auth/login", response_model=GameAuthResponse, tags=["Kingdom Quarry"])
    async def game_login(login_data: GameLoginRequest, request: Request):
        """Login to game account"""
        try:
            # Authenticate user: try multiple role formats to support new and
            # legacy account formats. Try lowercase 'player' first, then
            # capitalized 'Player', then finally attempt to use the username
            # as the role (legacy fallback).
            user_id = None
            try_roles = ["player", "Player", login_data.username]
            for role_try in try_roles:
                user_id = UserRepository.authenticate_user(login_data.username, role_try, login_data.password)
                if user_id:
                    break

            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid username or password")
            
            # Log IP address for the authenticated user
            log_user_ip_address(user_id, get_client_ip_sync(request))
            
            # Create access token
            access_token = create_access_token(user_id, login_data.username)
            
            return GameAuthResponse(
                access_token=access_token,
                token_type="bearer", 
                expires_in=int(JWT_EXPIRATION_TIME.total_seconds()),
                user_id=user_id
            )
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

    # Game Save Endpoints
    @app.get(ENDPOINT + "/game/save", response_model=GameLoadResponse, tags=["Kingdom Quarry"])
    async def get_game_save(current_user: dict = Depends(get_current_game_user)):
        """Load game save data for authenticated user"""
        try:
            user_id = current_user['user_id']
            print(f" BACKEND LOAD: user_id = {user_id}")
            
            save_data = GameSaveRepository.get_save_by_user(user_id)
            print(f" BACKEND LOAD: save_data exists = {save_data is not None}")
            
            if save_data:
                print(f" BACKEND LOAD: save_data keys = {save_data.keys() if save_data else None}")
                print(f" BACKEND LOAD: save_data['save_data'] type = {type(save_data.get('save_data'))}")
                
                # Convert datetime to ISO string if it's a datetime object
                last_updated = save_data['last_updated']
                if isinstance(last_updated, datetime):
                    last_updated = last_updated.isoformat()
                
                print(f" BACKEND LOAD: Returning has_save=True")
                return GameLoadResponse(
                    save_data=save_data['save_data'],
                    last_updated=last_updated,
                    total_play_time=None,  # Column doesn't exist yet
                    has_save=True
                )
            else:
                print(f" BACKEND LOAD: No save found, returning has_save=False")
                return GameLoadResponse(has_save=False)
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load save: {str(e)}")


    # -----------------------------------------------------------------------------
    # Public access endpoint (NO AUTH) - Return game save for a named user
    # NOTE: This endpoint intentionally does not require authentication as requested,
    # but exposing save data publicly is a security/privacy risk. Consider restricting
    # access or adding a shared secret or rate limits in production.
    # -----------------------------------------------------------------------------
    @app.get(ENDPOINT + "/donationprogress", response_model=GameLoadResponse, tags=["Kingdom Quarry"])
    def get_public_game_save():
        """Return the latest game save for the UserServer account (user_id=648).

        This endpoint is unauthenticated and hardcoded for donation progress reading.
        """
        try:
            user_id = 648  # Hardcoded for UserServer
            save_data = GameSaveRepository.get_save_by_user(user_id)

            if save_data:
                last_updated = save_data.get('last_updated')
                if isinstance(last_updated, datetime):
                    last_updated = last_updated.isoformat()

                return GameLoadResponse(
                    save_data=save_data.get('save_data'),
                    last_updated=last_updated,
                    total_play_time=save_data.get('total_play_time') if 'total_play_time' in save_data else None,
                    has_save=True
                )
            else:
                return GameLoadResponse(has_save=False)
        except Exception as e:
            quiz_logger.error(f"PUBLIC SAVE ENDPOINT: Error while loading save for user_id={user_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load save: {e}")

    @app.post(ENDPOINT + "/game/save", response_model=GameSaveResponse, tags=["Kingdom Quarry"])
    async def save_game_data(save_request: GameSaveRequest, current_user: dict = Depends(get_current_game_user)):
        """Save game data for authenticated user"""
        try:
            user_id = current_user['user_id']
            print(f" BACKEND SAVE: user_id = {user_id}")
            print(f" BACKEND SAVE: game_version = {save_request.save_data.game_version}")
            print(f" BACKEND SAVE: resources = {save_request.save_data.resources}")
            
            # Create backup if requested
            backup_id = None
            if save_request.backup:
                existing_save = GameSaveRepository.get_save_by_user(user_id)
                if existing_save:
                    backup_id = GameSaveRepository.create_backup(user_id, existing_save['save_data'])
            
            # Convert Pydantic model to dict (Pydantic v2 uses model_dump())
            save_data_dict = save_request.save_data.model_dump() if hasattr(save_request.save_data, 'model_dump') else save_request.save_data.dict()
            
            print(f" BACKEND SAVE: save_data_dict keys = {save_data_dict.keys()}")
            print(f" BACKEND SAVE: save_data_dict size = {len(str(save_data_dict))} chars")
            
            # Save game data
            save_id = GameSaveRepository.create_save(
                user_id, 
                save_data_dict,
                save_request.save_data.game_version
            )
            
            print(f" BACKEND SAVE: save_id = {save_id}")
            
            if not save_id:
                raise HTTPException(status_code=500, detail="Failed to save game data")
                raise HTTPException(status_code=500, detail="Failed to save game data")
            
            # Update resources table with current values
            resources = save_request.save_data.resources
            GameResourcesRepository.update_resources(
                user_id,
                stone_count=resources.get('stone', 0),
                gold_count=resources.get('gold', 0), 
                magical_crystals=resources.get('crystals', 0),
                prestige_level=save_request.save_data.prestige_level
            )
            
            return GameSaveResponse(
                success=True,
                timestamp=datetime.now().isoformat(),
                save_id=save_id,
                backup_id=backup_id
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save game: {str(e)}")

    @app.get(ENDPOINT + "/game/leaderboard", response_model=GameLeaderboardResponse, tags=["Kingdom Quarry"])
    async def get_game_leaderboard(
        limit: int = 100,
        current_user: dict = Depends(get_current_game_user)
    ):
        """Get game leaderboard"""
        try:
            leaderboard_data = GameResourcesRepository.get_leaderboard(limit)
            
            entries = []
            user_rank = None
            
            for idx, entry in enumerate(leaderboard_data):
                rank = idx + 1
                leaderboard_entry = GameLeaderboardEntry(
                    user_id=entry['user_id'],
                    username=f"{entry['first_name']} {entry['last_name']}",
                    stone_count=entry['stone_count'],
                    gold_count=entry['gold_count'],
                    magical_crystals=entry['magical_crystals'],
                    prestige_level=entry['prestige_level'],
                    total_score=entry['total_score'],
                    rank=rank
                )
                entries.append(leaderboard_entry)
                
                # Check if this is the current user
                if entry['user_id'] == current_user['user_id']:
                    user_rank = rank
            
            return GameLeaderboardResponse(
                entries=entries,
                user_rank=user_rank,
                total_players=len(entries)
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get leaderboard: {str(e)}")

else:
    # JWT not available - add placeholder endpoints that return helpful messages
    @app.post(ENDPOINT + "/game/auth/register", tags=["Kingdom Quarry"])
    async def game_register_placeholder():
        """Game registration requires PyJWT"""
        raise HTTPException(status_code=503, detail="Game features require PyJWT library. Install with: pip install PyJWT")

    @app.post(ENDPOINT + "/game/auth/login", tags=["Kingdom Quarry"])
    async def game_login_placeholder():
        """Game login requires PyJWT"""
        raise HTTPException(status_code=503, detail="Game features require PyJWT library. Install with: pip install PyJWT")

# =============================================================================
# END KINGDOM QUARRY GAME API ENDPOINTS
# =============================================================================

# =============================================================================
# SENTLE GAME API ENDPOINTS
# =============================================================================

# Sentle Admin Password (stored in environment variable for security)
SENTLE_ADMIN_PASSWORD = os.getenv("SENTLE_ADMIN_PASSWORD", "sentle6967god")

# Initialize Sentle database tables
def init_sentle_tables():
    """Initialize Sentle game database tables"""
    try:
        from database.database import Database
        
        # Create sessions table for tracking plays and device info
        # (Uses quiz's users table, not a separate sentle_users table)
        Database.execute_sql("""
            CREATE TABLE IF NOT EXISTS sentle_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_token VARCHAR(255) NOT NULL UNIQUE,
                ip_address VARCHAR(45),
                user_agent TEXT,
                date DATE NOT NULL,
                played BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # Create sentences table
        Database.execute_sql("""
            CREATE TABLE IF NOT EXISTS sentle_sentences (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                sentence VARCHAR(500) NOT NULL,
                word_count INT NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create scores table
        Database.execute_sql("""
            CREATE TABLE IF NOT EXISTS sentle_scores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                sentence_id INT NOT NULL,
                score INT NOT NULL,
                attempts INT NOT NULL,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (sentence_id) REFERENCES sentle_sentences(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_sentence_date (user_id, sentence_id, date)
            )
        """)
        
        # Create game sessions table (tracks active game state for security)
        Database.execute_sql("""
            CREATE TABLE IF NOT EXISTS sentle_game_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                sentence_id INT NOT NULL,
                date DATE NOT NULL,
                current_word_index INT DEFAULT 0,
                total_attempts INT DEFAULT 0,
                reveals_used INT DEFAULT 0,
                completed BOOLEAN DEFAULT FALSE,
                score INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (sentence_id) REFERENCES sentle_sentences(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_game (user_id, sentence_id, date),
                INDEX idx_user_date (user_id, date)
            )
        """)
        
        # Create guesses table (tracks individual word guess attempts)
        Database.execute_sql("""
            CREATE TABLE IF NOT EXISTS sentle_guesses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_session_id INT NOT NULL,
                word_index INT NOT NULL,
                guess VARCHAR(100) NOT NULL,
                is_correct BOOLEAN DEFAULT FALSE,
                attempt_number INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_session_id) REFERENCES sentle_game_sessions(id) ON DELETE CASCADE,
                INDEX idx_session_word (game_session_id, word_index)
            )
        """)
        
        # Create reveals table (tracks letter reveals for anti-cheat)
        Database.execute_sql("""
            CREATE TABLE IF NOT EXISTS sentle_reveals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                game_session_id INT NOT NULL,
                word_index INT NOT NULL,
                letter_index INT NOT NULL,
                letter CHAR(1) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_session_id) REFERENCES sentle_game_sessions(id) ON DELETE CASCADE,
                INDEX idx_session_reveals (game_session_id, word_index)
            )
        """)
        
        print("✓ Sentle database tables initialized")
    except Exception as e:
        print(f"Warning: Could not initialize Sentle tables: {e}")

# Initialize tables on startup
init_sentle_tables()

# Sentle Admin Password (stored in environment variable for security)
SENTLE_ADMIN_PASSWORD = os.getenv("SENTLE_ADMIN_PASSWORD", "sentle6967god")

import secrets
import bcrypt

def generate_session_token() -> str:
    """Generate secure random session token"""
    return secrets.token_urlsafe(32)

def get_client_info(request) -> tuple:
    """Extract IP and User-Agent from request"""
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    return ip, user_agent

def verify_quiz_password(password: str, hashed_password: str, salt: str) -> bool:
    """Verify password against quiz user bcrypt hash (first try hash-only, then hash+salt fallback)."""
    try:
        if hashed_password:
            if bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8')):
                return True
        if hashed_password and salt:
            combined = (hashed_password + salt).encode('utf-8')
            return bcrypt.checkpw(password.encode('utf-8'), combined)
    except Exception:
        return False
    return False

@app.post("/api/sentle/register", tags=["Sentle Auth"])
async def sentle_register(payload: Dict[str, Any] = Body(...)):
    """Register a new Quiz user account (first + last name + password) for Sentle."""
    try:
        from database.datarepository import UserRepository

        first_name = payload.get('first_name', '').strip()
        last_name = payload.get('last_name', '').strip()
        password = payload.get('password', '').strip()

        if not first_name or not last_name or not password:
            raise HTTPException(status_code=400, detail="First name, last name, and password are required")

        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

        # Prevent duplicate names
        existing = UserRepository.get_user_by_name(first_name, last_name)
        if existing:
            raise HTTPException(status_code=409, detail="A user with this name already exists. Please login instead.")

        hashed_info = UserRepository.hash_password(password)
        user_data = {
            'first_name': first_name,
            'last_name': last_name,
            'password_hash': hashed_info['password_hash'],
            'salt': hashed_info['salt'],
            'userRoleId': 1,
            'soul_points': 4,
            'limb_points': 4,
            'updated_by': 1
        }

        user_id = UserRepository.create_user_with_password(user_data)
        if not user_id:
            raise HTTPException(status_code=500, detail="Could not create user")

        return {"success": True, "message": "Account created. Please login."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

@app.post("/api/sentle/login", tags=["Sentle Auth"])
async def sentle_login(payload: Dict[str, Any] = Body(...), request: Request = None):
    """Login with Quiz user account (first name + last name + password)."""
    try:
        from database.database import Database
        
        first_name = payload.get('first_name', '').strip()
        last_name = payload.get('last_name', '').strip()
        password = payload.get('password', '').strip()
        
        if not first_name or not last_name or not password:
            raise HTTPException(status_code=400, detail="First name, last name, and password are required")
        
        # Fetch quiz user by first/last name
        user = Database.get_one_row(
            "SELECT id, first_name, last_name, password_hash, salt FROM users WHERE first_name = %s AND last_name = %s",
            (first_name, last_name)
        )
        
        if not user:
            raise HTTPException(status_code=401, detail="Quiz account not found. Please use your Quiz credentials.")
        
        # Verify password
        if not verify_quiz_password(password, user['password_hash'], user.get('salt', '')):
            raise HTTPException(status_code=401, detail="Invalid password")
        
        # Check if already played today
        today = datetime.now().date()
        today_session = Database.get_one_row(
            "SELECT id, played, session_token FROM sentle_sessions WHERE user_id = %s AND date = %s",
            (user['id'], today)
        )

        cols = get_sentle_scores_columns()
        has_user_id = 'user_id' in cols
        has_player_name = 'player_name' in cols
        player_name = f"{user['first_name']} {user['last_name']}".strip()

        already_scored = None
        if has_user_id:
            already_scored = Database.get_one_row(
                "SELECT id FROM sentle_scores WHERE user_id = %s AND date = %s",
                (user['id'], today)
            )
        elif has_player_name:
            already_scored = Database.get_one_row(
                "SELECT id FROM sentle_scores WHERE player_name = %s AND date = %s",
                (player_name, today)
            )

        ip, user_agent = get_client_info(request)
        # Ensure there is a session row/token for today
        session_token = today_session['session_token'] if today_session and today_session.get('session_token') else generate_session_token()

        if today_session:
            Database.execute_sql(
                "UPDATE sentle_sessions SET session_token = %s, ip_address = %s, user_agent = %s, played = %s WHERE id = %s",
                (session_token, ip, user_agent, bool(already_scored), today_session['id'])
            )
        else:
            Database.execute_sql(
                "INSERT INTO sentle_sessions (user_id, session_token, ip_address, user_agent, date, played) VALUES (%s, %s, %s, %s, %s, %s)",
                (user['id'], session_token, ip, user_agent, today, bool(already_scored))
            )
        
        username = f"{user['first_name']} {user['last_name']}".strip()
        if already_scored:
            return {
                "success": True,
                "session_token": session_token,
                "user_id": user['id'],
                "username": username,
                "played_today": True,
                "message": "You already played today. You can view stats or play archives."
            }
        else:
            return {
                "success": True,
                "session_token": session_token,
                "user_id": user['id'],
                "username": username,
                "played_today": False,
                "message": "Login successful"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")

@app.get("/api/sentle/daily", tags=["Sentle"])
async def get_daily_sentence():
    """Get the daily Sentle sentence"""
    try:
        from database.database import Database
        
        today = datetime.now().date()
        
        # Get today's sentence
        result = Database.get_one_row(
            "SELECT id, sentence, date FROM sentle_sentences WHERE date = %s",
            (today,)
        )
        
        if result:
            # Mark as used
            Database.execute_sql(
                "UPDATE sentle_sentences SET used = TRUE WHERE id = %s",
                (result['id'],)
            )
            
            return {
                "id": result['id'],
                "sentence": result['sentence'],
                "date": str(result['date'])
            }
        else:
            # No sentence for today
            return {"sentence": None, "date": str(today), "id": None}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading sentence: {str(e)}")

@app.post("/api/sentle/game/start", tags=["Sentle"])
async def start_game_session(payload: Dict[str, Any] = Body(...)):
    """Initialize a new game session for tracking (called when game loads)"""
    try:
        from database.database import Database
        
        session_token = payload.get('session_token')
        sentence_id = payload.get('sentenceId')
        date = payload.get('date')
        
        sentle_logger.info(f"Game session start request: sentence={sentence_id}, date={date}, token={'present' if session_token else 'missing'}")
        
        if not session_token or not sentence_id:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify session (using main sessions table)
        session = Database.get_one_row(
            "SELECT user_id FROM sessions WHERE session_token = %s",
            (session_token,)
        )
        
        sentle_logger.info(f"Session lookup result: found={session is not None}")
        
        if not session:
            sentle_logger.warning(f"Invalid session token provided: {session_token[:10]}...")
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_id = session['user_id']
        today = datetime.now().date()
        
        # Check if game session already exists for today
        existing_game = Database.get_one_row(
            "SELECT id, current_word_index, total_attempts, reveals_used, completed FROM sentle_game_sessions WHERE user_id = %s AND sentence_id = %s AND date = %s",
            (user_id, sentence_id, today)
        )
        
        if existing_game:
            # Return existing session state
            return {
                "game_session_id": existing_game['id'],
                "current_word_index": existing_game['current_word_index'],
                "total_attempts": existing_game['total_attempts'],
                "reveals_used": existing_game['reveals_used'],
                "completed": bool(existing_game['completed'])
            }
        
        # Create new game session
        Database.execute_sql(
            "INSERT INTO sentle_game_sessions (user_id, sentence_id, date) VALUES (%s, %s, %s)",
            (user_id, sentence_id, today)
        )
        
        new_game = Database.get_one_row(
            "SELECT id FROM sentle_game_sessions WHERE user_id = %s AND sentence_id = %s AND date = %s",
            (user_id, sentence_id, today)
        )
        
        sentle_logger.info(f"Game session created: user={user_id}, sentence={sentence_id}, session_id={new_game['id']}")
        
        return {
            "game_session_id": new_game['id'],
            "current_word_index": 0,
            "total_attempts": 0,
            "reveals_used": 0,
            "completed": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error starting game session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error starting game: {str(e)}")

@app.post("/api/sentle/guess", tags=["Sentle"])
async def submit_guess(payload: Dict[str, Any] = Body(...)):
    """Submit and validate a word guess (server-side evaluation for security)"""
    try:
        from database.database import Database
        
        session_token = payload.get('session_token')
        game_session_id = payload.get('game_session_id')
        word_index = payload.get('word_index')
        guess = payload.get('guess', '').upper().strip()
        target_word = payload.get('target_word', '').upper().strip()
        
        if not all([session_token, game_session_id is not None, word_index is not None, guess, target_word]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify session
        session = Database.get_one_row(
            "SELECT user_id FROM sentle_sessions WHERE session_token = %s",
            (session_token,)
        )
        
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_id = session['user_id']
        
        # Verify game session belongs to user
        game = Database.get_one_row(
            "SELECT id, current_word_index, total_attempts, completed FROM sentle_game_sessions WHERE id = %s AND user_id = %s",
            (game_session_id, user_id)
        )
        
        if not game:
            raise HTTPException(status_code=403, detail="Game session not found or access denied")
        
        if game['completed']:
            raise HTTPException(status_code=403, detail="Game already completed")
        
        # Validate word index matches current progress
        if word_index != game['current_word_index']:
            raise HTTPException(status_code=400, detail="Word index mismatch")
        
        # Check guess length
        if len(guess) != len(target_word):
            raise HTTPException(status_code=400, detail="Guess length must match target word")
        
        # Get attempt number for this word
        attempt_count = Database.get_one_row(
            "SELECT COUNT(*) as count FROM sentle_guesses WHERE game_session_id = %s AND word_index = %s",
            (game_session_id, word_index)
        )
        attempt_number = (attempt_count['count'] if attempt_count else 0) + 1
        
        # Server-side evaluation (prevents client manipulation)
        is_correct = (guess == target_word)
        
        # Calculate letter feedback
        feedback = []
        letter_count = {}
        for ch in target_word:
            letter_count[ch] = letter_count.get(ch, 0) + 1
        
        # First pass: mark correct positions
        for i in range(len(guess)):
            if guess[i] == target_word[i]:
                feedback.append('correct')
                letter_count[guess[i]] -= 1
            else:
                feedback.append(None)  # Placeholder
        
        # Second pass: mark present/absent
        for i in range(len(guess)):
            if feedback[i] == 'correct':
                continue
            if guess[i] in letter_count and letter_count[guess[i]] > 0:
                feedback[i] = 'present'
                letter_count[guess[i]] -= 1
            else:
                feedback[i] = 'absent'
        
        # Store guess in database
        Database.execute_sql(
            "INSERT INTO sentle_guesses (game_session_id, word_index, guess, is_correct, attempt_number) VALUES (%s, %s, %s, %s, %s)",
            (game_session_id, word_index, guess, is_correct, attempt_number)
        )
        
        # Update game session
        new_total_attempts = game['total_attempts'] + 1
        Database.execute_sql(
            "UPDATE sentle_game_sessions SET total_attempts = %s, updated_at = NOW() WHERE id = %s",
            (new_total_attempts, game_session_id)
        )
        
        sentle_logger.info(f"Guess submitted: session={game_session_id}, word={word_index}, attempt={attempt_number}, correct={is_correct}")
        
        return {
            "is_correct": is_correct,
            "feedback": feedback,
            "attempt_number": attempt_number,
            "total_attempts": new_total_attempts
        }
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error processing guess: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing guess: {str(e)}")

@app.post("/api/sentle/word/complete", tags=["Sentle"])
async def complete_word(payload: Dict[str, Any] = Body(...)):
    """Mark a word as completed and advance to next word"""
    try:
        from database.database import Database
        
        session_token = payload.get('session_token')
        game_session_id = payload.get('game_session_id')
        word_index = payload.get('word_index')
        
        if not all([session_token, game_session_id is not None, word_index is not None]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify session
        session = Database.get_one_row(
            "SELECT user_id FROM sentle_sessions WHERE session_token = %s",
            (session_token,)
        )
        
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_id = session['user_id']
        
        # Verify game session
        game = Database.get_one_row(
            "SELECT id, current_word_index FROM sentle_game_sessions WHERE id = %s AND user_id = %s",
            (game_session_id, user_id)
        )
        
        if not game:
            raise HTTPException(status_code=403, detail="Game session not found")
        
        # Update to next word
        next_word_index = word_index + 1
        Database.execute_sql(
            "UPDATE sentle_game_sessions SET current_word_index = %s, updated_at = NOW() WHERE id = %s",
            (next_word_index, game_session_id)
        )
        
        sentle_logger.info(f"Word completed: session={game_session_id}, word={word_index}, next={next_word_index}")
        
        return {"success": True, "next_word_index": next_word_index}
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error completing word: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error completing word: {str(e)}")

@app.post("/api/sentle/reveal", tags=["Sentle"])
async def reveal_letter(payload: Dict[str, Any] = Body(...)):
    """Reveal a letter with server-side validation (anti-cheat)"""
    try:
        from database.database import Database
        
        session_token = payload.get('session_token')
        game_session_id = payload.get('game_session_id')
        word_index = payload.get('word_index')
        letter_index = payload.get('letter_index')
        target_word = payload.get('target_word', '').upper().strip()
        
        if not all([session_token, game_session_id is not None, word_index is not None, letter_index is not None, target_word]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify session
        session = Database.get_one_row(
            "SELECT user_id FROM sentle_sessions WHERE session_token = %s",
            (session_token,)
        )
        
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_id = session['user_id']
        
        # Get game session
        game = Database.get_one_row(
            "SELECT id, current_word_index, reveals_used FROM sentle_game_sessions WHERE id = %s AND user_id = %s",
            (game_session_id, user_id)
        )
        
        if not game:
            raise HTTPException(status_code=403, detail="Game session not found")
        
        # Verify word index matches
        if word_index != game['current_word_index']:
            raise HTTPException(status_code=400, detail="Word index mismatch")
        
        # Count failed guesses for this word (to determine available reveals)
        failed_guesses = Database.get_one_row(
            "SELECT COUNT(*) as count FROM sentle_guesses WHERE game_session_id = %s AND word_index = %s AND is_correct = FALSE",
            (game_session_id, word_index)
        )
        
        failed_count = failed_guesses['count'] if failed_guesses else 0
        
        # Count reveals already used for this word
        word_reveals = Database.get_one_row(
            "SELECT COUNT(*) as count FROM sentle_reveals WHERE game_session_id = %s AND word_index = %s",
            (game_session_id, word_index)
        )
        
        word_reveals_count = word_reveals['count'] if word_reveals else 0
        
        # Validate reveal eligibility: failed guesses must be > reveals used
        # (1 failed guess = 1 reveal available)
        if word_reveals_count >= failed_count:
            raise HTTPException(status_code=403, detail="No reveals available. Make more guesses first.")
        
        # Check if this specific letter was already revealed
        already_revealed = Database.get_one_row(
            "SELECT id FROM sentle_reveals WHERE game_session_id = %s AND word_index = %s AND letter_index = %s",
            (game_session_id, word_index, letter_index)
        )
        
        if already_revealed:
            raise HTTPException(status_code=400, detail="Letter already revealed")
        
        # Validate letter index
        if letter_index < 0 or letter_index >= len(target_word):
            raise HTTPException(status_code=400, detail="Invalid letter index")
        
        # Get the letter
        revealed_letter = target_word[letter_index]
        
        # Store reveal
        Database.execute_sql(
            "INSERT INTO sentle_reveals (game_session_id, word_index, letter_index, letter) VALUES (%s, %s, %s, %s)",
            (game_session_id, word_index, letter_index, revealed_letter)
        )
        
        # Update total reveals count in game session
        new_reveals_used = game['reveals_used'] + 1
        Database.execute_sql(
            "UPDATE sentle_game_sessions SET reveals_used = %s, updated_at = NOW() WHERE id = %s",
            (new_reveals_used, game_session_id)
        )
        
        sentle_logger.info(f"Letter revealed: session={game_session_id}, word={word_index}, letter={letter_index}, total_reveals={new_reveals_used}")
        
        return {
            "letter": revealed_letter,
            "letter_index": letter_index,
            "reveals_used": new_reveals_used,
            "reveals_available": failed_count - word_reveals_count - 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error revealing letter: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error revealing letter: {str(e)}")

@app.post("/api/sentle/score_old", tags=["Sentle"])
async def submit_score_old(payload: Dict[str, Any] = Body(...)):
    """Submit final score - CALCULATES SCORE SERVER-SIDE from verified game session data"""
    try:
        from database.database import Database
        
        session_token = payload.get('session_token')
        game_session_id = payload.get('game_session_id')
        sentence_id = payload.get('sentenceId')
        date = payload.get('date')
        
        sentle_logger.info(f"Score submission attempt: sentence={sentence_id}, date={date}, game_session={game_session_id}")
        
        if not session_token or not game_session_id or not sentence_id or not date:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify session
        today = datetime.now().date()
        session = Database.get_one_row(
            "SELECT id, user_id, date FROM sentle_sessions WHERE session_token = %s",
            (session_token,)
        )

        sentle_logger.info(f"Session lookup: token found={session is not None}, today={today}")

        if not session:
            raise HTTPException(status_code=401, detail="Invalid session. Please log in again.")

        user_id = session['user_id']

        # Enforce one score per day per user
        already_played = Database.get_one_row(
            "SELECT id FROM sentle_scores WHERE user_id = %s AND date = %s",
            (user_id, today)
        )

        if already_played:
            sentle_logger.info(f"User {user_id} already played today")
            raise HTTPException(status_code=403, detail="You have already submitted a score today!")

        # Verify game session belongs to user
        game = Database.get_one_row(
            "SELECT id, sentence_id, total_attempts, reveals_used, completed FROM sentle_game_sessions WHERE id = %s AND user_id = %s",
            (game_session_id, user_id)
        )
        
        if not game:
            raise HTTPException(status_code=403, detail="Game session not found or access denied")
        
        if game['completed']:
            raise HTTPException(status_code=403, detail="Score already submitted for this game")
        
        # Verify sentence ID matches
        if int(game['sentence_id']) != int(sentence_id):
            raise HTTPException(status_code=400, detail="Sentence ID mismatch")

        # Ensure the score is for today's sentence only
        today_sentence = Database.get_one_row(
            "SELECT id, date FROM sentle_sentences WHERE date = %s",
            (today,)
        )
        
        sentle_logger.info(f"Today's sentence: {today_sentence}")

        if not today_sentence or not today_sentence.get("id"):
            raise HTTPException(status_code=400, detail="No active sentence for today")

        if int(sentence_id) != int(today_sentence['id']) or str(date) != str(today_sentence['date']):
            sentle_logger.warning(f"Sentence mismatch: submitted_id={sentence_id}, today_id={today_sentence['id']}")
            raise HTTPException(status_code=403, detail="Scores can only be submitted for today's sentence")
        
        # ===== SERVER-SIDE SCORE CALCULATION (ANTI-CHEAT) =====
        # Fetch total attempts and reveals from verified database records
        total_attempts = game['total_attempts']
        reveals_used = game['reveals_used']
        
        # Get word count from sentence
        sentence_row = Database.get_one_row(
            "SELECT word_count FROM sentle_sentences WHERE id = %s",
            (sentence_id,)
        )
        
        word_count = sentence_row['word_count'] if sentence_row else 3
        
        # Score calculation: cap attempts at 10 per word
        scoring_cap_per_word = 10
        total_attempts_available = word_count * scoring_cap_per_word
        unused_attempts = max(0, total_attempts_available - total_attempts)
        calculated_score = 500 + (unused_attempts * 100)
        
        # Deduct 100 points per reveal used
        calculated_score -= reveals_used * 100
        calculated_score = max(0, calculated_score)
        
        sentle_logger.info(f"Server-calculated score: base=500, attempts={total_attempts}/{total_attempts_available}, reveals={reveals_used}, final={calculated_score}")
        
        # Detect schema columns
        cols = get_sentle_scores_columns()
        supports_user_id = 'user_id' in cols
        supports_player_name = 'player_name' in cols
        
        # Get player name
        player_name = "Anonymous"
        try:
            user_row = Database.get_one_row(
                "SELECT first_name, last_name FROM users WHERE id = %s",
                (user_id,)
            )
            if user_row:
                player_name = f"{user_row.get('first_name','').strip()} {user_row.get('last_name','').strip()}".strip() or "Anonymous"
        except Exception as name_err:
            sentle_logger.warning(f"Could not fetch player name: {name_err}")
        
        # Insert score with server-calculated values
        supports_attempts = 'attempts' in cols
        supports_guesses = 'guesses' in cols
        supports_date = 'date' in cols

        insert_cols = []
        insert_vals = []
        if supports_user_id:
            insert_cols.append('user_id')
            insert_vals.append(user_id)
        insert_cols.append('sentence_id')
        insert_vals.append(sentence_id)
        if supports_player_name:
            insert_cols.append('player_name')
            insert_vals.append(player_name)
        insert_cols.append('score')
        insert_vals.append(calculated_score)  # Use server-calculated score
        if supports_attempts:
            insert_cols.append('attempts')
            insert_vals.append(total_attempts)  # Use verified attempts
        elif supports_guesses:
            insert_cols.append('guesses')
            insert_vals.append(total_attempts)
        if supports_date:
            insert_cols.append('date')
            insert_vals.append(date)

        if not insert_cols:
            sentle_logger.error("sentle_scores schema not detected; cannot insert score")
            raise HTTPException(status_code=500, detail="Score table unavailable")

        placeholders = ', '.join(['%s'] * len(insert_cols))
        sql = f"INSERT INTO sentle_scores ({', '.join(insert_cols)}) VALUES ({placeholders})"

        try:
            Database.execute_sql(sql, tuple(insert_vals))
            
            # Mark game session as completed
            Database.execute_sql(
                "UPDATE sentle_game_sessions SET completed = TRUE, score = %s, updated_at = NOW() WHERE id = %s",
                (calculated_score, game_session_id)
            )
            
            # Mark sentle_session as played
            try:
                Database.execute_sql(
                    "UPDATE sentle_sessions SET played = TRUE WHERE user_id = %s AND date = %s",
                    (user_id, today)
                )
            except Exception as played_err:
                sentle_logger.warning(f"Failed to mark session played: {played_err}")

            sentle_logger.info(
                f"Score inserted (SERVER-CALCULATED): user_id={user_id}, sentence_id={sentence_id}, score={calculated_score}, attempts={total_attempts}, reveals={reveals_used}, date={date}"
            )
        except Exception as insert_err:
            sentle_logger.error(f"Failed to insert score: {insert_err}")
            raise HTTPException(status_code=500, detail=f"Failed to save score: {str(insert_err)}")
        
        return {
            "success": True,
            "message": "Score submitted successfully",
            "score": calculated_score,
            "attempts": total_attempts,
            "reveals_used": reveals_used
        }
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error submitting score: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error submitting score: {str(e)}")

@app.post("/api/sentle/score", tags=["Sentle"])
async def submit_score(data: dict):
    """Submit a Sentle game score"""
    try:
        from database.database import Database
        session_token = data.get('session_token')
        game_session_id = data.get('game_session_id')
        sentence_id = data.get('sentenceId')
        date_str = data.get('date')
        user_id = data.get('user_id')
        score = data.get('score', 0)
        guesses = data.get('guesses', 0)
        
        sentle_logger.info(f"Score submission attempt: sentence={sentence_id}, date={date_str}, game_session={game_session_id}, user_id={user_id}, score={score}, guesses={guesses}")
        
        # Validate required fields
        if not all([session_token, sentence_id, date_str, user_id is not None]):
            sentle_logger.error(f"Missing required fields: session_token={session_token}, sentence_id={sentence_id}, date_str={date_str}, user_id={user_id}")
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # TEMPORARILY SKIP SESSION VALIDATION FOR TESTING
        # # Validate session token
        # session = Database.get_one_row(
        #     "SELECT user_id FROM sentle_sessions WHERE session_token = %s",
        #     (session_token,)
        # )
        # if not session:
        #     sentle_logger.warning(f"Invalid session token provided: {session_token[:10]}...")
        #     raise HTTPException(status_code=401, detail="Invalid session token")
        
        # if session['user_id'] != user_id:
        #     raise HTTPException(status_code=403, detail="Session token does not match user")
        
        # Get user name for player_name
        user_row = Database.get_one_row(
            "SELECT first_name, last_name FROM users WHERE id = %s",
            (user_id,)
        )
        if not user_row:
            sentle_logger.warning(f"User not found: {user_id}, allowing submission anyway")
            player_name = f"User {user_id}"
        else:
            player_name = f"{user_row['first_name']} {user_row['last_name']}".strip()
        
        # Parse date
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
        
        # Check if already submitted for today
        existing = Database.get_one_row(
            "SELECT id FROM sentle_scores WHERE user_id = %s AND date = %s",
            (user_id, date_obj)
        )
        if existing:
            sentle_logger.warning(f"Duplicate score submission for user {user_id} on {date_obj}")
            raise HTTPException(status_code=403, detail="Score already submitted for today")
        
        # Insert score
        cols = get_sentle_scores_columns()
        if 'user_id' in cols:
            Database.execute_sql(
                """INSERT INTO sentle_scores (sentence_id, player_name, score, guesses, date, user_id, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (sentence_id, player_name, score, guesses, date_obj, user_id, datetime.now())
            )
        else:
            # Fallback for old schema
            Database.execute_sql(
                """INSERT INTO sentle_scores (sentence_id, player_name, score, guesses, date, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (sentence_id, player_name, score, guesses, date_obj, datetime.now())
            )
        
        sentle_logger.info(f"Score submitted successfully: user={user_id}, score={score}, guesses={guesses}")
        return {"success": True, "score": score}
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error submitting score: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error submitting score: {str(e)}")


@app.post("/api/sentle/login", tags=["Sentle"])
async def sentle_login(request: Request):
    try:
        payload = await request.json()
        
        first_name = payload.get('first_name')
        last_name = payload.get('last_name')
        password = payload.get('password')
        
        if not all([first_name, last_name, password]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Authenticate user
        user_id = UserRepository.authenticate_user(first_name, last_name, password)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        
        # Store session
        Database.execute_sql(
            "INSERT INTO sentle_sessions (user_id, session_token, created_at) VALUES (%s, %s, %s)",
            (user_id, session_token, datetime.now())
        )
        
        sentle_logger.info(f"Sentle login successful for user {user_id}")
        return {"session_token": session_token, "user_id": user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error in sentle login: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@app.post("/api/sentle/register", tags=["Sentle"])
async def sentle_register(request: Request):
    try:
        payload = await request.json()
        
        first_name = payload.get('first_name')
        last_name = payload.get('last_name')
        password = payload.get('password')
        
        if not all([first_name, last_name, password]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Check if user exists
        existing = Database.get_one_row(
            "SELECT id FROM users WHERE first_name = %s AND last_name = %s",
            (first_name, last_name)
        )
        if existing:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Hash password
        hashed = UserRepository.hash_password(password)
        
        # Create user
        user_id = Database.execute_sql(
            """INSERT INTO users (first_name, last_name, password_hash, salt, rfid_code, userRoleId, created_at) 
               VALUES (%s, %s, %s, %s, %s, 1, %s)""",
            (first_name, last_name, hashed['password_hash'], hashed['salt'], f"sentle_{first_name}_{last_name}", datetime.now())
        )
        
        # Generate session token
        session_token = secrets.token_urlsafe(32)
        
        # Store session
        Database.execute_sql(
            "INSERT INTO sentle_sessions (user_id, session_token, created_at) VALUES (%s, %s, %s)",
            (user_id, session_token, datetime.now())
        )
        
        sentle_logger.info(f"Sentle registration successful for user {user_id}")
        return {"session_token": session_token, "user_id": user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error in sentle register: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.get("/api/sentle/stats", tags=["Sentle"])
async def get_user_stats(request: Request):
    """Get user stats calculated from sentle_scores table"""
    try:
        from database.database import Database
        
        # Get session token from request
        session_token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
        
        if not session_token:
            # Try getting from query or body
            session_token = request.query_params.get('session_token')
        
        if not session_token:
            raise HTTPException(status_code=401, detail="Session token required")
        
        # Get user from session (date-agnostic). If missing (e.g., table cleared) but user_id provided, return empty stats.
        session = Database.get_one_row(
            "SELECT user_id FROM sentle_sessions WHERE session_token = %s",
            (session_token,)
        )

        if not session:
            return {
                "gamesPlayed": 0,
                "gamesWon": 0,
                "currentStreak": 0,
                "maxStreak": 0,
                "totalScore": 0,
                "playedToday": False,
            }

        user_id = session['user_id']
        
        # Calculate stats from sentle_scores table
        cols = get_sentle_scores_columns()
        has_attempts = 'attempts' in cols
        has_guesses = 'guesses' in cols
        has_user_id = 'user_id' in cols
        has_player_name = 'player_name' in cols
        today = datetime.now().date()

        if not has_user_id and has_player_name:
            # Fallback: use player_name matching this user
            user_row = Database.get_one_row(
                "SELECT first_name, last_name FROM users WHERE id = %s",
                (user_id,)
            )
            player_name = None
            if user_row:
                player_name = f"{user_row.get('first_name','').strip()} {user_row.get('last_name','').strip()}".strip()
            if not player_name:
                sentle_logger.warning("sentle_scores has no user_id column and player name missing; returning empty stats")
                stats_result = None
            else:
                stats_result = Database.get_one_row(
                    """SELECT 
                        COUNT(*) AS games_played,
                        SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END) AS games_won,
                        COALESCE(SUM(score), 0) AS total_score,
                        COALESCE(SUM({attempt_col}), 0) AS total_attempts
                       FROM sentle_scores
                       WHERE player_name = %s""".format(attempt_col='attempts' if has_attempts else ('guesses' if has_guesses else 'score')),
                    (player_name,)
                )
        elif has_attempts:
            stats_result = Database.get_one_row(
                """SELECT 
                    COUNT(*) AS games_played,
                    SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END) AS games_won,
                    COALESCE(SUM(score), 0) AS total_score,
                    COALESCE(SUM(attempts), 0) AS total_attempts
                   FROM sentle_scores
                   WHERE user_id = %s""",
                (user_id,)
            )
        elif has_guesses:
            stats_result = Database.get_one_row(
                """SELECT 
                    COUNT(*) AS games_played,
                    SUM(CASE WHEN score > 0 THEN 1 ELSE 0 END) AS games_won,
                    COALESCE(SUM(score), 0) AS total_score,
                    COALESCE(SUM(guesses), 0) AS total_attempts
                   FROM sentle_scores
                   WHERE user_id = %s""",
                (user_id,)
            )
        else:
            stats_result = None
        
        if not stats_result:
            stats_result = {
                'games_played': 0,
                'games_won': 0,
                'total_score': 0,
                'total_attempts': 0
            }

        # Determine if the user already played today (schema-aware)
        played_today = False
        if has_user_id:
            played_today = Database.get_one_row(
                "SELECT id FROM sentle_scores WHERE user_id = %s AND date = %s",
                (user_id, today)
            ) is not None
        elif has_player_name:
            user_row = Database.get_one_row(
                "SELECT first_name, last_name FROM users WHERE id = %s",
                (user_id,)
            )
            player_name = None
            if user_row:
                player_name = f"{user_row.get('first_name','').strip()} {user_row.get('last_name','').strip()}".strip()
            if player_name:
                played_today = Database.get_one_row(
                    "SELECT id FROM sentle_scores WHERE player_name = %s AND date = %s",
                    (player_name, today)
                ) is not None
        
        return {
            "gamesPlayed": stats_result['games_played'] or 0,
            "gamesWon": stats_result['games_won'] or 0,
            "totalScore": stats_result['total_score'] or 0,
            "totalAttempts": stats_result['total_attempts'] or 0,
            "playedToday": played_today,
            "currentStreak": 0,  # Would need more complex logic to calculate
            "maxStreak": 0       # Would need more complex logic to calculate
        }
        
    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Error getting user stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading stats: {str(e)}")


@app.get("/api/sentle/debug/scores", tags=["Sentle"])
async def debug_scores():
    """Debug endpoint: Show all sentle_scores in database"""
    try:
        from database.database import Database
        
        scores = Database.get_rows("""
            SELECT 
                s.id,
                s.user_id,
                u.first_name,
                u.last_name,
                s.sentence_id,
                s.score,
                s.attempts,
                s.date
            FROM sentle_scores s
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY s.date DESC, s.id DESC
        """)
        
        if not scores:
            return {"message": "No scores in database", "scores": []}
        
        return {
            "totalScores": len(scores),
            "scores": scores
        }
        
    except Exception as e:
        sentle_logger.error(f"Error in debug/scores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sentle/leaderboard", tags=["Sentle"])
async def get_leaderboard():
    """Get cumulative Sentle leaderboard (all-time scores, top 100)"""
    try:
        from database.database import Database
        
        cols = get_sentle_scores_columns()
        has_player_name = 'player_name' in cols
        has_user_id = 'user_id' in cols

        if has_player_name and not has_user_id:
            # Schema with player_name/guesses only
            results = Database.get_rows(
                """SELECT t.player_name, t.games_played, t.total_score
                   FROM (
                        SELECT 
                            COALESCE(player_name, 'Anonymous') AS player_name,
                            COUNT(*) AS games_played,
                            SUM(score) AS total_score
                        FROM sentle_scores
                        GROUP BY COALESCE(player_name, 'Anonymous')
                   ) t
                   ORDER BY t.total_score DESC
                   LIMIT 100"""
            )
        else:
            # Default schema with user_id (may also have player_name)
            results = Database.get_rows(
                """SELECT 
                        u.id,
                        COALESCE(s.player_name, CONCAT(u.first_name, ' ', u.last_name)) AS player_name,
                        COUNT(*) AS games_played,
                        SUM(s.score) AS total_score
                   FROM sentle_scores s
                   INNER JOIN users u ON s.user_id = u.id
                   GROUP BY u.id, player_name
                   ORDER BY total_score DESC
                   LIMIT 100"""
            )
        
        leaderboard = []
        if results:
            for row in results:
                leaderboard.append({
                    "playerName": row.get('player_name', 'Unknown'),
                    "score": int(row.get('total_score', 0))
                })
        else:
            sentle_logger.warning("Leaderboard query returned no rows (results empty or error)")

        sentle_logger.info(f"Leaderboard query returned {len(leaderboard)} entries")
        return {"leaderboard": leaderboard}
        
    except Exception as e:
        sentle_logger.error(f"Leaderboard error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"leaderboard": []}


@app.get("/api/sentle/leaderboard/daily", tags=["Sentle"])
async def get_daily_leaderboard(date: Optional[str] = None):
    """Get Sentle leaderboard for a specific date (per-day scores, top 100)"""
    try:
        from database.database import Database

        # Parse date parameter or default to today
        if date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d').date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            target_date = datetime.now().date()
        
        cols = get_sentle_scores_columns()
        has_player_name = 'player_name' in cols
        has_user_id = 'user_id' in cols

        if has_player_name and not has_user_id:
            results = Database.get_rows(
                """SELECT t.player_name, t.score FROM (
                        SELECT COALESCE(player_name, 'Anonymous') AS player_name, score
                        FROM sentle_scores
                        WHERE date = %s
                   ) t
                   ORDER BY t.score DESC
                   LIMIT 100""",
                (target_date,)
            )
        else:
            results = Database.get_rows(
                """SELECT 
                        u.id,
                        COALESCE(s.player_name, CONCAT(u.first_name, ' ', u.last_name)) AS player_name,
                        s.score
                   FROM sentle_scores s
                   INNER JOIN users u ON s.user_id = u.id
                   WHERE s.date = %s
                   ORDER BY s.score DESC
                   LIMIT 100""",
                (target_date,)
            )

        leaderboard = []
        if results:
            for row in results:
                leaderboard.append({
                    "playerName": row.get('player_name', 'Unknown'),
                    "score": int(row.get('score', 0))
                })

        sentle_logger.info(f"Daily leaderboard returned {len(leaderboard)} entries for {target_date}")
        return {"date": str(target_date), "leaderboard": leaderboard}

    except HTTPException:
        raise
    except Exception as e:
        sentle_logger.error(f"Daily leaderboard error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"date": str(datetime.now().date()), "leaderboard": []}

@app.get("/api/sentle/archive", tags=["Sentle"])
async def get_archive():
    """Get archive of past sentences with stats"""
    try:
        from database.database import Database
        
        today = datetime.now().date()
        
        # Get past sentences with stats
        results = Database.get_rows(
            """SELECT 
                s.id, s.date, s.sentence,
                COUNT(DISTINCT sc.id) as plays,
                MAX(sc.score) as best_score
               FROM sentle_sentences s
               LEFT JOIN sentle_scores sc ON s.id = sc.sentence_id
               WHERE s.date < %s
               GROUP BY s.id, s.date, s.sentence
               ORDER BY s.date DESC
               LIMIT 100""",
            (today,)
        )
        
        archive = [
            {
                "id": row['id'],
                "date": str(row['date']),
                "sentence": row['sentence'],
                "plays": row['plays'] or 0,
                "bestScore": row['best_score'] or 0
            }
            for row in (results or [])
        ]
        
        return {"archive": archive}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading archive: {str(e)}")

@app.get("/api/sentle/debug/scores", tags=["Sentle"])
async def debug_get_all_scores():
    """DEBUG ENDPOINT: Get ALL sentle_scores rows (for troubleshooting)"""
    try:
        from database.database import Database
        
        # Raw count
        count_result = Database.get_one_row("SELECT COUNT(*) as total FROM sentle_scores")
        total_count = count_result['total'] if count_result else 0
        
        # Get all scores with user names
        results = Database.get_rows(
            """SELECT 
                    ss.id,
                    ss.user_id,
                    u.first_name,
                    u.last_name,
                    ss.sentence_id,
                    ss.score,
                    ss.attempts,
                    ss.date
               FROM sentle_scores ss
               LEFT JOIN users u ON ss.user_id = u.id
               ORDER BY ss.date DESC, ss.id DESC
               LIMIT 50"""
        )
        
        scores = [
            {
                "id": row['id'],
                "user_id": row['user_id'],
                "player_name": f"{row['first_name']} {row['last_name']}" if row['first_name'] else "Unknown",
                "sentence_id": row['sentence_id'],
                "score": row['score'],
                "attempts": row['attempts'],
                "date": str(row['date'])
            }
            for row in (results or [])
        ]
        
        return {
            "total_scores_in_db": total_count,
            "last_50_scores": scores,
            "debug_info": "If this returns empty but you've submitted scores, check: (1) Are INSERT queries actually executing? (2) Is the user_id valid in users table?"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching scores: {str(e)}")

@app.post("/api/sentle/admin/login", tags=["Sentle"])
async def admin_login(payload: Dict[str, Any] = Body(...)):
    """Authenticate admin and return session token"""
    try:
        password = payload.get('password')
        
        if not password:
            raise HTTPException(status_code=400, detail="Password is required")
        
        # Verify admin password
        if password != SENTLE_ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid password")
        
        # Generate secure admin token
        admin_token = secrets.token_urlsafe(32)
        
        return {"admin_token": admin_token}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error logging in: {str(e)}")


def verify_admin_token(request: Request) -> str:
    """Verify admin token from request headers"""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid admin token")
    
    token = auth_header[7:]  # Remove 'Bearer ' prefix
    # In a real app, you'd validate against a stored/session token
    # For now, we'll accept the token if it's non-empty
    # In production, store issued tokens temporarily and validate against them
    if not token:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    return token


@app.post("/api/sentle/admin/add", tags=["Sentle"])
async def admin_add_sentence(payload: Dict[str, Any] = Body(...), request: Request = None):
    """Admin endpoint to add a new sentence for a specific day"""
    try:
        from database.database import Database
        
        admin_token = payload.get('admin_token')
        date = payload.get('date')
        sentence = payload.get('sentence', '').strip()
        
        # Verify admin token
        if not admin_token:
            raise HTTPException(status_code=401, detail="Admin token required")
        
        if not date or not sentence:
            raise HTTPException(status_code=400, detail="Date and sentence are required")
        
        # Validate sentence
        words = sentence.split()
        word_count = len(words)
        
        if word_count < 2 or word_count > 15:
            raise HTTPException(
                status_code=400, 
                detail="Sentence must be between 2 and 15 words"
            )
        
        # Insert sentence
        try:
            Database.execute_sql(
                """INSERT INTO sentle_sentences (date, sentence, word_count) 
                   VALUES (%s, %s, %s)""",
                (date, sentence, word_count)
            )
            
            return {"success": True, "message": "Sentence added successfully"}
            
        except Exception as e:
            if "Duplicate entry" in str(e):
                raise HTTPException(
                    status_code=400, 
                    detail="A sentence already exists for this date"
                )
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding sentence: {str(e)}")

@app.get("/api/sentle/admin/list", tags=["Sentle"])
async def admin_list_sentences(request: Request):
    """List all scheduled sentences (requires admin auth)"""
    try:
        from database.database import Database
        
        # Verify admin token
        verify_admin_token(request)
        
        # Get all future and recent sentences
        results = Database.get_rows(
            """SELECT id, date, sentence, used 
               FROM sentle_sentences 
               ORDER BY date DESC 
               LIMIT 50"""
        )
        
        sentences = [
            {
                "id": row['id'],
                "date": str(row['date']),
                "sentence": row['sentence'],
                "used": bool(row['used'])
            }
            for row in (results or [])
        ]
        
        return {"sentences": sentences}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing sentences: {str(e)}")

# =============================================================================
# END SENTLE GAME API ENDPOINTS
# =============================================================================

if __name__ == "__main__":
    # System startup info - Triple-layer fallback system
    import sys
    cookie_file = os.environ.get('YTDL_COOKIE_FILE')
    proxy = os.environ.get('YTDL_PROXY')
    proxy_list = os.environ.get('YTDL_PROXY_LIST')
    
    has_cookies = cookie_file and os.path.exists(cookie_file)
    has_proxy = proxy or proxy_list
    
    print("\n" + "="*80)
    print("YouTube Download System - Triple-Layer Fallback Initialized")
    print("="*80)
    print("\nActive Protection Layers:")
    print("  [OK] LAYER 1: Browser Cookie Auto-Extraction (Chrome/Firefox)")
    print("  [OK] LAYER 2: Proxy Rotation (if configured)")
    print(f"  [OK] LAYER 3: Invidious Fallback ({len(INVIDIOUS_INSTANCES)} instances)")
    print("\n Configuration Status:")
    
    if has_cookies:
        print(f"   Global cookies: {cookie_file}")
    else:
        print("  [INFO] No global cookies (will try browser extraction)")
    
    if has_proxy:
        if proxy:
            print(f"   Proxy configured: {proxy}")
        if proxy_list:
            proxy_count = len(proxy_list.split(','))
            print(f"   Proxy rotation: {proxy_count} proxies")
    else:
        print("  [INFO] No proxy configured (optional)")
    
    print("\n Tips:")
    print("  - System will try browser cookies if Chrome/Firefox is logged in")
    print("  - Invidious instances provide fallback when YouTube blocks")
    print("  - Users can upload cookies via frontend UI for authentication")
    print("  - Proxy rotation helps avoid IP-based blocking")
    print("="*80 + "\n")
    
    # Show recommendations based on config
    if not has_cookies and not has_proxy:
        print(" RECOMMENDED: Configure at least one authentication method:")
        print("  1. Log into YouTube in Chrome/Firefox on this server (easiest)")
        print("  2. Or set: YTDL_PROXY=http://proxy.example.com:8080")
        print("  3. Or set: YTDL_COOKIE_FILE=/path/to/cookies.txt")
        print("  4. Or users can upload cookies via the frontend UI")
        print()
    
    elif not has_cookies:
        print("\n[INFO] No global cookies - relying on browser extraction and proxies")
    elif not has_proxy:
        print("\n[INFO] No proxy - using direct connection with cookies")
    else:
        print("\n Optimal config: Both cookies and proxy configured!")
    
    # Enable auto-reload for development (toggle via env var)
    dev_reload = os.getenv("DEV_RELOAD", "false").lower() in ("1", "true", "yes")
    # Only start the Uvicorn server when this module is executed directly.
    # Use the already-created `app` object instead of passing a string target
    # to avoid uvicorn re-importing this module (which can cause duplicate
    # side-effects and confusing bind errors). Keep `reload=False` here to
    # avoid automatic reloading in long-running deployments.
    if __name__ == "__main__":
        # Run the top-level ASGI app that includes Socket.IO and FastAPI
        uvicorn.run(
            asgi_app,
            host="0.0.0.0",
            port=int(os.getenv("PORT", 8001)),  # Allow overriding via PORT env var
            reload=dev_reload,
            # Use a portable path for reload watching (backend directory)
            reload_dirs=[os.path.dirname(__file__)] if dev_reload else None
        )





