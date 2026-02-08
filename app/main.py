from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv

from app.routes import auth, playlists, sync, services, admin

load_dotenv()

app = FastAPI(
    title="Syncify",
    description="Universal playlist synchronization service",
    version="2.0.0"
)

# Add session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "syncify-secret-key"),
    max_age=24 * 60 * 60,  # 24 hours
    same_site="lax",  # Allow OAuth redirects
    https_only=False  # Set to True in production with HTTPS
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://127.0.0.1:{os.getenv('PORT', 3000)}",
        f"http://localhost:{os.getenv('PORT', 3000)}"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="public"), name="static")

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(playlists.router, prefix="/api/playlists", tags=["playlists"])
app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
app.include_router(services.router, prefix="/api/services", tags=["services"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/")
async def serve_index():
    """Serve the main application page"""
    return FileResponse("public/index.html")

@app.get("/admin")
async def serve_admin():
    """Serve the admin panel page"""
    return FileResponse("public/admin.html")

@app.get("/{filename}")
async def serve_static_files(filename: str):
    """Serve static files at root level for compatibility"""
    # Only serve specific file types for security
    if filename.endswith((".js", ".css", ".png", ".jpg", ".ico", ".svg")):
        file_path = os.path.join("public", filename)
        if os.path.isfile(file_path):
            return FileResponse(file_path)

    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/status")
async def get_status(request: Request):
    """Get the current authentication status"""
    session = request.session

    return {
        "spotify": "connected" if session.get("spotify_tokens") else "disconnected",
        "apple": "connected" if session.get("apple_user_token") else "disconnected",
        "appleAuth": session.get("apple_auth") if session.get("apple_auth") else None
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)