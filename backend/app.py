import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from database.datarepository import QuestionRepository
from models.models import (
    QuestionBase, QuestionCreate, QuestionResponse, QuestionUpdate,
    QuestionStatusUpdate, ErrorNotFound, QuestionWithAnswers,
    ThemeResponse, DifficultyLevelResponse, QuestionSearchResult,
    RandomQuestionRequest, QuestionMetadataUpdate,
    QuestionActivationNotification
)

# ----------------------------------------------------
# App setup
# ----------------------------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
sio = socketio.AsyncServer(cors_allowed_origins='*', async_mode='asgi', logger=True)
sio_app = socketio.ASGIApp(sio, app)

ENDPOINT = "/api/v1"  # API base endpoint

# ----------------------------------------------------
# FastAPI Endpoints - Questions
# ----------------------------------------------------

@app.get("/")
async def root():
    return "Quiz API Server is running. Use the API endpoints to interact with the system."

@app.get(
    ENDPOINT + "/questions/",
    summary="Get all questions",
    response_model=list[QuestionResponse],
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def get_all_questions(active_only: bool = False):
    questions = QuestionRepository.get_all_questions(active_only)
    if not questions:
        raise HTTPException(
            status_code=404,
            detail="No questions found"
        )
    return questions

@app.get(
    ENDPOINT + "/questions/{question_id}/",
    summary="Get question by ID",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def get_question_by_id(question_id: int):
    question = QuestionRepository.get_question_by_id(question_id)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return question

@app.post(
    ENDPOINT + "/questions/",
    summary="Create a new question",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Questions"]
)
async def create_question(question: QuestionCreate):
    new_id = QuestionRepository.create_question(**question.dict())
    if not new_id:
        raise HTTPException(
            status_code=400,
            detail="Failed to create question"
        )
    return QuestionRepository.get_question_by_id(new_id)

@app.put(
    ENDPOINT + "/questions/{question_id}/",
    summary="Update a question",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def update_question(question_id: int, question: QuestionUpdate):
    updated = QuestionRepository.update_question(question_id, **question.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found or update failed"
        )
    return QuestionRepository.get_question_by_id(question_id)

@app.patch(
    ENDPOINT + "/questions/{question_id}/status/",
    summary="Update question status (active/inactive)",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def update_question_status(question_id: int, status: QuestionStatusUpdate):
    updated = QuestionRepository.update_question(
        question_id,
        is_active=status.is_active
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    await sio.emit('question_status_changed', {
        "question_id": question_id,
        "new_status": status.is_active
    })
    return QuestionRepository.get_question_by_id(question_id)

@app.delete(
    ENDPOINT + "/questions/{question_id}/",
    summary="Delete a question",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": ErrorNotFound}},
    tags=["Questions"]
)
async def delete_question(question_id: int):
    success = QuestionRepository.delete_question(question_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )

# ----------------------------------------------------
# FastAPI Endpoints - Special Question Operations
# ----------------------------------------------------

@app.get(
    ENDPOINT + "/questions/random/",
    summary="Get a random question",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def get_random_question(params: RandomQuestionRequest = Body(default=None)):
    question = QuestionRepository.get_random_question(
        themeId=params.themeId if params else None,
        difficultyLevelId=params.difficultyLevelId if params else None
    )
    if not question:
        raise HTTPException(
            status_code=404,
            detail="No active questions found matching criteria"
        )
    return question

@app.get(
    ENDPOINT + "/questions/{question_id}/with-answers/",
    summary="Get question with answers",
    response_model=QuestionWithAnswers,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def get_question_with_answers(question_id: int):
    question = QuestionRepository.get_questions_with_answers(question_id)
    if not question:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return question

@app.patch(
    ENDPOINT + "/questions/{question_id}/metadata/",
    summary="Update question metadata",
    response_model=QuestionResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Special Question Operations"]
)
async def update_question_metadata(question_id: int, metadata: QuestionMetadataUpdate):
    updated = QuestionRepository.update_question_metadata(
        question_id,
        **metadata.dict(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Question with ID {question_id} not found"
        )
    return QuestionRepository.get_question_by_id(question_id)

# ----------------------------------------------------
# Socket.IO Handlers
# ----------------------------------------------------

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def request_random_question(sid, data):
    theme_id = data.get('themeId')
    difficulty_id = data.get('difficultyLevelId')
    question = QuestionRepository.get_random_question(theme_id, difficulty_id)
    if question:
        await sio.emit('new_question', question, room=sid)

# ----------------------------------------------------
# Run the app
# ----------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:sio_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend"]
    )