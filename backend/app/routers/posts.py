import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import Post, User
from ..schemas import PostPublic, PostUpdate, SongMetadata
from ..storage import (
    StorageConfigError,
    StorageDeleteError,
    StorageUploadError,
    delete_image_from_supabase,
    max_upload_bytes,
    upload_image_to_supabase,
)

router = APIRouter(prefix="/posts", tags=["posts"])
logger = logging.getLogger("app.routers.posts")


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


def _parse_music_metadata(raw_value: str | None) -> tuple[dict[str, object] | None, str | None]:
    if not raw_value:
        return None, None

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="music_metadata must be valid JSON.",
        ) from exc

    try:
        validated = SongMetadata.model_validate(parsed)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="music_metadata is not in the expected format.",
        ) from exc

    fallback = validated.song_name
    if validated.artist_names:
        fallback = f"{validated.song_name} - {', '.join(validated.artist_names)}"

    return validated.model_dump(), fallback[:255]


def _music_label_from_metadata(metadata: SongMetadata) -> str:
    label = metadata.song_name
    if metadata.artist_names:
        label = f"{metadata.song_name} - {', '.join(metadata.artist_names)}"

    return label[:255]


def _get_user_post_or_404(*, db: Session, user_id: int, post_id: int) -> Post:
    post = db.query(Post).filter(Post.id == post_id, Post.user_id == user_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.")

    return post


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


@router.patch("/{post_id}", response_model=PostPublic)
def update_post(
    post_id: int,
    payload: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Post:
    post = _get_user_post_or_404(db=db, user_id=current_user.id, post_id=post_id)
    provided_fields = payload.model_fields_set

    if "caption" in provided_fields:
        post.caption = _normalize_optional_text(payload.caption, max_length=2200)

    if "music_info" in provided_fields:
        post.music_info = _normalize_optional_text(payload.music_info, max_length=255)

    if "music_metadata" in provided_fields:
        if payload.music_metadata is None:
            post.music_metadata = None
            if "music_info" not in provided_fields:
                post.music_info = None
        else:
            post.music_metadata = payload.music_metadata.model_dump()
            if "music_info" not in provided_fields:
                post.music_info = _music_label_from_metadata(payload.music_metadata)

    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("", response_model=PostPublic, status_code=status.HTTP_201_CREATED)
async def create_post(
    image: UploadFile = File(...),
    caption: str | None = Form(default=None),
    music_info: str | None = Form(default=None),
    music_metadata: str | None = Form(default=None),
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
    safe_music_metadata, derived_music_info = _parse_music_metadata(music_metadata)
    if derived_music_info and not safe_music_info:
        safe_music_info = derived_music_info

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
        music_metadata=safe_music_metadata,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    post = _get_user_post_or_404(db=db, user_id=current_user.id, post_id=post_id)
    storage_path = post.storage_path

    db.delete(post)
    db.commit()

    if storage_path:
        try:
            await delete_image_from_supabase(storage_path=storage_path)
        except (StorageConfigError, StorageDeleteError) as exc:
            logger.warning(
                "Image cleanup failed after post delete post_id=%s path=%s detail=%s",
                post_id,
                storage_path,
                exc,
            )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
