from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import AuthResponse, UserCreate, UserLogin, UserPublic
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower()
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    return AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=user.email)
    return AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return current_user
