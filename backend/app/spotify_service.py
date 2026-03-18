import base64
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from typing import Any

from .config import settings

logger = logging.getLogger("app.spotify")

_TOKEN_URL = "https://accounts.spotify.com/api/token"
_SEARCH_URL = "https://api.spotify.com/v1/search"
_cache_lock = threading.Lock()
_token_cache: dict[str, str | float | None] = {
    "access_token": None,
    "expires_at": 0.0,
}


class SpotifyConfigError(RuntimeError):
    pass


class SpotifyApiError(RuntimeError):
    pass


def _require_credentials() -> tuple[str, str]:
    client_id = (settings.SPOTIFY_CLIENT_ID or "").strip()
    client_secret = (settings.SPOTIFY_CLIENT_SECRET or "").strip()

    if not client_id or not client_secret:
        raise SpotifyConfigError("Spotify credentials are missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.")

    return client_id, client_secret


def _request_access_token(client_id: str, client_secret: str) -> tuple[str, float]:
    encoded = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    payload = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")
    headers = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    request = urllib.request.Request(_TOKEN_URL, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        logger.error("Spotify token request failed status=%s body=%s", exc.code, error_body[:500])
        raise SpotifyApiError("Could not authenticate with Spotify.") from exc
    except urllib.error.URLError as exc:
        logger.error("Spotify token request network error: %s", exc)
        raise SpotifyApiError("Could not connect to Spotify.") from exc

    data = json.loads(body)
    access_token = data.get("access_token")
    expires_in = data.get("expires_in")

    if not isinstance(access_token, str) or not isinstance(expires_in, int):
        logger.error("Spotify token response invalid body=%s", body[:500])
        raise SpotifyApiError("Received invalid auth response from Spotify.")

    buffer_seconds = max(settings.SPOTIFY_TOKEN_BUFFER_SECONDS, 0)
    expires_at = time.time() + max(expires_in - buffer_seconds, 1)
    return access_token, expires_at


def _get_access_token() -> str:
    with _cache_lock:
        token = _token_cache.get("access_token")
        expires_at = _token_cache.get("expires_at")

        if isinstance(token, str) and isinstance(expires_at, float) and time.time() < expires_at:
            return token

        client_id, client_secret = _require_credentials()
        token, next_expiry = _request_access_token(client_id=client_id, client_secret=client_secret)
        _token_cache["access_token"] = token
        _token_cache["expires_at"] = next_expiry
        return token


def _to_track_metadata(item: Mapping[str, Any]) -> dict[str, Any]:
    artists_raw = item.get("artists")
    artist_names: list[str] = []
    if isinstance(artists_raw, list):
        artist_names = [str(artist.get("name", "")).strip() for artist in artists_raw if isinstance(artist, dict)]
        artist_names = [name for name in artist_names if name]

    album_name: str | None = None
    image_url: str | None = None
    album_raw = item.get("album")
    if isinstance(album_raw, dict):
        name_raw = album_raw.get("name")
        if isinstance(name_raw, str) and name_raw.strip():
            album_name = name_raw.strip()

        images_raw = album_raw.get("images")
        if isinstance(images_raw, list):
            for image in images_raw:
                if isinstance(image, dict):
                    image_candidate = image.get("url")
                    if isinstance(image_candidate, str) and image_candidate.strip():
                        image_url = image_candidate
                        break

    external_url: str | None = None
    external_urls_raw = item.get("external_urls")
    if isinstance(external_urls_raw, dict):
        external_candidate = external_urls_raw.get("spotify")
        if isinstance(external_candidate, str) and external_candidate.strip():
            external_url = external_candidate

    track_id = item.get("id")
    song_name = item.get("name")
    duration_ms = item.get("duration_ms")
    preview_url = item.get("preview_url")

    return {
        "provider": "spotify",
        "track_id": str(track_id or ""),
        "song_name": str(song_name or "").strip(),
        "artist_names": artist_names,
        "album_name": album_name,
        "image_url": image_url,
        "duration_ms": duration_ms if isinstance(duration_ms, int) else None,
        "external_url": external_url,
        "preview_url": preview_url if isinstance(preview_url, str) else None,
    }


def _search_tracks_with_token(*, token: str, query: str, limit: int) -> list[dict[str, Any]]:
    request_params: dict[str, str] = {
        "q": query,
        "type": "track",
        "limit": str(limit),
    }

    configured_market = (settings.SPOTIFY_SEARCH_MARKET or "").strip().upper()
    if configured_market and configured_market != "FROM_TOKEN":
        request_params["market"] = configured_market

    params = urllib.parse.urlencode(request_params)
    search_url = f"{_SEARCH_URL}?{params}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    request = urllib.request.Request(search_url, headers=headers, method="GET")

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        logger.error("Spotify search failed status=%s body=%s", exc.code, error_body[:500])
        if exc.code == 401:
            raise PermissionError("Spotify token expired or invalid") from exc
        if exc.code == 403 and "Insufficient client scope" in error_body:
            raise SpotifyApiError(
                "Spotify denied the request due to insufficient scope. "
                "With Client Credentials flow, do not use market=from_token.",
            ) from exc
        if exc.code == 429:
            raise SpotifyApiError("Spotify rate limit reached. Please try again in a moment.") from exc
        raise SpotifyApiError("Spotify search failed.") from exc
    except urllib.error.URLError as exc:
        logger.error("Spotify search network error: %s", exc)
        raise SpotifyApiError("Could not connect to Spotify.") from exc

    payload = json.loads(body)
    tracks_container = payload.get("tracks")
    if not isinstance(tracks_container, dict):
        return []

    items = tracks_container.get("items")
    if not isinstance(items, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue

        mapped = _to_track_metadata(item)
        if mapped["track_id"] and mapped["song_name"]:
            normalized.append(mapped)

    return normalized


def search_spotify_tracks(*, query: str, limit: int) -> list[dict[str, Any]]:
    cleaned_query = query.strip()
    if not cleaned_query:
        return []

    max_limit = max(settings.SPOTIFY_SEARCH_MAX_RESULTS, 1)
    safe_limit = min(max(limit, 1), max_limit)

    token = _get_access_token()
    try:
        return _search_tracks_with_token(token=token, query=cleaned_query, limit=safe_limit)
    except PermissionError:
        with _cache_lock:
            _token_cache["access_token"] = None
            _token_cache["expires_at"] = 0.0
        fresh_token = _get_access_token()
        return _search_tracks_with_token(token=fresh_token, query=cleaned_query, limit=safe_limit)
