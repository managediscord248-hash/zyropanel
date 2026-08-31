from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import AuditLog

class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        action: str,
        resource_type: str,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[str] = None
    ) -> AuditLog:
        # Sanitize sensitive details
        sanitized_details = details
        if details and ("password" in details.lower() or "secret" in details.lower() or "token" in details.lower()):
            sanitized_details = "[FILTERED_CREDENTIALS]"

        log_entry = AuditLog(
            user_id=user_id,
            action=action.upper(),
            resource_type=resource_type.upper(),
            resource_id=resource_id,
            ip_address=ip_address,
            details=sanitized_details
        )
        try:
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
        except Exception:
            db.rollback()
        return log_entry

audit_service = AuditService()
