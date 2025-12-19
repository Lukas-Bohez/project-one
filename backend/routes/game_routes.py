"""
Kingdom Quarry Game Routes
Handles game saves, resources, upgrades, and items
"""

from fastapi import APIRouter, HTTPException, Request, Depends, Header
from typing import Optional, List
import json

from database.datarepository import (
    GameSaveRepository, GameResourcesRepository, GameUpgradesRepository,
    ItemRepository, PlayerItemRepository
)

router = APIRouter(prefix="/api", tags=["Kingdom Quarry Game"])


# Item Routes
@router.get("/v1/items")
async def get_all_items():
    """Get all available items"""
    try:
        items = ItemRepository.get_all_items()
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/player/{user_id}/items")
async def get_player_items(user_id: int):
    """Get items owned by a player"""
    try:
        items = PlayerItemRepository.get_player_items(user_id)
        return {"success": True, "user_id": user_id, "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/player/{user_id}/items/{item_id}/use")
async def use_player_item(user_id: int, item_id: int):
    """Use an item from player inventory"""
    try:
        # Check if player owns the item
        player_item = PlayerItemRepository.get_player_item(user_id, item_id)
        if not player_item:
            raise HTTPException(status_code=404, detail="Item not found in inventory")
        
        # Check quantity
        if player_item.get('quantity', 0) <= 0:
            raise HTTPException(status_code=400, detail="Item quantity is 0")
        
        # Use item (decrement quantity)
        PlayerItemRepository.use_item(user_id, item_id)
        
        return {
            "message": "Item used successfully",
            "remaining": player_item.get('quantity', 1) - 1
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Game Save Routes
@router.get("/game/saves/{user_id}")
async def get_game_saves(user_id: int):
    """Get all game saves for a user"""
    try:
        saves = GameSaveRepository.get_user_saves(user_id)
        return {"user_id": user_id, "saves": saves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/game/save/{save_id}")
async def get_game_save(save_id: int):
    """Get a specific game save"""
    try:
        save = GameSaveRepository.get_save_by_id(save_id)
        if not save:
            raise HTTPException(status_code=404, detail="Save not found")
        return save
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/game/save")
async def create_game_save(
    user_id: int,
    save_name: str,
    save_data: dict,
    request: Request
):
    """Create a new game save"""
    try:
        save_id = GameSaveRepository.create_save(
            user_id=user_id,
            save_name=save_name,
            save_data=json.dumps(save_data)
        )
        
        return {
            "message": "Game saved successfully",
            "save_id": save_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/game/save/{save_id}")
async def update_game_save(
    save_id: int,
    save_data: dict,
    request: Request
):
    """Update an existing game save"""
    try:
        GameSaveRepository.update_save(
            save_id=save_id,
            save_data=json.dumps(save_data)
        )
        
        return {"message": "Game save updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/game/save/{save_id}")
async def delete_game_save(save_id: int, request: Request):
    """Delete a game save"""
    try:
        GameSaveRepository.delete_save(save_id)
        return {"message": "Game save deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Game Resources Routes
@router.get("/game/resources/{user_id}")
async def get_player_resources(user_id: int):
    """Get player's resources"""
    try:
        resources = GameResourcesRepository.get_user_resources(user_id)
        return {"user_id": user_id, "resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/game/resources/{user_id}/update")
async def update_player_resources(
    user_id: int,
    resource_type: str,
    amount: int,
    operation: str = "add"  # add, subtract, set
):
    """Update player's resources"""
    try:
        if operation == "add":
            GameResourcesRepository.add_resource(user_id, resource_type, amount)
        elif operation == "subtract":
            GameResourcesRepository.subtract_resource(user_id, resource_type, amount)
        elif operation == "set":
            GameResourcesRepository.set_resource(user_id, resource_type, amount)
        else:
            raise HTTPException(status_code=400, detail="Invalid operation")
        
        return {"message": "Resources updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Game Upgrades Routes
@router.get("/game/upgrades/{user_id}")
async def get_player_upgrades(user_id: int):
    """Get player's upgrades"""
    try:
        upgrades = GameUpgradesRepository.get_user_upgrades(user_id)
        return {"user_id": user_id, "upgrades": upgrades}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/game/upgrades/{user_id}/unlock")
async def unlock_upgrade(
    user_id: int,
    upgrade_id: int,
    request: Request
):
    """Unlock an upgrade for a player"""
    try:
        GameUpgradesRepository.unlock_upgrade(user_id, upgrade_id)
        return {"message": "Upgrade unlocked successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/game/status")
async def get_game_status():
    """Check if game features are available"""
    # Check if JWT is available for game auth
    try:
        import jwt
        JWT_AVAILABLE = True
    except ImportError:
        JWT_AVAILABLE = False
    
    return {
        "game_available": JWT_AVAILABLE,
        "message": "Kingdom Quarry game endpoints available" if JWT_AVAILABLE else "Install PyJWT to enable Kingdom Quarry game features"
    }
