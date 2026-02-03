from typing import Dict, Any, List
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status

from api.dependencies import get_current_user_info
from database.datarepository import ArticlesRepository, StoriesRepository, AuditLogRepository
from models.models import (
    ArticleListResponse,
    ArticleResponse,
    ArticleSearchResult,
    ArticleStatsResponse,
    ArticleCreate,
    ArticleUpdate,
    ArticleStatusUpdate,
    StoryResponse,
    ErrorNotFound
)

router = APIRouter()


def _slugify(value: str) -> str:
    try:
        import re
        return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    except Exception:
        return value


@router.get(
    "/api/v1/stories/",
    summary="List all stories",
    response_model=List[StoryResponse],
    tags=["Stories"]
)
async def list_stories():
    """Return all stories for filtering and admin UI."""
    try:
        stories = StoriesRepository.list_stories()
        return [StoryResponse(**story) for story in stories]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving stories: {str(e)}")


@router.post("/api/v1/stories/create-if-not-exists", tags=["Stories"])
def create_story_if_not_exists(
    payload: Dict[str, Any] = Body(...),
    current_user_info: dict = Depends(get_current_user_info)
):
    role = current_user_info["role"]

    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create stories")

    name = (payload or {}).get("name")
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="Field 'name' is required")
    slug = (payload or {}).get("slug") or _slugify(name)
    description = (payload or {}).get("description")
    try:
        existing = StoriesRepository.get_story_by_name(name)
        if existing:
            return {"created": False, "story": existing}
        new_id = StoriesRepository.create_story(name, slug, description)
        if not new_id:
            raise HTTPException(status_code=500, detail="Failed to create story")
        created = StoriesRepository.get_story_by_id(int(new_id))
        return {"created": True, "story": created}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create story: {e}")


# ----------------------------------------------------
# Articles Endpoints
# ----------------------------------------------------

