import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ZyroCloud Control Panel"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Security
    APP_SECRET: str = os.getenv("APP_SECRET", "zyrocloud_development_secret_key_change_in_production_min32chars")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRATION_HOURS: int = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://zyrocloud:zyrocloud_secure_pass_123@postgres:5432/zyrocloud_db"
    )
    
    # Storage Paths
    DATA_DIRECTORY: str = os.getenv("DATA_DIRECTORY", "/var/lib/zyrocloud")
    SERVERS_DIRECTORY: str = os.getenv("SERVERS_DIRECTORY", "/var/lib/zyrocloud/servers")
    BACKUPS_DIRECTORY: str = os.getenv("BACKUPS_DIRECTORY", "/var/lib/zyrocloud/backups")
    PLAYIT_DIRECTORY: str = os.getenv("PLAYIT_DIRECTORY", "/var/lib/zyrocloud/playit")
    LOGS_DIRECTORY: str = os.getenv("LOGS_DIRECTORY", "/var/lib/zyrocloud/logs")
    
    # Docker
    DOCKER_HOST: str = os.getenv("DOCKER_HOST", "unix:///var/run/docker.sock")
    DOCKER_NETWORK: str = os.getenv("DOCKER_NETWORK", "zyrocloud-network")
    
    # Default Bootstrap Admin
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@zyrocloud.local")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "ZyroCloud2026!SecureAdmin")
    
    # Playit.gg
    PLAYIT_ENABLED: bool = os.getenv("PLAYIT_ENABLED", "true").lower() in ("true", "1", "yes")
    PLAYIT_BINARY_PATH: str = os.getenv("PLAYIT_BINARY_PATH", "/usr/local/bin/playit")

    class Config:
        case_sensitive = True

settings = Settings()
