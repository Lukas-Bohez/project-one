"""
Theme Selection Routes
Handles manual theme selection initiation for quiz flow
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
import random

from database.datarepository import ThemeRepository

router = APIRouter(prefix="/api", tags=["Theme Selection"])


@router.post("/v1/quiz/start-theme-selection")
async def start_theme_selection(session_id: int, num_themes: int = 4):
    """
    Manually trigger theme selection for a session
    Returns a theme_selection payload that matches what Socket.IO expects
    """
    try:
        # Get all active themes
        all_themes = ThemeRepository.get_active_themes() or ThemeRepository.get_all_themes()
        
        if not all_themes:
            raise HTTPException(status_code=404, detail="No themes available")
        
        # Select random themes (up to num_themes)
        selected_themes = random.sample(
            all_themes,
            min(num_themes, len(all_themes))
        )
        
        # Format response to match Socket.IO theme_selection event structure
        return {
            "success": True,
            "type": "theme_selection",
            "question": "Select a theme for the quiz:",
            "themes": selected_themes,
            "session_id": session_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start theme selection: {str(e)}")


@router.get("/v1/themes/random")
async def get_random_themes(count: int = 4):
    """
    Get random themes for selection
    """
    try:
        all_themes = ThemeRepository.get_active_themes() or ThemeRepository.get_all_themes()
        
        if not all_themes:
            raise HTTPException(status_code=404, detail="No themes available")
        
        selected = random.sample(all_themes, min(count, len(all_themes)))
        return {
            "success": True,
            "themes": selected
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch themes: {str(e)}")
