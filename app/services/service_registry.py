from typing import Dict, List, Optional
from app.services.spotify_service import SpotifyService
from app.services.apple_music_service import AppleMusicService

class ServiceRegistry:
    """Registry for managing music service connections"""

    @staticmethod
    def get_available_services() -> List[Dict]:
        """Get list of available music services"""
        return [
            {
                "type": "spotify",
                "name": "Spotify",
                "description": "Connect to your Spotify account",
                "icon": "🎵",
                "capabilities": {
                    "canRead": True,
                    "canWrite": True,
                    "canCreatePlaylists": True,
                    "supportsISRC": True
                }
            },
            {
                "type": "apple",
                "name": "Apple Music",
                "description": "Connect to your Apple Music account",
                "icon": "🍎",
                "capabilities": {
                    "canRead": True,
                    "canWrite": True,
                    "canCreatePlaylists": True,
                    "supportsISRC": True
                }
            }
        ]

    @staticmethod
    def get_connection_status(session: Dict) -> Dict[str, bool]:
        """Get connection status for all services"""
        return {
            "spotify": bool(session.get("spotify_tokens")),
            "apple": bool(session.get("apple_user_token"))
        }

    @staticmethod
    def get_connected_services(session: Dict) -> Dict:
        """Get connected service instances"""
        services = {}

        # Spotify service
        spotify_tokens = session.get("spotify_tokens")
        if spotify_tokens:
            services["spotify"] = SpotifyService(spotify_tokens["access_token"])

        # Apple Music service
        apple_token = session.get("apple_user_token")
        if apple_token:
            apple_dev_token = session.get("apple_developer_token")
            services["apple"] = AppleMusicService(apple_token, developer_token=apple_dev_token)

        return services

    @staticmethod
    def get_connected_service_users(session: Dict) -> Dict:
        """Get user information for connected services"""
        users = {}

        # Spotify user
        if session.get("spotify_tokens"):
            try:
                spotify_service = SpotifyService(session["spotify_tokens"]["access_token"])
                user = spotify_service.get_current_user()
                users["spotify"] = {
                    "id": user.get("id"),
                    "display_name": user.get("display_name"),
                    "email": user.get("email")
                }
            except Exception:
                pass

        # Apple Music user
        if session.get("apple_auth"):
            apple_auth = session["apple_auth"]
            users["apple"] = {
                "email": apple_auth.get("email"),
                "is_private_email": apple_auth.get("isPrivateEmail", False)
            }

        return users

    @staticmethod
    def validate_sync_requirements(session: Dict, source_type: str, destination_type: str) -> Dict:
        """Validate that required services are connected for sync"""
        connection_status = ServiceRegistry.get_connection_status(session)

        if not connection_status.get(source_type.lower()):
            return {
                "success": False,
                "message": f"Source service {source_type} is not connected"
            }

        if not connection_status.get(destination_type.lower()):
            return {
                "success": False,
                "message": f"Destination service {destination_type} is not connected"
            }

        if source_type.lower() == destination_type.lower():
            return {
                "success": False,
                "message": "Source and destination services cannot be the same"
            }

        return {"success": True}

    @staticmethod
    def disconnect_service(session: Dict, service_type: str) -> bool:
        """Disconnect a service from the session"""
        try:
            if service_type.lower() == "spotify":
                session.pop("spotify_tokens", None)
            elif service_type.lower() == "apple":
                session.pop("apple_user_token", None)
                session.pop("apple_auth", None)
            else:
                return False
            return True
        except Exception:
            return False

    @staticmethod
    def get_service_info(service_type: str) -> Optional[Dict]:
        """Get information about a specific service"""
        services = ServiceRegistry.get_available_services()
        for service in services:
            if service["type"] == service_type.lower():
                return service
        return None