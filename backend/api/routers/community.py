"""
Spire AI Collaboration - API Router
Enables users to create, share, and play community quiz themes.
Supports CSV import for AI-generated quiz content.
"""

import csv
import io
import logging
from typing import List, Optional

from database.community_repository import (
    CommunityAnswerRepository,
    CommunityQuestionRepository,
    CommunityRatingRepository,
    CommunityThemeRepository,
    CsvUploadRepository,
)
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, status
from models.community_models import (
    CommunityQuestionCreate,
    CommunityQuestionResponse,
    CommunityQuestionUpdate,
    CommunityThemeCreate,
    CommunityThemeFullResponse,
    CommunityThemeResponse,
    CommunityThemeUpdate,
    CsvUploadResponse,
    RatingInput,
    ReviewAction,
)
from pydantic import BaseModel, Field

logger = logging.getLogger("spire_ai")

router = APIRouter(prefix="/api/v1/community", tags=["Spire AI Collaboration"])


# ============================================================
# Helper: extract user info from headers (same as app.py pattern)
# ============================================================
async def get_user_from_headers(request):
    """Extract user info from request headers.

    Supports two auth methods:
    1. RFID-based: X-User-ID + X-RFID headers (hardware auth)
    2. Password-based: X-User-ID + X-Password headers (web auth)
    """
    from database.datarepository import UserRepository

    user_id = request.headers.get("X-User-ID")
    rfid = request.headers.get("X-RFID")
    password = request.headers.get("X-Password")
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Authentication required. Please log in."
        )
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID")
    user = UserRepository.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Try RFID auth first, then fall back to password auth
    if rfid:
        if user.get("rfid_code") != rfid:
            raise HTTPException(status_code=403, detail="Invalid RFID code")
    elif password:
        if not UserRepository.authenticate_user(
            user.get("first_name"), user.get("last_name"), password
        ):
            raise HTTPException(status_code=403, detail="Invalid password")
    else:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials required. Please provide RFID or password.",
        )
    return user


async def get_user_loose(request):
    """Loosely identify a user from X-User-ID header without verifying password/RFID.

    Used for community content creation endpoints where any registered user
    can contribute. Content goes through admin approval before going live,
    so strict auth is not required for creation.
    """
    from database.datarepository import UserRepository

    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(
            status_code=401, detail="Please log in to create community content."
        )
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID")
    user = UserRepository.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def is_admin(user):
    return user.get("userRoleId") == 3


# ============================================================
# PASSWORDLESS AUTH — for community content creation
# ============================================================


class CommunityAuthRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    password: Optional[str] = Field(None, min_length=8)


@router.post("/auth")
async def community_auth(auth_data: CommunityAuthRequest, request: Request):
    """Sign in or register for community features. Password is optional.

    - With password: full authentication (same as /api/v1/login)
    - Without password: name-only lookup or auto-register for community content creation

    Community content (themes, questions) goes through admin approval,
    so strict password auth is not required for creation.
    """
    from database.datarepository import UserRepository

    existing = UserRepository.get_user_by_name(
        auth_data.first_name, auth_data.last_name
    )

    if auth_data.password:
        # Full auth — verify password
        user_id = UserRepository.authenticate_user(
            auth_data.first_name, auth_data.last_name, auth_data.password
        )
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid name or password.")
        return {"message": "Login successful", "user_id": user_id, "auth_level": "full"}
    else:
        # Passwordless — lookup or create
        if existing:
            logger.info(
                f"Passwordless community login for user {existing['id']} ({auth_data.first_name} {auth_data.last_name})"
            )
            return {
                "message": "Welcome back!",
                "user_id": existing["id"],
                "auth_level": "community",
            }
        else:
            # Auto-register without password
            user_data = {
                "first_name": auth_data.first_name,
                "last_name": auth_data.last_name,
                "password_hash": None,
                "salt": None,
                "userRoleId": 1,
                "soul_points": 4,
                "limb_points": 4,
                "updated_by": 1,
            }
            user_id = UserRepository.create_user_with_password(user_data)
            if not user_id:
                raise HTTPException(status_code=500, detail="Failed to create account")
            logger.info(
                f"Passwordless community registration: user {user_id} ({auth_data.first_name} {auth_data.last_name})"
            )
            return {
                "message": "Account created!",
                "user_id": user_id,
                "auth_level": "community",
            }


# ============================================================
# THEME ENDPOINTS
# ============================================================


