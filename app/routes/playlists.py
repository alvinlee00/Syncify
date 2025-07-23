from fastapi import APIRouter, Request, HTTPException
from typing import Dict, List

from app.services.service_registry import ServiceRegistry

router = APIRouter()

@router.get("/{service}")
async def get_playlists(request: Request, service: str):
    """Get playlists for a specific service"""
    try:
        # Validate service connection
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service.lower()):
            raise HTTPException(status_code=401, detail=f"{service} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service} service instance")

        # Get playlists
        playlists = service_instance.get_user_playlists()

        # Convert to dict format for JSON response
        playlist_data = []
        for playlist in playlists:
            playlist_data.append({
                "id": playlist.id,
                "name": playlist.name,
                "description": playlist.description,
                "trackCount": playlist.track_count,
                "images": playlist.images,
                "owner": playlist.owner
            })

        return {
            "service": service,
            "playlists": playlist_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get playlists: {str(e)}")

@router.get("/{service}/{playlist_id}")
async def get_playlist_details(request: Request, service: str, playlist_id: str):
    """Get details for a specific playlist"""
    try:
        # Validate service connection
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service.lower()):
            raise HTTPException(status_code=401, detail=f"{service} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service} service instance")

        # Get playlist details
        playlist = service_instance.get_playlist_details(playlist_id)

        return {
            "id": playlist.id,
            "name": playlist.name,
            "description": playlist.description,
            "trackCount": playlist.track_count,
            "images": playlist.images,
            "owner": playlist.owner
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get playlist details: {str(e)}")

@router.get("/{service}/{playlist_id}/tracks")
async def get_playlist_tracks(request: Request, service: str, playlist_id: str):
    """Get tracks from a specific playlist"""
    try:
        # Validate service connection
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service.lower()):
            raise HTTPException(status_code=401, detail=f"{service} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service} service instance")

        # Get playlist tracks
        tracks = service_instance.get_playlist_tracks(playlist_id)

        # Convert to dict format for JSON response
        track_data = []
        for track in tracks:
            track_data.append({
                "id": track.id,
                "name": track.name,
                "artist": track.artist,
                "album": track.album,
                "durationMs": track.duration_ms,
                "isrc": track.isrc,
                "uri": track.uri,
                "externalIds": track.external_ids
            })

        return {
            "service": service,
            "playlistId": playlist_id,
            "tracks": track_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get playlist tracks: {str(e)}")

@router.post("/{service}")
async def create_playlist(request: Request, service: str):
    """Create a new playlist"""
    try:
        # Validate service connection
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service.lower()):
            raise HTTPException(status_code=401, detail=f"{service} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service} service instance")

        # Parse request body
        body = await request.json()
        name = body.get("name")
        description = body.get("description", "")
        track_ids = body.get("trackIds", [])

        if not name:
            raise HTTPException(status_code=400, detail="Playlist name is required")

        # Create playlist
        playlist = service_instance.create_playlist(name, description, track_ids)

        return {
            "id": playlist.id,
            "name": playlist.name,
            "description": playlist.description,
            "trackCount": playlist.track_count,
            "images": playlist.images,
            "owner": playlist.owner
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create playlist: {str(e)}")

@router.post("/{service}/{playlist_id}/tracks")
async def add_tracks_to_playlist(request: Request, service: str, playlist_id: str):
    """Add tracks to an existing playlist"""
    try:
        # Validate service connection
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service.lower()):
            raise HTTPException(status_code=401, detail=f"{service} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service} service instance")

        # Parse request body
        body = await request.json()
        track_ids = body.get("trackIds", [])

        if not track_ids:
            raise HTTPException(status_code=400, detail="Track IDs are required")

        # Add tracks to playlist
        playlist = service_instance.add_tracks_to_playlist(playlist_id, track_ids)

        return {
            "id": playlist.id,
            "name": playlist.name,
            "description": playlist.description,
            "trackCount": playlist.track_count,
            "images": playlist.images,
            "owner": playlist.owner
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add tracks to playlist: {str(e)}")

@router.get("/{service}/search")
async def search_tracks(request: Request, service: str, q: str, limit: int = 10):
    """Search for tracks in a service"""
    try:
        # Validate service connection
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service.lower()):
            raise HTTPException(status_code=401, detail=f"{service} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service} service instance")

        if not q:
            raise HTTPException(status_code=400, detail="Search query is required")

        # Search for tracks
        tracks = service_instance.search_track(q, limit)

        # Convert to dict format for JSON response
        track_data = []
        for track in tracks:
            track_data.append({
                "id": track.id,
                "name": track.name,
                "artist": track.artist,
                "album": track.album,
                "durationMs": track.duration_ms,
                "isrc": track.isrc,
                "uri": track.uri,
                "externalIds": track.external_ids
            })

        return {
            "service": service,
            "query": q,
            "tracks": track_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search tracks: {str(e)}")