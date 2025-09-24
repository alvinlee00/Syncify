import time
import asyncio
from typing import List, Dict, Optional, Callable

from app.models.track import Track, Playlist, SyncResult, MatchResult
from app.utils.track_matcher import TrackMatcher
from app.services.spotify_service import SpotifyService
from app.services.apple_music_service import AppleMusicService

class SyncService:
    def __init__(self, source_service, destination_service):
        self.source_service = source_service
        self.destination_service = destination_service
        self.track_matcher = TrackMatcher(destination_service)

    @classmethod
    def create_from_session(cls, session: Dict, source_type: str, destination_type: str):
        """Create sync service from session data"""

        # Get source service
        if source_type.lower() == "spotify":
            spotify_tokens = session.get("spotify_tokens")
            if not spotify_tokens:
                raise Exception(f"Source service {source_type} is not connected")
            source_service = SpotifyService(spotify_tokens["access_token"])
        elif source_type.lower() == "apple":
            apple_token = session.get("apple_user_token")
            if not apple_token:
                raise Exception(f"Source service {source_type} is not connected")
            source_service = AppleMusicService(apple_token)
        else:
            raise Exception(f"Unsupported source service: {source_type}")

        # Get destination service
        if destination_type.lower() == "spotify":
            spotify_tokens = session.get("spotify_tokens")
            if not spotify_tokens:
                raise Exception(f"Destination service {destination_type} is not connected")
            destination_service = SpotifyService(spotify_tokens["access_token"])
        elif destination_type.lower() == "apple":
            apple_token = session.get("apple_user_token")
            if not apple_token:
                raise Exception(f"Destination service {destination_type} is not connected")
            destination_service = AppleMusicService(apple_token)
        else:
            raise Exception(f"Unsupported destination service: {destination_type}")

        return cls(source_service, destination_service)

    async def sync_playlist(self, source_playlist_id: str, options: Dict = None) -> SyncResult:
        """Sync a playlist from source to destination service"""
        if options is None:
            options = {}

        sync_result = SyncResult(
            source_service=self.source_service.service_name,
            destination_service=self.destination_service.service_name,
            start_time=int(time.time() * 1000),
            sync_mode=options.get("sync_mode", "create")
        )

        try:
            print(f"Starting sync from {self.source_service.service_name} to {self.destination_service.service_name}")

            # Get source playlist details
            sync_result.source_playlist = self.source_service.get_playlist_details(source_playlist_id)
            print(f"Source playlist: {sync_result.source_playlist.name}")

            # Get all tracks from source playlist
            source_tracks = self.source_service.get_playlist_tracks(source_playlist_id)
            sync_result.total_tracks = len(source_tracks)
            print(f"Found {sync_result.total_tracks} tracks in source playlist")

            if not source_tracks:
                print("No tracks to sync")
                sync_result.end_time = int(time.time() * 1000)
                return sync_result

            # Check if destination playlist already exists
            destination_playlist = None
            playlist_name = options.get("playlist_name")

            if options.get("update_existing", False):
                # For updates, try to find existing playlist
                original_name = playlist_name or sync_result.source_playlist.name
                destination_playlist = self.destination_service.find_playlist_by_name(original_name)

                if destination_playlist:
                    print(f"Found existing destination playlist for update: {destination_playlist.name}")
                    playlist_name = destination_playlist.name
                    sync_result.sync_mode = "update"
                else:
                    # Try with service suffix
                    name_with_suffix = f"{original_name} (from {self.source_service.service_name})"
                    destination_playlist = self.destination_service.find_playlist_by_name(name_with_suffix)

                    if destination_playlist:
                        print(f"Found existing destination playlist with suffix: {destination_playlist.name}")
                        playlist_name = destination_playlist.name
                        sync_result.sync_mode = "update"
                    else:
                        print("No existing playlist found for update, will create new one")
                        playlist_name = original_name
                        sync_result.sync_mode = "create"
            else:
                # For create mode, use custom name or generate one with service suffix
                playlist_name = playlist_name or f"{sync_result.source_playlist.name} (from {self.source_service.service_name})"

            # Match tracks between services
            match_results = await self.match_all_tracks(source_tracks, options.get("on_progress"))

            # Collect matched track IDs and unmatched tracks
            matched_track_ids = []
            matched_results = []  # Keep track of matched results for duplicate detection
            for result in match_results:
                if result.destination_track:
                    matched_track_ids.append(result.destination_track.id)
                    matched_results.append(result)  # Store the result for later use
                    sync_result.matched_tracks += 1
                else:
                    sync_result.unmatched_tracks.append({
                        "name": result.source_track.name,
                        "artist": result.source_track.artist,
                        "album": result.source_track.album
                    })

            print(f"Matched {sync_result.matched_tracks} out of {sync_result.total_tracks} tracks")

            # Create or update destination playlist
            if matched_track_ids:
                if destination_playlist and sync_result.sync_mode == "update":
                    # Update existing playlist - only add new tracks
                    print(f"Updating existing playlist: {destination_playlist.name}")

                    existing_tracks = self.destination_service.get_playlist_tracks(destination_playlist.id)

                    # Create a set of existing tracks using name + artist for matching
                    existing_track_signatures = set()
                    for track in existing_tracks:
                        signature = f"{track.name.lower().strip()} - {track.artist.lower().strip()}"
                        existing_track_signatures.add(signature)

                    # Filter out tracks that are already in the playlist by comparing metadata
                    new_track_ids = []
                    for i, track_id in enumerate(matched_track_ids):
                        # Get the corresponding source track to compare metadata
                        result = matched_results[i] if i < len(matched_results) else None
                        if result and result.source_track:
                            source_signature = f"{result.source_track.name.lower().strip()} - {result.source_track.artist.lower().strip()}"
                            if source_signature not in existing_track_signatures:
                                new_track_ids.append(track_id)
                            else:
                                print(f"  Skip duplicate: {result.source_track.artist} - {result.source_track.name}")
                        else:
                            # Fallback: add the track if we can't match metadata
                            new_track_ids.append(track_id)

                    print(f"Found {len(existing_tracks)} existing tracks, adding {len(new_track_ids)} new tracks")

                    if new_track_ids:
                        sync_result.destination_playlist = self.destination_service.add_tracks_to_playlist(
                            destination_playlist.id,
                            new_track_ids
                        )
                        sync_result.matched_tracks = len(new_track_ids)
                    else:
                        print("All tracks already exist in the playlist")
                        sync_result.destination_playlist = destination_playlist
                        sync_result.matched_tracks = 0
                else:
                    # Create new playlist
                    print(f"Creating new playlist: {playlist_name}")
                    description = options.get("playlist_description") or f"Synced from {self.source_service.service_name} on {time.strftime('%Y-%m-%d')}"

                    sync_result.destination_playlist = self.destination_service.create_playlist(
                        playlist_name,
                        description,
                        matched_track_ids
                    )
            else:
                print("No matched tracks to sync")

            sync_result.end_time = int(time.time() * 1000)
            sync_result.duration = sync_result.end_time - sync_result.start_time

            print(f"Sync completed in {(sync_result.duration / 1000):.1f} seconds")
            return sync_result

        except Exception as error:
            print(f"Sync error: {error}")
            sync_result.errors.append(str(error))
            sync_result.end_time = int(time.time() * 1000)
            sync_result.duration = sync_result.end_time - sync_result.start_time
            raise error

    async def match_all_tracks(self, source_tracks: List[Track], on_progress: Optional[Callable] = None) -> List[MatchResult]:
        """Match all tracks with progress reporting"""
        results = []
        batch_size = 15  # Increased batch size for better performance

        print(f"Starting track matching for {len(source_tracks)} tracks")

        for i in range(0, len(source_tracks), batch_size):
            batch = source_tracks[i:i + batch_size]

            # Process batch concurrently for much faster performance
            async def match_track_with_logging(track):
                print(f"Matching: {track.artist} - {track.name}")
                result = await self.track_matcher.match_track(track)
                if result.destination_track:
                    print(f"  ✓ Found: {result.destination_track.artist} - {result.destination_track.name} (confidence: {result.match_confidence:.0f}%)")
                else:
                    print(f"  ✗ No match found")
                return result

            # Process all tracks in this batch concurrently
            batch_results = await asyncio.gather(*[match_track_with_logging(track) for track in batch])

            results.extend(batch_results)

            # Report progress
            if on_progress:
                progress = round((len(results) / len(source_tracks)) * 100)
                on_progress(progress, len(results), len(source_tracks))

            # Rate limiting delay
            await self.rate_limit_delay()

        print(f"Track matching completed: {len([r for r in results if r.destination_track])}/{len(results)} matched")
        return results

    async def get_user_playlists(self) -> Dict:
        """Get playlists from both services"""
        try:
            source_playlists = self.source_service.get_user_playlists()
            destination_playlists = self.destination_service.get_user_playlists()

            return {
                "source": {
                    "service": self.source_service.service_name,
                    "playlists": source_playlists
                },
                "destination": {
                    "service": self.destination_service.service_name,
                    "playlists": destination_playlists
                }
            }
        except Exception as error:
            print(f"Error fetching playlists: {error}")
            raise error

    def get_sync_capabilities(self) -> Dict:
        """Get sync capabilities between the two services"""
        source_capabilities = self.source_service.get_capabilities()
        destination_capabilities = self.destination_service.get_capabilities()

        return {
            "can_sync": source_capabilities["canRead"] and destination_capabilities["canWrite"],
            "can_create_playlists": destination_capabilities["canCreatePlaylists"],
            "supports_isrc": source_capabilities["supportsISRC"] and destination_capabilities["supportsISRC"],
            "max_playlist_tracks": min(
                source_capabilities.get("maxPlaylistTracks", float('inf')),
                destination_capabilities.get("maxPlaylistTracks", float('inf'))
            ),
            "batch_size": min(
                source_capabilities.get("batchSize", 100),
                destination_capabilities.get("batchSize", 100)
            ),
            "source_service": {
                "name": self.source_service.service_name,
                "capabilities": source_capabilities
            },
            "destination_service": {
                "name": self.destination_service.service_name,
                "capabilities": destination_capabilities
            }
        }

    async def validate_sync(self, source_playlist_id: str, options: Dict = None) -> Dict:
        """Validate that a sync operation can be performed"""
        try:
            # Check if source playlist exists and is accessible
            source_playlist = self.source_service.get_playlist_details(source_playlist_id)
            if not source_playlist:
                return {"valid": False, "error": "Source playlist not found"}

            # Check capabilities
            capabilities = self.get_sync_capabilities()
            if not capabilities["can_sync"]:
                return {"valid": False, "error": "Sync not supported between these services"}

            # Check track count limits
            if source_playlist.track_count > capabilities["max_playlist_tracks"]:
                return {
                    "valid": False,
                    "error": f"Playlist has {source_playlist.track_count} tracks, but destination service supports maximum {capabilities['max_playlist_tracks']} tracks"
                }

            return {"valid": True, "source_playlist": source_playlist, "capabilities": capabilities}
        except Exception as error:
            return {"valid": False, "error": str(error)}

    async def rate_limit_delay(self):
        """Delay to respect API rate limits"""
        # Reduced delays since we're using concurrent processing
        delay = 0.1 if self.destination_service.service_name == "Apple Music" else 0.05
        await asyncio.sleep(delay)