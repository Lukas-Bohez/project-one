"""
Article and Story Management Routes
Handles CRUD operations for articles and stories
"""

from fastapi import APIRouter, HTTPException, Request, Body
from typing import List, Optional, Dict, Any

from database.datarepository import ArticlesRepository, StoriesRepository, AuditLogRepository

router = APIRouter(prefix="/api", tags=["Articles"])

def _slugify(value: str) -> str:
    """Convert string to URL-friendly slug"""
    import re
    value = value.lower().strip()
    value = re.sub(r'[^\w\s-]', '', value)
    value = re.sub(r'[-\s]+', '-', value)
    return value


# Story Routes
@router.options("/stories/")
def options_stories():
    """Handle CORS preflight for stories endpoint"""
    return {}


@router.get("/stories/")
def list_stories():
    """Get all stories (legacy endpoint)"""
    try:
        stories = StoriesRepository.get_all_stories()
        return {"stories": stories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stories/create-if-not-exists")
def create_story_if_not_exists(
    story_title: str = Body(...),
    story_description: str = Body(None)
):
    """Create story if it doesn't exist"""
    try:
        # Check if story exists
        existing = StoriesRepository.get_story_by_title(story_title)
        if existing:
            return {"story_id": existing['id'], "created": False}
        
        # Create new story
        story_slug = _slugify(story_title)
        new_id = StoriesRepository.create_story(
            title=story_title,
            slug=story_slug,
            description=story_description
        )
        
        return {"story_id": new_id, "created": True}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.options("/v1/stories/")
async def options_v1_stories():
    """Handle CORS preflight for v1 stories endpoint"""
    return {}


@router.get("/v1/stories/")
async def list_stories():
    """Get all stories"""
    try:
        stories = StoriesRepository.get_all_stories()
        return {"stories": stories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/stories/{story_id}/articles")
async def get_articles_by_story(story_id: int, active_only: bool = True):
    """Get all articles for a specific story"""
    try:
        articles = ArticlesRepository.get_articles_by_story(story_id, active_only=active_only)
        return {"story_id": story_id, "articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Article Routes (Legacy)
@router.options("/articles/by-story/{story_id}/")
def options_articles_by_story(story_id: int):
    """Handle CORS preflight for articles by story endpoint"""
    return {}


@router.get("/articles/by-story/{story_id}/")
def get_articles_by_story(story_id: int, active_only: bool = False):
    """Get articles by story ID (legacy endpoint)"""
    try:
        articles = ArticlesRepository.get_articles_by_story(story_id, active_only=active_only)
        return {"articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.options("/v1/articles/by-story/{story_id}/")
async def options_v1_articles_by_story(story_id: int):
    """Handle CORS preflight for v1 articles by story endpoint"""
    return {}


@router.get("/v1/articles/by-story/{story_id}/")
async def get_v1_articles_by_story(story_id: int, active_only: bool = False):
    """Get articles by story ID (v1 endpoint)"""
    try:
        articles = ArticlesRepository.get_articles_by_story(story_id, active_only=active_only)
        return articles if isinstance(articles, list) else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/articles/{article_id}/")
def get_article(article_id: int, increment_view: bool = True):
    """Get single article by ID (legacy endpoint)"""
    try:
        article = ArticlesRepository.get_article_by_id(article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Increment view count
        if increment_view:
            ArticlesRepository.increment_view_count(article_id)
        
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/articles/")
def create_article(
    story_id: int = Body(...),
    title: str = Body(...),
    subtitle: str = Body(None),
    content: str = Body(...),
    author: str = Body("Anonymous"),
    category: str = Body("General"),
    tags: List[str] = Body([]),
    featured: bool = Body(False),
    is_active: bool = Body(True)
):
    """Create new article (legacy endpoint)"""
    try:
        article_id = ArticlesRepository.create_article(
            story_id=story_id,
            title=title,
            subtitle=subtitle,
            content=content,
            author=author,
            category=category,
            tags=tags,
            featured=featured,
            is_active=is_active
        )
        
        return {"message": "Article created", "article_id": article_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/articles/{article_id}/")
def update_article(article_id: int, payload: Dict[str, Any] = Body(...)):
    """Update article (legacy endpoint)"""
    try:
        ArticlesRepository.update_article(article_id, payload)
        return {"message": "Article updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/articles/{article_id}/")
def delete_article(article_id: int):
    """Delete article (legacy endpoint)"""
    try:
        # Soft delete - set is_active to False
        ArticlesRepository.update_article(article_id, {"is_active": False})
        return {"message": "Article deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Article Routes (v1)
@router.get("/v1/articles")
async def get_all_articles(active_only: bool = False, include_story_info: bool = True):
    """Get all articles"""
    try:
        articles = ArticlesRepository.get_all_articles(
            active_only=active_only,
            include_story_info=include_story_info
        )
        return {"articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/search")
async def search_articles(q: str, active_only: bool = True):
    """Search articles by title or content"""
    try:
        articles = ArticlesRepository.search_articles(q, active_only=active_only)
        return {"query": q, "results": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/featured")
async def get_featured_articles(limit: int = 5):
    """Get featured articles"""
    try:
        articles = ArticlesRepository.get_featured_articles(limit=limit)
        return {"articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/recent")
async def get_recent_articles(limit: int = 10, active_only: bool = True):
    """Get recent articles"""
    try:
        articles = ArticlesRepository.get_recent_articles(limit=limit, active_only=active_only)
        return {"articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/statistics")
async def get_article_statistics():
    """Get article statistics"""
    try:
        stats = ArticlesRepository.get_article_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/{article_id}")
async def get_article_by_id(article_id: int):
    """Get single article by ID"""
    try:
        article = ArticlesRepository.get_article_by_id(article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Increment view count
        ArticlesRepository.increment_view_count(article_id)
        
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/by-author/{author}")
async def get_articles_by_author(author: str, active_only: bool = True):
    """Get articles by author"""
    try:
        articles = ArticlesRepository.get_articles_by_author(author, active_only=active_only)
        return {"author": author, "articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/v1/articles/by-category/{category}")
async def get_articles_by_category(category: str, active_only: bool = True):
    """Get articles by category"""
    try:
        articles = ArticlesRepository.get_articles_by_category(category, active_only=active_only)
        return {"category": category, "articles": articles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/articles")
async def create_article(
    request: Request,
    story_id: int = Body(...),
    title: str = Body(...),
    subtitle: str = Body(None),
    content: str = Body(...),
    author: str = Body("Anonymous"),
    category: str = Body("General"),
    tags: List[str] = Body([]),
    featured: bool = Body(False),
    is_active: bool = Body(True)
):
    """Create new article"""
    try:
        article_id = ArticlesRepository.create_article(
            story_id=story_id,
            title=title,
            subtitle=subtitle,
            content=content,
            author=author,
            category=category,
            tags=tags,
            featured=featured,
            is_active=is_active
        )
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='create_article',
            details=f'Created article {article_id}: {title}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Article created successfully", "article_id": article_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/v1/articles/{article_id}")
async def update_article(
    article_id: int,
    request: Request,
    payload: Dict[str, Any] = Body(...)
):
    """Update article"""
    try:
        ArticlesRepository.update_article(article_id, payload)
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='update_article',
            details=f'Updated article {article_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Article updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/v1/articles/{article_id}/status")
async def update_article_status(
    article_id: int,
    request: Request,
    is_active: bool = Body(...)
):
    """Update article active status"""
    try:
        ArticlesRepository.update_article(article_id, {"is_active": is_active})
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='update_article_status',
            details=f'Set article {article_id} active={is_active}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Article status updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/v1/articles/{article_id}")
async def delete_article(
    article_id: int,
    request: Request
):
    """Delete article (soft delete)"""
    try:
        ArticlesRepository.update_article(article_id, {"is_active": False})
        
        # Log audit
        AuditLogRepository.log_action(
            action_type='delete_article',
            details=f'Deleted article {article_id}',
            ip_address=request.client.host if request.client else None
        )
        
        return {"message": "Article deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
