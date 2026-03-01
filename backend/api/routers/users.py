import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from api.dependencies import get_current_user_info, get_client_ip, get_client_ip_sync, log_user_ip_address
from database.datarepository import UserRepository, UserIpAddressRepository
from models.models import UserPublicWithIp, UserPublic, UserIpAddress, UserUpdateNames, ErrorNotFound

router = APIRouter()


# Alternative: If you want to keep the original endpoint and add a separate one for IP info
@router.get(
    "/api/v1/users/with-ip/",
    response_model=List[UserPublicWithIp],
    summary="Get all users with detailed IP information (Admin only)",
    tags=["Users"]
)
async def get_all_users_with_ip(
    request: Request,
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_rfid: str = Header(None, alias="X-RFID")
):
    user_info = await get_current_user_info(request, x_user_id, x_rfid)
    if user_info["role"] not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required for IP information")

    users = UserRepository.get_all_users()
    users_with_ip = []

    for user in users:
        user_ip_data = UserIpAddressRepository.get_user_ip_addresses(user['id'])

        ip_addresses = []
        for ip_data in user_ip_data:
            ip_addresses.append(UserIpAddress(
                id=ip_data['id'],
                ip_address=ip_data['ip_address'],
                is_banned=ip_data['is_banned'],
                ban_reason=ip_data['ban_reason'],
                ban_date=ip_data['ban_date'],
                ban_expires_at=ip_data['ban_expires_at'],
                usage_count=ip_data['usage_count'],
                last_used=ip_data['last_used'],
                is_primary=ip_data['is_primary']
            ))

        user_with_ip = UserPublicWithIp(
            **user,
            ip_addresses=ip_addresses
        )
        if user_with_ip.email:
            user_with_ip.first_name = user_with_ip.email
        users_with_ip.append(user_with_ip)

    return users_with_ip


@router.get(
    "/api/v1/users/basic/",
    response_model=List[UserPublic],
    summary="Get all users (basic info only)",
    tags=["Users"]
)
async def get_all_users_basic():
    users = UserRepository.get_all_users()
    for user in users:
        if user.get('email'):
            user['first_name'] = user['email']
    return [UserPublic(**user) for user in users]


@router.get(
    "/api/v1/users/{user_id}",
    response_model=UserPublic,
    summary="Get user by ID",
    responses={404: {"model": ErrorNotFound}},
    tags=["Users"]
)
async def get_user_by_id(user_id: int):
    user = UserRepository.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {user_id} not found")
    return UserPublic(**user)


@router.patch("/api/v1/users/{rfid_code}")
async def update_user_names(rfid_code: str, user_update: UserUpdateNames, request: Request):
    client_ip = get_client_ip_sync(request)

    all_users = UserRepository.get_all_users()
    target_user_id = None
    target_user_role = None

    for user in all_users:
        if user['first_name'] == user_update.first_name and user['last_name'] == user_update.last_name:
            if user['rfid_code'] == rfid_code:
                target_user_id = user['id']
                target_user_role = user['userRoleId']
                UserRepository.update_user_last_active(target_user_id, datetime.now())

                log_user_ip_address(target_user_id, client_ip)
                break
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user with this name already exists, but the provided RFID does not match."
                )

    if target_user_id is None:
        existing_user_by_rfid = UserRepository.get_user_by_rfid(rfid_code)
        if existing_user_by_rfid:
            if existing_user_by_rfid['first_name'] == 'Open' and existing_user_by_rfid['last_name'] == 'Open':
                success = UserRepository.update_user_names_by_rfid(
                    rfid_code,
                    user_update.first_name,
                    user_update.last_name
                )
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update 'Open' user account."
                    )
                target_user_id = existing_user_by_rfid['id']
                target_user_role = existing_user_by_rfid['userRoleId']
                UserRepository.update_user_last_active(target_user_id, datetime.now())

                log_user_ip_address(target_user_id, client_ip)
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"RFID code '{rfid_code}' is already associated with another user and is not an 'Open' account."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with RFID code '{rfid_code}' not found and no 'Open' account to update."
            )

    if target_user_role != 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Only administrators can access the admin panel."
        )

    return {"user_id": target_user_id}


@router.delete("/api/v1/users/{user_id}")
async def delete_user_endpoint(
    user_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    current_user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    if current_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    existing_user = UserRepository.get_user_by_id(user_id)
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    if existing_user['userRoleId'] == 3:
        raise HTTPException(status_code=403, detail="Cannot delete admin users for security reasons")

    try:
        delete_success = UserRepository.delete_user(user_id)

        if not delete_success:
            raise HTTPException(status_code=500, detail="Failed to delete user")

        new_values = {
            "deleted_by": current_user_id,
            "user_id": user_id,
            "action": "DELETE",
            "timestamp": datetime.now().isoformat()
        }

        try:
            from database.datarepository import AuditLogRepository
            AuditLogRepository.create_audit_log(
                table_name="users",
                record_id=user_id,
                action="DELETE",
                old_values=None,
                new_values=json.dumps(new_values),
                changed_by=current_user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"User delete audit log creation failed: {audit_error}")

        return {
            "status": "success",
            "message": "User deleted successfully",
            "user_id": user_id,
            "role": role
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user. Please try again later.")
