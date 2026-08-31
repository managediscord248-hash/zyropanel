from fastapi import APIRouter
from app.utils.system_info import get_system_metrics
from app.services.docker_service import docker_service

router = APIRouter(tags=["Health & System"])

@router.get("/health")
def health_check():
    docker_ok = docker_service.is_docker_available()
    metrics = get_system_metrics()
    return {
        "status": "healthy",
        "service": "ZyroCloud Control Panel",
        "docker_available": docker_ok,
        "metrics": metrics
    }

@router.get("/system/metrics")
def system_metrics():
    return get_system_metrics()
