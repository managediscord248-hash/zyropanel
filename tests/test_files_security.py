import os
import pytest
from fastapi import HTTPException
from app.utils.path_validator import resolve_safe_path, init_server_filesystem, get_server_root

def test_server_filesystem_isolation(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SERVERS_DIRECTORY", str(tmp_path))
    server_id = "server-uuid-test-001"
    
    dirs = init_server_filesystem(server_id)
    assert os.path.exists(dirs["data"])
    assert os.path.exists(dirs["config"])
    assert os.path.exists(dirs["logs"])
    
    # Safe path resolution inside server root
    safe_path = resolve_safe_path(server_id, "data/server.properties")
    assert safe_path.startswith(get_server_root(server_id))

def test_path_traversal_prevention(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SERVERS_DIRECTORY", str(tmp_path))
    server_id = "server-uuid-test-002"
    init_server_filesystem(server_id)
    
    # Attack vector 1: standard ../ traversal
    with pytest.raises(HTTPException) as exc_info:
        resolve_safe_path(server_id, "../../etc/passwd")
    assert exc_info.value.status_code == 403

    # Attack vector 2: encoded / normalized parent traversal
    with pytest.raises(HTTPException) as exc_info:
        resolve_safe_path(server_id, "data/../../../root/.ssh/id_rsa")
    assert exc_info.value.status_code == 403
