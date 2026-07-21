from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.api.endpoints import (
    auth,
    resumes,
    job_descriptions,
    analyses,
    features,
    clone_style,
    assessments,
    tracker
)

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware config
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(resumes.router, prefix=f"{settings.API_V1_STR}/resumes", tags=["resumes"])
app.include_router(job_descriptions.router, prefix=f"{settings.API_V1_STR}/job-descriptions", tags=["job-descriptions"])
app.include_router(analyses.router, prefix=f"{settings.API_V1_STR}/analyses", tags=["analyses"])
app.include_router(features.router, prefix=f"{settings.API_V1_STR}/features", tags=["features"])
app.include_router(assessments.router, prefix=f"{settings.API_V1_STR}/assessments", tags=["assessments"])
app.include_router(clone_style.router, prefix=f"{settings.API_V1_STR}/clone-style", tags=["clone-style"])
app.include_router(tracker.router, prefix=f"{settings.API_V1_STR}/tracker", tags=["tracker"])

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}
