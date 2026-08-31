import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Node, NodeStatusEnum, User
from app.schemas.schemas import NodeResponse, NodeCreate
from app.middleware.auth import require_admin
from app.services.audit_service import audit_service
from app.utils.system_info import get_system_metrics

router = APIRouter(prefix="/nodes", tags=["Nodes"])

@router.get("", response_model=List[NodeResponse])
def list_nodes(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    nodes = db.query(Node).all()
    # Update local master node telemetry
    for node in nodes:
        if node.name.lower() in ("local", "master", "default"):
            metrics = get_system_metrics()
            node.cpu_cores = metrics["cpu_cores"]
            node.total_memory_mb = int(metrics["memory_total_mb"])
            node.total_disk_gb = int(metrics["disk_total_gb"])
            node.status = NodeStatusEnum.ONLINE
            node.last_heartbeat = datetime.utcnow()
            db.commit()
    return nodes

@router.post("", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
def create_node(
    node_in: NodeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    token = uuid.uuid4().hex
    new_node = Node(
        name=node_in.name,
        ip_address=node_in.ip_address,
        daemon_port=node_in.daemon_port,
        auth_token=token,
        status=NodeStatusEnum.ONLINE,
        cpu_cores=node_in.cpu_cores,
        total_memory_mb=node_in.total_memory_mb,
        total_disk_gb=node_in.total_disk_gb,
        docker_version="24.0.7",
        last_heartbeat=datetime.utcnow()
    )
    db.add(new_node)
    db.commit()
    db.refresh(new_node)

    audit_service.log_event(
        db=db,
        action="CREATE_NODE",
        resource_type="NODE",
        user_id=current_user.id,
        resource_id=new_node.id,
        ip_address=request.client.host if request.client else None,
        details=f"Registered node '{new_node.name}' ({new_node.ip_address}:{new_node.daemon_port})"
    )

    return new_node

@router.delete("/{node_id}")
def delete_node(
    node_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found.")

    if node.servers:
        raise HTTPException(status_code=400, detail="Cannot delete node with active assigned servers.")

    name = node.name
    db.delete(node)
    db.commit()

    audit_service.log_event(
        db=db,
        action="DELETE_NODE",
        resource_type="NODE",
        user_id=current_user.id,
        resource_id=node_id,
        ip_address=request.client.host if request.client else None,
        details=f"Deleted node '{name}'"
    )

    return {"message": f"Node '{name}' deleted."}
