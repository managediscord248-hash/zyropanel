from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Template, User
from app.schemas.schemas import TemplateResponse, TemplateCreate
from app.middleware.auth import get_current_user, require_admin
from app.services.audit_service import audit_service

router = APIRouter(prefix="/templates", tags=["Templates"])

@router.get("", response_model=List[TemplateResponse])
def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Template).all()

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    template_in: TemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    new_template = Template(
        name=template_in.name,
        game=template_in.game,
        description=template_in.description,
        docker_image=template_in.docker_image,
        default_port=template_in.default_port,
        default_ram_mb=template_in.default_ram_mb,
        default_cpu_limit=template_in.default_cpu_limit,
        startup_command=template_in.startup_command,
        environment_variables=template_in.environment_variables,
        config_templates=template_in.config_templates
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)

    audit_service.log_event(
        db=db,
        action="CREATE_TEMPLATE",
        resource_type="TEMPLATE",
        user_id=current_user.id,
        resource_id=new_template.id,
        ip_address=request.client.host if request.client else None,
        details=f"Created game server template '{new_template.name}' ({new_template.game})"
    )

    return new_template

@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found.")

    name = tmpl.name
    db.delete(tmpl)
    db.commit()

    audit_service.log_event(
        db=db,
        action="DELETE_TEMPLATE",
        resource_type="TEMPLATE",
        user_id=current_user.id,
        resource_id=template_id,
        ip_address=request.client.host if request.client else None,
        details=f"Deleted template '{name}'"
    )

    return {"message": f"Template '{name}' deleted."}
