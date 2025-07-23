import requests
import jwt
from typing import List, Dict, Optional
import urllib.parse
import time

from app.config.apple import AppleMusicConfig
from app.models.track import Track, Playlist

class AppleMusicService:
    def __init__(self, user_token: str):
        self.user_token = user_token
        self.developer_token = AppleMusicConfig.generate_developer_token()
        self.base_url = AppleMusicConfig.API_BASE_URL
        self.service_name = "Apple Music"

        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {self.developer_token}',
            'Music-User-Token': self.user_token,
            'Content-Type': 'application/json'
        })

    @classmethod
    def exchange_code_for_token(cls, authorization_code: str) -> Dict[str, str]:
        """Exchange authorization code for user token (Sign in with Apple)"""
        try:
            client_secret = AppleMusicConfig.generate_signin_client_secret()

            data = {
                'client_id': AppleMusicConfig.SERVICE_ID,
                'client_secret': client_secret,
                'code': authorization_code,
                'grant_type': 'authorization_code',
                'redirect_uri': AppleMusicConfig.SIGNIN_REDIRECT_URI
            }

            response = requests.post(
                'https://appleid.apple.com/auth/token',
                data=data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Token exchange failed: {response.text}")
        except Exception as e:
            raise Exception(f"Failed to exchange code for token: {str(e)}")

    def get_current_user(self) -> Dict:
        """Get current user information (limited in Apple Music API)"""
        try:
            # Apple Music API doesn't provide extensive user info
            # We'll return basic info or make a test call to verify token
            response = self.session.get(f"{self.base_url}/me/library/playlists?limit=1")

            if response.status_code == 200:
                return {"id": "current_user", "display_name": "Apple Music User"}
            else:
                raise Exception("Invalid user token")
        except Exception as e:
            raise Exception(f"Failed to get current user: {str(e)}")

    def get_user_playlists(self, limit: int = 100) -> List[Playlist]:
        """Get user's library playlists"""
        try:
            playlists = []
            offset = 0

            while True:
                response = self.session.get(
                    f"{self.base_url}/me/library/playlists",
                    params={'limit': limit, 'offset': offset}
                )

                if response.status_code != 200:
                    raise Exception(f"API request failed: {response.text}")

                data = response.json()

                for item in data['data']:
                    attributes = item['attributes']

                    # Extract artwork if available
                    images = []
                    if 'artwork' in attributes:
                        artwork = attributes['artwork']
                        url_template = artwork.get('url', '')
                        if url_template:
                            artwork_url = url_template.replace('{w}', '640').replace('{h}', '640')
                            images = [{'url': artwork_url, 'width': 640, 'height': 640}]

                    playlist = Playlist(
                        id=item['id'],
                        name=attributes['name'],
                        description=attributes.get('description', {}).get('standard', ''),
                        track_count=attributes.get('trackCount', 0),
                        images=images
                    )
                    playlists.append(playlist)

                # Check if there are more results
                if 'next' not in data or not data['next']:
                    break
                offset += limit

            return playlists
        except Exception as e:
            raise Exception(f"Failed to get user playlists: {str(e)}")

    def get_playlist_details(self, playlist_id: str) -> Playlist:
        """Get playlist details"""
        try:
            response = self.session.get(f"{self.base_url}/me/library/playlists/{playlist_id}")

            if response.status_code != 200:
                raise Exception(f"API request failed: {response.text}")

            data = response.json()
            item = data['data'][0]
            attributes = item['attributes']

            # Extract artwork if available
            images = []
            if 'artwork' in attributes:
                artwork = attributes['artwork']
                # Apple Music artwork URLs can be customized by replacing {w} and {h} with desired dimensions
                url_template = artwork.get('url', '')
                if url_template:
                    # Replace placeholders with standard playlist cover dimensions
                    artwork_url = url_template.replace('{w}', '640').replace('{h}', '640')
                    images = [{'url': artwork_url, 'width': 640, 'height': 640}]

            return Playlist(
                id=item['id'],
                name=attributes['name'],
                description=attributes.get('description', {}).get('standard', ''),
                track_count=attributes.get('trackCount', 0),
                images=images
            )
        except Exception as e:
            raise Exception(f"Failed to get playlist details: {str(e)}")

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        """Get all tracks from a playlist"""
        try:
            tracks = []
            offset = 0
            limit = 100

            while True:
                response = self.session.get(
                    f"{self.base_url}/me/library/playlists/{playlist_id}/tracks",
                    params={'limit': limit, 'offset': offset}
                )

                if response.status_code != 200:
                    raise Exception(f"API request failed: {response.text}")

                data = response.json()

                for item in data['data']:
                    attributes = item['attributes']
                    track = Track(
                        id=item['id'],
                        name=attributes['name'],
                        artist=attributes['artistName'],
                        album=attributes['albumName'],
                        duration_ms=attributes.get('durationInMillis'),
                        isrc=attributes.get('isrc'),
                        uri=None  # Apple Music doesn't use URIs like Spotify
                    )
                    tracks.append(track)

                # Check if there are more results
                if 'next' not in data or not data['next']:
                    break
                offset += limit

            return tracks
        except Exception as e:
            raise Exception(f"Failed to get playlist tracks: {str(e)}")

    def search_track(self, query: str, limit: int = 10) -> List[Track]:
        """Search for tracks in Apple Music catalog"""
        try:
            params = {
                'term': query,
                'types': 'songs',
                'limit': limit
            }

            response = self.session.get(f"{self.base_url}/catalog/us/search", params=params)

            if response.status_code != 200:
                raise Exception(f"Search request failed: {response.text}")

            data = response.json()
            tracks = []

            if 'songs' in data['results']:
                for item in data['results']['songs']['data']:
                    attributes = item['attributes']
                    track = Track(
                        id=item['id'],
                        name=attributes['name'],
                        artist=attributes['artistName'],
                        album=attributes['albumName'],
                        duration_ms=attributes.get('durationInMillis'),
                        isrc=attributes.get('isrc')
                    )
                    tracks.append(track)

            return tracks
        except Exception as e:
            raise Exception(f"Failed to search tracks: {str(e)}")

    def search_by_isrc(self, isrc: str) -> Optional[Track]:
        """Search for a track by ISRC"""
        try:
            params = {
                'filter[isrc]': isrc,
                'types': 'songs',
                'limit': 1
            }

            response = self.session.get(f"{self.base_url}/catalog/us/search", params=params)

            if response.status_code != 200:
                return None

            data = response.json()

            if 'songs' in data['results'] and data['results']['songs']['data']:
                item = data['results']['songs']['data'][0]
                attributes = item['attributes']
                return Track(
                    id=item['id'],
                    name=attributes['name'],
                    artist=attributes['artistName'],
                    album=attributes['albumName'],
                    duration_ms=attributes.get('durationInMillis'),
                    isrc=attributes.get('isrc')
                )

            return None
        except Exception as e:
            raise Exception(f"Failed to search by ISRC: {str(e)}")

    def create_playlist(self, name: str, description: str = "", track_ids: List[str] = None) -> Playlist:
        """Create a new playlist"""
        try:
            # Create playlist
            playlist_data = {
                'attributes': {
                    'name': name,
                    'description': description
                }
            }

            response = self.session.post(
                f"{self.base_url}/me/library/playlists",
                json={'data': [playlist_data]}
            )

            if response.status_code != 201:
                raise Exception(f"Failed to create playlist: {response.text}")

            playlist_response = response.json()
            playlist_id = playlist_response['data'][0]['id']

            # Add tracks if provided
            if track_ids:
                self.add_tracks_to_playlist(playlist_id, track_ids)

            return Playlist(
                id=playlist_id,
                name=name,
                description=description,
                track_count=len(track_ids) if track_ids else 0
            )
        except Exception as e:
            raise Exception(f"Failed to create playlist: {str(e)}")

    def add_tracks_to_playlist(self, playlist_id: str, track_ids: List[str]) -> Playlist:
        """Add tracks to an existing playlist"""
        try:
            # Apple Music API requires songs to be added in batches
            # and uses catalog IDs, not library IDs
            song_data = []
            for track_id in track_ids:
                song_data.append({
                    'id': track_id,
                    'type': 'songs'
                })

            # Add tracks in batches (Apple Music limit is typically 100)
            batch_size = 100
            for i in range(0, len(song_data), batch_size):
                batch = song_data[i:i+batch_size]

                response = self.session.post(
                    f"{self.base_url}/me/library/playlists/{playlist_id}/tracks",
                    json={'data': batch}
                )

                if response.status_code != 204:
                    raise Exception(f"Failed to add tracks to playlist: {response.text}")

            return self.get_playlist_details(playlist_id)
        except Exception as e:
            raise Exception(f"Failed to add tracks to playlist: {str(e)}")

    def find_playlist_by_name(self, name: str) -> Optional[Playlist]:
        """Find a playlist by name"""
        try:
            playlists = self.get_user_playlists()
            for playlist in playlists:
                if playlist.name == name:
                    return playlist
            return None
        except Exception as e:
            raise Exception(f"Failed to find playlist by name: {str(e)}")

    def get_capabilities(self) -> Dict:
        """Get service capabilities"""
        return {
            "canRead": True,
            "canWrite": True,
            "canCreatePlaylists": True,
            "supportsISRC": True,
            "maxPlaylistTracks": 10000,
            "batchSize": 100
        }