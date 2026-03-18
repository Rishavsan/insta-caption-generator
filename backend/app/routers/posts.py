from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import Post, User
from ..schemas import PostPublic
from ..storage import StorageConfigError, StorageUploadError, max_upload_bytes, upload_image_to_supabase

router = APIRouter(prefix="/posts", tags=["posts"])


def _normalize_optional_text(value: str | None, *, max_length: int) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    if len(normalized) > max_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Field cannot exceed {max_length} characters.",
        )

    return normalized


@router.get("", response_model=list[PostPublic])
def list_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Post]:
    return (
        db.query(Post)
        .filter(Post.user_id == current_user.id)
        .order_by(Post.created_at.desc())
        .all()
    )


@router.post("", response_model=PostPublic, status_code=status.HTTP_201_CREATED)
async def create_post(
    image: UploadFile = File(...),
    caption: str | None = Form(default=None),
    music_info: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Post:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are supported.")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded image is empty.")

    max_bytes = max_upload_bytes()
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image is too large. Maximum size is {settings.SUPABASE_MAX_UPLOAD_MB} MB.",
        )

    safe_caption = _normalize_optional_text(caption, max_length=2200)
    safe_music_info = _normalize_optional_text(music_info, max_length=255)

    try:
        storage_path, image_url = await upload_image_to_supabase(
            user_id=current_user.id,
            file_name=image.filename,
            content_type=image.content_type,
            file_bytes=image_bytes,
        )
    except StorageConfigError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except StorageUploadError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    post = Post(
        user_id=current_user.id,
        image_url=image_url,
        storage_path=storage_path,
        caption=safe_caption,
        music_info=safe_music_info,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post
