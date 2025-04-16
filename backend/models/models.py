from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Enum as SQLAlchemyEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from typing import Optional, List, Union
from pydantic import BaseModel, Field

# Constants
DEFAULT_ROLE = 'User'
DEFAULT_DIFFICULTY = 'Medium'
ROLE_TYPES = ('Admin', 'Moderator', 'User')
DIFFICULTY_LEVELS = ('Easy', 'Medium', 'Hard')
MEDIA_TYPES = ('image', 'audio')

# Helper function for timezone-aware current time
def get_utc_now():
    return datetime.now(timezone.utc)

# SQLAlchemy Base Model
Base = declarative_base()

# SQLAlchemy Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    rfid_code = Column(String(100), unique=True, nullable=False)
    role = Column(SQLAlchemyEnum(*ROLE_TYPES, name='user_role'), default=DEFAULT_ROLE)
    last_active = Column(DateTime(timezone=True), default=get_utc_now)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    
    # Relationships
    themes = relationship("Theme", back_populates="creator")
    questions = relationship("Question", back_populates="creator")

class Theme(Base):
    __tablename__ = "themes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    
    # Relationships
    creator = relationship("User", back_populates="themes")
    questions = relationship("Question", back_populates="theme")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String(255), nullable=False)
    theme_id = Column(Integer, ForeignKey('themes.id'), nullable=False)
    difficulty = Column(SQLAlchemyEnum(*DIFFICULTY_LEVELS, name='difficulty_level'), default=DEFAULT_DIFFICULTY)
    explanation = Column(String(255))
    created_by = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    
    # Relationships
    theme = relationship("Theme", back_populates="questions")
    creator = relationship("User", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey('questions.id'), nullable=False)
    text = Column(String(255), nullable=False)
    is_correct = Column(Boolean, default=False)
    
    # Relationships
    question = relationship("Question", back_populates="answers")

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    description = Column(String(255))
    effect = Column(String(100), nullable=False)

class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    start_time = Column(DateTime(timezone=True), default=get_utc_now)
    end_time = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'))
    
    # Relationships
    creator = relationship("User")
    players = relationship("SessionPlayer", back_populates="session", cascade="all, delete-orphan")
    sensor_data = relationship("SensorData", back_populates="session", cascade="all, delete-orphan")

class SessionPlayer(Base):
    __tablename__ = "session_players"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('quiz_sessions.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    score = Column(Integer, default=0)
    
    # Relationships
    session = relationship("QuizSession", back_populates="players")
    user = relationship("User")

class SensorData(Base):
    __tablename__ = "sensor_data"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('quiz_sessions.id'), nullable=False)
    temperature = Column(Float)
    light_intensity = Column(Integer)
    sound_level = Column(Float)
    timestamp = Column(DateTime(timezone=True), default=get_utc_now)
    
    # Relationships
    session = relationship("QuizSession", back_populates="sensor_data")

class IPAddress(Base):
    __tablename__ = "ip_addresses"
    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(45), nullable=False)
    owned_by = Column(Integer, ForeignKey('users.id'))
    banned = Column(Boolean, default=False)
    ban_reason = Column(String(255))
    ban_date = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    owner = relationship("User")

class MediaFile(Base):
    __tablename__ = "media_files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(SQLAlchemyEnum(*MEDIA_TYPES, name='file_type'), nullable=False)
    question_id = Column(Integer, ForeignKey('questions.id'), nullable=True)
    theme_id = Column(Integer, ForeignKey('themes.id'), nullable=True)
    uploaded_by = Column(Integer, ForeignKey('users.id'))
    uploaded_at = Column(DateTime(timezone=True), default=get_utc_now)
    
    # Relationships
    question = relationship("Question")
    theme = relationship("Theme")
    uploader = relationship("User")

# ================= Pydantic Models =================
# Base Pydantic models
class UserBase(BaseModel):
    username: str
    rfid_code: str
    role: str = DEFAULT_ROLE

class ThemeBase(BaseModel):
    name: str

class QuestionBase(BaseModel):
    text: str
    theme_id: int
    difficulty: str = DEFAULT_DIFFICULTY
    explanation: Optional[str] = None

class AnswerBase(BaseModel):
    text: str
    is_correct: bool = False

class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    effect: str

class QuizSessionBase(BaseModel):
    name: str

class SessionPlayerBase(BaseModel):
    user_id: int
    score: int = 0

class SensorDataBase(BaseModel):
    temperature: Optional[float] = None
    light_intensity: Optional[int] = None
    sound_level: Optional[float] = None

class IPAddressBase(BaseModel):
    ip_address: str
    banned: bool = False
    ban_reason: Optional[str] = None

class MediaFileBase(BaseModel):
    filename: str
    file_type: str
    question_id: Optional[int] = None
    theme_id: Optional[int] = None

# Create models (for requests)
class UserCreate(UserBase):
    pass

class ThemeCreate(ThemeBase):
    pass

class QuestionCreate(QuestionBase):
    answers: List[AnswerBase] = []

class ItemCreate(ItemBase):
    pass

class QuizSessionCreate(QuizSessionBase):
    pass

class SessionPlayerCreate(SessionPlayerBase):
    pass

class SensorDataCreate(SensorDataBase):
    pass

class IPAddressCreate(IPAddressBase):
    pass

class MediaFileCreate(MediaFileBase):
    pass

# Response models (for API responses)
class UserResponse(UserBase):
    id: int
    last_active: datetime
    created_at: datetime

    class Config:
        orm_mode = True

class ThemeResponse(ThemeBase):
    id: int
    created_by: int
    created_at: datetime

    class Config:
        orm_mode = True

class AnswerResponse(AnswerBase):
    id: int
    question_id: int

    class Config:
        orm_mode = True

class QuestionResponse(QuestionBase):
    id: int
    created_by: int
    created_at: datetime
    answers: List[AnswerResponse] = []

    class Config:
        orm_mode = True

class ItemResponse(ItemBase):
    id: int

    class Config:
        orm_mode = True

class SessionPlayerResponse(SessionPlayerBase):
    id: int
    session_id: int

    class Config:
        orm_mode = True

class SensorDataResponse(SensorDataBase):
    id: int
    session_id: int
    timestamp: datetime

    class Config:
        orm_mode = True

class QuizSessionResponse(QuizSessionBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    created_by: int
    players: List[SessionPlayerResponse] = []
    sensor_data: List[SensorDataResponse] = []

    class Config:
        orm_mode = True

class IPAddressResponse(IPAddressBase):
    id: int
    owned_by: Optional[int] = None
    ban_date: Optional[datetime] = None

    class Config:
        orm_mode = True

class MediaFileResponse(MediaFileBase):
    id: int
    uploaded_by: int
    uploaded_at: datetime

    class Config:
        orm_mode = True

# Utility models for specific API operations
class AmountModel(BaseModel):
    amount: int

class ProgressResponse(BaseModel):
    current_progress: int
    daily_goal: int
    percentage: float

class ThemeQuestionCount(BaseModel):
    theme_id: int
    theme_name: str
    question_count: int

class UserStats(BaseModel):
    user_id: int
    username: str
    themes_created: int
    questions_created: int
    session_count: int