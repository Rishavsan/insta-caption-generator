import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings


logger = logging.getLogger("app.db")
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    logger.debug("Database session opened")
    try:
        yield db
    except Exception:
        logger.exception("Database session failed")
        raise
    finally:
        db.close()
        logger.debug("Database session closed")
