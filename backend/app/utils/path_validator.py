import os
from fastapi import HTTPException, status
from app.config import settings

def get_server_root(server_id: str) -> str:
    """Returns the immutable root directory path for a server."""
    base_dir = os.path.abspath(settings.SERVERS_DIRECTORY)
    clean_id = os.path.basename(server_id.strip())
    if not clean_id or clean_id in (".", ".."):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid server identifier specified."
        )
    server_dir = os.path.abspath(os.path.join(base_dir, clean_id))
    
    # Ensure server dir stays strictly inside the servers directory
    if server_dir != base_dir and not server_dir.startswith(base_dir + os.sep):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid server identifier specified."
        )
    return server_dir

def get_server_data_root(server_id: str) -> str:
    """Returns the isolated game data directory for a server."""
    server_root = get_server_root(server_id)
    data_dir = os.path.abspath(os.path.join(server_root, "data"))
    os.makedirs(data_dir, mode=0o750, exist_ok=True)
    return data_dir

def resolve_safe_path(server_id: str, relative_path: str = "") -> str:
    """
    Strictly resolves and validates a filesystem path within a server's isolated data directory.
    Prevents path traversal (../), null byte injection, and symlink escapes.
    File Manager operations MUST NOT access server internal dirs (config, runtime, logs, backups, tmp).
    """
    data_root = get_server_data_root(server_id)
    
    # Strip dangerous characters and clean path
    cleaned = relative_path.replace("\x00", "").strip()
    if cleaned.startswith("/"):
        cleaned = cleaned.lstrip("/")
        
    target_path = os.path.abspath(os.path.join(data_root, cleaned))
    
    # Verification 1: Must be equal to or inside data root
    if target_path != data_root and not target_path.startswith(data_root + os.sep):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Path traversal detected. Target is outside server data boundary."
        )
    
    # Verification 2: Check realpath for symlink escapes
    if os.path.exists(target_path):
        real_target = os.path.realpath(target_path)
        real_root = os.path.realpath(data_root)
        if real_target != real_root and not real_target.startswith(real_root + os.sep):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Symlink escape detected."
            )
            
    return target_path

def init_server_filesystem(server_id: str) -> dict:
    """Provisions the isolated subdirectory tree required for every server."""
    root = get_server_root(server_id)
    subdirs = ["data", "config", "logs", "runtime", "backups", "metadata"]
    created_paths = {}
    
    os.makedirs(root, mode=0o750, exist_ok=True)
    for sub in subdirs:
        subpath = os.path.join(root, sub)
        os.makedirs(subpath, mode=0o750, exist_ok=True)
        created_paths[sub] = subpath
        
    return created_paths
