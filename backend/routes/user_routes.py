"""
User, Authentication, and IP Management Routes
Handles user CRUD, authentication, IP tracking, and ban management
"""

from fastapi import APIRouter, HTTPException, Request, Header, status, Query, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from typing import List, Optional
from datetime import datetime, timedelta
import hashlib

from database.datarepository import (
    UserRepository, IpAddressRepository, UserIpAddressRepository,
    AuditLogRepository
)
from models.models import (
    User, UserCreate, UserUpdate, UserPublic, UserUpdateNames,
    UserCredentials, IpAddressPayload, AppealPayload
)
from utils.shared import get_client_ip

router = APIRouter(prefix="/api", tags=["Users & Auth"])


# Helper functions
def log_user_ip_address(user_id: int, ip_address: str):
    """Log the IP address for a user."""
    try:
        # First, get or create the IP address record
        existing_ip = IpAddressRepository.get_ip_address_by_string(ip_address)
        if existing_ip:
            ip_address_id = existing_ip['id']
        else:
            ip_address_id = IpAddressRepository.create_ip_address(ip_address)
        
        # Link the user to this IP address
        UserIpAddressRepository.create_user_ip_address(user_id, ip_address_id)
    except Exception as e:
        print(f"Error logging IP address: {e}")


def verify_user(user_id: int, rfid_code: str, client_ip: str = None) -> str:
    """Verify user identity and return status"""
    try:
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            return "user_not_found"
        
        if user.get('rfid_code') != rfid_code:
            return "rfid_mismatch"
        
        if client_ip:
            log_user_ip_address(user_id, client_ip)
        
        return "verified"
    except Exception as e:
        print(f"Error verifying user: {e}")
        return "error"


def generate_kawaii_string(user_credentials):
    """Generate a hashed authentication token"""
    raw_string = f"{user_credentials.username}:{user_credentials.password}"
    hashed = hashlib.sha256(raw_string.encode()).hexdigest()
    return hashed


def calculate_ban_expiry(duration_value: int, duration_unit: str) -> Optional[datetime]:
    """Calculate ban expiry datetime"""
    if duration_unit == "permanent":
        return None
    
    duration_map = {
        "minutes": timedelta(minutes=duration_value),
        "hours": timedelta(hours=duration_value),
        "days": timedelta(days=duration_value),
        "weeks": timedelta(weeks=duration_value)
    }
    
    delta = duration_map.get(duration_unit)
    if delta:
        return datetime.now() + delta
    return None


# IP and Client Info Routes
@router.get("/v1/client-ip")
async def get_client_ip_endpoint(request: Request):
    """Get client IP address"""
    return {"ip": get_client_ip(request)}


