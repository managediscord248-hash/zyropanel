import os
import tarfile
import shutil
import uuid
from datetime import datetime
from typing import List, Dict, Any
from fastapi import HTTPException, status
from app.config import settings
from app.utils.path_validator import resolve_safe_path

class BackupService:
    def get_backup_dir(self, server_id: str) -> str:
        backup_dir = os.path.join(settings.BACKUPS_DIRECTORY, server_id)
        os.makedirs(backup_dir, mode=0o750, exist_ok=True)
        return backup_dir

    def create_backup(self, server_id: str, backup_name: str) -> Dict[str, Any]:
        server_root = resolve_safe_path(server_id, "")
        backup_dir = self.get_backup_dir(server_id)
        
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c for c in backup_name if c.isalnum() or c in ("-", "_")).strip()
        if not safe_name:
            safe_name = f"backup_{timestamp_str}"
            
        filename = f"{safe_name}_{timestamp_str}.tar.gz"
        archive_path = os.path.join(backup_dir, filename)

        try:
            with tarfile.open(archive_path, "w:gz") as tar:
                # Add data, config, metadata directories
                for item in ["data", "config", "metadata"]:
                    item_path = os.path.join(server_root, item)
                    if os.path.exists(item_path):
                        tar.add(item_path, arcname=item)

            size_bytes = os.path.getsize(archive_path)
            return {
                "id": str(uuid.uuid4()),
                "name": backup_name,
                "file_path": archive_path,
                "size_bytes": size_bytes,
                "is_successful": True,
                "created_at": datetime.utcnow()
            }
        except Exception as e:
            if os.path.exists(archive_path):
                os.remove(archive_path)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Backup creation failed: {e}")

    def restore_backup(self, server_id: str, backup_file_path: str) -> bool:
        backup_dir = os.path.abspath(self.get_backup_dir(server_id))
        clean_backup_path = os.path.abspath(backup_file_path)
        
        # Ensure backup path is within the server's backup directory
        if clean_backup_path != backup_dir and not clean_backup_path.startswith(backup_dir + os.sep):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized backup file path")

        if not os.path.exists(clean_backup_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup archive not found")

        server_root = resolve_safe_path(server_id, "")
        try:
            # Extract tar safely
            with tarfile.open(clean_backup_path, "r:gz") as tar:
                # Safe extract checking paths against path traversal
                for member in tar.getmembers():
                    target_member_path = os.path.abspath(os.path.join(server_root, member.name))
                    if target_member_path != server_root and not target_member_path.startswith(server_root + os.sep):
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malicious path detected in archive")
                    if member.issym() or member.islnk():
                        link_target = os.path.abspath(os.path.join(os.path.dirname(target_member_path), member.linkname))
                        if link_target != server_root and not link_target.startswith(server_root + os.sep):
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dangerous link target detected in archive")
                tar.extractall(path=server_root)
            return True
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Backup restore failed: {e}")

    def delete_backup(self, server_id: str, backup_file_path: str) -> bool:
        backup_dir = os.path.abspath(self.get_backup_dir(server_id))
        clean_backup_path = os.path.abspath(backup_file_path)
        if clean_backup_path != backup_dir and not clean_backup_path.startswith(backup_dir + os.sep):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized backup path")

        if os.path.exists(clean_backup_path):
            os.remove(clean_backup_path)
            return True
        return False

backup_service = BackupService()
