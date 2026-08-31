import asyncio
import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger("zyrocloud.ws")

class WebSocketManager:
    def __init__(self):
        # Map server_id -> set of active WebSockets
        self.console_connections: Dict[str, Set[WebSocket]] = {}
        self.playit_connections: Dict[str, Set[WebSocket]] = {}

    async def connect_console(self, server_id: str, websocket: WebSocket):
        await websocket.accept()
        if server_id not in self.console_connections:
            self.console_connections[server_id] = set()
        self.console_connections[server_id].add(websocket)

    def disconnect_console(self, server_id: str, websocket: WebSocket):
        if server_id in self.console_connections:
            self.console_connections[server_id].discard(websocket)
            if not self.console_connections[server_id]:
                del self.console_connections[server_id]

    async def broadcast_console(self, server_id: str, message: str):
        if server_id in self.console_connections:
            dead_sockets = set()
            for ws in self.console_connections[server_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.console_connections[server_id].discard(ws)

    async def connect_playit(self, server_id: str, websocket: WebSocket):
        await websocket.accept()
        if server_id not in self.playit_connections:
            self.playit_connections[server_id] = set()
        self.playit_connections[server_id].add(websocket)

    def disconnect_playit(self, server_id: str, websocket: WebSocket):
        if server_id in self.playit_connections:
            self.playit_connections[server_id].discard(websocket)
            if not self.playit_connections[server_id]:
                del self.playit_connections[server_id]

    async def broadcast_playit(self, server_id: str, message: str):
        if server_id in self.playit_connections:
            dead_sockets = set()
            for ws in self.playit_connections[server_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.playit_connections[server_id].discard(ws)

ws_manager = WebSocketManager()
