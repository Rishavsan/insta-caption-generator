from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401
from .config import settings
from .db import Base, engine, ensure_schema_updates
from .logging_config import configure_logging
from .routers import auth, music, posts


logger = configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting application")
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    logger.info("Database tables ensured")
    yield
    logger.info("Stopping application")


app = FastAPI(title="Creator Growth API", version="0.1.0", lifespan=lifespan)
request_logger = logging.getLogger("app.request")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    client_host = request.client.host if request.client else "unknown"
    request_logger.info("Request started method=%s path=%s client=%s", request.method, request.url.path, client_host)
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    request_logger.info(
        "Request completed method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on path=%s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health() -> dict[str, str]:
    logger.debug("Health check requested")
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(music.router, prefix="/api/v1")
app.include_router(posts.router, prefix="/api/v1")
