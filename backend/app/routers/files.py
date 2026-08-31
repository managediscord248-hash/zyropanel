import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import FileResponse as FastApiFileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Server, User
from app.schemas.schemas import FileItem, FileContentRequest, FileActionRequest
from app.middleware.auth import require_server_access, get_current_user
from app.services.file_service import file_service
from app.services.audit_service import audit_service
from app.utils.path_validator import resolve_safe_path

router = APIRouter(prefix="/servers/{server_id}/files", tags=["File Manager"])

@router.get("/list", response_model=List[FileItem])
def list_files(
    path: str = "",
    server: Server = Depends(require_server_access)
):
    return file_service.list_files(server.id, path)

@router.get("/read")
def read_file(
    path: str,
    server: Server = Depends(require_server_access)
):
    content = file_service.read_file(server.id, path)
    return {"path": path, "content": content}

@router.post("/write")
def write_file(
    payload: FileContentRequest,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_service.write_file(server.id, payload.path, payload.content)
    audit_service.log_event(
        db=db,
        action="EDIT_FILE",
        resource_type="FILE",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Edited file '{payload.path}' in server '{server.name}'"
    )
    return {"message": "File written successfully.", "path": payload.path}

@router.post("/directory")
def create_directory(
    payload: FileActionRequest,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_service.create_directory(server.id, payload.path)
    audit_service.log_event(
        db=db,
        action="CREATE_FOLDER",
        resource_type="FILE",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Created directory '{payload.path}' in server '{server.name}'"
    )
    return {"message": "Directory created successfully.", "path": payload.path}

@router.post("/rename")
def rename_item(
    payload: FileActionRequest,
    server: Server = Depends(require_server_access)
):
    if not payload.name:
        raise HTTPException(status_code=400, detail="New name must be provided.")
    file_service.rename_item(server.id, payload.path, payload.name)
    return {"message": "Renamed successfully."}

@router.post("/copy")
def copy_item(
    payload: FileActionRequest,
    server: Server = Depends(require_server_access)
):
    if not payload.new_path:
        raise HTTPException(status_code=400, detail="Destination path must be provided.")
    file_service.copy_item(server.id, payload.path, payload.new_path)
    return {"message": "Copied successfully."}

@router.delete("/delete")
def delete_item(
    path: str,
    request: Request,
    server: Server = Depends(require_server_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_service.delete_item(server.id, path)
    audit_service.log_event(
        db=db,
        action="DELETE_FILE",
        resource_type="FILE",
        user_id=current_user.id,
        resource_id=server.id,
        ip_address=request.client.host if request.client else None,
        details=f"Deleted file/folder '{path}' from server '{server.name}'"
    )
    return {"message": f"Successfully deleted {path}."}

@router.post("/upload")
async def upload_file(
    directory: str = Form(""),
    file: UploadFile = File(...),
    server: Server = Depends(require_server_access)
):
    saved_name = await file_service.save_uploaded_file(server.id, directory, file)
    return {"message": f"Uploaded {saved_name} successfully.", "filename": saved_name}

@router.get("/download")
def download_file(
    path: str,
    server: Server = Depends(require_server_access)
):
    full_path = resolve_safe_path(server.id, path)
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FastApiFileResponse(full_path, filename=os.path.basename(full_path))
