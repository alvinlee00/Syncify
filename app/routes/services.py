from fastapi import APIRouter, Request, HTTPException

from app.services.service_registry import ServiceRegistry

router = APIRouter()

@router.get("/")
async def get_services(request: Request):
    """Get all available services with connection status"""
    try:
        connection_status = ServiceRegistry.get_connection_status(request.session)
        connected_users = ServiceRegistry.get_connected_service_users(request.session)
        available_services = ServiceRegistry.get_available_services()

        services = []
        for service in available_services:
            service_data = {
                **service,
                "connected": connection_status.get(service["type"], False),
                "user": connected_users.get(service["type"])
            }
            services.append(service_data)

        return {
            "services": services,
            "totalConnected": sum(1 for connected in connection_status.values() if connected)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get services: {str(e)}")

@router.get("/connected")
async def get_connected_services(request: Request):
    """Get only connected services"""
    try:
        connection_status = ServiceRegistry.get_connection_status(request.session)
        connected_users = ServiceRegistry.get_connected_service_users(request.session)
        available_services = ServiceRegistry.get_available_services()

        connected_services = []
        for service in available_services:
            if connection_status.get(service["type"], False):
                service_data = {
                    **service,
                    "connected": True,
                    "user": connected_users.get(service["type"])
                }
                connected_services.append(service_data)

        return {
            "services": connected_services,
            "count": len(connected_services)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get connected services: {str(e)}")

@router.get("/{service_type}")
async def get_service_info(request: Request, service_type: str):
    """Get information about a specific service"""
    try:
        service_info = ServiceRegistry.get_service_info(service_type)
        if not service_info:
            raise HTTPException(status_code=404, detail="Service not found")

        connection_status = ServiceRegistry.get_connection_status(request.session)
        connected_users = ServiceRegistry.get_connected_service_users(request.session)

        return {
            **service_info,
            "connected": connection_status.get(service_type.lower(), False),
            "user": connected_users.get(service_type.lower())
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service info: {str(e)}")

@router.post("/{service_type}/disconnect")
async def disconnect_service(request: Request, service_type: str):
    """Disconnect from a specific service"""
    try:
        success = ServiceRegistry.disconnect_service(request.session, service_type)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to disconnect service")

        return {
            "success": True,
            "message": f"Disconnected from {service_type}",
            "service": service_type
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to disconnect service: {str(e)}")

@router.get("/{service_type}/capabilities")
async def get_service_capabilities(request: Request, service_type: str):
    """Get capabilities of a specific service"""
    try:
        # Check if service is connected
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service_type.lower()):
            raise HTTPException(status_code=401, detail=f"{service_type} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service_type.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service_type} service instance")

        capabilities = service_instance.get_capabilities()

        return {
            "service": service_type,
            "capabilities": capabilities
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service capabilities: {str(e)}")

@router.get("/{service_type}/user")
async def get_service_user(request: Request, service_type: str):
    """Get user information for a specific service"""
    try:
        # Check if service is connected
        connection_status = ServiceRegistry.get_connection_status(request.session)
        if not connection_status.get(service_type.lower()):
            raise HTTPException(status_code=401, detail=f"{service_type} is not connected")

        # Get connected services
        connected_services = ServiceRegistry.get_connected_services(request.session)
        service_instance = connected_services.get(service_type.lower())

        if not service_instance:
            raise HTTPException(status_code=401, detail=f"Failed to get {service_type} service instance")

        try:
            user = service_instance.get_current_user()
            return {
                "service": service_type,
                "user": user
            }
        except Exception as e:
            # Return basic info if detailed user info fails
            connected_users = ServiceRegistry.get_connected_service_users(request.session)
            user = connected_users.get(service_type.lower(), {})

            return {
                "service": service_type,
                "user": user
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service user: {str(e)}")