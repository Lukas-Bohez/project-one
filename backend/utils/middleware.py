"""
Middleware Module
Contains all FastAPI middleware functions
"""
import logging
from starlette.responses import Response as StarletteResponse


async def log_incoming_requests(request, call_next):
    """
    Middleware to log incoming HTTP requests (path, query, headers) to socket.log
    """
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
        sock_logger.debug(f"Incoming HTTP request: {info}")
        if request.url.path.startswith('/socket.io'):
            headers_dict = {k: v for k, v in request.headers.items()}
            sock_logger.debug(f"Socket.IO request headers: {headers_dict}")
    except Exception:
        logging.exception("Failed to log incoming request")
    
    response = await call_next(request)
    
    try:
        if request.url.path.startswith('/socket.io'):
            body_bytes = None
            try:
                if hasattr(response, 'body') and response.body is not None:
                    body_bytes = response.body
                else:
                    body_chunks = []
                    async for chunk in response.body_iterator:
                        body_chunks.append(chunk)
                    body_bytes = b"".join(body_chunks)
                    new_resp = StarletteResponse(
                        content=body_bytes, 
                        status_code=response.status_code, 
                        headers=dict(response.headers), 
                        media_type=getattr(response, 'media_type', None)
                    )
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
                sock_logger = logging.getLogger('socketio')
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
