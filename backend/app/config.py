from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(raw_url: str) -> str:
    """Accept common Postgres URL variants and enforce SSL for hosted databases."""
    url = raw_url.strip()

    if url.startswith("postgres://"):
        url = f"postgresql+psycopg://{url[len('postgres://') :]}"
    elif url.startswith("postgresql://"):
        url = f"postgresql+psycopg://{url[len('postgresql://') :]}"

    parsed = urlparse(url)
    if parsed.hostname and parsed.hostname not in {"localhost", "127.0.0.1"}:
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query.setdefault("sslmode", "require")
        parsed = parsed._replace(query=urlencode(query))
        url = urlunparse(parsed)

    return url


class Settings(BaseSettings):
    SUPABASE_DB_URL: str | None = None
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/creator_growth"
    JWT_SECRET_KEY: str = "change_me_in_production"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_ALGORITHM: str = "HS256"
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        # Prefer Supabase when provided, but keep DATABASE_URL for compatibility.
        return _normalize_database_url(self.SUPABASE_DB_URL or self.DATABASE_URL)


settings = Settings()
