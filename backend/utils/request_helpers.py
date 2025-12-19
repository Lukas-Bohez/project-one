"""
Request Helper Functions
Utilities for extracting client information and user authentication from requests
"""
import logging
from fastapi import Request, HTTPException, Header
from database.datarepository import UserRepository, UserIpAddressRepository, IpAddressRepository
from datetime import datetime


quiz_logger = logging.getLogger('quiz_debug')


def get_client_ip_sync(request: Request) -> str:
    """Extract client IP address from request headers"""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else "unknown"


def get_client_ip(request: Request) -> str:
    """Lightweight synchronous wrapper for get_client_ip_sync"""
    return get_client_ip_sync(request)


def log_user_ip_address(user_id: int, ip_address: str):
    """Log user IP address to database"""
    try:
        # Get or create IP address record
        ip_record = IpAddressRepository.get_ip_address_by_ip(ip_address)
        if not ip_record:
            ip_id = IpAddressRepository.create_ip_address({
                'ip_address': ip_address,
                'is_banned': False,
                'ban_reason': None,
                'banned_at': None,
                'ban_expires_at': None,
                'updated_by': user_id
            })
        else:
            ip_id = ip_record['id']
        
        # Check if association exists
        existing = UserIpAddressRepository.get_user_ip_associations(user_id)
        if not any(assoc.get('ip_address_id') == ip_id for assoc in existing):
            UserIpAddressRepository.create_user_ip_address({
                'user_id': user_id,
                'ip_address_id': ip_id,
                'first_seen': datetime.now(),
                'last_seen': datetime.now()
            })
        else:
            UserIpAddressRepository.update_last_seen(user_id, ip_id)
            
    except Exception as e:
        quiz_logger.error(f"Failed to log IP address for user {user_id}: {e}")


def verify_user(user_id: int, rfid_code: str, client_ip: str) -> str:
    """Verify user credentials and return role"""
    user = UserRepository.get_user_by_id(user_id)
    
    if not user:
        quiz_logger.warning(f"User not found: ID {user_id} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get('rfid_code') != rfid_code:
        quiz_logger.warning(f"Invalid RFID for user {user_id} from IP {client_ip}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    role_id = user.get('userRoleId', 2)
    role = 'admin' if role_id == 1 else 'user'
    
    quiz_logger.info(f"User verified: {user_id} ({role}) from IP {client_ip}")
    return role


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
    
    log_user_ip_address(user_id, client_ip)
    
    return {
        "id": user_id,
        "role": verify_user(user_id, x_rfid, client_ip)
    }


def safe_int_convert(value, default=1):
    """Safely convert value to integer with fallback"""
    try:
        if value is None:
            return default
        return int(value)
    except (ValueError, TypeError):
        return default
