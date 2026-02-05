"""
Manage the Spire Pydantic Models
Data validation and serialization models
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum


# Enums
class SubscriptionTier(str, Enum):
    free = "free"
    pro = "pro"
    enterprise = "enterprise"


class EmployeeStatus(str, Enum):
    active = "active"
    on_leave = "on_leave"
    terminated = "terminated"
    suspended = "suspended"


class ShiftStatus(str, Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class TimeOffType(str, Enum):
    pto = "pto"
    sick = "sick"
    unpaid = "unpaid"
    bereavement = "bereavement"
    other = "other"


class RequestStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"
    cancelled = "cancelled"


class WarningType(str, Enum):
    verbal = "verbal"
    written = "written"
    final = "final"
    suspension = "suspension"
    termination = "termination"


# Business Models
class BusinessCreate(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=255)
    owner_user_id: int
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    timezone: str = "UTC"
    subscription_tier: SubscriptionTier = SubscriptionTier.free


class BusinessResponse(BaseModel):
    id: int
    business_name: str
    owner_user_id: int
    contact_email: str
    contact_phone: Optional[str]
    address: Optional[str]
    timezone: str
    subscription_tier: str
    max_employees: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Employee Models
class EmployeeCreate(BaseModel):
    business_id: int
    user_id: Optional[int] = None
    employee_code: Optional[str] = None
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    role_id: int = 3  # Default to 'employee' role
    position_title: Optional[str] = None
    department: Optional[str] = None
    hire_date: date
    hourly_rate: Optional[float] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class EmployeeUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    position_title: Optional[str] = None
    department: Optional[str] = None
    hourly_rate: Optional[float] = None
    status: Optional[EmployeeStatus] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int
    business_id: int
    user_id: Optional[int]
    employee_code: Optional[str]
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    role_id: int
    role_name: str
    position_title: Optional[str]
    department: Optional[str]
    hire_date: date
    termination_date: Optional[date]
    hourly_rate: Optional[float]
    pto_balance_hours: float
    sick_balance_hours: float
    status: str
    created_at: datetime
    updated_at: datetime


# Shift Models
class ShiftCreate(BaseModel):
    business_id: int
    employee_id: int
    shift_date: date
    start_time: time
    end_time: time
    position: Optional[str] = None
    location: Optional[str] = None
    break_minutes: int = 0
    notes: Optional[str] = None
    created_by: Optional[int] = None

    @validator('end_time')
    def end_after_start(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


class ShiftUpdate(BaseModel):
    employee_id: Optional[int] = None
    shift_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    position: Optional[str] = None
    location: Optional[str] = None
    break_minutes: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[ShiftStatus] = None


class ShiftResponse(BaseModel):
    id: int
    business_id: int
    employee_id: int
    first_name: Optional[str]
    last_name: Optional[str]
    employee_code: Optional[str]
    shift_date: date
    start_time: time
    end_time: time
    position: Optional[str]
    location: Optional[str]
    break_minutes: int
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime


# Time Off Models
class TimeOffRequestCreate(BaseModel):
    business_id: int
    employee_id: int
    request_type: TimeOffType
    start_date: date
    end_date: date
    total_hours: float = Field(..., gt=0)
    reason: Optional[str] = None

    @validator('end_date')
    def end_after_start(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('end_date must be on or after start_date')
        return v


class TimeOffRequestReview(BaseModel):
    status: RequestStatus
    review_notes: Optional[str] = None
    reviewed_by: int


class TimeOffRequestResponse(BaseModel):
    id: int
    business_id: int
    employee_id: int
    first_name: Optional[str]
    last_name: Optional[str]
    employee_code: Optional[str]
    request_type: str
    start_date: date
    end_date: date
    total_hours: float
    reason: Optional[str]
    status: str
    reviewed_by: Optional[int]
    review_notes: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime


# Warning Models
class WarningCreate(BaseModel):
    business_id: int
    employee_id: int
    warning_type: WarningType
    category: Optional[str] = None
    incident_date: date
    description: str = Field(..., min_length=10)
    corrective_action: Optional[str] = None
    follow_up_date: Optional[date] = None
    issued_by: int


class WarningResponse(BaseModel):
    id: int
    business_id: int
    employee_id: int
    warning_type: str
    category: Optional[str]
    incident_date: date
    description: str
    corrective_action: Optional[str]
    follow_up_date: Optional[date]
    issued_by: int
    acknowledged_by_employee: bool
    acknowledged_at: Optional[datetime]
    is_active: bool
    created_at: datetime


# Commendation Models
class CommendationCreate(BaseModel):
    business_id: int
    employee_id: int
    commendation_type: str
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=10)
    date_earned: date
    bonus_amount: Optional[float] = None
    issued_by: int
    is_public: bool = True


class CommendationResponse(BaseModel):
    id: int
    business_id: int
    employee_id: int
    commendation_type: str
    title: str
    description: str
    date_earned: date
    bonus_amount: Optional[float]
    issued_by: int
    is_public: bool
    created_at: datetime


# Announcement Models
class AnnouncementCreate(BaseModel):
    business_id: int
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=10)
    priority: str = "medium"
    target_audience: str = "all"
    expires_at: Optional[datetime] = None
    created_by: int


class AnnouncementResponse(BaseModel):
    id: int
    business_id: int
    title: str
    message: str
    priority: str
    target_audience: str
    expires_at: Optional[datetime]
    created_by: int
    is_active: bool
    created_at: datetime


# Dashboard Models
class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    shifts_today: int
    pending_time_off_requests: int
    compliance_alerts: int
    total_hours_this_week: float
    labor_cost_this_week: float


# Authentication Models
class ManageLogin(BaseModel):
    email: EmailStr
    password: str


class ManageAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee_id: int
    business_id: int
    role_name: str
    first_name: str
    last_name: str
