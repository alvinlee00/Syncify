import os
import time
import jwt
from dotenv import load_dotenv

load_dotenv()

class AppleMusicConfig:
    TEAM_ID = os.getenv("APPLE_TEAM_ID")
    KEY_ID = os.getenv("APPLE_KEY_ID")
    PRIVATE_KEY_PATH = os.getenv("APPLE_PRIVATE_KEY_PATH")

    # Apple Music API endpoints
    API_BASE_URL = "https://api.music.apple.com/v1"

    # Sign in with Apple configuration
    SERVICE_ID = os.getenv("APPLE_SERVICE_ID")
    SIGNIN_KEY_ID = os.getenv("APPLE_SIGNIN_KEY_ID")
    SIGNIN_PRIVATE_KEY_PATH = os.getenv("APPLE_SIGNIN_PRIVATE_KEY_PATH")
    SIGNIN_REDIRECT_URI = os.getenv("APPLE_SIGNIN_REDIRECT_URI", "http://127.0.0.1:3000/auth/apple/callback")

    @classmethod
    def generate_developer_token(cls) -> str:
        """Generate Apple Music API developer token"""
        if not all([cls.TEAM_ID, cls.KEY_ID]):
            raise ValueError("Missing Apple Music API credentials (TEAM_ID, KEY_ID)")

        # Support loading private key from environment variable (for CI/CD) or file path (for local dev)
        private_key = os.getenv("APPLE_PRIVATE_KEY")
        if private_key:
            # Private key provided directly as environment variable (GitHub Actions, etc.)
            pass
        elif cls.PRIVATE_KEY_PATH:
            # Private key path provided, read from file (local development)
            try:
                with open(cls.PRIVATE_KEY_PATH, 'r') as key_file:
                    private_key = key_file.read()
            except FileNotFoundError:
                raise ValueError(f"Apple Music private key file not found: {cls.PRIVATE_KEY_PATH}")
        else:
            raise ValueError("Missing Apple Music private key: set APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH")

        headers = {
            "alg": "ES256",
            "kid": cls.KEY_ID
        }

        payload = {
            "iss": cls.TEAM_ID,
            "iat": int(time.time()),
            "exp": int(time.time()) + 15777000  # 6 months
        }

        token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
        return token

    @classmethod
    def generate_signin_client_secret(cls) -> str:
        """Generate client secret for Sign in with Apple"""
        if not all([cls.TEAM_ID, cls.SERVICE_ID, cls.SIGNIN_KEY_ID, cls.SIGNIN_PRIVATE_KEY_PATH]):
            raise ValueError("Missing Sign in with Apple credentials")

        try:
            with open(cls.SIGNIN_PRIVATE_KEY_PATH, 'r') as key_file:
                private_key = key_file.read()
        except FileNotFoundError:
            raise ValueError(f"Sign in with Apple private key file not found: {cls.SIGNIN_PRIVATE_KEY_PATH}")

        headers = {
            "alg": "ES256",
            "kid": cls.SIGNIN_KEY_ID
        }

        payload = {
            "iss": cls.TEAM_ID,
            "iat": int(time.time()),
            "exp": int(time.time()) + 15777000,  # 6 months
            "aud": "https://appleid.apple.com",
            "sub": cls.SERVICE_ID
        }

        token = jwt.encode(payload, private_key, algorithm="ES256", headers=headers)
        return token

    @classmethod
    def get_signin_auth_url(cls, state: str = None) -> str:
        """Generate Sign in with Apple authorization URL"""
        import urllib.parse

        params = {
            "client_id": cls.SERVICE_ID,
            "redirect_uri": cls.SIGNIN_REDIRECT_URI,
            "response_type": "code",
            "scope": "name email",
            "response_mode": "form_post"
        }

        if state:
            params["state"] = state

        return f"https://appleid.apple.com/auth/authorize?{urllib.parse.urlencode(params)}"