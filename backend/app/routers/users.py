from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User, RoleEnum
from app.schemas.schemas import UserResponse, UserCreate, UserUpdate
from app.utils.security import get_password_hash
from app.middleware.auth import require_admin
from app.services.audit_service import audit_service

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    # Check duplicate username
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already registered.")
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already in use.")

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit_service.log_event(
        db=db,
        action="CREATE_USER",
        resource_type="USER",
        user_id=current_user.id,
        resource_id=new_user.id,
        ip_address=request.client.host if request.client else None,
        details=f"Admin created user {new_user.username} with role {new_user.role}"
    )

    return new_user

@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    user_update: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_update.email is not None:
        user.email = user_update.email
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    if user_update.password is not None and user_update.password.strip():
        user.password_hash = get_password_hash(user_update.password)

    db.commit()
    db.refresh(user)

    audit_service.log_event(
        db=db,
        action="UPDATE_USER",
        resource_type="USER",
        user_id=current_user.id,
        resource_id=user.id,
        ip_address=request.client.host if request.client else None,
        details=f"Admin updated user {user.username}"
    )

    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrative account.")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    username = user.username
    db.delete(user)
    db.commit()

    audit_service.log_event(
        db=db,
        action="DELETE_USER",
        resource_type="USER",
        user_id=current_user.id,
        resource_id=user_id,
        ip_address=request.client.host if request.client else None,
        details=f"Admin deleted user {username}"
    )

    return {"message": f"User {username} deleted successfully."}
