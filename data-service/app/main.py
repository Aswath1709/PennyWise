"""
PennyWise Data Service - Main Application
Handles PDF parsing, AI categorization, and data analytics
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import pdf_parser, categorization, analytics, insights, nlp_query
from app.services.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    print("🚀 Starting PennyWise Data Service...")
    await init_db()
    yield
    # Shutdown
    print("👋 Shutting down Data Service...")


app = FastAPI(
    title="PennyWise Data Service",
    description="AI-powered financial data processing microservice",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pdf_parser.router, prefix="/api/pdf", tags=["PDF Parsing"])
app.include_router(categorization.router, prefix="/api/categorize", tags=["AI Categorization"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(insights.router, prefix="/api/insights", tags=["AI Insights"])
app.include_router(nlp_query.router, prefix="/api/query", tags=["Natural Language Query"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "data-service"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "PennyWise Data Service",
        "version": "2.0.0",
        "endpoints": {
            "pdf_parsing": "/api/pdf/parse",
            "categorization": "/api/categorize",
            "analytics": "/api/analytics",
            "insights": "/api/insights",
            "nlp_query": "/api/query"
        }
    }