@router.get("/themes", response_model=List[CommunityThemeResponse])
async def list_community_themes(
    request: Request,
    search: Optional[str] = Query(
        None, description="Search themes by name/description"
    ),
    status: Optional[str] = Query(
        None, description="Filter by status: draft/pending/approved/rejected"
    ),
    creator_id: Optional[int] = Query(None, description="Filter by creator user ID"),
    mine: Optional[bool] = Query(False, description="Only show my themes"),
):
    """List public community themes, or search/filter them."""
    if mine or creator_id:
        if creator_id:
            themes = CommunityThemeRepository.get_themes_by_user(creator_id)
        else:
            user = await get_user_from_headers(request)
            themes = CommunityThemeRepository.get_themes_by_user(user["id"])
    elif search:
        themes = CommunityThemeRepository.search_themes(search)
    else:
        themes = CommunityThemeRepository.get_all_public_themes()

    # Filter by status if specified
    if status and themes:
        themes = [t for t in themes if t.get("status") == status]

    return themes or []


@router.get("/themes/{theme_id}", response_model=CommunityThemeResponse)
async def get_community_theme(theme_id: int):
    """Get a single community theme by ID."""
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Community theme not found")
    return theme


@router.post(
    "/themes",
    response_model=CommunityThemeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_community_theme(theme_data: CommunityThemeCreate, request: Request):
    """Create a new community theme. Any registered user can create themes (no password required).
    Content starts as draft and requires admin approval before going live."""
    user = await get_user_loose(request)
    theme_id = CommunityThemeRepository.create_theme(
        name=theme_data.name,
        description=theme_data.description,
        created_by=user["id"],
        logo_url=theme_data.logo_url,
    )
    if not theme_id:
        raise HTTPException(status_code=500, detail="Failed to create theme")
    logger.info(
        f"User {user['id']} created community theme '{theme_data.name}' (id={theme_id})"
    )
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    return theme


@router.patch("/themes/{theme_id}", response_model=CommunityThemeResponse)
async def update_community_theme(
    theme_id: int, theme_data: CommunityThemeUpdate, request: Request
):
    """Update a community theme (only by the creator)."""
    user = await get_user_from_headers(request)
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["created_by"] != user["id"] and not is_admin(user):
        raise HTTPException(status_code=403, detail="You can only edit your own themes")

    update_data = theme_data.dict(exclude_unset=True)
    if update_data:
        CommunityThemeRepository.update_theme(theme_id, user["id"], **update_data)

    return CommunityThemeRepository.get_theme_by_id(theme_id)


@router.delete("/themes/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_community_theme(theme_id: int, request: Request):
    """Delete a community theme (only by creator or admin)."""
    user = await get_user_from_headers(request)
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["created_by"] != user["id"] and not is_admin(user):
        raise HTTPException(
            status_code=403, detail="You can only delete your own themes"
        )

    CommunityThemeRepository.delete_theme(theme_id, theme["created_by"])
    logger.info(f"User {user['id']} deleted community theme {theme_id}")


@router.post("/themes/{theme_id}/submit")
async def submit_theme_for_review(theme_id: int, request: Request):
    """Submit a draft theme for admin review. No password required."""
    user = await get_user_loose(request)
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["created_by"] != user["id"]:
        raise HTTPException(
            status_code=403, detail="You can only submit your own themes"
        )
    if theme["status"] != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Theme is already '{theme['status']}', can only submit drafts",
        )

    # Require at least 5 questions
    questions = CommunityQuestionRepository.get_questions_by_theme(theme_id)
    if len(questions) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 5 questions to submit (currently {len(questions)})",
        )

    CommunityThemeRepository.submit_for_review(theme_id, user["id"])
    logger.info(f"User {user['id']} submitted theme {theme_id} for review")
    return {"status": "success", "message": "Theme submitted for admin review!"}


@router.post("/themes/{theme_id}/rate")
async def rate_community_theme(
    theme_id: int, rating_data: RatingInput, request: Request
):
    """Rate a community theme (1-5 stars). No password required."""
    user = await get_user_loose(request)
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["status"] != "approved":
        raise HTTPException(status_code=400, detail="Can only rate approved themes")

    CommunityRatingRepository.rate_theme(theme_id, user["id"], rating_data.rating)
    return {"status": "success", "rating": rating_data.rating}


