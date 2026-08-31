from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Server, PlayitTunnel, PlayitStatusEnum, User
from app.schemas.schemas import PlayitTunnelResponse, PlayitConfigRequest
from app.middleware.auth import require_server_access, get_current_user
from app.services.playit_service import playit_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/servers/{server_id}/playit", tags=["Playit Tunnel"])

@router.get("/status", response_model=PlayitTunnelResponse)
def get_playit_status(
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db)
):
    tunnel = db.query(PlayitTunnel).filter(PlayitTunnel.server_id == server.id).first()
    if not tunnel:
        tunnel = PlayitTunnel(server_id=server.id, status=PlayitStatusEnum.NOT_CONFIGURED)
        db.add(tunnel)
        db.commit()
        db.refresh(tunnel)

    # Sync real process state
    real_state = playit_service.get_tunnel_status(server.id, tunnel.id)
    tunnel.status = real_state.get("status", tunnel.status)
    tunnel.process_pid = real_state.get("pid")
    if real_state.get("tunnel_address"):
        tunnel.tunnel_address = real_state.get("tunnel_address")
    if real_state.get("claim_code"):
        tunnel.claim_code = real_state.get("claim_code")
    db.commit()

    return tunnel

@router.post("/start")
def start_playit_tunnel(
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tunnel = db.query(PlayitTunnel).filter(PlayitTunnel.server_id == server.id).first()
    if not tunnel:
        tunnel = PlayitTunnel(server_id=server.id, status=PlayitStatusEnum.STARTING)
        db.add(tunnel)
        db.commit()
        db.refresh(tunnel)

    result = playit_service.start_tunnel(server.id, tunnel.id)
    tunnel.status = result.get("status", PlayitStatusEnum.STARTING)
    tunnel.process_pid = result.get("pid")
    db.commit()

    audit_service.log_event(
        db=db,
        action="PLAYIT_START",
        resource_type="PLAYIT",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Started Playit tunnel process for server '{server.name}' (PID: {tunnel.process_pid})"
    )

    return result

@router.post("/stop")
def stop_playit_tunnel(
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tunnel = db.query(PlayitTunnel).filter(PlayitTunnel.server_id == server.id).first()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Playit tunnel record not found.")

    result = playit_service.stop_tunnel(server.id, tunnel.id)
    tunnel.status = PlayitStatusEnum.STOPPED
    tunnel.process_pid = None
    db.commit()

    audit_service.log_event(
        db=db,
        action="PLAYIT_STOP",
        resource_type="PLAYIT",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Stopped Playit tunnel for server '{server.name}'"
    )

    return result

@router.post("/restart")
def restart_playit_tunnel(
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tunnel = db.query(PlayitTunnel).filter(PlayitTunnel.server_id == server.id).first()
    if not tunnel:
        raise HTTPException(status_code=404, detail="Playit tunnel record not found.")

    playit_service.stop_tunnel(server.id, tunnel.id)
    result = playit_service.start_tunnel(server.id, tunnel.id)
    tunnel.status = result.get("status", PlayitStatusEnum.STARTING)
    tunnel.process_pid = result.get("pid")
    db.commit()

    audit_service.log_event(
        db=db,
        action="PLAYIT_RESTART",
        resource_type="PLAYIT",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Restarted Playit tunnel for server '{server.name}'"
    )

    return result

@router.get("/logs")
def get_playit_logs(
    tail: int = 100,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db)
):
    tunnel = db.query(PlayitTunnel).filter(PlayitTunnel.server_id == server.id).first()
    if not tunnel:
        return {"logs": "[Playit Terminal] No active tunnel."}
    logs_output = playit_service.get_logs(server.id, tunnel.id, tail=tail)
    return {"logs": logs_output}
