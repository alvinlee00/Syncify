from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class Track(BaseModel):
    """Base track model"""
    id: str
    name: str
    artist: str
    album: str
    duration_ms: Optional[int] = None
    isrc: Optional[str] = None
    uri: Optional[str] = None
    external_ids: Optional[Dict[str, str]] = None
    album_type: Optional[str] = None  # "album", "single", "compilation" (Spotify provides this)

class Playlist(BaseModel):
    """Base playlist model"""
    id: str
    name: str
    description: Optional[str] = None
    track_count: int = 0
    images: Optional[List[Dict[str, Any]]] = None
    owner: Optional[str] = None

class SyncResult(BaseModel):
    """Result of a playlist sync operation"""
    source_playlist: Optional[Playlist] = None
    destination_playlist: Optional[Playlist] = None
    source_service: str
    destination_service: str
    total_tracks: int = 0
    matched_tracks: int = 0
    unmatched_tracks: List[Dict[str, str]] = []
    errors: List[str] = []
    start_time: int
    end_time: Optional[int] = None
    sync_mode: str = "create"
    duration: Optional[int] = None

class MatchResult(BaseModel):
    """Result of track matching"""
    source_track: Track
    destination_track: Optional[Track] = None
    match_confidence: float = 0.0
    match_method: Optional[str] = None