import os
from dotenv import load_dotenv

load_dotenv()

class SpotifyConfig:
    CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
    CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
    REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:3000/auth/spotify/callback")

    # Spotify API endpoints
    API_BASE_URL = "https://api.spotify.com/v1"
    AUTH_URL = "https://accounts.spotify.com/authorize"
    TOKEN_URL = "https://accounts.spotify.com/api/token"

    # Required scopes for playlist operations
    SCOPES = [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-read-collaborative",
        "playlist-modify-public",
        "playlist-modify-private"
    ]

    @classmethod
    def get_auth_url(cls, state: str = None) -> str:
        """Generate Spotify authorization URL"""
        import urllib.parse

        params = {
            "client_id": cls.CLIENT_ID,
            "response_type": "code",
            "redirect_uri": cls.REDIRECT_URI,
            "scope": " ".join(cls.SCOPES),
            "show_dialog": "true"
        }

        if state:
            params["state"] = state

        return f"{cls.AUTH_URL}?{urllib.parse.urlencode(params)}"