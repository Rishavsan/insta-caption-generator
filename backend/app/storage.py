import asyncio
import logging
import mimetypes
import urllib.error
import urllib.parse
import urllib.request
from uuid import uuid4

from .config import settings

logger = logging.getLogger("app.storage")


class StorageError(RuntimeError):
    pass


class StorageConfigError(StorageError):
    pass


class StorageUploadError(StorageError):
    pass


class StorageDeleteError(StorageError):
    pass


def max_upload_bytes() -> int:
    return settings.SUPABASE_MAX_UPLOAD_MB * 1024 * 1024


def _file_extension(file_name: str | None, content_type: str | None) -> str:
    if file_name and "." in file_name:
        extension = f".{file_name.rsplit('.', 1)[1].strip().lower()}"
        sanitized = extension.replace(".", "")
        if sanitized.isalnum() and len(sanitized) <= 12:
            return extension

    guessed_extension = mimetypes.guess_extension(content_type or "")
    if guessed_extension:
        return guessed_extension

    return ".jpg"


def _build_storage_path(user_id: int, file_name: str | None, content_type: str | None) -> str:
    extension = _file_extension(file_name=file_name, content_type=content_type)
    return f"user-{user_id}/{uuid4().hex}{extension}"


def _upload_bytes(upload_url: str, file_bytes: bytes, headers: dict[str, str]) -> tuple[int, str]:
    request = urllib.request.Request(upload_url, data=file_bytes, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="ignore")
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return exc.code, body
    except urllib.error.URLError as exc:
        raise StorageUploadError("Network error while uploading to Supabase Storage.") from exc


def _delete_object(delete_url: str, headers: dict[str, str]) -> tuple[int, str]:
    request = urllib.request.Request(delete_url, headers=headers, method="DELETE")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="ignore")
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return exc.code, body
    except urllib.error.URLError as exc:
        raise StorageDeleteError("Network error while deleting file from Supabase Storage.") from exc


async def upload_image_to_supabase(
    *,
    user_id: int,
    file_name: str | None,
    content_type: str | None,
    file_bytes: bytes,
) -> tuple[str, str]:
    project_url = settings.supabase_project_url
    service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
    bucket = settings.SUPABASE_STORAGE_BUCKET.strip()

    if not project_url or not service_role_key:
        raise StorageConfigError(
            "Supabase Storage is not configured. Set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    if not bucket:
        raise StorageConfigError("SUPABASE_STORAGE_BUCKET cannot be empty.")

    storage_path = _build_storage_path(user_id=user_id, file_name=file_name, content_type=content_type)
    upload_url = f"{project_url}/storage/v1/object/{bucket}/{storage_path}"

    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "false",
    }

    status_code, response_body = await asyncio.to_thread(
        _upload_bytes,
        upload_url,
        file_bytes,
        headers,
    )

    if status_code >= 400:
        logger.error(
            "Supabase upload failed status=%s body=%s",
            status_code,
            response_body[:500],
        )
        raise StorageUploadError("Could not upload image to Supabase Storage.")

    public_url = f"{project_url}/storage/v1/object/public/{bucket}/{storage_path}"
    return storage_path, public_url


async def delete_image_from_supabase(*, storage_path: str) -> None:
    path = storage_path.strip()
    if not path:
        return

    project_url = settings.supabase_project_url
    service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
    bucket = settings.SUPABASE_STORAGE_BUCKET.strip()

    if not project_url or not service_role_key:
        raise StorageConfigError(
            "Supabase Storage is not configured. Set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )

    if not bucket:
        raise StorageConfigError("SUPABASE_STORAGE_BUCKET cannot be empty.")

    encoded_path = urllib.parse.quote(path, safe="/")
    delete_url = f"{project_url}/storage/v1/object/{bucket}/{encoded_path}"
    headers = {
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
    }

    status_code, response_body = await asyncio.to_thread(_delete_object, delete_url, headers)
    if status_code == 404:
        return

    if status_code >= 400:
        logger.error(
            "Supabase delete failed status=%s path=%s body=%s",
            status_code,
            path,
            response_body[:500],
        )
        raise StorageDeleteError("Could not delete image from Supabase Storage.")
