import os
import json
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models.models import User, RoleEnum, Node, NodeStatusEnum, Template, Setting
from app.utils.security import get_password_hash
from app.websocket.manager import ws_manager
from app.services.docker_service import docker_service
from app.services.playit_service import playit_service

# Routers
from app.routers import auth, users, servers, nodes, backups, templates, settings as settings_router, playit, files, audit, health

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zyrocloud")

def init_database():
    """Initializes tables and seeds default admin, node, and game templates."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed Admin User
        admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not admin:
            logger.info(f"Bootstrapping default admin user '{settings.ADMIN_USERNAME}'...")
            admin = User(
                username=settings.ADMIN_USERNAME,
                email=settings.ADMIN_EMAIL,
                password_hash=get_password_hash(settings.ADMIN_PASSWORD),
                role=RoleEnum.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()

        # 2. Seed Default Local Node
        local_node = db.query(Node).filter(Node.name == "Local Node (Master)").first()
        if not local_node:
            local_node = Node(
                name="Local Node (Master)",
                ip_address="127.0.0.1",
                daemon_port=8000,
                auth_token="master_local_token",
                status=NodeStatusEnum.ONLINE,
                cpu_cores=4,
                total_memory_mb=8192,
                total_disk_gb=120,
                docker_version="24.0.7"
            )
            db.add(local_node)
            db.commit()

        # 3. Seed Game Server Templates
        default_templates = [
            {
                "name": "Minecraft: Paper (High Performance)",
                "game": "Minecraft",
                "description": "High-performance PaperMC Minecraft server with plugin support and low memory overhead.",
                "docker_image": "itzg/minecraft-server:latest",
                "default_port": 25565,
                "default_ram_mb": 2048,
                "default_cpu_limit": 2.0,
                "startup_command": "java -Xms1G -Xmx2G -jar paper.jar nogui",
                "environment_variables": json.dumps({"TYPE": "PAPER", "EULA": "TRUE", "VERSION": "1.20.4", "MEMORY": "2G"}),
            },
            {
                "name": "Minecraft: Vanilla",
                "game": "Minecraft",
                "description": "Official Mojang Minecraft Java Edition server.",
                "docker_image": "itzg/minecraft-server:latest",
                "default_port": 25565,
                "default_ram_mb": 2048,
                "default_cpu_limit": 2.0,
                "startup_command": "java -Xms1G -Xmx2G -jar server.jar nogui",
                "environment_variables": json.dumps({"TYPE": "VANILLA", "EULA": "TRUE", "VERSION": "LATEST"}),
            },
            {
                "name": "Minecraft: Fabric Modded",
                "game": "Minecraft",
                "description": "Lightweight and modular Fabric modded Minecraft server environment.",
                "docker_image": "itzg/minecraft-server:latest",
                "default_port": 25565,
                "default_ram_mb": 4096,
                "default_cpu_limit": 3.0,
                "startup_command": "java -Xms2G -Xmx4G -jar fabric-server-launch.jar nogui",
                "environment_variables": json.dumps({"TYPE": "FABRIC", "EULA": "TRUE", "VERSION": "1.20.4", "MEMORY": "4G"}),
            },
            {
                "name": "Terraria (tShock Dedicated)",
                "game": "Terraria",
                "description": "Dedicated Terraria multiplayer server with tShock admin commands and security.",
                "docker_image": "ryshe/terraria:latest",
                "default_port": 7777,
                "default_ram_mb": 1024,
                "default_cpu_limit": 1.5,
                "startup_command": "./TerrariaServer.bin.x86_64 -config serverconfig.txt",
                "environment_variables": json.dumps({"WORLD_NAME": "ZyroTerraria", "AUTOCREATE": "2"}),
            },
            {
                "name": "Rust Dedicated Server",
                "game": "Rust",
                "description": "High-intensity multiplayer survival Rust dedicated server.",
                "docker_image": "didstopia/rust-server:latest",
                "default_port": 28015,
                "default_ram_mb": 8192,
                "default_cpu_limit": 4.0,
                "startup_command": "./RustDedicated -batchmode +server.port 28015 +server.maxplayers 50",
                "environment_variables": json.dumps({"RUST_SERVER_NAME": "ZyroCloud Rust Server", "RUST_MAXPLAYERS": "50"}),
            },
            {
                "name": "Node.js Discord/Game Bot",
                "game": "Application",
                "description": "Lightweight Node.js 20 environment for Discord bot orchestration and automation scripts.",
                "docker_image": "node:20-alpine",
                "default_port": 8080,
                "default_ram_mb": 512,
                "default_cpu_limit": 1.0,
                "startup_command": "npm start",
                "environment_variables": json.dumps({"NODE_ENV": "production"}),
            }
        ]

        for tmpl_data in default_templates:
            existing = db.query(Template).filter(Template.name == tmpl_data["name"]).first()
            if not existing:
                tmpl = Template(**tmpl_data)
                db.add(tmpl)
        db.commit()

    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(users.router, prefix=settings.API_PREFIX)
app.include_router(servers.router, prefix=settings.API_PREFIX)
app.include_router(nodes.router, prefix=settings.API_PREFIX)
app.include_router(backups.router, prefix=settings.API_PREFIX)
app.include_router(templates.router, prefix=settings.API_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_PREFIX)
app.include_router(playit.router, prefix=settings.API_PREFIX)
app.include_router(files.router, prefix=settings.API_PREFIX)
app.include_router(audit.router, prefix=settings.API_PREFIX)
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(health.router) # Root /health

from app.utils.security import decode_access_token
from app.models.models import Server

# WebSockets for Real-time Console Streaming
@app.websocket("/ws/console/{server_id}")
async def websocket_console_endpoint(websocket: WebSocket, server_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Authentication token required")
        return
        
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4003, reason="Invalid or expired token")
        return
        
    user_id = payload.get("sub")
    user_role = payload.get("role")
    
    # Check server access permission
    db = SessionLocal()
    try:
        server = db.query(Server).filter(Server.id == server_id).first()
        if not server:
            await websocket.close(code=4004, reason="Server not found")
            return
        if user_role != RoleEnum.ADMIN.value and server.owner_id != user_id:
            await websocket.close(code=4003, reason="Unauthorized access to server")
            return
    finally:
        db.close()

    await ws_manager.connect_console(server_id, websocket)
    try:
        # Stream initial logs
        init_logs = docker_service.get_container_logs(server_id, tail=100)
        await websocket.send_text(json.dumps({"type": "logs", "data": init_logs}))
        
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "command":
                    cmd = msg.get("command", "")
                    output = docker_service.send_command(server_id, cmd)
                    await websocket.send_text(json.dumps({"type": "output", "data": output}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect_console(server_id, websocket)

# WebSockets for Real-time Playit Terminal
@app.websocket("/ws/playit/{server_id}")
async def websocket_playit_endpoint(websocket: WebSocket, server_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Authentication token required")
        return
        
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4003, reason="Invalid or expired token")
        return
        
    user_id = payload.get("sub")
    user_role = payload.get("role")
    
    db = SessionLocal()
    try:
        server = db.query(Server).filter(Server.id == server_id).first()
        if not server:
            await websocket.close(code=4004, reason="Server not found")
            return
        if user_role != RoleEnum.ADMIN.value and server.owner_id != user_id:
            await websocket.close(code=4003, reason="Unauthorized access to server")
            return
    finally:
        db.close()

    await ws_manager.connect_playit(server_id, websocket)
    try:
        while True:
            # Poll status and log updates
            status_data = playit_service.get_tunnel_status(server_id, "default")
            logs_data = playit_service.get_logs(server_id, "default", tail=50)
            await websocket.send_text(json.dumps({
                "type": "playit_update",
                "status": status_data,
                "logs": logs_data
            }))
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        ws_manager.disconnect_playit(server_id, websocket)
