"""
WebSocket Integration for Manage the Spire
Real-time updates for shifts, time-off requests, and business events
"""

import json
from typing import Dict, List, Set
from datetime import datetime
from fastapi import WebSocket
import logging

logger = logging.getLogger('manage_the_spire')

# Track active connections per business
class ConnectionManager:
    def __init__(self):
        # Format: {business_id: {user_id: [websocket, websocket, ...]}}
        self.active_connections: Dict[int, Dict[int, List[WebSocket]]] = {}
        self.user_roles: Dict[int, str] = {}  # user_id -> role
    
    async def connect(self, business_id: int, user_id: int, websocket: WebSocket):
        """Register a new WebSocket connection"""
        await websocket.accept()
        
        if business_id not in self.active_connections:
            self.active_connections[business_id] = {}
        
        if user_id not in self.active_connections[business_id]:
            self.active_connections[business_id][user_id] = []
        
        self.active_connections[business_id][user_id].append(websocket)
        logger.info(f"User {user_id} connected to business {business_id}")
    
    async def disconnect(self, business_id: int, user_id: int, websocket: WebSocket):
        """Unregister a WebSocket connection"""
        if business_id in self.active_connections:
            if user_id in self.active_connections[business_id]:
                self.active_connections[business_id][user_id].remove(websocket)
                
                # Clean up empty entries
                if not self.active_connections[business_id][user_id]:
                    del self.active_connections[business_id][user_id]
                
                if not self.active_connections[business_id]:
                    del self.active_connections[business_id]
        
        logger.info(f"User {user_id} disconnected from business {business_id}")
    
    async def broadcast_to_business(self, business_id: int, message: dict):
        """Broadcast message to all users in a business"""
        if business_id not in self.active_connections:
            return
        
        message['timestamp'] = datetime.utcnow().isoformat()
        message_json = json.dumps(message)
        
        disconnected_users = []
        
        for user_id, websockets in self.active_connections[business_id].items():
            for websocket in websockets:
                try:
                    await websocket.send_text(message_json)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    disconnected_users.append((user_id, websocket))
        
        # Clean up disconnected websockets
        for user_id, websocket in disconnected_users:
            await self.disconnect(business_id, user_id, websocket)
    
    async def send_to_user(self, business_id: int, user_id: int, message: dict):
        """Send message to a specific user in a business"""
        if business_id not in self.active_connections:
            return
        
        if user_id not in self.active_connections[business_id]:
            return
        
        message['timestamp'] = datetime.utcnow().isoformat()
        message_json = json.dumps(message)
        
        websockets_to_remove = []
        
        for websocket in self.active_connections[business_id][user_id]:
            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                websockets_to_remove.append(websocket)
        
        # Clean up disconnected websockets
        for websocket in websockets_to_remove:
            await self.disconnect(business_id, user_id, websocket)


# Global connection manager
manager = ConnectionManager()


# Event Broadcasting Functions

async def broadcast_shift_created(business_id: int, shift: dict):
    """Broadcast when a new shift is created"""
    await manager.broadcast_to_business(business_id, {
        "type": "shift_created",
        "action": "new_shift",
        "data": shift,
        "message": f"New shift created: {shift.get('employee_name')} on {shift.get('shift_date')}"
    })


async def broadcast_shift_updated(business_id: int, shift: dict):
    """Broadcast when a shift is updated"""
    await manager.broadcast_to_business(business_id, {
        "type": "shift_updated",
        "action": "shift_changed",
        "data": shift,
        "message": f"Shift updated: {shift.get('employee_name')}"
    })


async def broadcast_shift_deleted(business_id: int, shift_id: int, employee_name: str):
    """Broadcast when a shift is deleted"""
    await manager.broadcast_to_business(business_id, {
        "type": "shift_deleted",
        "action": "shift_removed",
        "shift_id": shift_id,
        "message": f"Shift deleted for {employee_name}"
    })


async def broadcast_time_off_requested(business_id: int, request: dict):
    """Broadcast when time-off is requested"""
    await manager.broadcast_to_business(business_id, {
        "type": "time_off_requested",
        "action": "new_request",
        "data": request,
        "message": f"{request.get('employee_name')} requested time off"
    })


async def broadcast_time_off_reviewed(business_id: int, request: dict, approved: bool):
    """Broadcast when time-off request is reviewed"""
    status = "approved" if approved else "denied"
    await manager.broadcast_to_business(business_id, {
        "type": "time_off_reviewed",
        "action": "request_reviewed",
        "data": request,
        "status": status,
        "message": f"Time-off request {status}: {request.get('employee_name')}"
    })


async def send_notification_to_manager(business_id: int, manager_user_id: int, notification: dict):
    """Send a notification to a specific manager"""
    notification['type'] = 'notification'
    await manager.send_to_user(business_id, manager_user_id, notification)


# WebSocket Event Handlers

async def handle_websocket_message(business_id: int, user_id: int, data: dict):
    """Handle incoming WebSocket messages"""
    message_type = data.get('type')
    
    if message_type == 'ping':
        # Simple ping/pong for connection health
        await manager.send_to_user(business_id, user_id, {
            "type": "pong",
            "message": "Connection healthy"
        })
    
    elif message_type == 'subscribe':
        # User wants to subscribe to specific updates
        logger.info(f"User {user_id} subscribed to: {data.get('channels')}")
    
    elif message_type == 'unsubscribe':
        # User wants to unsubscribe from updates
        logger.info(f"User {user_id} unsubscribed from: {data.get('channels')}")
    
    else:
        logger.warning(f"Unknown message type: {message_type}")
