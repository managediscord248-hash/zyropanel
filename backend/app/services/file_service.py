import os
import shutil
import stat
from datetime import datetime
from typing import List
from fastapi import HTTPException, UploadFile, status
from app.schemas.schemas import FileItem
from app.utils.path_validator import resolve_safe_path

class FileService:
    def list_files(self, server_id: str, relative_path: str = "") -> List[FileItem]:
        target_dir = resolve_safe_path(server_id, relative_path)
        if not os.path.exists(target_dir) or not os.path.isdir(target_dir):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Directory not found")

        items = []
        with os.scandir(target_dir) as entries:
            for entry in entries:
                try:
                    st = entry.stat(follow_symlinks=False)
                    is_dir = entry.is_dir(follow_symlinks=False)
                    ext = None if is_dir else os.path.splitext(entry.name)[1].lstrip(".").lower()
                    perm_str = stat.filemode(st.st_mode)
                    
                    # compute relative path for UI
                    clean_rel = os.path.relpath(entry.path, resolve_safe_path(server_id, ""))
                    if clean_rel == ".":
                        clean_rel = ""
                        
                    items.append(FileItem(
                        name=entry.name,
                        path=clean_rel,
                        is_directory=is_dir,
                        size=0 if is_dir else st.st_size,
                        modified_at=datetime.fromtimestamp(st.st_mtime),
                        permissions=perm_str,
                        extension=ext
                    ))
                except (PermissionError, FileNotFoundError):
                    continue
        
        # Sort directories first, then alphabetically
        items.sort(key=lambda x: (not x.is_directory, x.name.lower()))
        return items

    def read_file(self, server_id: str, relative_path: str) -> str:
        target_file = resolve_safe_path(server_id, relative_path)
        if not os.path.exists(target_file) or os.path.isdir(target_file):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        
        # File size sanity limit for editor (5MB)
        if os.path.getsize(target_file) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File is too large for online editor (max 5MB). Please download instead."
            )

        try:
            with open(target_file, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Cannot read file: {e}")

    def write_file(self, server_id: str, relative_path: str, content: str) -> bool:
        target_file = resolve_safe_path(server_id, relative_path)
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        try:
            with open(target_file, "w", encoding="utf-8") as f:
                f.write(content)
            return True
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed writing file: {e}")

    def create_directory(self, server_id: str, relative_path: str) -> bool:
        target_dir = resolve_safe_path(server_id, relative_path)
        if os.path.exists(target_dir):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Directory already exists")
        try:
            os.makedirs(target_dir, mode=0o750, exist_ok=True)
            return True
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Directory creation failed: {e}")

    def delete_item(self, server_id: str, relative_path: str) -> bool:
        target_path = resolve_safe_path(server_id, relative_path)
        root = resolve_safe_path(server_id, "")
        if target_path == root:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete server root directory")
            
        if not os.path.exists(target_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
        try:
            if os.path.isdir(target_path):
                shutil.rmtree(target_path)
            else:
                os.remove(target_path)
            return True
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Delete failed: {e}")

    def rename_item(self, server_id: str, old_relative: str, new_name: str) -> bool:
        src = resolve_safe_path(server_id, old_relative)
        if not os.path.exists(src):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found")
        
        # New destination in same parent
        parent = os.path.dirname(src)
        clean_new_name = os.path.basename(new_name.strip())
        dst = os.path.join(parent, clean_new_name)
        
        # Validate dst
        resolve_safe_path(server_id, os.path.relpath(dst, resolve_safe_path(server_id, "")))
        
        if os.path.exists(dst):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A file or folder with that name already exists")
        try:
            shutil.move(src, dst)
            return True
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Rename failed: {e}")

    def copy_item(self, server_id: str, src_rel: str, dst_rel: str) -> bool:
        src = resolve_safe_path(server_id, src_rel)
        dst = resolve_safe_path(server_id, dst_rel)
        if not os.path.exists(src):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
        try:
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
            return True
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Copy failed: {e}")

    async def save_uploaded_file(self, server_id: str, relative_dir: str, upload_file: UploadFile) -> str:
        target_dir = resolve_safe_path(server_id, relative_dir)
        os.makedirs(target_dir, exist_ok=True)
        safe_filename = os.path.basename(upload_file.filename or "upload.bin")
        file_path = resolve_safe_path(server_id, os.path.join(relative_dir, safe_filename))
        
        with open(file_path, "wb") as buffer:
            while chunk := await upload_file.read(1024 * 1024):
                buffer.write(chunk)
        return safe_filename

file_service = FileService()
