from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import traceback

from database.datarepository import QuestionRepository, UserRepository
from models.models import UserPublic

router = APIRouter()


@router.get("/")
async def read_root():
    return {"message": "Welcome to the Site Quiz Backend!"}


@router.get("/api/questions/active/count")
async def get_active_questions_count():
    try:
        active_questions = QuestionRepository.get_active_questions()
        count = len(active_questions) if active_questions else 0
        return JSONResponse(content={"count": count})
    except Exception as e:
        print(f"Error retrieving active questions count: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to retrieve active questions count."}
        )


@router.get("/api/users/active/count")
async def get_active_users_count():
    try:
        users = UserRepository.get_all_users()
        count = len(users) if users else 0
        return JSONResponse(content={"count": count})
    except Exception as e:
        print(f"Error retrieving active users count: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to retrieve active users count."}
        )


@router.get("/api/v1/users/", response_model=list[UserPublic])
async def get_all_users(request: Request):
    """
    Fetches all users from the database.
    """
    try:
        users = UserRepository.get_all_users()
        for user in users:
            if user.get('email'):
                user['first_name'] = user['email']
        return [UserPublic(**user) for user in users]
    except Exception as e:
        print(f"Error in get_all_users endpoint: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to retrieve users.")
