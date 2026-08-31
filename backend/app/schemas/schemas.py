from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.models import RoleEnum, ServerStatusEnum, NodeStatusEnum, PlayitStatusEnum

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class OAuthAccountResponse(BaseModel):
    id: str
    user_id: str
    provider: str
    provider_user_id: str
    provider_email: Optional[str] = None
    provider_username: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: RoleEnum = RoleEnum.USER
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Node Schemas
class NodeBase(BaseModel):
    name: str
    ip_address: str
    daemon_port: int = 8000
    cpu_cores: int = 4
    total_memory_mb: int = 8192
    total_disk_gb: int = 100

class NodeCreate(NodeBase):
    pass

class NodeResponse(NodeBase):
    id: str
    status: NodeStatusEnum
    docker_version: str
    last_heartbeat: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# Port Schemas
class ServerPortBase(BaseModel):
    host_port: int
    container_port: int
    protocol: str = "TCP"
    is_primary: bool = False

class ServerPortResponse(ServerPortBase):
    id: str
    server_id: str

    class Config:
        from_attributes = True

# Playit Schemas
class PlayitTunnelResponse(BaseModel):
    id: str
    server_id: str
    status: PlayitStatusEnum
    tunnel_address: Optional[str] = None
    assigned_port: Optional[int] = None
    claim_code: Optional[str] = None
    process_pid: Optional[int] = None
    last_connected: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PlayitConfigRequest(BaseModel):
    secret_key: Optional[str] = None

# Template Schemas
class TemplateBase(BaseModel):
    name: str
    game: str
    description: Optional[str] = None
    docker_image: str
    default_port: int
    default_ram_mb: int = 2048
    default_cpu_limit: float = 2.0
    startup_command: str
    environment_variables: str = "{}"
    config_templates: str = "{}"

class TemplateCreate(TemplateBase):
    pass

class TemplateResponse(TemplateBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Server Schemas
class ServerBase(BaseModel):
    name: str
    description: Optional[str] = None
    node_id: str
    template_id: Optional[str] = None
    docker_image: str
    startup_command: str
    environment_variables: str = "{}"
    ram_limit_mb: int = 2048
    cpu_limit: float = 2.0
    disk_limit_gb: int = 20
    auto_restart: bool = True

class ServerCreate(ServerBase):
    primary_port: int
    owner_id: Optional[str] = None

class ServerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    docker_image: Optional[str] = None
    startup_command: Optional[str] = None
    environment_variables: Optional[str] = None
    ram_limit_mb: Optional[int] = None
    cpu_limit: Optional[float] = None
    disk_limit_gb: Optional[int] = None
    auto_restart: Optional[bool] = None

class ServerStats(BaseModel):
    cpu_percent: float
    memory_used_mb: float
    memory_limit_mb: float
    memory_percent: float
    disk_used_gb: float
    disk_total_gb: float
    network_rx_bytes: int
    network_tx_bytes: int
    uptime_seconds: int
    status: ServerStatusEnum

class ServerResponse(ServerBase):
    id: str
    owner_id: str
    container_id: Optional[str] = None
    status: ServerStatusEnum
    created_at: datetime
    updated_at: datetime
    ports: List[ServerPortResponse] = []
    playit_tunnel: Optional[PlayitTunnelResponse] = None

    class Config:
        from_attributes = True

# Backup Schemas
class BackupCreate(BaseModel):
    name: str

class BackupResponse(BaseModel):
    id: str
    server_id: str
    name: str
    file_path: str
    size_bytes: int
    is_successful: bool
    created_at: datetime

    class Config:
        from_attributes = True

# File Manager Schemas
class FileItem(BaseModel):
    name: str
    path: str
    is_directory: bool
    size: int
    modified_at: datetime
    permissions: str
    extension: Optional[str] = None

class FileContentRequest(BaseModel):
    path: str
    content: str

class FileActionRequest(BaseModel):
    path: str
    new_path: Optional[str] = None
    name: Optional[str] = None

# Settings Schemas
class SettingItem(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SettingBatchUpdate(BaseModel):
    settings: Dict[str, str]

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True
