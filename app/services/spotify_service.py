import spotipy
from spotipy.oauth2 import SpotifyOAuth
from typing import List, Dict, Optional
import requests

from app.config.spotify import SpotifyConfig
from app.models.track import Track, Playlist

class SpotifyService:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.client = spotipy.Spotify(auth=access_token)
        self.service_name = "Spotify"

    @classmethod
    def create_oauth_handler(cls, state: str = None) -> SpotifyOAuth:
        """Create Spotify OAuth handler"""
        return SpotifyOAuth(
            client_id=SpotifyConfig.CLIENT_ID,
            client_secret=SpotifyConfig.CLIENT_SECRET,
            redirect_uri=SpotifyConfig.REDIRECT_URI,
            scope=" ".join(SpotifyConfig.SCOPES),
            state=state,
            show_dialog=True
        )

    @classmethod
    def get_tokens_from_code(cls, code: str, state: str = None) -> Dict[str, str]:
        """Exchange authorization code for access tokens"""
        oauth = cls.create_oauth_handler(state)
        return oauth.get_access_token(code)

    @classmethod
    def refresh_access_token(cls, refresh_token: str) -> Dict[str, str]:
        """Refresh expired access token"""
        oauth = cls.create_oauth_handler()
        return oauth.refresh_access_token(refresh_token)

    def get_current_user(self) -> Dict:
        """Get current user information"""
        try:
            return self.client.current_user()
        except Exception as e:
            raise Exception(f"Failed to get current user: {str(e)}")

    def get_user_playlists(self, limit: int = 50) -> List[Playlist]:
        """Get user's playlists"""
        try:
            playlists = []
            offset = 0

            while True:
                results = self.client.current_user_playlists(limit=limit, offset=offset)

                for item in results['items']:
                    playlist = Playlist(
                        id=item['id'],
                        name=item['name'],
                        description=item.get('description', ''),
                        track_count=item['tracks']['total'],
                        images=item.get('images', []),
                        owner=item['owner']['display_name'] if item['owner'] else None
                    )
                    playlists.append(playlist)

                if not results['next']:
                    break
                offset += limit

            return playlists
        except Exception as e:
            raise Exception(f"Failed to get user playlists: {str(e)}")

    def get_playlist_details(self, playlist_id: str) -> Playlist:
        """Get playlist details"""
        try:
            result = self.client.playlist(
                playlist_id,
                fields="id,name,description,images,owner,tracks(total)"
            )

            return Playlist(
                id=result['id'],
                name=result['name'],
                description=result.get('description', ''),
                track_count=result['tracks']['total'],
                images=result.get('images', []),
                owner=result['owner']['display_name'] if result['owner'] else None
            )
        except Exception as e:
            raise Exception(f"Failed to get playlist details: {str(e)}")

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        """Get all tracks from a playlist"""
        try:
            tracks = []
            offset = 0

            while True:
                results = self.client.playlist_tracks(
                    playlist_id,
                    offset=offset,
                    limit=100,
                    fields="items(track(id,name,artists,album,external_ids,duration_ms,uri)),next"
                )

                for item in results['items']:
                    track = item['track']
                    if track and not track.get('is_local', False):
                        track_obj = Track(
                            id=track['id'],
                            name=track['name'],
                            artist=", ".join([artist['name'] for artist in track['artists']]),
                            album=track['album']['name'],
                            duration_ms=track.get('duration_ms'),
                            isrc=track.get('external_ids', {}).get('isrc'),
                            uri=track.get('uri'),
                            external_ids=track.get('external_ids', {})
                        )
                        tracks.append(track_obj)

                if not results['next']:
                    break
                offset += 100

            return tracks
        except Exception as e:
            raise Exception(f"Failed to get playlist tracks: {str(e)}")

    def search_track(self, query: str, limit: int = 10) -> List[Track]:
        """Search for tracks"""
        try:
            results = self.client.search(q=query, type='track', limit=limit)
            tracks = []

            for item in results['tracks']['items']:
                track = Track(
                    id=item['id'],
                    name=item['name'],
                    artist=", ".join([artist['name'] for artist in item['artists']]),
                    album=item['album']['name'],
                    duration_ms=item.get('duration_ms'),
                    isrc=item.get('external_ids', {}).get('isrc'),
                    uri=item.get('uri'),
                    external_ids=item.get('external_ids', {})
                )
                tracks.append(track)

            return tracks
        except Exception as e:
            raise Exception(f"Failed to search tracks: {str(e)}")

    def search_by_isrc(self, isrc: str) -> Optional[Track]:
        """Search for a track by ISRC"""
        try:
            results = self.client.search(q=f"isrc:{isrc}", type='track', limit=1)

            if results['tracks']['items']:
                item = results['tracks']['items'][0]
                return Track(
                    id=item['id'],
                    name=item['name'],
                    artist=", ".join([artist['name'] for artist in item['artists']]),
                    album=item['album']['name'],
                    duration_ms=item.get('duration_ms'),
                    isrc=item.get('external_ids', {}).get('isrc'),
                    uri=item.get('uri'),
                    external_ids=item.get('external_ids', {})
                )
            return None
        except Exception as e:
            raise Exception(f"Failed to search by ISRC: {str(e)}")

    def create_playlist(self, name: str, description: str = "", track_ids: List[str] = None) -> Playlist:
        """Create a new playlist"""
        try:
            user = self.get_current_user()
            playlist = self.client.user_playlist_create(
                user['id'],
                name,
                public=False,
                description=description
            )

            if track_ids:
                # Add tracks in batches of 100 (Spotify limit)
                for i in range(0, len(track_ids), 100):
                    batch = track_ids[i:i+100]
                    self.client.playlist_add_items(playlist['id'], batch)

            return Playlist(
                id=playlist['id'],
                name=playlist['name'],
                description=playlist.get('description', ''),
                track_count=len(track_ids) if track_ids else 0,
                images=playlist.get('images', []),
                owner=user.get('display_name')
            )
        except Exception as e:
            raise Exception(f"Failed to create playlist: {str(e)}")

    def add_tracks_to_playlist(self, playlist_id: str, track_ids: List[str]) -> Playlist:
        """Add tracks to an existing playlist"""
        try:
            # Add tracks in batches of 100 (Spotify limit)
            for i in range(0, len(track_ids), 100):
                batch = track_ids[i:i+100]
                self.client.playlist_add_items(playlist_id, batch)

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