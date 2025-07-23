from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
import json
import asyncio
import time

from app.services.sync_service import SyncService
from app.services.service_registry import ServiceRegistry

router = APIRouter()

async def stream_sync_progress(sync_service: SyncService, source_playlist_id: str, options: dict):
    """Stream sync progress using Server-Sent Events"""

    def send_event(event_type: str, data: dict):
        """Format and return SSE event"""
        return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

    # Send initial event
    yield send_event("start", {
        "message": f"Starting sync from {sync_service.source_service.service_name} to {sync_service.destination_service.service_name}...",
        "sourceService": sync_service.source_service.service_name,
        "destinationService": sync_service.destination_service.service_name
    })

    # Progress tracking
    progress_data = {"current": 0, "total": 0, "progress": 0}

    def on_progress(progress: int, current: int, total: int):
        progress_data.update({
            "progress": progress,
            "current": current,
            "total": total,
            "sourceService": sync_service.source_service.service_name,
            "destinationService": sync_service.destination_service.service_name
        })

    # Add progress callback to options
    options["on_progress"] = lambda p, c, t: None  # We'll handle progress differently

    try:
        # Start sync
        result = await sync_service.sync_playlist(source_playlist_id, options)

        # Send completion event
        yield send_event("complete", {
            "success": True,
            "result": {
                "sourceService": result.source_service,
                "destinationService": result.destination_service,
                "playlistName": result.source_playlist.name if result.source_playlist else None,
                "totalTracks": result.total_tracks,
                "matchedTracks": result.matched_tracks,
                "unmatchedTracks": result.unmatched_tracks,
                "duration": result.duration,
                "destinationPlaylistId": result.destination_playlist.id if result.destination_playlist else None,
                "syncMode": result.sync_mode
            }
        })

    except Exception as error:
        print(f"Sync error: {error}")
        yield send_event("error", {
            "success": False,
            "error": str(error),
            "sourceService": sync_service.source_service.service_name,
            "destinationService": sync_service.destination_service.service_name
        })

@router.post("/playlist")
async def sync_playlist(request: Request):
    """Start a playlist sync operation between two services"""
    try:
        body = await request.json()
        source_type = body.get("sourceType")
        destination_type = body.get("destinationType")
        source_playlist_id = body.get("sourcePlaylistId")
        options = body.get("options", {})

        if not all([source_type, destination_type, source_playlist_id]):
            raise HTTPException(
                status_code=400,
                detail="sourceType, destinationType, and sourcePlaylistId are required"
            )

        # Validate service connections
        validation = ServiceRegistry.validate_sync_requirements(
            request.session, source_type, destination_type
        )

        if not validation["success"]:
            raise HTTPException(status_code=401, detail=validation["message"])

        # Create sync service
        sync_service = SyncService.create_from_session(
            request.session, source_type, destination_type
        )

        # Return streaming response
        return StreamingResponse(
            stream_sync_progress(sync_service, source_playlist_id, options),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start sync: {str(e)}")

@router.post("/validate")
async def validate_sync(request: Request):
    """Validate a sync operation before starting"""
    try:
        body = await request.json()
        source_type = body.get("sourceType")
        destination_type = body.get("destinationType")
        source_playlist_id = body.get("sourcePlaylistId")

        if not all([source_type, destination_type, source_playlist_id]):
            raise HTTPException(
                status_code=400,
                detail="sourceType, destinationType, and sourcePlaylistId are required"
            )

        # Validate service connections
        validation = ServiceRegistry.validate_sync_requirements(
            request.session, source_type, destination_type
        )

        if not validation["success"]:
            return {"valid": False, "error": validation["message"]}

        # Create sync service and validate the specific playlist
        sync_service = SyncService.create_from_session(
            request.session, source_type, destination_type
        )

        playlist_validation = await sync_service.validate_sync(source_playlist_id)

        if not playlist_validation["valid"]:
            return {"valid": False, "error": playlist_validation["error"]}

        return {
            "valid": True,
            "sourcePlaylist": {
                "id": playlist_validation["source_playlist"].id,
                "name": playlist_validation["source_playlist"].name,
                "trackCount": playlist_validation["source_playlist"].track_count
            },
            "capabilities": playlist_validation["capabilities"]
        }

    except Exception as e:
        return {"valid": False, "error": "Failed to validate sync operation"}

@router.post("/check-existing")
async def check_existing_playlist(request: Request):
    """Check if a playlist already exists in the destination service"""
    try:
        body = await request.json()
        source_type = body.get("sourceType")
        destination_type = body.get("destinationType")
        source_playlist_id = body.get("sourcePlaylistId")

        if not all([source_type, destination_type, source_playlist_id]):
            raise HTTPException(
                status_code=400,
                detail="sourceType, destinationType, and sourcePlaylistId are required"
            )

        # Create sync service
        sync_service = SyncService.create_from_session(
            request.session, source_type, destination_type
        )

        # Get source playlist details
        source_playlist = sync_service.source_service.get_playlist_details(source_playlist_id)

        # Check if it exists in destination service
        existing_playlist = sync_service.destination_service.find_playlist_by_name(
            source_playlist.name
        )

        track_count = 0
        if existing_playlist:
            tracks = sync_service.destination_service.get_playlist_tracks(existing_playlist.id)
            track_count = len(tracks)

        return {
            "sourcePlaylist": {
                "name": source_playlist.name,
                "trackCount": source_playlist.track_count
            },
            "existingPlaylist": {
                "id": existing_playlist.id,
                "name": existing_playlist.name,
                "trackCount": track_count
            } if existing_playlist else None,
            "sourceService": source_type,
            "destinationService": destination_type
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check existing playlist: {str(e)}")

@router.post("/capabilities")
async def get_sync_capabilities(request: Request):
    """Get sync capabilities between two services"""
    try:
        body = await request.json()
        source_type = body.get("sourceType")
        destination_type = body.get("destinationType")

        if not all([source_type, destination_type]):
            raise HTTPException(
                status_code=400,
                detail="sourceType and destinationType are required"
            )

        # Validate service connections
        validation = ServiceRegistry.validate_sync_requirements(
            request.session, source_type, destination_type
        )

        if not validation["success"]:
            raise HTTPException(status_code=400, detail=validation["message"])

        # Create sync service
        sync_service = SyncService.create_from_session(
            request.session, source_type, destination_type
        )

        capabilities = sync_service.get_sync_capabilities()
        return capabilities

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sync capabilities: {str(e)}")

@router.get("/status")
async def get_sync_status(request: Request):
    """Get overall sync status (which services are connected)"""
    try:
        connection_status = ServiceRegistry.get_connection_status(request.session)
        connected_users = ServiceRegistry.get_connected_service_users(request.session)
        available_services = ServiceRegistry.get_available_services()

        services = []
        for service in available_services:
            services.append({
                **service,
                "connected": connection_status.get(service["type"], False),
                "user": connected_users.get(service["type"])
            })

        return {
            "authenticated": any(connection_status.values()),
            "services": services,
            "totalConnected": sum(1 for connected in connection_status.values() if connected)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sync status: {str(e)}")