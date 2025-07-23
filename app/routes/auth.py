from fastapi import APIRouter, Request, HTTPException, Form
from fastapi.responses import RedirectResponse
import urllib.parse
import uuid

from app.config.spotify import SpotifyConfig
from app.config.apple import AppleMusicConfig
from app.services.spotify_service import SpotifyService
from app.services.apple_music_service import AppleMusicService

router = APIRouter()

@router.get("/spotify")
async def spotify_auth(request: Request):
    """Initiate Spotify OAuth flow"""
    try:
        # Generate state for CSRF protection
        state = str(uuid.uuid4())
        request.session["spotify_state"] = state

        # Get Spotify authorization URL
        auth_url = SpotifyConfig.get_auth_url(state)
        return RedirectResponse(url=auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate Spotify auth: {str(e)}")

@router.get("/spotify/callback")
async def spotify_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Spotify OAuth callback"""
    try:
        if error:
            raise HTTPException(status_code=400, detail=f"Spotify authorization failed: {error}")

        if not code:
            raise HTTPException(status_code=400, detail="Authorization code not provided")

        # Verify state parameter
        session_state = request.session.get("spotify_state")
        if not session_state or session_state != state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")

        # Exchange code for tokens
        tokens = SpotifyService.get_tokens_from_code(code, state)

        # Store tokens in session
        request.session["spotify_tokens"] = tokens

        # Get user info and store
        spotify_service = SpotifyService(tokens["access_token"])
        user = spotify_service.get_current_user()
        request.session["spotify_user"] = {
            "id": user.get("id"),
            "display_name": user.get("display_name"),
            "email": user.get("email")
        }

        # Clean up state
        request.session.pop("spotify_state", None)

        # Redirect back to main app
        return RedirectResponse(url="/")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to complete Spotify auth: {str(e)}")

@router.get("/apple/developer-token")
async def get_apple_developer_token(request: Request):
    """Get Apple Music developer token for MusicKit JS"""
    try:
        developer_token = AppleMusicConfig.generate_developer_token()
        return {"developerToken": developer_token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate developer token: {str(e)}")

@router.post("/apple/music-token")
async def set_apple_music_token(request: Request):
    """Set Apple Music user token from frontend"""
    try:
        body = await request.json()
        user_token = body.get("userToken")

        if not user_token:
            raise HTTPException(status_code=400, detail="User token not provided")

        # Verify the token works by making a test call
        apple_service = AppleMusicService(user_token)
        apple_service.get_current_user()  # This will throw if token is invalid

        # Store the user token
        request.session["apple_user_token"] = user_token
        request.session.pop("apple_auth_partial", None)

        return {"success": True, "message": "Apple Music token set successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set Apple Music token: {str(e)}")

@router.post("/refresh")
async def refresh_tokens(request: Request):
    """Refresh expired tokens"""
    try:
        refreshed = {}

        # Refresh Spotify token if needed
        spotify_tokens = request.session.get("spotify_tokens")
        if spotify_tokens and spotify_tokens.get("refresh_token"):
            try:
                new_tokens = SpotifyService.refresh_access_token(spotify_tokens["refresh_token"])
                request.session["spotify_tokens"] = new_tokens
                refreshed["spotify"] = True
            except Exception as e:
                print(f"Failed to refresh Spotify token: {e}")
                refreshed["spotify"] = False

        # Apple Music tokens don't expire in the same way
        # The user token is long-lived and developer token is generated fresh each time

        return {"success": True, "refreshed": refreshed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh tokens: {str(e)}")

@router.post("/logout/{service}")
async def logout_service(request: Request, service: str):
    """Logout from a specific service"""
    try:
        if service.lower() == "spotify":
            request.session.pop("spotify_tokens", None)
            request.session.pop("spotify_user", None)
        elif service.lower() == "apple":
            request.session.pop("apple_user_token", None)
            request.session.pop("apple_auth", None)
        else:
            raise HTTPException(status_code=400, detail="Unknown service")

        return {"success": True, "message": f"Logged out from {service}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to logout: {str(e)}")

@router.post("/logout")
async def logout_all(request: Request):
    """Logout from all services"""
    try:
        # Clear all authentication data
        keys_to_remove = [
            "spotify_tokens", "spotify_user", "spotify_state",
            "apple_user_token", "apple_auth"
        ]

        for key in keys_to_remove:
            request.session.pop(key, None)

        return {"success": True, "message": "Logged out from all services"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to logout: {str(e)}")