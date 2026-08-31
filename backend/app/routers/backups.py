from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Server, Backup, User
from app.schemas.schemas import BackupResponse, BackupCreate
from app.middleware.auth import require_server_access, get_current_user
from app.services.backup_service import backup_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/servers/{server_id}/backups", tags=["Backups"])

@router.get("", response_model=List[BackupResponse])
def list_backups(
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db)
):
    return db.query(Backup).filter(Backup.server_id == server.id).order_by(Backup.created_at.desc()).all()

@router.post("", response_model=BackupResponse, status_code=status.HTTP_201_CREATED)
def create_backup(
    backup_in: BackupCreate,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backup_meta = backup_service.create_backup(server.id, backup_in.name)
    
    new_backup = Backup(
        id=backup_meta["id"],
        server_id=server.id,
        name=backup_meta["name"],
        file_path=backup_meta["file_path"],
        size_bytes=backup_meta["size_bytes"],
        is_successful=backup_meta["is_successful"]
    )
    db.add(new_backup)
    db.commit()
    db.refresh(new_backup)

    audit_service.log_event(
        db=db,
        action="CREATE_BACKUP",
        resource_type="BACKUP",
        user_id=current_user.id,
        resource_id=new_backup.id,
        ip_address=request.client.host if request.client else None,
        details=f"Created backup '{new_backup.name}' for server '{server.name}' ({new_backup.size_bytes} bytes)"
    )

    return new_backup

@router.post("/{backup_id}/restore")
def restore_backup(
    backup_id: str,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backup = db.query(Backup).filter(Backup.id == backup_id, Backup.server_id == server.id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup record not found.")

    backup_service.restore_backup(server.id, backup.file_path)

    audit_service.log_event(
        db=db,
        action="RESTORE_BACKUP",
        resource_type="BACKUP",
        user_id=current_user.id,
        resource_id=backup_id,
        ip_address=request.client.host if request.client else None,
        details=f"Restored backup '{backup.name}' on server '{server.name}'"
    )

    return {"message": f"Backup '{backup.name}' restored successfully."}

@router.delete("/{backup_id}")
def delete_backup(
    backup_id: str,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backup = db.query(Backup).filter(Backup.id == backup_id, Backup.server_id == server.id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup record not found.")

    backup_service.delete_backup(server.id, backup.file_path)
    b_name = backup.name
    db.delete(backup)
    db.commit()

    audit_service.log_event(
        db=db,
        action="DELETE_BACKUP",
        resource_type="BACKUP",
        user_id=current_user.id,
        resource_id=backup_id,
        ip_address=request.client.host if request.client else None,
        details=f"Deleted backup '{b_name}' for server '{server.name}'"
    )

    return {"message": f"Backup '{b_name}' deleted."}
