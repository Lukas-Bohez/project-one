"""
Spire AI Collaboration - Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class DifficultyLevel(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"
    expert = "expert"


class ThemeStatus(str, Enum):
    draft = "draft"
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"


# --- Community Answer Models ---
class CommunityAnswerCreate(BaseModel):
    answer_text: str = Field(..., min_length=1, max_length=300)
    is_correct: bool = False


class CommunityAnswerResponse(BaseModel):
    id: int
    community_question_id: int
    answer_text: str
    is_correct: bool


# --- Community Question Models ---
class CommunityQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=3, max_length=500)
    explanation: Optional[str] = None
    difficulty: DifficultyLevel = DifficultyLevel.medium
    time_limit: int = Field(default=30, ge=5, le=120)
    points: int = Field(default=10, ge=1, le=100)
    image_url: Optional[str] = None
    is_ai_generated: bool = False
    answers: List[CommunityAnswerCreate] = Field(..., min_length=2, max_length=6)


class CommunityQuestionResponse(BaseModel):
    id: int
    community_theme_id: int
    question_text: str
    explanation: Optional[str] = None
    difficulty: str
    time_limit: int
    points: int
    image_url: Optional[str] = None
    is_ai_generated: bool = False
    answer_count: Optional[int] = None
    correct_count: Optional[int] = None
    answers: Optional[List[CommunityAnswerResponse]] = None
    created_at: Optional[datetime] = None


class CommunityQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    time_limit: Optional[int] = Field(default=None, ge=5, le=120)
    points: Optional[int] = Field(default=None, ge=1, le=100)
    image_url: Optional[str] = None


# --- Community Theme Models ---
class CommunityThemeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = None


class CommunityThemeResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    created_by: int
    creator_name: Optional[str] = None
    status: str
    is_public: bool = False
    play_count: int = 0
    question_count: Optional[int] = None
    avg_rating: Optional[float] = None
    rating_count: int = 0
    csv_source: bool = False
    review_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CommunityThemeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = None


class ReviewAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    notes: Optional[str] = None


class RatingInput(BaseModel):
    rating: int = Field(..., ge=1, le=5)


# --- CSV Upload Models ---
class CsvUploadResponse(BaseModel):
    imported: int
    failed: int
    errors: List[str]
    theme_id: int
    theme_name: str


# --- Full theme with questions (for playing) ---
class CommunityThemeFullResponse(BaseModel):
    theme: CommunityThemeResponse
    questions: List[CommunityQuestionResponse]
