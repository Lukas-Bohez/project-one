import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status

from api.dependencies import get_current_user_info, get_client_ip
from database.datarepository import ThemeRepository, QuestionRepository, AuditLogRepository
from models.models import ThemeInput, ThemeResponse, ErrorNotFound

router = APIRouter()


@router.get(
    "/api/v1/themes/",
    summary="Get all themes",
    response_model=List[ThemeResponse],
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_all_themes(active_only: bool = False):
    if active_only:
        themes = ThemeRepository.get_active_themes()
    else:
        themes = ThemeRepository.get_all_themes()

    if not themes:
        raise HTTPException(
            status_code=404,
            detail="No themes found"
        )
    return themes


@router.get(
    "/api/v1/themes/{theme_id}/",
    summary="Get theme by ID",
    response_model=ThemeResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_theme_by_id(theme_id: int):
    theme = ThemeRepository.get_theme_by_id(theme_id)
    if not theme:
        raise HTTPException(
            status_code=404,
            detail=f"Theme with ID {theme_id} not found"
        )
    return theme


@router.get(
    "/api/v1/themes/{theme_id}/question_count/",
    summary="Get the number of questions for a specific theme",
    response_model=int,
    responses={404: {"model": ErrorNotFound}},
    tags=["Themes"]
)
async def get_theme_question_count(theme_id: int):
    count = QuestionRepository.get_questions_count_by_theme(theme_id)
    return count


# Fixed create theme endpoint - Log first, create second
@router.post("/api/v1/themes", tags=["Themes"])
async def create_theme_endpoint(
    theme_data: ThemeInput,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can create themes"
        )

    new_values = {
        "name": theme_data.name,
        "description": theme_data.description,
        "is_active": theme_data.is_active,
        "created_by": user_id,
        "role": role,
        "timestamp": datetime.now().isoformat()
    }

    try:
        AuditLogRepository.create_audit_log(
            table_name="themes",
            record_id=0,
            action="CREATE",
            old_values=None,
            new_values=json.dumps(new_values),
            changed_by=user_id,
            ip_address=client_ip
        )
    except Exception as audit_error:
        print(f"Audit log creation failed: {audit_error}")

    try:
        theme_id = ThemeRepository.create_theme(
            name=theme_data.name,
            description=theme_data.description,
            is_active=theme_data.is_active
        )

        if not theme_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create theme - no ID returned"
            )

        return {
            "status": "success",
            "theme_id": theme_id,
            "is_active": theme_data.is_active,
            "role": role
        }

    except ValueError as ve:
        raise HTTPException(
            status_code=400,
            detail=f"Validation error: {str(ve)}"
        )
    except Exception as e:
        print(f"Error creating theme: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create theme: {str(e)}"
        )


# Fixed delete theme endpoint
@router.delete("/api/v1/themes/{theme_id}", tags=["Themes"])
async def delete_theme_endpoint(
    theme_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete themes"
        )

    try:
        existing_theme = ThemeRepository.get_theme_by_id(theme_id)
        if not existing_theme:
            raise HTTPException(status_code=404, detail="Theme not found")

        delete_success = ThemeRepository.delete_theme(theme_id)

        if not delete_success:
            raise HTTPException(status_code=500, detail="Failed to delete theme")

        new_values = {
            "deleted_by": user_id,
            "theme_id": theme_id,
            "action": "DELETE",
            "timestamp": datetime.now().isoformat()
        }

        try:
            AuditLogRepository.create_audit_log(
                table_name="themes",
                record_id=theme_id,
                action="DELETE",
                old_values=None,
                new_values=json.dumps(new_values),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"Theme delete audit log creation failed: {audit_error}")

        return {
            "status": "success",
            "message": "Theme deleted successfully",
            "theme_id": theme_id,
            "role": role
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting theme: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete theme: {str(e)}")


# Mass migration endpoint for moving questions between themes
@router.post("/api/v1/themes/{source_theme_id}/migrate-to/{target_theme_id}", tags=["Themes"])
async def migrate_questions_between_themes(
    source_theme_id: int,
    target_theme_id: int,
    current_user_info: dict = Depends(get_current_user_info),
    request: Request = None
):
    """
    Move all questions from source theme to target theme.
    Only admins can perform this operation.
    """
    user_id = current_user_info["id"]
    role = current_user_info["role"]
    client_ip = get_client_ip(request) if request else "unknown"

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can migrate questions between themes"
        )

    try:
        source_theme = ThemeRepository.get_theme_by_id(source_theme_id)
        target_theme = ThemeRepository.get_theme_by_id(target_theme_id)

        if not source_theme:
            raise HTTPException(
                status_code=404,
                detail=f"Source theme with ID {source_theme_id} not found"
            )

        if not target_theme:
            raise HTTPException(
                status_code=404,
                detail=f"Target theme with ID {target_theme_id} not found"
            )

        if source_theme_id == target_theme_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot migrate questions to the same theme"
            )

        source_questions = QuestionRepository.get_questions_by_theme(source_theme_id)
        question_count = len(source_questions)

        if question_count == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Source theme '{source_theme['name']}' has no questions to migrate"
            )

        try:
            migration_success = QuestionRepository.migrate_questions_to_theme(source_theme_id, target_theme_id)
            if not migration_success:
                raise Exception("Database migration operation failed")
        except Exception as migration_error:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to migrate questions: {str(migration_error)}"
            )

        audit_data = {
            "migrated_by": user_id,
            "source_theme_id": source_theme_id,
            "source_theme_name": source_theme["name"],
            "target_theme_id": target_theme_id,
            "target_theme_name": target_theme["name"],
            "question_count": question_count,
            "action": "MIGRATE_QUESTIONS",
            "timestamp": datetime.now().isoformat()
        }

        try:
            AuditLogRepository.create_audit_log(
                table_name="questions",
                record_id=source_theme_id,
                action="MIGRATE_TO_THEME",
                old_values=json.dumps({"theme_id": source_theme_id}),
                new_values=json.dumps(audit_data),
                changed_by=user_id,
                ip_address=client_ip
            )
        except Exception as audit_error:
            print(f"Migration audit log creation failed: {audit_error}")

        return {
            "status": "success",
            "message": f"Successfully migrated {question_count} questions",
            "source_theme": {
                "id": source_theme_id,
                "name": source_theme["name"]
            },
            "target_theme": {
                "id": target_theme_id,
                "name": target_theme["name"]
            },
            "migrated_count": question_count,
            "migration_timestamp": datetime.now().isoformat(),
            "migrated_by": user_id
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error migrating questions from theme {source_theme_id} to {target_theme_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during question migration: {str(e)}"
        )
