from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class SongMetadata(BaseModel):
    provider: str = "spotify"
    track_id: str
    song_name: str
    artist_names: list[str]
    album_name: str | None = None
    image_url: str | None = None
    duration_ms: int | None = None
    external_url: str | None = None
    preview_url: str | None = None


class PostPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    image_url: str
    caption: str | None
    music_info: str | None
    music_metadata: SongMetadata | None
    created_at: datetime


class PostUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=2200)
    music_info: str | None = Field(default=None, max_length=255)
    music_metadata: SongMetadata | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
