import os
import pytest
from app.services.playit_service import PlayitService
from app.services.backup_service import BackupService

def test_playit_directory_isolation(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.PLAYIT_DIRECTORY", str(tmp_path))
    service = PlayitService()
    
    server_id = "test-srv-playit"
    tunnel_id = "test-tunnel-01"
    tunnel_dir = service.get_tunnel_dir(server_id, tunnel_id)
    
    assert os.path.exists(os.path.join(tunnel_dir, "config"))
    assert os.path.exists(os.path.join(tunnel_dir, "runtime"))
    assert os.path.exists(os.path.join(tunnel_dir, "logs"))

def test_backup_creation_and_directory(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.SERVERS_DIRECTORY", str(tmp_path / "servers"))
    monkeypatch.setattr("app.config.settings.BACKUPS_DIRECTORY", str(tmp_path / "backups"))
    
    backup_service = BackupService()
    server_id = "test-srv-backup"
    backup_dir = backup_service.get_backup_dir(server_id)
    
    assert os.path.exists(backup_dir)
    assert server_id in backup_dir
