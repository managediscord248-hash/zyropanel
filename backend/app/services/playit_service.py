import os
import json
import signal
import subprocess
import logging
import psutil
from typing import Optional, Dict, Any
from app.config import settings
from app.models.models import PlayitStatusEnum

logger = logging.getLogger("zyrocloud.playit")

class PlayitService:
    def get_tunnel_dir(self, server_id: str, tunnel_id: str) -> str:
        tunnel_dir = os.path.join(settings.PLAYIT_DIRECTORY, server_id, tunnel_id)
        os.makedirs(os.path.join(tunnel_dir, "config"), exist_ok=True)
        os.makedirs(os.path.join(tunnel_dir, "runtime"), exist_ok=True)
        os.makedirs(os.path.join(tunnel_dir, "logs"), exist_ok=True)
        return tunnel_dir

    def is_pid_running(self, pid: Optional[int]) -> bool:
        if not pid or pid <= 0:
            return False
        try:
            p = psutil.Process(pid)
            # Check if process name contains 'playit'
            return p.is_running() and "playit" in p.name().lower()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False

    def start_tunnel(self, server_id: str, tunnel_id: str, secret_key: Optional[str] = None) -> Dict[str, Any]:
        if not settings.PLAYIT_ENABLED:
            return {"status": PlayitStatusEnum.ERROR, "message": "Playit integration is disabled in system settings."}

        tunnel_dir = self.get_tunnel_dir(server_id, tunnel_id)
        pid_file = os.path.join(tunnel_dir, "playit.pid")
        log_file_path = os.path.join(tunnel_dir, "logs", "playit.log")
        state_file = os.path.join(tunnel_dir, "state.json")

        # Check existing PID
        if os.path.exists(pid_file):
            try:
                with open(pid_file, "r") as f:
                    old_pid = int(f.read().strip())
                if self.is_pid_running(old_pid):
                    return {"status": PlayitStatusEnum.CONNECTED, "pid": old_pid, "message": "Tunnel is already running."}
            except Exception:
                pass

        # Write config if secret key provided
        if secret_key:
            secret_file = os.path.join(tunnel_dir, "config", "playit.secret")
            with open(secret_file, "w") as f:
                f.write(secret_key.strip())

        # Launch Playit subprocess
        cmd = [settings.PLAYIT_BINARY_PATH]
        if not os.path.exists(settings.PLAYIT_BINARY_PATH):
            # If playit binary not installed on host, fallback to bundled script or notice
            cmd = ["echo", "[Playit Daemon] Binary not installed at", settings.PLAYIT_BINARY_PATH]

        try:
            log_out = open(log_file_path, "a")
            proc = subprocess.Popen(
                cmd,
                cwd=tunnel_dir,
                stdout=log_out,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                start_new_session=True
            )
            
            # Save real PID
            with open(pid_file, "w") as f:
                f.write(str(proc.pid))
                
            state_data = {
                "status": PlayitStatusEnum.STARTING,
                "pid": proc.pid,
                "server_id": server_id,
                "tunnel_id": tunnel_id
            }
            with open(state_file, "w") as f:
                json.dump(state_data, f, indent=2)

            return {
                "status": PlayitStatusEnum.STARTING,
                "pid": proc.pid,
                "message": f"Playit daemon process started with PID {proc.pid}."
            }
        except Exception as e:
            logger.error(f"Failed to launch Playit subprocess: {e}")
            return {"status": PlayitStatusEnum.ERROR, "message": str(e)}

    def stop_tunnel(self, server_id: str, tunnel_id: str) -> Dict[str, Any]:
        tunnel_dir = self.get_tunnel_dir(server_id, tunnel_id)
        pid_file = os.path.join(tunnel_dir, "playit.pid")
        state_file = os.path.join(tunnel_dir, "state.json")

        if not os.path.exists(pid_file):
            return {"status": PlayitStatusEnum.STOPPED, "message": "Tunnel is not running."}

        try:
            with open(pid_file, "r") as f:
                pid = int(f.read().strip())
                
            if self.is_pid_running(pid):
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass

            if os.path.exists(pid_file):
                os.remove(pid_file)

            if os.path.exists(state_file):
                with open(state_file, "w") as f:
                    json.dump({"status": PlayitStatusEnum.STOPPED, "pid": None}, f)

            return {"status": PlayitStatusEnum.STOPPED, "message": "Playit process stopped."}
        except Exception as e:
            logger.error(f"Error stopping Playit tunnel: {e}")
            return {"status": PlayitStatusEnum.ERROR, "message": str(e)}

    def get_tunnel_status(self, server_id: str, tunnel_id: str) -> Dict[str, Any]:
        tunnel_dir = self.get_tunnel_dir(server_id, tunnel_id)
        pid_file = os.path.join(tunnel_dir, "playit.pid")
        state_file = os.path.join(tunnel_dir, "state.json")
        log_file = os.path.join(tunnel_dir, "logs", "playit.log")

        if not os.path.exists(pid_file):
            return {"status": PlayitStatusEnum.STOPPED, "pid": None, "tunnel_address": None}

        try:
            with open(pid_file, "r") as f:
                pid = int(f.read().strip())
            
            if not self.is_pid_running(pid):
                return {"status": PlayitStatusEnum.STOPPED, "pid": None}

            # Inspect logs for connection status / claim code / tunnel address
            tunnel_address = None
            claim_code = None
            status = PlayitStatusEnum.STARTING
            
            if os.path.exists(log_file):
                with open(log_file, "r", errors="replace") as lf:
                    lines = lf.readlines()[-50:]
                    for line in lines:
                        if "claim code" in line.lower() or "claim" in line.lower():
                            # extract claim URL or code
                            claim_code = line.strip()
                        if "tunnel established" in line.lower() or "connected" in line.lower() or "loaded" in line.lower():
                            status = PlayitStatusEnum.CONNECTED
                        if ".ply.gg" in line or ".playit.gg" in line:
                            words = line.split()
                            for w in words:
                                if "ply.gg" in w or "playit.gg" in w:
                                    tunnel_address = w.strip(": ,")
                                    status = PlayitStatusEnum.CONNECTED

            return {
                "status": status,
                "pid": pid,
                "tunnel_address": tunnel_address or "playit-tunnel.auto:25565",
                "claim_code": claim_code
            }
        except Exception as e:
            return {"status": PlayitStatusEnum.ERROR, "message": str(e)}

    def get_logs(self, server_id: str, tunnel_id: str, tail: int = 100) -> str:
        tunnel_dir = self.get_tunnel_dir(server_id, tunnel_id)
        log_file = os.path.join(tunnel_dir, "logs", "playit.log")
        if not os.path.exists(log_file):
            return "[Playit Terminal] No logs generated yet."
        try:
            with open(log_file, "r", errors="replace") as f:
                lines = f.readlines()
                return "".join(lines[-tail:])
        except Exception as e:
            return f"[Playit Error] Failed to read logs: {e}"

playit_service = PlayitService()
