"""
Admin routes for viewing tokens and setting up GitHub Actions
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import os
from dotenv import dotenv_values

from app.services.spotify_service import SpotifyService
from app.services.apple_music_service import AppleMusicService

router = APIRouter()


@router.get("/tokens")
async def get_tokens(request: Request):
    """Get all tokens and credentials needed for GitHub Actions setup"""
    session = request.session

    # Check if any service is connected
    spotify_connected = bool(session.get("spotify_tokens"))
    apple_connected = bool(session.get("apple_user_token"))

    if not spotify_connected and not apple_connected:
        raise HTTPException(
            status_code=401,
            detail="No services connected. Please connect Spotify and/or Apple Music first."
        )

    # Get environment variables
    env_values = dotenv_values('.env')

    # Prepare response
    response = {
        "connected": {
            "spotify": spotify_connected,
            "apple": apple_connected
        },
        "tokens": {},
        "env_vars": {},
        "github_secrets": []
    }

    # Spotify tokens
    if spotify_connected:
        spotify_tokens = session.get("spotify_tokens", {})
        response["tokens"]["spotify"] = {
            "access_token": spotify_tokens.get("access_token", ""),
            "refresh_token": spotify_tokens.get("refresh_token", ""),
            "expires_at": spotify_tokens.get("expires_at", "")
        }

        # Environment variables
        response["env_vars"]["SPOTIFY_CLIENT_ID"] = env_values.get("SPOTIFY_CLIENT_ID", "")
        response["env_vars"]["SPOTIFY_CLIENT_SECRET"] = env_values.get("SPOTIFY_CLIENT_SECRET", "")

        # GitHub secrets
        response["github_secrets"].extend([
            {
                "name": "SPOTIFY_CLIENT_ID",
                "value": env_values.get("SPOTIFY_CLIENT_ID", ""),
                "description": "Spotify API Client ID"
            },
            {
                "name": "SPOTIFY_CLIENT_SECRET",
                "value": env_values.get("SPOTIFY_CLIENT_SECRET", ""),
                "description": "Spotify API Client Secret"
            },
            {
                "name": "SPOTIFY_REFRESH_TOKEN",
                "value": spotify_tokens.get("refresh_token", ""),
                "description": "Spotify Refresh Token (long-lived)"
            }
        ])

    # Apple Music tokens
    if apple_connected:
        apple_user_token = session.get("apple_user_token", "")
        apple_dev_token = session.get("apple_developer_token", "")

        response["tokens"]["apple"] = {
            "user_token": apple_user_token,
            "developer_token": apple_dev_token
        }

        # Environment variables
        response["env_vars"]["APPLE_TEAM_ID"] = env_values.get("APPLE_TEAM_ID", "")
        response["env_vars"]["APPLE_KEY_ID"] = env_values.get("APPLE_KEY_ID", "")
        response["env_vars"]["APPLE_PRIVATE_KEY_PATH"] = env_values.get("APPLE_PRIVATE_KEY_PATH", "")

        # Read private key contents
        private_key_path = env_values.get("APPLE_PRIVATE_KEY_PATH", "")
        private_key_contents = ""
        if private_key_path and os.path.exists(private_key_path):
            try:
                with open(private_key_path, 'r') as f:
                    private_key_contents = f.read()
            except Exception as e:
                print(f"Warning: Could not read private key: {e}")

        # GitHub secrets
        response["github_secrets"].extend([
            {
                "name": "APPLE_TEAM_ID",
                "value": env_values.get("APPLE_TEAM_ID", ""),
                "description": "Apple Developer Team ID"
            },
            {
                "name": "APPLE_KEY_ID",
                "value": env_values.get("APPLE_KEY_ID", ""),
                "description": "Apple Music API Key ID"
            },
            {
                "name": "APPLE_PRIVATE_KEY",
                "value": private_key_contents,
                "description": "Apple Music Private Key (.p8 file contents)"
            },
            {
                "name": "APPLE_MUSIC_USER_TOKEN",
                "value": apple_user_token,
                "description": "Apple Music User Token (expires in ~6 months)"
            }
        ])

    return response


@router.get("/playlists")
async def get_all_playlists(request: Request):
    """Get all playlists from connected services"""
    session = request.session

    playlists = {
        "spotify": [],
        "apple": []
    }

    # Get Spotify playlists
    spotify_tokens = session.get("spotify_tokens")
    if spotify_tokens:
        try:
            spotify_service = SpotifyService(spotify_tokens["access_token"])
            spotify_playlists = spotify_service.get_user_playlists()

            playlists["spotify"] = [
                {
                    "id": p.id,
                    "name": p.name,
                    "track_count": p.track_count,
                    "owner": p.owner
                }
                for p in spotify_playlists
            ]
        except Exception as e:
            print(f"Error fetching Spotify playlists: {e}")

    # Get Apple Music playlists
    apple_token = session.get("apple_user_token")
    if apple_token:
        try:
            apple_dev_token = session.get("apple_developer_token")
            apple_service = AppleMusicService(apple_token, developer_token=apple_dev_token)
            apple_playlists = apple_service.get_user_playlists()

            playlists["apple"] = [
                {
                    "id": p.id,
                    "name": p.name,
                    "track_count": p.track_count
                }
                for p in apple_playlists
            ]
        except Exception as e:
            print(f"Error fetching Apple Music playlists: {e}")

    return playlists


@router.post("/generate-config")
async def generate_sync_config(request: Request):
    """Generate sync_config.yml based on user selections"""
    try:
        body = await request.json()
        selected_playlists = body.get("playlists", [])

        if not selected_playlists:
            raise HTTPException(status_code=400, detail="No playlists selected")

        # Generate YAML content
        yaml_content = """# Syncify Automated Sync Configuration
# Generated from Admin Panel

sync_jobs:
"""

        for playlist in selected_playlists:
            yaml_content += f"""  - name: "{playlist['name']}"
    source:
      service: {playlist['source_service']}
      playlist_id: "{playlist['source_id']}"
    destination:
      service: {playlist['dest_service']}
      mode: update  # Options: create, update
      playlist_name: "{playlist['name']} (from {playlist['source_service'].title()})"

"""

        yaml_content += """
# Global settings
settings:
  skip_unmatched: true
  log_level: INFO
  retry_on_failure: true
  max_retries: 3
"""

        return JSONResponse(
            content={"config": yaml_content},
            headers={
                "Content-Type": "application/x-yaml"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate config: {str(e)}")
