"""
Application Lifespan and Startup/Shutdown Management
"""
import asyncio
from threading import Thread, Event


# Global flag to signal the background thread to stop
stop_thread_event = Event()
main_asyncio_loop = None


async def lifespan_startup(app, sio, RPI_COMPONENTS_AVAILABLE):
    """Handle application startup"""
    global main_asyncio_loop
    
    print("FastAPI app starting up...")
    
    # Get the main asyncio event loop when FastAPI starts.
    # This is the loop on which Socket.IO emits will be scheduled.
    main_asyncio_loop = asyncio.get_running_loop()
    print(f"Main asyncio loop obtained: {main_asyncio_loop}")
    
    # Initialize Socket.IO handlers with the event loop
    from core.socketio_handlers import init_socketio
    init_socketio(sio, main_asyncio_loop)
    
    if RPI_COMPONENTS_AVAILABLE:
        from utils.raspberry_pi_thread import raspberry_pi_main_thread
        
        # Start the Raspberry Pi script in a new thread
        pi_thread = Thread(
            target=raspberry_pi_main_thread,
            args=(stop_thread_event, sio, main_asyncio_loop),
            daemon=True
        )
        pi_thread.start()
        print("Raspberry Pi script thread started.")
    else:
        print("Raspberry Pi thread will not be started due to import errors.")
    
    print("Server started - Socket.IO backend is ready!")


async def lifespan_shutdown():
    """Handle application shutdown"""
    print("FastAPI app shutting down...")
    
    # Signal the background thread to stop
    stop_thread_event.set()
    print("Shutdown signal sent to Raspberry Pi thread.")
