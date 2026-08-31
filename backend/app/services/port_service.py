from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import ServerPort

MIN_PORT = 1024
MAX_PORT = 65535

class PortService:
    def is_port_available(self, db: Session, port: int) -> bool:
        if port < MIN_PORT or port > MAX_PORT:
            return False
        existing = db.query(ServerPort).filter(ServerPort.host_port == port).first()
        return existing is None

    def allocate_port(self, db: Session, server_id: str, host_port: int, container_port: int, protocol: str = "TCP", is_primary: bool = False) -> ServerPort:
        if host_port < MIN_PORT or host_port > MAX_PORT:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Port must be between {MIN_PORT} and {MAX_PORT}")

        if not self.is_port_available(db, host_port):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Port {host_port} is already allocated.")

        new_port = ServerPort(
            server_id=server_id,
            host_port=host_port,
            container_port=container_port,
            protocol=protocol.upper(),
            is_primary=is_primary
        )
        db.add(new_port)
        db.commit()
        db.refresh(new_port)
        return new_port

    def release_port(self, db: Session, server_id: str, port_id: str) -> bool:
        port_entry = db.query(ServerPort).filter(ServerPort.id == port_id, ServerPort.server_id == server_id).first()
        if not port_entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Port assignment not found")
        
        db.delete(port_entry)
        db.commit()
        return True

port_service = PortService()
