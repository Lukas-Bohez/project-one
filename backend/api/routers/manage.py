"""
Manage the Spire API Router
RESTful endpoints for employee management system
"""

from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from typing import List, Optional
from datetime import datetime, date, timedelta
import json
import logging

from models.manage_models import (
    BusinessCreate, BusinessResponse,
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    ShiftCreate, ShiftUpdate, ShiftResponse,
    TimeOffRequestCreate, TimeOffRequestReview, TimeOffRequestResponse,
    WarningCreate, WarningResponse,
    CommendationCreate, CommendationResponse,
    AnnouncementCreate, AnnouncementResponse,
    DashboardStats
)
from database.manage_repository import (
    ManageBusinessRepository,
    ManageEmployeeRepository,
    ManageShiftRepository,
    ManageTimeOffRepository,
    ManageWarningRepository
)
from api.websocket import (
    manager, 
    broadcast_shift_created, 
    broadcast_shift_updated,
    broadcast_shift_deleted,
    broadcast_time_off_requested,
    broadcast_time_off_reviewed,
    handle_websocket_message
)

logger = logging.getLogger('manage_the_spire')

router = APIRouter(prefix="/api/v1/manage", tags=["Manage the Spire"])


# ============================================================
# Business Endpoints
# ============================================================

@router.post("/businesses", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(business: BusinessCreate):
    """Create a new business"""
    business_id = ManageBusinessRepository.create_business(business.dict())
    
    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create business"
        )
    
    created_business = ManageBusinessRepository.get_business_by_id(business_id)
    return created_business


@router.get("/businesses/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: int):
    """Get business by ID"""
    business = ManageBusinessRepository.get_business_by_id(business_id)
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business {business_id} not found"
        )
    
    return business


@router.get("/businesses/owner/{owner_user_id}", response_model=List[BusinessResponse])
async def get_businesses_by_owner(owner_user_id: int):
    """Get all businesses owned by a user"""
    businesses = ManageBusinessRepository.get_businesses_by_owner(owner_user_id)
    return businesses


# ============================================================
# Employee Endpoints
# ============================================================

@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(employee: EmployeeCreate):
    """Create a new employee"""
    # Verify business exists
    business = ManageBusinessRepository.get_business_by_id(employee.business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business {employee.business_id} not found"
        )
    
    # Check employee limit for free tier
    if business['subscription_tier'] == 'free':
        existing_employees = ManageEmployeeRepository.get_employees_by_business(
            employee.business_id, status='active'
        )
        if len(existing_employees) >= business['max_employees']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Free tier limit of {business['max_employees']} employees reached. Upgrade to add more."
            )
    
    employee_id = ManageEmployeeRepository.create_employee(employee.dict())
    
    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create employee"
        )
    
    created_employee = ManageEmployeeRepository.get_employee_by_id(employee_id)
    return created_employee


@router.get("/businesses/{business_id}/employees", response_model=List[EmployeeResponse])
async def get_business_employees(
    business_id: int,
    status: Optional[str] = None
):
    """Get all employees for a business"""
    employees = ManageEmployeeRepository.get_employees_by_business(business_id, status)
    return employees


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: int):
    """Get employee by ID"""
    employee = ManageEmployeeRepository.get_employee_by_id(employee_id)
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {employee_id} not found"
        )
    
    return employee


# ============================================================
# Shift Endpoints
# ============================================================

@router.post("/shifts", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
async def create_shift(shift: ShiftCreate):
    """Create a new shift"""
    # Verify employee exists and belongs to business
    employee = ManageEmployeeRepository.get_employee_by_id(shift.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {shift.employee_id} not found"
        )
    
    if employee['business_id'] != shift.business_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to this business"
        )
    
    shift_id = ManageShiftRepository.create_shift(shift.dict())
    
    if not shift_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create shift"
        )
    
    # Return created shift with employee details
    shifts = ManageShiftRepository.get_shifts_by_date_range(
        shift.business_id,
        shift.shift_date,
        shift.shift_date
    )
    created_shift = next((s for s in shifts if s['id'] == shift_id), None)
    
    # Broadcast real-time update
    await broadcast_shift_created(shift.business_id, created_shift)
    
    return created_shift


@router.get("/businesses/{business_id}/shifts", response_model=List[ShiftResponse])
async def get_business_shifts(
    business_id: int,
    start_date: date,
    end_date: date
):
    """Get shifts for a business within a date range"""
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date"
        )
    
    shifts = ManageShiftRepository.get_shifts_by_date_range(business_id, start_date, end_date)
    return shifts


