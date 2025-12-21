"""
FastAPI Application - Main Entry Point
Minimal setup file that imports and configures all modules
"""
import socketio
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Import logging configuration
from utils.logging_config import setup_logging
loggers = setup_logging()

# Import middleware
from utils.middleware import log_incoming_requests

# Import lifespan management
from utils.lifespan import lifespan_startup, lifespan_shutdown

# Import rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Check for Raspberry Pi components
try:
    from raspberryPi5.RFIDYReaderske import HardcoreRFID
    RPI_COMPONENTS_AVAILABLE = True
except ImportError:
    RPI_COMPONENTS_AVAILABLE = False

# ----------------------------------------------------
# Application Lifespan
# ----------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    try:
        # Startup
        await lifespan_startup(app, sio, RPI_COMPONENTS_AVAILABLE)
    except Exception as e:
        print(f"Error in startup: {e}")
        raise
    
    yield
    
    try:
        # Shutdown
        await lifespan_shutdown()
    except Exception as e:
        print(f"Error in shutdown: {e}")

# ----------------------------------------------------
# FastAPI Application Setup
# ----------------------------------------------------

app = FastAPI(
    title="Socket.IO Messaging Backend", 
    version="1.0.0", 
    lifespan=lifespan
)

# Register route modules
from routes.quiz_routes import router as quiz_router
from routes.article_routes import router as article_router
from routes.user_routes import router as user_router
from routes.game_routes import router as game_router
from routes.misc_routes import router as misc_router
from routes.session_routes import router as session_router
from routes.theme_selection_routes import router as theme_selection_router

app.include_router(quiz_router)
app.include_router(article_router)
app.include_router(user_router)
app.include_router(game_router)
app.include_router(misc_router)
app.include_router(session_router)
app.include_router(theme_selection_router)

# Register request logging middleware
app.middleware("http")(log_incoming_requests)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ----------------------------------------------------
# Socket.IO Setup
# ----------------------------------------------------

sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi',
    logger=True,
    engineio_logger=True
)

# Wrap FastAPI app with Socket.IO
asgi_app = socketio.ASGIApp(sio, app)

# Register Socket.IO handlers
from core.socketio_handlers import init_socketio
init_socketio(sio, asyncio.get_event_loop())

# Run server when executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(asgi_app, host="0.0.0.0", port=8001, log_level="info")