@router.get("/themes/{theme_id}/play", response_model=CommunityThemeFullResponse)
async def play_community_theme(theme_id: int):
    """Get a community theme with all questions and answers for playing."""
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["status"] != "approved" and not theme.get("is_public"):
        raise HTTPException(
            status_code=403, detail="This theme is not yet approved for play"
        )

    CommunityThemeRepository.increment_play_count(theme_id)
    questions = CommunityQuestionRepository.get_questions_with_answers(theme_id)
    return {"theme": theme, "questions": questions}


# ============================================================
# QUESTION ENDPOINTS
# ============================================================


@router.get(
    "/themes/{theme_id}/questions", response_model=List[CommunityQuestionResponse]
)
async def list_theme_questions(theme_id: int, request: Request):
    """List all questions in a community theme."""
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    questions = CommunityQuestionRepository.get_questions_with_answers(theme_id)
    return questions or []


@router.post(
    "/themes/{theme_id}/questions",
    response_model=CommunityQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_question(
    theme_id: int, question_data: CommunityQuestionCreate, request: Request
):
    """Add a question to a community theme. No password required — content goes through admin review."""
    user = await get_user_loose(request)
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["created_by"] != user["id"] and not is_admin(user):
        raise HTTPException(
            status_code=403, detail="You can only add questions to your own themes"
        )

    # Validate at least one correct answer
    correct_count = sum(1 for a in question_data.answers if a.is_correct)
    if correct_count < 1:
        raise HTTPException(
            status_code=400, detail="At least one answer must be marked as correct"
        )

    q_id = CommunityQuestionRepository.create_question(
        community_theme_id=theme_id,
        question_text=question_data.question_text,
        explanation=question_data.explanation,
        difficulty=question_data.difficulty.value,
        time_limit=question_data.time_limit,
        points=question_data.points,
        image_url=question_data.image_url,
        is_ai_generated=question_data.is_ai_generated,
    )
    if not q_id:
        raise HTTPException(status_code=500, detail="Failed to create question")

    for answer in question_data.answers:
        CommunityAnswerRepository.create_answer(
            q_id, answer.answer_text, answer.is_correct
        )

    question = CommunityQuestionRepository.get_question_by_id(q_id)
    question["answers"] = CommunityAnswerRepository.get_answers_for_question(q_id)
    return question


@router.patch("/questions/{question_id}", response_model=CommunityQuestionResponse)
async def update_question(
    question_id: int, question_data: CommunityQuestionUpdate, request: Request
):
    """Update a community question."""
    user = await get_user_from_headers(request)
    question = CommunityQuestionRepository.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    theme = CommunityThemeRepository.get_theme_by_id(question["community_theme_id"])
    if theme["created_by"] != user["id"] and not is_admin(user):
        raise HTTPException(
            status_code=403, detail="You can only edit questions in your own themes"
        )

    update_data = question_data.dict(exclude_unset=True)
    if "difficulty" in update_data and update_data["difficulty"]:
        update_data["difficulty"] = update_data["difficulty"].value

    CommunityQuestionRepository.update_question(question_id, **update_data)

    updated = CommunityQuestionRepository.get_question_by_id(question_id)
    updated["answers"] = CommunityAnswerRepository.get_answers_for_question(question_id)
    return updated


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: int, request: Request):
    """Delete a community question."""
    user = await get_user_from_headers(request)
    question = CommunityQuestionRepository.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    theme = CommunityThemeRepository.get_theme_by_id(question["community_theme_id"])
    if theme["created_by"] != user["id"] and not is_admin(user):
        raise HTTPException(
            status_code=403, detail="You can only delete questions in your own themes"
        )

    CommunityQuestionRepository.delete_question(question_id)


# ============================================================
# CSV UPLOAD ENDPOINT
# ============================================================


