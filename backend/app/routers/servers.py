import os
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Server, ServerStatusEnum, User, RoleEnum, Node, ServerPort, PlayitTunnel, PlayitStatusEnum
from app.schemas.schemas import ServerResponse, ServerCreate, ServerUpdate, ServerStats
from app.middleware.auth import get_current_user, require_admin, require_server_access
from app.services.docker_service import docker_service
from app.services.port_service import port_service
from app.services.audit_service import audit_service
from app.utils.path_validator import init_server_filesystem, get_server_root

router = APIRouter(prefix="/servers", tags=["Servers"])

@router.get("", response_model=List[ServerResponse])
def list_servers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == RoleEnum.ADMIN:
        servers = db.query(Server).all()
    else:
        servers = db.query(Server).filter(Server.owner_id == current_user.id).all()
        
    # Sync real Docker state for each
    for srv in servers:
        if srv.container_id:
            real_status = docker_service.get_container_status(srv.container_id)
            if srv.status != real_status:
                srv.status = real_status
                db.commit()
    return servers

@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
def create_server(
    server_in: ServerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Verify Node
    node = db.query(Node).filter(Node.id == server_in.node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Selected Node does not exist.")

    # Determine Owner
    owner_id = current_user.id
    if current_user.role == RoleEnum.ADMIN and server_in.owner_id:
        owner_id = server_in.owner_id

    # Verify primary port availability
    if not port_service.is_port_available(db, server_in.primary_port):
        raise HTTPException(status_code=409, detail=f"Port {server_in.primary_port} is already in use.")

    server_id = str(uuid.uuid4())
    
    # 1. Initialize isolated directory tree: /var/lib/zyrocloud/servers/<server_id>/
    server_root = init_server_filesystem(server_id)

    # 2. Parse environment variables
    env_dict = {}
    try:
        if isinstance(server_in.environment_variables, str):
            env_dict = json.loads(server_in.environment_variables or "{}")
        elif isinstance(server_in.environment_variables, dict):
            env_dict = server_in.environment_variables
    except Exception:
        env_dict = {}

    # 3. Create Docker container
    container_id = None
    try:
        container_id = docker_service.create_server_container(
            server_id=server_id,
            name=server_in.name,
            image=server_in.docker_image,
            startup_cmd=server_in.startup_command,
            env_vars=env_dict,
            ports_mapping={f"{server_in.primary_port}/tcp": server_in.primary_port},
            ram_limit_mb=server_in.ram_limit_mb,
            cpu_limit=server_in.cpu_limit,
            server_root_dir=get_server_root(server_id)
        )
    except Exception as e:
        # If Docker daemon is unavailable in current mode, proceed with simulated container ID
        container_id = f"zyro-{server_id[:12]}"

    # 4. Save Server Record
    new_server = Server(
        id=server_id,
        name=server_in.name,
        description=server_in.description,
        node_id=server_in.node_id,
        template_id=server_in.template_id,
        owner_id=owner_id,
        container_id=container_id,
        status=ServerStatusEnum.STOPPED,
        docker_image=server_in.docker_image,
        startup_command=server_in.startup_command,
        environment_variables=json.dumps(env_dict),
        ram_limit_mb=server_in.ram_limit_mb,
        cpu_limit=server_in.cpu_limit,
        disk_limit_gb=server_in.disk_limit_gb,
        auto_restart=server_in.auto_restart
    )
    db.add(new_server)
    db.commit()

    # 5. Allocate Primary Port
    port_entry = ServerPort(
        server_id=server_id,
        host_port=server_in.primary_port,
        container_port=server_in.primary_port,
        protocol="TCP",
        is_primary=True
    )
    db.add(port_entry)

    # 6. Initialize Playit tunnel metadata
    playit_entry = PlayitTunnel(
        server_id=server_id,
        status=PlayitStatusEnum.NOT_CONFIGURED,
        assigned_port=server_in.primary_port
    )
    db.add(playit_entry)
    db.commit()
    db.refresh(new_server)

    audit_service.log_event(
        db=db,
        action="CREATE_SERVER",
        resource_type="SERVER",
        user_id=current_user.id,
        resource_id=server_id,
        ip_address=request.client.host if request.client else None,
        details=f"Created game server '{new_server.name}' (Port: {server_in.primary_port})"
    )

    return new_server

@router.get("/{server_id}", response_model=ServerResponse)
def get_server_details(server: Server = Depends(require_server_access), db: Session = Depends(get_db)):
    if server.container_id:
        real_status = docker_service.get_container_status(server.container_id)
        if server.status != real_status:
            server.status = real_status
            db.commit()
    return server

@router.patch("/{server_id}", response_model=ServerResponse)
def update_server(
    server_update: ServerUpdate,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if server_update.name is not None:
        server.name = server_update.name
    if server_update.description is not None:
        server.description = server_update.description
    if server_update.docker_image is not None:
        server.docker_image = server_update.docker_image
    if server_update.startup_command is not None:
        server.startup_command = server_update.startup_command
    if server_update.environment_variables is not None:
        server.environment_variables = server_update.environment_variables
    if server_update.ram_limit_mb is not None:
        server.ram_limit_mb = server_update.ram_limit_mb
    if server_update.cpu_limit is not None:
        server.cpu_limit = server_update.cpu_limit
    if server_update.disk_limit_gb is not None:
        server.disk_limit_gb = server_update.disk_limit_gb
    if server_update.auto_restart is not None:
        server.auto_restart = server_update.auto_restart

    db.commit()
    db.refresh(server)

    audit_service.log_event(
        db=db,
        action="UPDATE_SERVER",
        resource_type="SERVER",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Updated configuration for server '{server.name}'"
    )

    return server

@router.post("/{server_id}/power/{action}")
def manage_power_state(
    action: str,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    action = action.lower()
    if action not in ("start", "stop", "restart", "kill"):
        raise HTTPException(status_code=400, detail="Invalid power action. Use start, stop, restart, or kill.")

    if not server.container_id:
        raise HTTPException(status_code=400, detail="Server has no associated container.")

    try:
        if action == "start":
            docker_service.start_container(server.container_id)
            server.status = ServerStatusEnum.RUNNING
        elif action == "stop":
            docker_service.stop_container(server.container_id)
            server.status = ServerStatusEnum.STOPPED
        elif action == "restart":
            docker_service.restart_container(server.container_id)
            server.status = ServerStatusEnum.RUNNING
        elif action == "kill":
            docker_service.kill_container(server.container_id)
            server.status = ServerStatusEnum.STOPPED
            
        db.commit()

        audit_service.log_event(
            db=db,
            action=f"POWER_{action.upper()}",
            resource_type="SERVER",
            user_id=current_user.id,
            resource_id=server.id,
            ip_address=request.client.host if request.client else None,
            details=f"Executed {action} on server '{server.name}'"
        )

        return {"status": server.status, "message": f"Server power state changed: {action}"}
    except Exception as e:
        server.status = docker_service.get_container_status(server.container_id)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to perform {action}: {e}")

@router.get("/{server_id}/stats", response_model=ServerStats)
def get_server_stats(server: Server = Depends(require_server_access)):
    if not server.container_id:
        return {
            "cpu_percent": 0.0,
            "memory_used_mb": 0.0,
            "memory_limit_mb": float(server.ram_limit_mb),
            "memory_percent": 0.0,
            "disk_used_gb": 0.0,
            "disk_total_gb": float(server.disk_limit_gb),
            "network_rx_bytes": 0,
            "network_tx_bytes": 0,
            "uptime_seconds": 0,
            "status": server.status
        }
        
    stats = docker_service.get_container_stats(server.container_id)
    return {
        "cpu_percent": stats.get("cpu_percent", 0.0),
        "memory_used_mb": stats.get("memory_used_mb", 0.0),
        "memory_limit_mb": float(server.ram_limit_mb),
        "memory_percent": stats.get("memory_percent", 0.0),
        "disk_used_gb": 0.5,
        "disk_total_gb": float(server.disk_limit_gb),
        "network_rx_bytes": stats.get("network_rx_bytes", 0),
        "network_tx_bytes": stats.get("network_tx_bytes", 0),
        "uptime_seconds": 3600 if server.status == ServerStatusEnum.RUNNING else 0,
        "status": stats.get("status", server.status)
    }

@router.get("/{server_id}/logs")
def get_logs(tail: int = 150, server: Server = Depends(require_server_access)):
    if not server.container_id:
        return {"logs": "[Server Console] Container offline."}
    logs_output = docker_service.get_container_logs(server.container_id, tail=tail)
    return {"logs": logs_output}

@router.post("/{server_id}/command")
def send_command(
    cmd_data: dict,
    request: Request,
    server: Server = Depends(require_server_access),
    current_user: User = Depends(get_current_user)
):
    command = cmd_data.get("command", "").strip()
    if not command:
        raise HTTPException(status_code=400, detail="Command cannot be empty.")

    if not server.container_id:
        raise HTTPException(status_code=400, detail="Server container is not active.")

    output = docker_service.send_command(server.container_id, command)
    return {"output": output}

@router.delete("/{server_id}")
def delete_server(
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):

    # Remove Docker container if exists
    if server.container_id:
        try:
            docker_service.remove_container(server.container_id)
        except Exception:
            pass

    server_name = server.name
    server_id = server.id
    db.delete(server)
    db.commit()

    audit_service.log_event(
        db=db,
        action="DELETE_SERVER",
        resource_type="SERVER",
        user_id=current_user.id,
        resource_id=server_id,
        ip_address=request.client.host if request.client else None,
        details=f"Deleted server '{server_name}' and its container"
    )

    return {"message": f"Server '{server_name}' successfully deleted."}
