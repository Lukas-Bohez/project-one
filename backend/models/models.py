from pydantic import BaseModel
from typing import Optional

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

class QuestionWithAnswers(QuestionResponse):
    answers: list['AnswerResponse']  # You'll need to define AnswerResponse

class ThemeBase(BaseModel):
    name: str
    description: Optional[str] = None

class ThemeResponse(ThemeBase):
    id: int

class DifficultyLevelBase(BaseModel):
    name: str
    weight: int

class DifficultyLevelResponse(DifficultyLevelBase):
    id: int

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