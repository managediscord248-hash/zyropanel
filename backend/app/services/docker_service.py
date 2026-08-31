import json
import logging
from typing import Optional, Dict, Any, List
import docker
from docker.errors import NotFound, APIError, DockerException
from app.config import settings
from app.models.models import ServerStatusEnum

logger = logging.getLogger("zyrocloud.docker")

class DockerService:
    def __init__(self):
        self._client: Optional[docker.DockerClient] = None

    @property
    def client(self) -> docker.DockerClient:
        if self._client is None:
            try:
                self._client = docker.DockerClient(base_url=settings.DOCKER_HOST)
            except DockerException as e:
                logger.warning(f"Could not connect to Docker socket at {settings.DOCKER_HOST}: {e}")
                # Fallback to default from_env
                try:
                    self._client = docker.from_env()
                except Exception as ex:
                    logger.error(f"Docker initialization failed: {ex}")
                    raise
        return self._client

    def is_docker_available(self) -> bool:
        try:
            return self.client.ping()
        except Exception:
            return False

    def create_server_container(
        self,
        server_id: str,
        name: str,
        image: str,
        startup_cmd: str,
        env_vars: Dict[str, str],
        ports_mapping: Dict[str, int],
        ram_limit_mb: int,
        cpu_limit: float,
        server_root_dir: str
    ) -> str:
        """Creates an isolated Docker container with strict volume mounts and resource quotas."""
        container_name = f"zyrocloud-srv-{server_id[:8]}"
        
        # Build volume mappings for isolated directory
        volumes = {
            f"{server_root_dir}/data": {"bind": "/server/data", "mode": "rw"},
            f"{server_root_dir}/config": {"bind": "/server/config", "mode": "rw"},
            f"{server_root_dir}/logs": {"bind": "/server/logs", "mode": "rw"},
        }
        
        # Port bindings (e.g. {'25565/tcp': 25565})
        ports = {}
        for container_p, host_p in ports_mapping.items():
            ports[container_p] = host_p

        # Resource limits
        mem_limit = f"{int(ram_limit_mb)}m"
        nano_cpus = int(cpu_limit * 1e9)

        # Pull image if not local
        try:
            self.client.images.get(image)
        except NotFound:
            logger.info(f"Pulling Docker image {image}...")
            self.client.images.pull(image)

        container = self.client.containers.create(
            image=image,
            name=container_name,
            command=startup_cmd if startup_cmd else None,
            environment=env_vars,
            volumes=volumes,
            ports=ports,
            mem_limit=mem_limit,
            nano_cpus=nano_cpus,
            working_dir="/server/data",
            stdin_open=True,
            tty=True,
            detach=True,
            restart_policy={"Name": "unless-stopped"}
        )
        return container.id

    def _get_container(self, identifier: str):
        """Finds container by container_id or server_id / name."""
        if not identifier:
            raise NotFound("No container identifier provided.")
        try:
            return self.client.containers.get(identifier)
        except NotFound:
            short_name = f"zyrocloud-srv-{identifier[:8]}"
            try:
                return self.client.containers.get(short_name)
            except NotFound:
                pass
            # Fallback search by labels or names
            for c in self.client.containers.list(all=True):
                if identifier in c.name or identifier in c.id:
                    return c
            raise

    def start_container(self, container_id: str) -> bool:
        try:
            container = self._get_container(container_id)
            container.start()
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error starting container {container_id}: {e}")
            raise

    def stop_container(self, container_id: str, timeout: int = 15) -> bool:
        try:
            container = self._get_container(container_id)
            container.stop(timeout=timeout)
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error stopping container {container_id}: {e}")
            raise

    def restart_container(self, container_id: str, timeout: int = 15) -> bool:
        try:
            container = self._get_container(container_id)
            container.restart(timeout=timeout)
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error restarting container {container_id}: {e}")
            raise

    def kill_container(self, container_id: str) -> bool:
        try:
            container = self._get_container(container_id)
            container.kill()
            return True
        except (NotFound, APIError) as e:
            logger.error(f"Error killing container {container_id}: {e}")
            raise

    def remove_container(self, container_id: str, force: bool = True) -> bool:
        try:
            container = self._get_container(container_id)
            container.remove(force=force, v=True)
            return True
        except NotFound:
            return True
        except APIError as e:
            logger.error(f"Error removing container {container_id}: {e}")
            raise

    def get_container_status(self, container_id: str) -> ServerStatusEnum:
        if not container_id:
            return ServerStatusEnum.OFFLINE
        try:
            container = self._get_container(container_id)
            status_str = container.status.lower()
            if status_str == "running":
                return ServerStatusEnum.RUNNING
            elif status_str in ("created", "restarting"):
                return ServerStatusEnum.STARTING
            elif status_str == "paused":
                return ServerStatusEnum.STOPPING
            elif status_str in ("exited", "dead"):
                exit_code = container.attrs.get("State", {}).get("ExitCode", 0)
                if exit_code != 0 and exit_code != 137 and exit_code != 143:
                    return ServerStatusEnum.CRASHED
                return ServerStatusEnum.STOPPED
            return ServerStatusEnum.OFFLINE
        except NotFound:
            return ServerStatusEnum.OFFLINE
        except Exception:
            return ServerStatusEnum.ERROR

    def get_container_logs(self, container_id: str, tail: int = 200) -> str:
        try:
            container = self._get_container(container_id)
            raw_logs = container.logs(tail=tail, timestamps=True, stdout=True, stderr=True)
            return raw_logs.decode("utf-8", errors="replace")
        except NotFound:
            return "[Console] Container not found or offline."
        except Exception as e:
            return f"[Console Error] Failed to read container logs: {e}"

    def send_command(self, container_id: str, command: str) -> str:
        """Executes a command inside the running container."""
        try:
            container = self._get_container(container_id)
            # Try RCON or direct container command injection first
            try:
                rcon_res = container.exec_run(cmd=f"rcon-cli {command}", stdin=False, tty=False)
                if rcon_res.exit_code == 0 and rcon_res.output:
                    return rcon_res.output.decode("utf-8", errors="replace")
            except Exception:
                pass
            
            # Fallback to standard execution
            exec_res = container.exec_run(cmd=command, stdin=False, tty=False)
            return exec_res.output.decode("utf-8", errors="replace") if exec_res.output else ""
        except Exception as e:
            logger.error(f"Command exec failed for {container_id}: {e}")
            return f"Command execution error: {e}"

    def get_container_stats(self, container_id: str) -> Dict[str, Any]:
        """Reads real Docker resource statistics."""
        try:
            container = self._get_container(container_id)
            stats = container.stats(stream=False)
            
            # CPU calculation
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
            system_delta = stats["cpu_stats"].get("system_cpu_usage", 0) - stats["precpu_stats"].get("system_cpu_usage", 0)
            cpu_percent = 0.0
            if system_delta > 0 and cpu_delta > 0:
                cpu_count = len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [1]))
                cpu_percent = round((cpu_delta / system_delta) * cpu_count * 100.0, 2)

            # Memory calculation
            mem_usage = stats["memory_stats"].get("usage", 0)
            mem_limit = stats["memory_stats"].get("limit", 1)
            mem_used_mb = round(mem_usage / (1024 * 1024), 2)
            mem_limit_mb = round(mem_limit / (1024 * 1024), 2)
            mem_percent = round((mem_usage / mem_limit) * 100.0, 2)

            # Network I/O
            rx_bytes = 0
            tx_bytes = 0
            networks = stats.get("networks", {})
            for net_data in networks.values():
                rx_bytes += net_data.get("rx_bytes", 0)
                tx_bytes += net_data.get("tx_bytes", 0)

            return {
                "cpu_percent": cpu_percent,
                "memory_used_mb": mem_used_mb,
                "memory_limit_mb": mem_limit_mb,
                "memory_percent": mem_percent,
                "network_rx_bytes": rx_bytes,
                "network_tx_bytes": tx_bytes,
                "status": self.get_container_status(container_id)
            }
        except Exception as e:
            return {
                "cpu_percent": 0.0,
                "memory_used_mb": 0.0,
                "memory_limit_mb": 0.0,
                "memory_percent": 0.0,
                "network_rx_bytes": 0,
                "network_tx_bytes": 0,
                "status": ServerStatusEnum.OFFLINE
            }

docker_service = DockerService()
