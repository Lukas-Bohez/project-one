from typing import Dict, Any, Optional

from fastapi import Header, HTTPException, Request
import logging

from database.datarepository import UserRepository, IpAddressRepository, UserIpAddressRepository

quiz_logger = logging.getLogger('quiz_debug')


def get_client_ip_sync(request: Request) -> str:
    """Extract client IP address from request headers."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    return request.client.host if request.client else "unknown"


def get_client_ip(request: Request) -> str:
    return get_client_ip_sync(request)


def log_user_ip_address(user_id: int, ip_address: str):
    """Log the IP address for a user."""
    try:
        existing_ip = IpAddressRepository.get_ip_address_by_string(ip_address)
        if existing_ip:
            ip_address_id = existing_ip['id']
        else:
            ip_address_id = IpAddressRepository.create_ip_address(ip_address)
            if not ip_address_id:
                print(f"Failed to create IP address record for {ip_address}")
                return

        UserIpAddressRepository.create_user_ip_address_link(
            user_id=user_id,
            ip_address_id=ip_address_id,
            is_primary=False
        )
    except Exception as e:
        print(f"Error logging user IP address: {e}")


def verify_user(user_id: int, rfid_code: str, client_ip: Optional[str] = None) -> str:
    user = UserRepository.get_user_by_id(user_id)

    if not user:
        quiz_logger.warning(f"Authentication failed: User {user_id} not found from IP {client_ip}")
        raise HTTPException(status_code=404, detail="User not found")

    if user['rfid_code'] != rfid_code:
        quiz_logger.warning(f"Authentication failed: Invalid RFID for user {user_id} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Invalid RFID code")

    role = user['userRoleId']

    if role == 1:
        return "user"
    if role == 2:
        return "moderator"
    if role == 3:
        return "admin"

    quiz_logger.warning(f"Authentication failed: Unknown role {role} for user {user_id} from IP {client_ip}")
    raise HTTPException(status_code=403, detail="Unknown role")


async def get_current_user_info(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_rfid: str = Header(None, alias="X-RFID")
) -> Dict[str, Any]:
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
