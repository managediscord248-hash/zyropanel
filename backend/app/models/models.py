import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, DateTime, ForeignKey, Enum as SQLEnum, Float
)
from sqlalchemy.orm import relationship
from app.database import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    USER = "USER"

class ServerStatusEnum(str, enum.Enum):
    INSTALLING = "INSTALLING"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"
    CRASHED = "CRASHED"
    ERROR = "ERROR"
    OFFLINE = "OFFLINE"

class NodeStatusEnum(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"

class PlayitStatusEnum(str, enum.Enum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    STARTING = "STARTING"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"
    ERROR = "ERROR"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.USER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assignments = relationship("ServerAssignment", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String(30), nullable=False, index=True) # google, discord
    provider_user_id = Column(String(100), nullable=False, index=True)
    provider_email = Column(String(150), nullable=True)
    provider_username = Column(String(100), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="oauth_accounts")

class Node(Base):
    __tablename__ = "nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    ip_address = Column(String(100), nullable=False)
    daemon_port = Column(Integer, default=8000, nullable=False)
    auth_token = Column(String(255), nullable=False)
    status = Column(SQLEnum(NodeStatusEnum), default=NodeStatusEnum.ONLINE, nullable=False)
    cpu_cores = Column(Integer, default=4)
    total_memory_mb = Column(Integer, default=8192)
    total_disk_gb = Column(Integer, default=100)
    docker_version = Column(String(50), default="24.0.7")
    last_heartbeat = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    servers = relationship("Server", back_populates="node", cascade="all, delete-orphan")

class Template(Base):
    __tablename__ = "templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    game = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    docker_image = Column(String(255), nullable=False)
    default_port = Column(Integer, nullable=False)
    default_ram_mb = Column(Integer, default=2048)
    default_cpu_limit = Column(Float, default=2.0)
    startup_command = Column(Text, nullable=False)
    environment_variables = Column(Text, default="{}") # JSON String
    config_templates = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    servers = relationship("Server", back_populates="template")

class Server(Base):
    __tablename__ = "servers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    node_id = Column(String(36), ForeignKey("nodes.id"), nullable=False)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    container_id = Column(String(100), nullable=True, index=True)
    status = Column(SQLEnum(ServerStatusEnum), default=ServerStatusEnum.STOPPED, nullable=False)
    
    docker_image = Column(String(255), nullable=False)
    startup_command = Column(Text, nullable=False)
    environment_variables = Column(Text, default="{}")
    
    ram_limit_mb = Column(Integer, default=2048, nullable=False)
    cpu_limit = Column(Float, default=2.0, nullable=False)
    disk_limit_gb = Column(Integer, default=20, nullable=False)
    
    auto_restart = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    node = relationship("Node", back_populates="servers")
    template = relationship("Template", back_populates="servers")
    owner = relationship("User")
    assignments = relationship("ServerAssignment", back_populates="server", cascade="all, delete-orphan")
    ports = relationship("ServerPort", back_populates="server", cascade="all, delete-orphan")
    backups = relationship("Backup", back_populates="server", cascade="all, delete-orphan")
    playit_tunnel = relationship("PlayitTunnel", back_populates="server", uselist=False, cascade="all, delete-orphan")

class ServerAssignment(Base):
    __tablename__ = "server_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    server_id = Column(String(36), ForeignKey("servers.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    can_start = Column(Boolean, default=True, nullable=False)
    can_stop = Column(Boolean, default=True, nullable=False)
    can_edit_files = Column(Boolean, default=True, nullable=False)
    can_console = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    server = relationship("Server", back_populates="assignments")
    user = relationship("User", back_populates="assignments")

class ServerPort(Base):
    __tablename__ = "server_ports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    server_id = Column(String(36), ForeignKey("servers.id"), nullable=False)
    host_port = Column(Integer, nullable=False, unique=True, index=True)
    container_port = Column(Integer, nullable=False)
    protocol = Column(String(10), default="TCP", nullable=False) # TCP, UDP
    is_primary = Column(Boolean, default=False, nullable=False)

    server = relationship("Server", back_populates="ports")

class Backup(Base):
    __tablename__ = "backups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    server_id = Column(String(36), ForeignKey("servers.id"), nullable=False)
    name = Column(String(150), nullable=False)
    file_path = Column(String(255), nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    is_successful = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    server = relationship("Server", back_populates="backups")

class PlayitTunnel(Base):
    __tablename__ = "playit_tunnels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    server_id = Column(String(36), ForeignKey("servers.id"), unique=True, nullable=False)
    status = Column(SQLEnum(PlayitStatusEnum), default=PlayitStatusEnum.NOT_CONFIGURED, nullable=False)
    tunnel_address = Column(String(255), nullable=True)
    assigned_port = Column(Integer, nullable=True)
    claim_code = Column(String(100), nullable=True)
    process_pid = Column(Integer, nullable=True)
    secret_key_encrypted = Column(Text, nullable=True)
    last_connected = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    server = relationship("Server", back_populates="playit_tunnel")

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False) # SERVER, USER, NODE, BACKUP, SETTING, PLAYIT
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="audit_logs")
