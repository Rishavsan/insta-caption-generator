from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import get_current_user
from ..models import User
from ..schemas import SongMetadata
from ..spotify_service import SpotifyApiError, SpotifyConfigError, search_spotify_tracks

router = APIRouter(prefix="/music", tags=["music"])


@router.get("/search", response_model=list[SongMetadata])
def search_music(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=8, ge=1, le=20),
    _: User = Depends(get_current_user),
) -> list[SongMetadata]:
    try:
        results = search_spotify_tracks(query=q, limit=limit)
    except SpotifyConfigError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except SpotifyApiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return [SongMetadata.model_validate(item) for item in results]