@router.post("/v1/ip-status")
async def check_ip_status_and_track(payload: IpAddressPayload):
    """Check if IP is banned and track it"""
    try:
        ip = payload.ip_address
        
        # Get or create IP record
        existing_ip = IpAddressRepository.get_ip_address_by_string(ip)
        if existing_ip:
            ip_id = existing_ip['id']
            is_banned = existing_ip.get('is_banned', False)
            ban_reason = existing_ip.get('ban_reason')
            ban_expiry = existing_ip.get('ban_expiry')
        else:
            ip_id = IpAddressRepository.create_ip_address(ip)
            is_banned = False
            ban_reason = None
            ban_expiry = None
        
        return {
            "ip_address": ip,
            "is_banned": is_banned,
            "ban_reason": ban_reason,
            "ban_expiry": ban_expiry
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/banned", response_class=HTMLResponse, status_code=403)
async def banned_page(request: Request):
    """Display ban page"""
    client_ip = get_client_ip(request)
    
    try:
        ip_record = IpAddressRepository.get_ip_address_by_string(client_ip)
        ban_reason = ip_record.get('ban_reason', 'Violation of terms of service') if ip_record else 'Unknown'
        ban_expiry = ip_record.get('ban_expiry') if ip_record else None
    except:
        ban_reason = 'Violation of terms of service'
        ban_expiry = None
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Access Denied</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }}
            .ban-container {{
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 500px;
                text-align: center;
            }}
            h1 {{ color: #d32f2f; }}
            .ip {{ color: #666; font-family: monospace; }}
            .reason {{ 
                background: #ffebee;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }}
        </style>
    </head>
    <body>
        <div class="ban-container">
            <h1>🚫 Access Denied</h1>
            <p>Your IP address has been banned from accessing this service.</p>
            <p class="ip">IP: {client_ip}</p>
            <div class="reason">
                <strong>Reason:</strong> {ban_reason}
            </div>
            {f'<p><strong>Ban Expires:</strong> {ban_expiry}</p>' if ban_expiry else '<p><strong>Ban Type:</strong> Permanent</p>'}
            <p>If you believe this is an error, please contact support.</p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@router.post("/v1/appeal-ban", response_class=JSONResponse)
async def appeal_ban(payload: AppealPayload, request: Request):
    """Submit a ban appeal"""
    try:
        client_ip = get_client_ip(request)
        
        # Log the appeal
        AuditLogRepository.log_action(
            action_type='ban_appeal',
            details=f'Appeal from {client_ip}: {payload.reason}',
            ip_address=client_ip
        )
        
        return {
            "success": True,
            "message": "Your appeal has been submitted and will be reviewed."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# User Management Routes
@router.get("/users/active/count")
async def get_active_users_count():
    """Get count of active users"""
    try:
        count = UserRepository.get_active_user_count()
        return {"active_users": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/v1/users/", response_model=List[UserPublic])
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None)
):
    """Get all users with pagination"""
    try:
        users = UserRepository.get_all_users(skip=skip, limit=limit, search=search)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/v1/users/{rfid_code}")
async def update_user_names(rfid_code: str, user_update: UserUpdateNames, request: Request):
    """Update user first and last name"""
    try:
        client_ip = get_client_ip(request)
        
        # Verify user exists
        user = UserRepository.get_user_by_rfid(rfid_code)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update names
        UserRepository.update_user(
            user['id'],
            {
                'first_name': user_update.first_name,
                'last_name': user_update.last_name
            }
        )
        
        # Log IP
        log_user_ip_address(user['id'], client_ip)
        
        return {"message": "User updated successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/v1/users/{user_id}")
async def delete_user_endpoint(
    user_id: int,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Delete a user (admin only)"""
    try:
        UserRepository.delete_user(user_id)
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='delete_user',
            details=f'Deleted user {user_id}',
            ip_address=get_client_ip(request)
        )
        
        return {"message": "User deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


# Authentication Routes
@router.post("/v1/register", status_code=status.HTTP_201_CREATED)
async def register_user(user_credentials: UserCredentials, request: Request):
    """Register a new user"""
    try:
        client_ip = get_client_ip(request)
        
        # Check if user exists
        existing = UserRepository.get_user_by_username(user_credentials.username)
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Create user
        user_id = UserRepository.create_user(
            username=user_credentials.username,
            password_hash=generate_kawaii_string(user_credentials),
            rfid_code=user_credentials.rfid_code if hasattr(user_credentials, 'rfid_code') else None
        )
        
        # Log IP
        log_user_ip_address(user_id, client_ip)
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='user_register',
            details=f'User {user_credentials.username} registered',
            ip_address=client_ip
        )
        
        return {
            "message": "User created successfully",
            "user_id": user_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/login")
async def login_user(user_credentials: UserCredentials, request: Request):
    """Login user"""
    try:
        client_ip = get_client_ip(request)
        
        # Verify credentials
        user = UserRepository.get_user_by_username(user_credentials.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Verify password
        expected_hash = generate_kawaii_string(user_credentials)
        if user.get('password_hash') != expected_hash:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Log IP
        log_user_ip_address(user['id'], client_ip)
        
        return {
            "success": True,
            "user_id": user['id'],
            "username": user['username']
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/support/login")
async def support_login_user(user_credentials: UserCredentials, request: Request):
    """Support login endpoint"""
    try:
        client_ip = get_client_ip(request)
        
        user = UserRepository.get_user_by_username(user_credentials.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        expected_hash = generate_kawaii_string(user_credentials)
        if user.get('password_hash') != expected_hash:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        log_user_ip_address(user['id'], client_ip)
        
        return {"success": True, "user": user}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/support/register", status_code=status.HTTP_201_CREATED)
async def support_register_user(user_credentials: UserCredentials, request: Request):
    """Support registration endpoint"""
    try:
        client_ip = get_client_ip(request)
        
        existing = UserRepository.get_user_by_username(user_credentials.username)
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        user_id = UserRepository.create_user(
            username=user_credentials.username,
            password_hash=generate_kawaii_string(user_credentials)
        )
        
        log_user_ip_address(user_id, client_ip)
        
        return {"message": "User created", "user_id": user_id}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Ban Management Routes
@router.post("/v1/ban-ip")
async def ban_ip_address(
    request: Request,
    ip_address: str = None,
    reason: str = "Violation of terms",
    duration_value: int = 1,
    duration_unit: str = "days",
    authorization: Optional[str] = Header(None)
):
    """Ban an IP address (admin only)"""
    try:
        if not ip_address:
            ip_address = get_client_ip(request)
        
        # Calculate expiry
        ban_expiry = calculate_ban_expiry(duration_value, duration_unit)
        
        # Get or create IP record
        existing_ip = IpAddressRepository.get_ip_address_by_string(ip_address)
        if existing_ip:
            IpAddressRepository.update_ip_address(
                existing_ip['id'],
                {
                    'is_banned': True,
                    'ban_reason': reason,
                    'ban_expiry': ban_expiry
                }
            )
        else:
            IpAddressRepository.create_ip_address(
                ip_address,
                is_banned=True,
                ban_reason=reason,
                ban_expiry=ban_expiry
            )
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='ban_ip',
            details=f'Banned IP {ip_address}: {reason}',
            ip_address=get_client_ip(request)
        )
        
        return {
            "message": f"IP {ip_address} has been banned",
            "expiry": ban_expiry.isoformat() if ban_expiry else "permanent"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
