# Backend WebSocket Configuration Improvements for Cross-Browser Compatibility
# 
# Add these configurations to your backend/app.py file to improve Firefox and other browser compatibility

"""
UPDATED SOCKET.IO SERVER CONFIGURATION:
Replace your existing socketio.AsyncServer configuration with this enhanced version:
"""

import socketio

# Enhanced Socket.IO server configuration for cross-browser compatibility
sio = socketio.AsyncServer(
    cors_allowed_origins="*",  # Allow all origins for development
    async_mode='asgi',
    logger=False,  # Set to True for debugging
    engineio_logger=False,  # Set to True for debugging
    
    # Enhanced configuration for better browser compatibility
    ping_timeout=60,  # Increased timeout for slower connections
    ping_interval=25,  # Regular ping to keep connection alive
    max_http_buffer_size=1000000,  # Larger buffer for better performance
    
    # Transport configuration
    transports=['polling', 'websocket'],  # Allow both transports
    
    # CORS configuration for WebSocket
    cors_credentials=True,
    
    # Additional headers for better compatibility
    extra_headers={
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, UPGRADE',
        'Access-Control-Allow-Credentials': 'true'
    }
)

"""
FASTAPI CORS MIDDLEWARE CONFIGURATION:
Update your CORS middleware with these settings:
"""

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    
    # Additional headers for WebSocket support
    expose_headers=[
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Credentials",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Methods",
        "Upgrade",
        "Connection",
        "Sec-WebSocket-Accept",
        "Sec-WebSocket-Protocol",
        "Sec-WebSocket-Version"
    ]
)

"""
ADDITIONAL FASTAPI MIDDLEWARE FOR WEBSOCKET SUPPORT:
Add this middleware to handle WebSocket upgrade requests:
"""

@app.middleware("http")
async def websocket_cors_middleware(request, call_next):
    # Handle WebSocket upgrade requests
    if request.headers.get("upgrade") == "websocket":
        # Add WebSocket-specific headers
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept, Authorization, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol"
        return response
    
    return await call_next(request)

"""
SOCKET.IO EVENT HANDLERS WITH ERROR HANDLING:
Add these enhanced event handlers for better connection management:
"""

@sio.event
async def connect(sid, environ, auth):
    """Enhanced connection handler with browser detection"""
    user_agent = environ.get('HTTP_USER_AGENT', '')
    print(f"Client {sid} connected with user agent: {user_agent}")
    
    # Store browser info for connection-specific handling
    await sio.save_session(sid, {'user_agent': user_agent, 'connected_at': datetime.now()})
    
    # Send connection confirmation
    await sio.emit('connection_confirmed', {'status': 'connected', 'sid': sid}, room=sid)
    
    return True

@sio.event
async def disconnect(sid):
    """Enhanced disconnect handler"""
    session = await sio.get_session(sid)
    user_agent = session.get('user_agent', 'Unknown')
    connected_at = session.get('connected_at')
    
    if connected_at:
        duration = datetime.now() - connected_at
        print(f"Client {sid} ({user_agent}) disconnected after {duration}")
    else:
        print(f"Client {sid} ({user_agent}) disconnected")

@sio.event
async def ping(sid):
    """Handle ping requests from clients"""
    await sio.emit('pong', room=sid)

"""
SERVER STARTUP CONFIGURATION:
Use these settings when starting your server:
"""

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=5000,
        reload=True,  # For development
        
        # WebSocket specific configuration
        ws_ping_interval=20,
        ws_ping_timeout=60,
        ws_max_size=16777216,  # 16MB max message size
        
        # HTTP configuration
        timeout_keep_alive=5,
        access_log=True,
        
        # SSL configuration (if using HTTPS)
        # ssl_keyfile="path/to/key.pem",
        # ssl_certfile="path/to/cert.pem",
    )

"""
NGINX/APACHE PROXY CONFIGURATION:
If using a reverse proxy, add these configurations:

For Apache (.htaccess or virtual host):
"""

# Apache WebSocket proxy configuration
"""
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so

ProxyPreserveHost On
ProxyRequests Off

# WebSocket proxy
ProxyPass /socket.io/ ws://localhost:5000/socket.io/
ProxyPassReverse /socket.io/ ws://localhost:5000/socket.io/

# HTTP proxy for Socket.IO polling
ProxyPass /socket.io/ http://localhost:5000/socket.io/
ProxyPassReverse /socket.io/ http://localhost:5000/socket.io/

# Regular API proxy
ProxyPass /api/ http://localhost:5000/api/
ProxyPassReverse /api/ http://localhost:5000/api/
"""

"""
For Nginx:
"""

# Nginx WebSocket proxy configuration
"""
upstream backend {
    server localhost:5000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
    
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""