@router.get("/employees/{employee_id}/shifts", response_model=List[ShiftResponse])
async def get_employee_shifts(
    employee_id: int,
    start_date: date,
    end_date: date
):
    """Get shifts for a specific employee"""
    shifts = ManageShiftRepository.get_employee_shifts(employee_id, start_date, end_date)
    return shifts


# ============================================================
# Time Off Endpoints
# ============================================================

@router.post("/time-off", response_model=TimeOffRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_time_off_request(request: TimeOffRequestCreate):
    """Create a new time-off request"""
    # Verify employee exists
    employee = ManageEmployeeRepository.get_employee_by_id(request.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {request.employee_id} not found"
        )
    
    # Check if employee has sufficient PTO balance (if PTO type)
    if request.request_type == 'pto':
        if employee['pto_balance_hours'] < request.total_hours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient PTO balance. Available: {employee['pto_balance_hours']} hours"
            )
    
    request_id = ManageTimeOffRepository.create_time_off_request(request.dict())
    
    if not request_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create time-off request"
        )
    
    # Return the created request with employee details
    pending_requests = ManageTimeOffRepository.get_pending_requests(request.business_id)
    created_request = next((r for r in pending_requests if r['id'] == request_id), None)
    
    # Broadcast real-time update
    await broadcast_time_off_requested(request.business_id, created_request)
    
    return created_request


@router.get("/businesses/{business_id}/time-off/pending", response_model=List[TimeOffRequestResponse])
async def get_pending_time_off_requests(business_id: int):
    """Get all pending time-off requests for a business"""
    requests = ManageTimeOffRepository.get_pending_requests(business_id)
    return requests


# ============================================================
# Warning Endpoints
# ============================================================

@router.post("/warnings", response_model=WarningResponse, status_code=status.HTTP_201_CREATED)
async def create_warning(warning: WarningCreate):
    """Create a new warning/disciplinary action"""
    # Verify employee exists
    employee = ManageEmployeeRepository.get_employee_by_id(warning.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {warning.employee_id} not found"
        )
    
    # Verify issuer exists and has authority
    issuer = ManageEmployeeRepository.get_employee_by_id(warning.issued_by)
    if not issuer or issuer['role_name'] not in ['owner', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and managers can issue warnings"
        )
    
    warning_id = ManageWarningRepository.create_warning(warning.dict())
    
    if not warning_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create warning"
        )
    
    created_warnings = ManageWarningRepository.get_employee_warnings(warning.employee_id, active_only=False)
    created_warning = next((w for w in created_warnings if w['id'] == warning_id), None)
    return created_warning


@router.get("/employees/{employee_id}/warnings", response_model=List[WarningResponse])
async def get_employee_warnings(employee_id: int, active_only: bool = True):
    """Get warnings for an employee"""
    warnings = ManageWarningRepository.get_employee_warnings(employee_id, active_only)
    return warnings


# ============================================================
# Dashboard Endpoints
# ============================================================

