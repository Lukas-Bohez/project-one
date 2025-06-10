from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal
from datetime import datetime

# Existing Question Models (unchanged)
class QuestionBase(BaseModel):
    question_text: str
    themeId: int
    difficultyLevelId: int
    explanation: Optional[str] = None
    Url: Optional[str] = None
    time_limit: int = 30
    think_time: int = 0
    points: int = 10
    is_active: bool = False
    no_answer_correct: bool = False
    LightMax: Optional[int] = None
    LightMin: Optional[int] = None
    TempMax: Optional[int] = None
    TempMin: Optional[int] = None

class QuestionCreate(QuestionBase):
    createdBy: Optional[int] = None

class QuestionResponse(QuestionBase):
    id: int
    createdBy: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    themeId: Optional[int] = None
    difficultyLevelId: Optional[int] = None
    explanation: Optional[str] = None
    Url: Optional[str] = None
    time_limit: Optional[int] = None
    think_time: Optional[int] = None
    points: Optional[int] = None
    is_active: Optional[bool] = None
    no_answer_correct: Optional[bool] = None
    LightMax: Optional[int] = None
    LightMin: Optional[int] = None
    TempMax: Optional[int] = None
    TempMin: Optional[int] = None

class QuestionStatusUpdate(BaseModel):
    is_active: bool

class ErrorNotFound(BaseModel):
    detail: str

# --- Theme Models (Updated) ---
class ThemeBase(BaseModel):
    name: str
    description: Optional[str] = None
    logoUrl: Optional[str] = None  # Added logoUrl
    is_active: bool = True       # Added is_active

class ThemeCreate(ThemeBase):
    """Model for creating a new theme."""
    pass # No extra fields needed for creation beyond ThemeBase

class ThemeUpdate(BaseModel):
    """Model for updating an existing theme."""
    name: Optional[str] = None
    description: Optional[str] = None
    logoUrl: Optional[str] = None
    is_active: Optional[bool] = None

class ThemeResponse(ThemeBase):
    id: int
    # You might also want created_at and updated_at if your DB tracks them for themes
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- End Theme Models ---


class DifficultyLevelBase(BaseModel):
    name: str
    weight: int

class DifficultyLevelResponse(DifficultyLevelBase):
    id: int

    class Config:
        from_attributes = True

class QuestionSearchResult(BaseModel):
    questions: list[QuestionResponse]
    count: int

class RandomQuestionRequest(BaseModel):
    themeId: Optional[int] = None
    difficultyLevelId: Optional[int] = None

class QuestionMetadataUpdate(BaseModel):
    time_limit: Optional[int] = None
    think_time: Optional[int] = None
    points: Optional[int] = None

class QuestionActivationNotification(BaseModel):
    msg: str
    question_id: int
    new_status: bool

# New Answer Models (unchanged)
class AnswerBase(BaseModel):
    answer_text: str
    is_correct: bool = False

class AnswerCreate(AnswerBase):
    questionId: int

class AnswerResponse(AnswerBase):
    id: int
    questionId: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AnswerUpdate(BaseModel):
    answer_text: Optional[str] = None
    is_correct: Optional[bool] = None

class AnswerStatusUpdate(BaseModel):
    is_correct: bool

class AnswerListResponse(BaseModel):
    answers: list[AnswerResponse]
    count: int

class CorrectAnswerResponse(BaseModel):
    correct_answers: list[AnswerResponse]
    count: int

# Update QuestionWithAnswers to use the now-defined AnswerResponse (unchanged)
class QuestionWithAnswers(QuestionResponse):
    answers: list[AnswerResponse]



# --- UserRole Models ---
class UserRoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class UserRoleResponse(UserRoleBase):
    id: int

    class Config:
        from_attributes = True

# --- User Models ---
class UserBase(BaseModel):
    last_name: str
    first_name: str
    rfid_code: Optional[str] = None
    userRoleId: int
    soul_points: int = 4
    limb_points: int = 4

class UserCreate(UserBase):
    # password_hash and salt are required for creation but not part of UserBase
    # as they wouldn't be directly exposed in a UserResponse usually.
    password_hash: str
    salt: str

class UserResponse(UserBase):
    id: int
    last_active: Optional[datetime] = None
    session_expires_at: Optional[datetime] = None
    updated_by: Optional[int] = None # ID of the user who last updated this user

    class Config:
        from_attributes = True
        # json_encoders = {datetime: lambda v: v.isoformat() if v else None} # Example if you need specific datetime formatting

class UserUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    password_hash: Optional[str] = None # Include if allowing password changes via update
    salt: Optional[str] = None           # Include if allowing salt changes via update
    rfid_code: Optional[str] = None
    userRoleId: Optional[int] = None
    soul_points: Optional[int] = None
    limb_points: Optional[int] = None
    last_active: Optional[datetime] = None
    session_expires_at: Optional[datetime] = None
    updated_by: Optional[int] = None

class UserPointsUpdate(BaseModel):
    soul_points: Optional[int] = None
    limb_points: Optional[int] = None

class UserSessionUpdate(BaseModel):
    session_expires_at: datetime # Required to set an expiry


# --- Pydantic Models for API validation and serialization ---

class UserBase(BaseModel):
    """Base model for common user fields."""
    last_name: str = Field(..., max_length=100)
    first_name: str = Field(..., max_length=100)
    rfid_code: Optional[str] = Field(None, max_length=100)
    userRoleId: int
    soul_points: int = Field(4, ge=0, le=4)
    limb_points: int = Field(4, ge=0, le=4)
    # last_active and session_expires_at are typically handled by the server
    # updated_by is usually set by the server based on authenticated user

class UserCreate(UserBase):
    """Model for creating a new user (includes password)."""
    password: str = Field(..., min_length=8) # This is the plaintext password

