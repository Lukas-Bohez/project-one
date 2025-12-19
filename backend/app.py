import socketio
import asyncio
import uvicorn
import os
import zipfile
from datetime import datetime,timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body, Header, File, Form, UploadFile
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
# Create a logger for video conversion debugging
video_logger = logging.getLogger('video_debug')
video_logger.setLevel(logging.DEBUG)

# Create file handler for video logs
video_log_file = os.path.join(os.path.dirname(__file__), 'video_debug.log')
video_file_handler = logging.FileHandler(video_log_file, mode='a')
video_file_handler.setLevel(logging.DEBUG)

# Create formatter
video_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
video_file_handler.setFormatter(video_formatter)

# Avoid adding duplicate handlers when module is reloaded
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == video_file_handler.baseFilename for h in video_logger.handlers):
    video_logger.addHandler(video_file_handler)

# Prevent propagation to root logger to avoid duplicate outputs
video_logger.propagate = False

video_logger.info("="*50)
video_logger.info("Video Logger Initialized")
video_logger.info("="*50)

# General quiz logger used across the application for quiz-related messages
quiz_log_file = os.path.join(os.path.dirname(__file__), 'logs', 'quiz_debug.log')
quiz_logger = logging.getLogger('quiz_debug')
quiz_logger.setLevel(logging.INFO)
quiz_file_handler = logging.FileHandler(quiz_log_file, mode='a')
quiz_file_handler.setLevel(logging.INFO)
quiz_file_handler.setFormatter(video_formatter)
if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == quiz_file_handler.baseFilename for h in quiz_logger.handlers):
    quiz_logger.addHandler(quiz_file_handler)
# Socket.IO / Engine.IO and Uvicorn logging setup
# Write socket-related logs to `socket.log` for debugging client connection errors
socket_log_file = os.path.join(os.path.dirname(__file__), 'logs', 'socket.log')
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
quiz_logger.info("="*50)
quiz_logger.info("Quiz Logger Initialized")
quiz_logger.info("="*50)

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

# Register route modules
from routes.video_routes import router as video_router
from routes.quiz_routes import router as quiz_router
from routes.article_routes import router as article_router
from routes.user_routes import router as user_router
from routes.game_routes import router as game_router
from routes.misc_routes import router as misc_router
app.include_router(video_router)
app.include_router(quiz_router)
app.include_router(article_router)
app.include_router(user_router)
app.include_router(game_router)
app.include_router(misc_router)

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

# Use ASGI wrapper for both local development and production
asgi_app = socketio.ASGIApp(sio, app)

newClient = None
# ----------------------------------------------------
# Socket.IO event handlers
# ----------------------------------------------------
# Socket.IO event handlers
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



async def join_room(sid, data):
    room = data.get('room')
    if room:
        await sio.enter_room(sid, room)
        await sio.emit('room_joined', {
            'room': room,
            'client_id': sid,
            'timestamp': datetime.now().isoformat()
        }, room=room)

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

def safe_int_convert(value, default=1):
    """Safely convert a value to integer with a default fallback"""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

# Helper function to calculate ban expiry
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

