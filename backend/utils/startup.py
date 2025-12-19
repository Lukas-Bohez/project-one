"""
Application Startup and Lifecycle Management
Handles FastAPI lifespan events, Raspberry Pi thread startup, and graceful shutdown
"""
import asyncio
from contextlib import asynccontextmanager
from threading import Thread, Event

# Global flag to signal background thread to stop
stop_thread_event = Event()


def create_lifespan(sio, raspberry_pi_main_thread, RPI_COMPONENTS_AVAILABLE, VIDEO_CONVERTER_AVAILABLE):
    """Create lifespan context manager for FastAPI"""
    
    @asynccontextmanager
    async def lifespan(app):
        """Handle application startup and shutdown"""
        try:
            from utils import state_manager
            print("FastAPI app starting up...")

            # Get the main asyncio event loop
            state_manager.main_asyncio_loop = asyncio.get_running_loop()
            print(f"Main asyncio loop obtained: {state_manager.main_asyncio_loop}")
            
            # Initialize Socket.IO handlers
            from socketio_handlers import init_socketio
            init_socketio(sio, state_manager.main_asyncio_loop)
            
            if RPI_COMPONENTS_AVAILABLE:
                # Start Raspberry Pi hardware thread
                pi_thread = Thread(
                    target=raspberry_pi_main_thread,
                    args=(stop_thread_event, sio, state_manager.main_asyncio_loop),
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
            stop_thread_event.set()
            print("Shutdown signal sent to Raspberry Pi thread.")
            
            # Shutdown video conversion process pools
            if VIDEO_CONVERTER_AVAILABLE:
                try:
                    from routes.video_routes import video_process_pool, long_video_process_pool
                    if 'video_process_pool' in dir():
                        print("Shutting down video conversion process pool...")
                        video_process_pool.shutdown(wait=False, cancel_futures=True)
                        print("[OK] Video process pool shutdown complete")
                    if 'long_video_process_pool' in dir():
                        print("Shutting down long-video conversion process pool...")
                        long_video_process_pool.shutdown(wait=False, cancel_futures=True)
                        print("[OK] Long-video process pool shutdown complete")
                except Exception as e:
                    print(f"Error during video process pool shutdown: {e}")
        except Exception as e:
            print(f"Error in shutdown: {e}")
    
    return lifespan
