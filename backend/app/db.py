import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings


logger = logging.getLogger("app.db")
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema_updates() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())
        if "posts" not in table_names:
            return

        post_columns = {column["name"] for column in inspector.get_columns("posts")}
        if "music_metadata" not in post_columns:
            column_type = "JSONB" if engine.dialect.name == "postgresql" else "JSON"
            connection.execute(text(f"ALTER TABLE posts ADD COLUMN music_metadata {column_type}"))
            logger.info("Added posts.music_metadata column")


def get_db():
    db = SessionLocal()
    logger.debug("Database session opened")
    try:
        yield db
    finally:
        db.close()
        logger.debug("Database session closed")