@router.get(
    "/api/v1/articles/",
    summary="Get all articles",
    response_model=ArticleListResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Articles"]
)
async def get_all_articles(active_only: bool = False, include_story_info: bool = True):
    """Get all articles with statistics"""
    try:
        articles = ArticlesRepository.get_all_articles(active_only=active_only, include_story_info=include_story_info)
        stats = ArticlesRepository.get_articles_stats()

        return ArticleListResponse(
            articles=[ArticleResponse(**article) for article in articles],
            total_count=stats.get('total_articles', 0),
            active_count=stats.get('active_articles', 0),
            featured_count=stats.get('featured_articles', 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving articles: {str(e)}")


@router.get(
    "/api/v1/articles/search/",
    summary="Search articles",
    response_model=List[ArticleSearchResult],
    tags=["Articles"]
)
async def search_articles(q: str, active_only: bool = True):
    """Search articles by title, content, author, or story"""
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters long")

    articles = ArticlesRepository.search_articles(q.strip(), active_only=active_only)
    return [ArticleSearchResult(**article) for article in articles]


@router.get(
    "/api/v1/articles/featured/",
    summary="Get featured articles",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_featured_articles(limit: int = 5):
    """Get featured articles"""
    articles = ArticlesRepository.get_featured_articles(limit=limit)
    return [ArticleResponse(**article) for article in articles]


@router.get(
    "/api/v1/articles/recent/",
    summary="Get recent articles",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_recent_articles(limit: int = 10, active_only: bool = True):
    """Get most recent articles"""
    articles = ArticlesRepository.get_recent_articles(limit=limit, active_only=active_only)
    return [ArticleResponse(**article) for article in articles]


@router.get(
    "/api/v1/articles/stats/",
    summary="Get article statistics",
    response_model=ArticleStatsResponse,
    tags=["Articles"]
)
async def get_article_statistics():
    """Get comprehensive article statistics"""
    stats = ArticlesRepository.get_articles_stats()
    return ArticleStatsResponse(**stats)


@router.get(
    "/api/v1/articles/{article_id}/",
    summary="Get article by ID",
    response_model=ArticleResponse,
    responses={404: {"model": ErrorNotFound}},
    tags=["Articles"]
)
async def get_article_by_id(article_id: int, increment_view: bool = True):
    """Get a single article by ID and increment view count"""
    article = ArticlesRepository.get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if increment_view:
        try:
            ArticlesRepository.increment_view_count(article_id)
        except Exception:
            pass

    return ArticleResponse(**article)


@router.get(
    "/api/v1/articles/by-author/{author}/",
    summary="Get articles by author",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_articles_by_author(author: str, active_only: bool = True):
    """Get all articles by a specific author"""
    articles = ArticlesRepository.get_articles_by_author(author, active_only=active_only)
    return [ArticleResponse(**article) for article in articles]


@router.get(
    "/api/v1/articles/by-category/{category}/",
    summary="Get articles by category",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_articles_by_category(category: str, active_only: bool = True):
    """Get all articles in a specific category"""
    articles = ArticlesRepository.get_articles_by_category(category, active_only=active_only)
    return [ArticleResponse(**article) for article in articles]


@router.get(
    "/api/v1/articles/by-story/{story_id}/",
    summary="Get articles by story (ordered)",
    response_model=List[ArticleResponse],
    tags=["Articles"]
)
async def get_articles_by_story(story_id: int, active_only: bool = True):
    """Get all articles within a story, ordered by story_order."""
    try:
        articles = ArticlesRepository.get_articles_by_story_id(story_id, active_only=active_only)
        return [ArticleResponse(**article) for article in articles]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving articles for story {story_id}: {str(e)}")


# Protected Article Operations (require authentication)
@router.post(
    "/api/v1/articles/",
    summary="Create new article",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Articles"]
)
async def create_article(
    article: ArticleCreate,
    user_info: dict = Depends(get_current_user_info)
):
    """Create a new article with duplicate title checking"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]

        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can create articles")

        if ArticlesRepository.check_article_exists_by_title(article.title):
            raise HTTPException(
                status_code=400,
                detail=f"Article with title '{article.title}' already exists"
            )

        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=0,
            action="CREATE",
            new_values=article.dict(),
            changed_by=user_id,
            ip_address=None
        )

        article_id = ArticlesRepository.create_article(**article.dict())

        if article_id:
            AuditLogRepository.create_audit_log(
                table_name="articles",
                record_id=article_id,
                action="CREATE",
                new_values=article.dict(),
                changed_by=user_id,
                ip_address=None
            )

            created_article = ArticlesRepository.get_article_by_id(article_id)
            return ArticleResponse(**created_article)

        raise HTTPException(status_code=500, detail="Failed to create article")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating article: {str(e)}")


@router.patch(
    "/api/v1/articles/{article_id}/",
    summary="Update article",
    response_model=ArticleResponse,
    tags=["Articles"]
)
async def update_article(
    article_id: int,
    article_update: ArticleUpdate,
    user_info: dict = Depends(get_current_user_info)
):
    """Update an existing article with duplicate title checking"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]

        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can update articles")

        existing_article = ArticlesRepository.get_article_by_id(article_id)
        if not existing_article:
            raise HTTPException(status_code=404, detail="Article not found")

        if article_update.title and article_update.title != existing_article.get('title'):
            if ArticlesRepository.check_article_exists_by_title(article_update.title, exclude_id=article_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Article with title '{article_update.title}' already exists"
                )

        update_data = {k: v for k, v in article_update.dict().items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields provided for update")

        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=article_id,
            action="UPDATE",
            old_values=existing_article,
            new_values=update_data,
            changed_by=user_id,
            ip_address=None
        )

        success = ArticlesRepository.update_article(article_id, **update_data)

        if success:
            updated_article = ArticlesRepository.get_article_by_id(article_id)
            return ArticleResponse(**updated_article)

        raise HTTPException(status_code=500, detail="Failed to update article")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating article: {str(e)}")


@router.patch(
    "/api/v1/articles/{article_id}/status/",
    summary="Update article status",
    response_model=ArticleResponse,
    tags=["Articles"]
)
async def update_article_status(
    article_id: int,
    status_update: ArticleStatusUpdate,
    user_info: dict = Depends(get_current_user_info)
):
    """Update article active/featured status"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]

        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can update article status")

        existing_article = ArticlesRepository.get_article_by_id(article_id)
        if not existing_article:
            raise HTTPException(status_code=404, detail="Article not found")

        update_data = {}
        if status_update.is_active is not None:
            update_data['is_active'] = status_update.is_active
        if status_update.is_featured is not None:
            update_data['is_featured'] = status_update.is_featured

        if not update_data:
            raise HTTPException(status_code=400, detail="No status fields provided for update")

        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=article_id,
            action="STATUS_UPDATE",
            old_values=existing_article,
            new_values=update_data,
            changed_by=user_id,
            ip_address=None
        )

        success = ArticlesRepository.update_article(article_id, **update_data)

        if success:
            updated_article = ArticlesRepository.get_article_by_id(article_id)
            return ArticleResponse(**updated_article)

        raise HTTPException(status_code=500, detail="Failed to update article status")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating article status: {str(e)}")


@router.delete(
    "/api/v1/articles/{article_id}/",
    summary="Delete article",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Articles"]
)
async def delete_article(
    article_id: int,
    user_info: dict = Depends(get_current_user_info)
):
    """Delete an article"""
    try:
        user_id = user_info["id"]
        user_role = user_info["role"]

        if user_role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can delete articles")

        existing_article = ArticlesRepository.get_article_by_id(article_id)
        if not existing_article:
            raise HTTPException(status_code=404, detail="Article not found")

        AuditLogRepository.create_audit_log(
            table_name="articles",
            record_id=article_id,
            action="DELETE",
            old_values=existing_article,
            changed_by=user_id,
            ip_address=None
        )

        success = ArticlesRepository.delete_article(article_id)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete article")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting article: {str(e)}")