@router.get("/businesses/{business_id}/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(business_id: int):
    """Get dashboard statistics for a business"""
    # Get all employees
    all_employees = ManageEmployeeRepository.get_employees_by_business(business_id)
    active_employees = [e for e in all_employees if e['status'] == 'active']
    
    # Get today's shifts
    today = date.today()
    today_shifts = ManageShiftRepository.get_shifts_by_date_range(business_id, today, today)
    
    # Get pending time-off requests
    pending_requests = ManageTimeOffRepository.get_pending_requests(business_id)
    
    # Calculate this week's hours and cost
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_shifts = ManageShiftRepository.get_shifts_by_date_range(business_id, week_start, week_end)
    
    total_hours = 0
    total_cost = 0
    for shift in week_shifts:
        if shift['status'] in ['completed', 'confirmed']:
            # Calculate hours (simplified - assumes same day shifts)
            start = datetime.combine(today, shift['start_time'])
            end = datetime.combine(today, shift['end_time'])
            hours = (end - start).total_seconds() / 3600 - (shift['break_minutes'] / 60)
            total_hours += hours
            
            # Get employee's hourly rate
            employee = next((e for e in all_employees if e['id'] == shift['employee_id']), None)
            if employee and employee['hourly_rate']:
                total_cost += hours * float(employee['hourly_rate'])
    
    return DashboardStats(
        total_employees=len(all_employees),
        active_employees=len(active_employees),
        shifts_today=len(today_shifts),
        pending_time_off_requests=len(pending_requests),
        compliance_alerts=0,  # TODO: Implement compliance checking
        total_hours_this_week=round(total_hours, 2),
        labor_cost_this_week=round(total_cost, 2)
    )


@router.get("/employees/{employee_id}/time-off", response_model=List[TimeOffRequestResponse])
async def get_employee_time_off_requests(employee_id: int):
    """Get time-off requests for a specific employee"""
    requests = ManageTimeOffRepository.get_employee_time_off_requests(employee_id)
    return requests


@router.put("/time-off/{request_id}", response_model=TimeOffRequestResponse)
async def review_time_off_request(request_id: int, review: TimeOffRequestReview):
    """Review (approve/deny) a time-off request"""
    # First get the request to retrieve business_id
    time_off_request = ManageTimeOffRepository.get_time_off_request_by_id(request_id)
    if not time_off_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time-off request not found"
        )
    
    reviewed = ManageTimeOffRepository.review_time_off_request(request_id, review.dict())
    
    if not reviewed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time-off request not found"
        )
    
    # Return updated request
    request_obj = ManageTimeOffRepository.get_time_off_request_by_id(request_id)
    
    # Broadcast real-time update
    approved = review.status == 'approved'
    await broadcast_time_off_reviewed(time_off_request['business_id'], request_obj, approved)
    
    return request_obj


@router.get("/shifts")
async def query_shifts(
    business_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Query shifts with filters"""
    if not business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="business_id is required"
        )
    
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=7)
    
    shifts = ManageShiftRepository.get_shifts_by_date_range(business_id, start_date, end_date)
    return shifts


# ============================================================
# Shift Update and Delete Endpoints
# ============================================================

@router.put("/shifts/{shift_id}", response_model=ShiftResponse)
async def update_shift(shift_id: int, update_data: ShiftUpdate):
    """Update an existing shift"""
    # Verify shift exists
    shift = ManageShiftRepository.get_shift_by_id(shift_id)
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift {shift_id} not found"
        )
    
    # Update the shift
    success = ManageShiftRepository.update_shift(shift_id, update_data.dict(exclude_unset=True))
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update shift"
        )
    
    # Fetch updated shift
    updated_shift = ManageShiftRepository.get_shift_by_id(shift_id)
    
    # Broadcast real-time update
    await broadcast_shift_updated(shift['business_id'], updated_shift)
    
    return updated_shift


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(shift_id: int):
    """Delete a shift"""
    # Verify shift exists
    shift = ManageShiftRepository.get_shift_by_id(shift_id)
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shift {shift_id} not found"
        )
    
    # Get employee name before deleting
    employee = ManageEmployeeRepository.get_employee_by_id(shift['employee_id'])
    employee_name = f"{employee['first_name']} {employee['last_name']}" if employee else "Unknown"
    
    # Delete the shift
    success = ManageShiftRepository.delete_shift(shift_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete shift"
        )
    
    # Broadcast real-time update
    await broadcast_shift_deleted(shift['business_id'], shift_id, employee_name)


# ============================================================
# Health Check
# ============================================================

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Manage the Spire"}


# ============================================================
# WebSocket Real-Time Updates
# ============================================================

@router.websocket("/ws/{business_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, business_id: int, user_id: int):
    """
    WebSocket endpoint for real-time business updates
    
    Connects to: ws://localhost:5000/api/v1/manage/ws/{business_id}/{user_id}
    
    Receives:
    - shift_created: New shift added
    - shift_updated: Shift details changed
    - shift_deleted: Shift removed
    - time_off_requested: Employee requested time off
    - time_off_reviewed: Manager reviewed time-off request
    - employee_joined: New employee added
    
    Usage:
    const ws = new WebSocket(`ws://localhost:5000/api/v1/manage/ws/${businessId}/${userId}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Update:', data.type, data.data);
    };
    
    ws.send(JSON.stringify({ type: 'ping' }));
    """
    
    await manager.connect(business_id, user_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await handle_websocket_message(business_id, user_id, message)
    
    except WebSocketDisconnect:
        await manager.disconnect(business_id, user_id, websocket)
        logger.info(f"WebSocket client {user_id} disconnected from business {business_id}")
    
    except json.JSONDecodeError:
        logger.error("Invalid JSON received on WebSocket")
        await manager.disconnect(business_id, user_id, websocket)
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(business_id, user_id, websocket)
