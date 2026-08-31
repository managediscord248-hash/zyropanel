from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import re
import uuid
from app.database import get_db
from app.models.models import User, RoleEnum, OAuthAccount
from app.schemas.schemas import Token, LoginRequest, UserResponse, UserCreate, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, OAuthAccountResponse
from app.utils.security import verify_password, get_password_hash, create_access_token
from app.middleware.auth import get_current_user
from app.services.audit_service import audit_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(login_req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == login_req.username) | (User.email == login_req.username)
    ).first()
    if not user or not verify_password(login_req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact system administrator."
        )

    access_token = create_access_token(subject=user.id, role=user.role.value)
    
    audit_service.log_event(
        db=db,
        action="LOGIN",
        resource_type="USER",
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        details=f"User {user.username} logged in successfully."
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(reg_req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    # Validate username
    if not re.match(r"^[a-zA-Z0-9_-]{3,30}$", reg_req.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be 3-30 characters and contain only alphanumeric characters, dashes, and underscores."
        )

    # Validate password rules
    if len(reg_req.password) < 8 or not re.search(r"[A-Za-z]", reg_req.password) or not re.search(r"[0-9!@#$%^&*()_\-+=\[\]{};':\"\\|,.<>/?]", reg_req.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain both letters and numbers/special characters."
        )

    if reg_req.confirm_password and reg_req.password != reg_req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )

    # Prevent duplicate username
    if db.query(User).filter(User.username == reg_req.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already registered."
        )

    # Prevent duplicate email
    if db.query(User).filter(User.email == reg_req.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered."
        )

    new_user = User(
        id=f"usr-{str(uuid.uuid4())[:8]}",
        username=reg_req.username,
        email=reg_req.email,
        password_hash=get_password_hash(reg_req.password),
        role=RoleEnum.USER,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(subject=new_user.id, role=new_user.role.value)

    audit_service.log_event(
        db=db,
        action="REGISTER",
        resource_type="USER",
        user_id=new_user.id,
        ip_address=request.client.host if request.client else None,
        details=f"User {new_user.username} registered."
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    reset_token = None
    if user and user.is_active:
        reset_token = create_access_token(subject=user.id, role=user.role.value)
        audit_service.log_event(
            db=db,
            action="PASSWORD_RESET_REQUEST",
            resource_type="USER",
            user_id=user.id,
            ip_address=request.client.host if request.client else None,
            details=f"Password reset token generated for {user.email}."
        )
    return {
        "message": "If this email is registered, password reset instructions have been created.",
        "reset_token": reset_token
    }

@router.get("/oauth-accounts")
def get_oauth_accounts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    accounts = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).all()
    return accounts

@router.delete("/link/{provider}")
def unlink_oauth_account(provider: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.query(OAuthAccount).filter(
        OAuthAccount.user_id == current_user.id,
        OAuthAccount.provider == provider.lower()
    ).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No linked {provider} account found."
        )
    db.delete(account)
    db.commit()
    return {"message": f"Successfully unlinked {provider} account."}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    audit_service.log_event(
        db=db,
        action="LOGOUT",
        resource_type="USER",
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        details=f"User {current_user.username} logged out."
    )
    return {"message": "Logged out successfully."}