@router.post("/themes/{theme_id}/csv-upload", response_model=CsvUploadResponse)
async def upload_csv_questions(
    theme_id: int, request: Request, file: UploadFile = File(...)
):
    """Upload a CSV file to bulk-import questions into a community theme.

    CSV Format:
    question,correct_answer,wrong_answer_1,wrong_answer_2,wrong_answer_3,explanation,difficulty,ai_generated

    Required columns: question, correct_answer
    Optional columns: wrong_answer_1, wrong_answer_2, wrong_answer_3, explanation, difficulty, ai_generated
    """
    user = await get_user_loose(request)
    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["created_by"] != user["id"] and not is_admin(user):
        raise HTTPException(
            status_code=403, detail="You can only upload to your own themes"
        )

    # Validate file
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV (.csv)")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="CSV file too large (max 5MB)")

    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except Exception:
            raise HTTPException(
                status_code=400, detail="Could not decode CSV file. Use UTF-8 encoding."
            )

    # Parse CSV
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    if len(rows) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 questions per upload")

    # Import questions
    imported, failed, errors = CommunityQuestionRepository.bulk_create_from_csv(
        theme_id, rows
    )

    # Track upload
    error_log = "\n".join(errors) if errors else None
    CsvUploadRepository.create_upload(
        user_id=user["id"],
        community_theme_id=theme_id,
        filename=file.filename,
        imported=imported,
        failed=failed,
        error_log=error_log,
    )

    logger.info(
        f"CSV upload by user {user['id']}: {imported} imported, {failed} failed from '{file.filename}'"
    )

    return {
        "imported": imported,
        "failed": failed,
        "errors": errors[:20],  # Limit error output
        "theme_id": theme_id,
        "theme_name": theme["name"],
    }


@router.get("/csv-template")
async def get_csv_template():
    """Get a sample CSV template for quiz imports."""
    return {
        "template": "question,correct_answer,wrong_answer_1,wrong_answer_2,wrong_answer_3,explanation,difficulty,ai_generated",
        "example_rows": [
            (
                "What is the capital of France?,Paris,London,Berlin,Madrid,"
                "Paris has been the capital since the 10th century,easy,false"
            ),
            (
                "What is 2+2?,4,3,5,6,Basic arithmetic,easy,true"
            ),
            (
                "Who wrote Romeo and Juliet?,William Shakespeare,Charles Dickens,"
                "Jane Austen,Mark Twain,Written around 1595,medium,false"
            ),
        ],
        "columns": {
            "question": "Required. The question text.",
            "correct_answer": "Required. The correct answer.",
            "wrong_answer_1": "Required. First wrong answer.",
            "wrong_answer_2": "Optional. Second wrong answer.",
            "wrong_answer_3": "Optional. Third wrong answer.",
            "explanation": "Optional. Explanation shown after answering.",
            "difficulty": "Optional. easy/medium/hard/expert. Default: medium.",
            "ai_generated": "Optional. true/false. Mark if AI-generated.",
        },
    }


# ============================================================
# ADMIN REVIEW ENDPOINTS
# ============================================================


@router.get("/admin/pending", response_model=List[CommunityThemeResponse])
async def list_pending_themes(request: Request):
    """List themes pending admin review."""
    user = await get_user_from_headers(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return CommunityThemeRepository.get_pending_themes() or []


@router.post("/admin/review/{theme_id}")
async def review_theme(theme_id: int, review: ReviewAction, request: Request):
    """Approve or reject a community theme."""
    user = await get_user_from_headers(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["status"] != "pending_review":
        raise HTTPException(
            status_code=400, detail=f"Theme is '{theme['status']}', not pending review"
        )

    if review.action == "approve":
        CommunityThemeRepository.approve_theme(theme_id, user["id"], review.notes)
        logger.info(f"Admin {user['id']} approved community theme {theme_id}")
        return {"status": "success", "message": "Theme approved and published!"}
    else:
        CommunityThemeRepository.reject_theme(theme_id, user["id"], review.notes)
        logger.info(f"Admin {user['id']} rejected community theme {theme_id}")
        return {"status": "success", "message": "Theme rejected with feedback."}


@router.post("/admin/promote/{theme_id}")
async def promote_theme_to_official(theme_id: int, request: Request):
    """Promote an approved community theme to an official quiz theme."""
    user = await get_user_from_headers(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    theme = CommunityThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme["status"] != "approved":
        raise HTTPException(
            status_code=400, detail="Only approved themes can be promoted"
        )

    official_id = CommunityThemeRepository.promote_to_official(theme_id)
    if not official_id:
        raise HTTPException(status_code=500, detail="Failed to promote theme")

    logger.info(
        f"Admin {user['id']} promoted community theme {theme_id} to official theme {official_id}"
    )
    return {
        "status": "success",
        "official_theme_id": official_id,
        "message": "Theme promoted to official!",
    }


@router.get("/admin/stats")
async def get_community_stats(request: Request):
    """Get overall Spire AI Collaboration statistics."""
    user = await get_user_from_headers(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return CommunityThemeRepository.get_stats()
