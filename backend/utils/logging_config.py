"""
Logging Configuration Module
Centralizes all logging setup for video, quiz, and socket.io debugging
"""
import logging
import os

def setup_logging():
    """
    Configure all application loggers
    Returns dict of configured loggers
    """
    loggers = {}
    
    # Video Logger
    video_logger = logging.getLogger('video_debug')
    video_logger.setLevel(logging.DEBUG)
    video_log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'video_debug.log')
    video_file_handler = logging.FileHandler(video_log_file, mode='a')
    video_file_handler.setLevel(logging.DEBUG)
    video_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    video_file_handler.setFormatter(video_formatter)
    
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == video_file_handler.baseFilename for h in video_logger.handlers):
        video_logger.addHandler(video_file_handler)
    video_logger.propagate = False
    video_logger.info("="*50)
    video_logger.info("Video Logger Initialized")
    video_logger.info("="*50)
    loggers['video'] = video_logger
    
    # Quiz Logger
    quiz_log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs', 'quiz_debug.log')
    quiz_logger = logging.getLogger('quiz_debug')
    quiz_logger.setLevel(logging.INFO)
    quiz_file_handler = logging.FileHandler(quiz_log_file, mode='a')
    quiz_file_handler.setLevel(logging.INFO)
    quiz_file_handler.setFormatter(video_formatter)
    
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == quiz_file_handler.baseFilename for h in quiz_logger.handlers):
        quiz_logger.addHandler(quiz_file_handler)
    quiz_logger.propagate = False
    quiz_logger.info("="*50)
    quiz_logger.info("Quiz Logger Initialized")
    quiz_logger.info("="*50)
    loggers['quiz'] = quiz_logger
    
    # Socket.IO Logger
    socket_log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs', 'socket.log')
    socket_logger = logging.getLogger('socketio')
    socket_logger.setLevel(logging.DEBUG)
    socket_file_handler = logging.FileHandler(socket_log_file, mode='a')
    socket_file_handler.setLevel(logging.DEBUG)
    socket_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    socket_file_handler.setFormatter(socket_formatter)
    
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in socket_logger.handlers):
        socket_logger.addHandler(socket_file_handler)
    loggers['socket'] = socket_logger
    
    # Engine.IO Logger
    engineio_logger = logging.getLogger('engineio')
    engineio_logger.setLevel(logging.DEBUG)
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in engineio_logger.handlers):
        engineio_logger.addHandler(socket_file_handler)
    loggers['engineio'] = engineio_logger
    
    # Uvicorn Error Logger
    uvicorn_error_logger = logging.getLogger('uvicorn.error')
    uvicorn_error_logger.setLevel(logging.DEBUG)
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in uvicorn_error_logger.handlers):
        uvicorn_error_logger.addHandler(socket_file_handler)
    loggers['uvicorn_error'] = uvicorn_error_logger
    
    # Uvicorn Access Logger
    uvicorn_access_logger = logging.getLogger('uvicorn.access')
    uvicorn_access_logger.setLevel(logging.INFO)
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', None) == socket_file_handler.baseFilename for h in uvicorn_access_logger.handlers):
        uvicorn_access_logger.addHandler(socket_file_handler)
    loggers['uvicorn_access'] = uvicorn_access_logger
    
    # Suppress MySQL connector warnings
    logging.getLogger('mysql.connector').setLevel(logging.WARNING)
    
    return loggers