class UserUpdate(UserBase):
    """Model for updating an existing user. All fields optional for partial updates."""
    last_name: Optional[str] = Field(None, max_length=100)
    first_name: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=8) # Optional for updates
    rfid_code: Optional[str] = Field(None, max_length=100)
    userRoleId: Optional[int] = None
    soul_points: Optional[int] = Field(None, ge=0, le=4)
    limb_points: Optional[int] = Field(None, ge=0, le=4)

class UserInDB(UserBase):
    """Model for user data as stored in the database (includes hashed password and salt)."""
    id: int
    password_hash: Optional[str] = None
    salt: Optional[str] = None
    last_active: Optional[datetime] = None
    session_expires_at: Optional[datetime] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True # Equivalent to orm_mode = True in Pydantic v1

class User(UserInDB):
    """Model for user data returned by the API (excludes sensitive fields if desired for public output)."""
    # Inherits all fields from UserInDB
    # You might want to override __init__ or use a custom serializer if you want to omit password_hash/salt
    # from the public API responses for security. For now, we'll return them, but for production,
    # you'd typically remove or mask these for security.
    pass

# A model for displaying user data in API responses, often without sensitive info
class UserPublic(UserBase):
    id: int
    last_active: Optional[datetime] = None
    session_expires_at: Optional[datetime] = None
    # No password_hash or salt here

    class Config:
        from_attributes = True

class ErrorMessage(BaseModel):
    detail: str


class IpAddressPayload(BaseModel):
    ip_address: str

class AppealPayload(BaseModel):
    ip_address: str
    quote: str # The quote they provided

# Pydantic model for servo command
class ServoCommand(BaseModel):
    command: str

class BroadcastMessage(BaseModel):
    event: str
    data: Dict[str, Any]
    room: Optional[str] = None

class DirectMessage(BaseModel):
    event: str
    data: Dict[str, Any]
    client_id: str

class ClientActivity(BaseModel):
    client_ip: str



class UserUpdateNames(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50, example="John")
    last_name: str = Field(..., min_length=1, max_length=50, example="Doe")


# --- Pydantic Model for Login/Register Requests ---
class UserCredentials(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50, example="Jane")
    last_name: str = Field(..., min_length=1, max_length=50, example="Doe")
    password: str = Field(..., min_length=8, example="StrongPassword123!") # Adjust min_length as needed


class AnswerInput(BaseModel):
    answer_text: str
    is_correct: bool


class QuestionInput(BaseModel):
    question_text: str
    themeId: str
    difficultyLevelId: str
    explanation: Optional[str] = None
    Url: Optional[str] = None
    time_limit: Optional[int] = 30
    think_time: Optional[int] = 5
    points: Optional[int] = 10
    is_active: Optional[bool] = True
    no_answer_correct: Optional[bool] = False
    LightMax: Optional[float] = None
    LightMin: Optional[float] = None
    TempMax: Optional[float] = None
    TempMin: Optional[float] = None
    answers: list[AnswerInput]

class ThemeInput(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


# Updated response model to include IP information
class UserIpAddress(BaseModel):
    id: int
    ip_address: str
    is_banned: bool
    ban_reason: Optional[str] = None
    ban_date: Optional[datetime] = None
    ban_expires_at: Optional[datetime] = None
    usage_count: int
    last_used: datetime
    is_primary: bool

class UserPublicWithIp(BaseModel):
    # Include all your existing UserPublic fields here
    id: int
    first_name: str
    last_name: str
    rfid_code: Optional[str] = None
    userRoleId: int
    soul_points: int
    limb_points: int
    last_active: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Add IP addresses
    ip_addresses: list[UserIpAddress] = []




class BanIpRequest(BaseModel):
    ip_address: str
    ban_reason: str
    ban_duration_value: int
    ban_duration_unit: str  # 'minutes', 'hours', 'days', 'permanent'


# Updated Pydantic Model - removed timestamp since it doesn't exist in your table
class AuditLogResponse(BaseModel):
    id: int
    table_name: str
    record_id: str
    action: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    changed_by: str
    ip_address: str





class ChatMessage(BaseModel):
    id: Optional[int]
    userId: Optional[int]
    username: Optional[str]
    message: Optional[str]
    created_at: Optional[str]

class PlayerAnswer(BaseModel):
    player_answer_id: Optional[int]
    sessionId: Optional[int]
    userId: Optional[int]
    first_name: Optional[str]
    last_name: Optional[str]
    questionId: Optional[int]
    answerId: Optional[int]
    answer_text: Optional[str]
    is_correct: Optional[bool]
    points_earned: Optional[int]
    time_taken: Optional[float]
    answered_at: Optional[str]

class QuestionWithAnswers(BaseModel):
    question_id: Optional[int]
    question_text: Optional[str]
    player_answers: list[PlayerAnswer]



class SensorReading(BaseModel):
    timestamp: Optional[str]
    value: Optional[float]

class SessionSensorData(BaseModel):
    session_id: int
    session_name: str
    temperatures: list[SensorReading]
    light_intensities: list[SensorReading]
    servo_positions: list[SensorReading]
    chat_messages: list[ChatMessage] = []  # New field with default empty list
    player_answers: list[QuestionWithAnswers] = []  # New field with default empty list

class MultiSessionSensorResponse(BaseModel):
    sessions: list[SessionSensorData]


class ChatMessageCreate(BaseModel):
    session_id: int
    message_text: str
    user_id: Optional[int] = None
    # Ensure message_type is restricted to your ENUM values
    message_type: Literal['chat', 'system', 'announcement', 'warning'] = 'chat'
    reply_to_id: Optional[int] = None



class ShutdownRequest(BaseModel):
    action: str = "shutdown"