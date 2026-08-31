from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Setting, User
from app.schemas.schemas import SettingBatchUpdate
from app.middleware.auth import get_current_user, require_admin
from app.services.audit_service import audit_service

router = APIRouter(prefix="/settings", tags=["Settings"])

DEFAULT_SETTINGS = {
    "panel_name": "ZyroCloud Control Panel",
    "logo_url": "",
    "primary_color": "#06b6d4",    # Cyan Neon
    "secondary_color": "#8b5cf6",  # Violet
    "accent_color": "#10b981",     # Emerald
    "background_style": "dark_cyber",
    "glow_intensity": "medium",
    "playit_enabled": "true",
    "max_servers_per_user": "5",
    "default_allocation_start": "25565",
    "default_allocation_end": "25600"
}

@router.get("")
def get_settings(db: Session = Depends(get_db)):
    db_settings = db.query(Setting).all()
    res = dict(DEFAULT_SETTINGS)
    for s in db_settings:
        res[s.key] = s.value
    return res

@router.post("")
def update_settings(
    payload: SettingBatchUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    for key, val in payload.settings.items():
        entry = db.query(Setting).filter(Setting.key == key).first()
        if entry:
            entry.value = str(val)
        else:
            entry = Setting(key=key, value=str(val))
            db.add(entry)
    db.commit()

    audit_service.log_event(
        db=db,
        action="UPDATE_SETTINGS",
        resource_type="SETTING",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        details=f"Updated system and branding settings ({len(payload.settings)} keys)"
    )

    return {"message": "Settings updated successfully.", "settings": payload.settings}
