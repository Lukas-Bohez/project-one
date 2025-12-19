"""
Authentication and JWT Module
Handles JWT token creation/verification for Kingdom Quarry game authentication
"""
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Header


# Try to import JWT library
try:
    import jwt
    JWT_AVAILABLE = True
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_TIME = timedelta(hours=24)
    
except ImportError:
    JWT_AVAILABLE = False
    print("JWT library not available - Kingdom Quarry game authentication disabled")


def create_access_token(user_id: int, username: str) -> str:
    """Create JWT access token for game authentication"""
    if not JWT_AVAILABLE:
        raise HTTPException(
            status_code=500, 
            detail="JWT library not installed. Install PyJWT to use game authentication."
        )
    
    expire = datetime.now() + JWT_EXPIRATION_TIME
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": expire.timestamp()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload"""
    if not JWT_AVAILABLE:
        return None
    
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if datetime.fromtimestamp(payload["exp"]) > datetime.now():
            return payload
    except jwt.InvalidTokenError:
        pass
    return None


def get_current_game_user(authorization: str = Header(None)) -> Dict[str, Any]:
    """Get current user from JWT token for game endpoints"""
    if not JWT_AVAILABLE:
        raise HTTPException(
            status_code=500, 
            detail="JWT library not installed. Install PyJWT to use game authentication."
        )
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, 
            detail="Missing or invalid authorization header"
        )
    
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload
