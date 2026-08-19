from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserCreate, UserResponse, UserApiKeyUpdate
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    hashed_password = security.get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user

@router.put("/me/api-key", response_model=UserResponse)
def update_user_api_key(
    api_key_in: UserApiKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if api_key_in.gemini_api_key is not None:
        current_user.gemini_api_key = api_key_in.gemini_api_key
    if api_key_in.gemini_model is not None:
        current_user.gemini_model = api_key_in.gemini_model
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

from app.models.models import ModelUsage
import datetime

@router.get("/me/usage")
def get_user_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    model_name = current_user.gemini_model or "gemini-flash-lite-latest"
    usage = db.query(ModelUsage).filter(
        ModelUsage.user_id == current_user.id,
        ModelUsage.model_name == model_name,
        ModelUsage.date == today
    ).first()
    count = usage.count if usage else 0
    return {"model_name": model_name, "usage_today": count}
