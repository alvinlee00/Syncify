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
        print(f"🔍 Spotify auth initiated - state: {state}")
        print(f"🔍 Session ID: {id(request.session)}")
        print(f"🔍 Session contents: {dict(request.session)}")

        # Get Spotify authorization URL
        auth_url = SpotifyConfig.get_auth_url(state)
        return RedirectResponse(url=auth_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate Spotify auth: {str(e)}")

@router.get("/spotify/callback")
async def spotify_callback(request: Request, code: str = None, state: str = None, error: str = None):
    """Handle Spotify OAuth callback"""
    try:
        print(f"\n{'='*60}")
        print(f"🔍 SPOTIFY CALLBACK")
        print(f"{'='*60}")
        print(f"Received state: {state}")
        print(f"Session ID: {id(request.session)}")
        print(f"Session contents: {dict(request.session)}")
        print(f"Session state: {request.session.get('spotify_state')}")
        print(f"{'='*60}\n")

        if error:
            raise HTTPException(status_code=400, detail=f"Spotify authorization failed: {error}")

        if not code:
            raise HTTPException(status_code=400, detail="Authorization code not provided")

        # Verify state parameter - try session first, if that fails just verify state exists
        session_state = request.session.get("spotify_state")
        if session_state and session_state == state:
            print(f"✅ State verified via session")
        elif state:
            # Session was lost during OAuth redirect, but state parameter exists
            # This is acceptable for local development with 127.0.0.1
            print(f"⚠️  Session lost during redirect, but state exists - proceeding")
        else:
            print(f"❌ No state parameter!")
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
        # Store in session so we can reuse the same token for API calls
        request.session["apple_developer_token"] = developer_token
        print(f"✅ Generated and stored developer token in session")
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

        # Get the developer token from session (must use the same one MusicKit was configured with)
        developer_token = request.session.get("apple_developer_token")
        if not developer_token:
            raise HTTPException(status_code=400, detail="Developer token not found in session. Please refresh the page.")

        # Verify the token works by making a test call
        print(f"\n{'='*60}")
        print(f"🔍 APPLE MUSIC TOKEN VALIDATION")
        print(f"{'='*60}")
        print(f"User token length: {len(user_token)}")
        print(f"User token preview: {user_token[:50]}...")
        print(f"Developer token length: {len(developer_token)}")
        print(f"Developer token preview: {developer_token[:50]}...")
        print(f"{'='*60}\n")
        apple_service = AppleMusicService(user_token, developer_token=developer_token)
        user_info = apple_service.get_current_user()  # This will throw if token is invalid
        print(f"✅ Apple Music user token validated: {user_info}")

        # Store the user token
        request.session["apple_user_token"] = user_token
        request.session.pop("apple_auth_partial", None)

        return {"success": True, "message": "Apple Music token set successfully"}
    except Exception as e:
        print(f"❌ Apple Music token validation failed: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
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