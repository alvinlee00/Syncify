const express = require('express');
const router = express.Router();
const serviceRegistry = require('../services/serviceRegistry');

/**
 * Get all available services and their connection status
 */
router.get('/', (req, res) => {
  try {
    const availableServices = serviceRegistry.getAvailableServices();
    const connectionStatus = serviceRegistry.getConnectionStatus(req.session);
    const connectedUsers = serviceRegistry.getConnectedServiceUsers(req.session);

    const services = availableServices.map(service => ({
      ...service,
      connected: connectionStatus[service.type] || false,
      user: connectedUsers[service.type] || null,
      capabilities: serviceRegistry.getServiceCapabilities(service.type)
    }));

    res.json({
      services,
      totalConnected: Object.values(connectionStatus).filter(Boolean).length
    });
  } catch (error) {
    console.error('Error getting services:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

/**
 * Get connection status for all services
 */
router.get('/status', (req, res) => {
  try {
    const connectionStatus = serviceRegistry.getConnectionStatus(req.session);
    const connectedUsers = serviceRegistry.getConnectedServiceUsers(req.session);

    res.json({
      status: connectionStatus,
      users: connectedUsers
    });
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

/**
 * Disconnect a specific service
 */
router.post('/:serviceType/disconnect', (req, res) => {
  try {
    const { serviceType } = req.params;
    
    if (!serviceRegistry.serviceTypes[serviceType]) {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    serviceRegistry.disconnectService(req.session, serviceType);
    
    res.json({ 
      success: true, 
      message: `${serviceRegistry.serviceTypes[serviceType].name} disconnected` 
    });
  } catch (error) {
    console.error('Error disconnecting service:', error);
    res.status(500).json({ error: 'Failed to disconnect service' });
  }
});

/**
 * Get playlists for a specific service
 */
router.get('/:serviceType/playlists', async (req, res) => {
  try {
    const { serviceType } = req.params;
    
    if (!serviceRegistry.isServiceConnected(req.session, serviceType)) {
      return res.status(401).json({ error: `${serviceType} not connected` });
    }

    const connectedServices = serviceRegistry.getConnectedServices(req.session);
    const service = connectedServices[serviceType];

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const playlists = await service.getUserPlaylists();
    
    res.json({
      service: serviceType,
      playlists: playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.trackCount,
        image: playlist.image,
        owner: playlist.owner
      }))
    });
  } catch (error) {
    console.error(`Error fetching ${req.params.serviceType} playlists:`, error);
    
    if (error.message.includes('token expired') || error.message.includes('authentication')) {
      return res.status(401).json({ error: 'Authentication expired', code: 'TOKEN_EXPIRED' });
    }
    
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

/**
 * Get tracks for a specific playlist from a specific service
 */
router.get('/:serviceType/playlists/:playlistId/tracks', async (req, res) => {
  try {
    const { serviceType, playlistId } = req.params;
    
    if (!serviceRegistry.isServiceConnected(req.session, serviceType)) {
      return res.status(401).json({ error: `${serviceType} not connected` });
    }

    const connectedServices = serviceRegistry.getConnectedServices(req.session);
    const service = connectedServices[serviceType];

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const tracks = await service.getPlaylistTracks(playlistId);
    
    res.json({
      service: serviceType,
      playlistId,
      tracks: tracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        isrc: track.isrc
      }))
    });
  } catch (error) {
    console.error(`Error fetching tracks from ${req.params.serviceType}:`, error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

/**
 * Validate sync requirements between two services
 */
router.post('/validate-sync', (req, res) => {
  try {
    const { sourceType, destinationType } = req.body;

    if (!sourceType || !destinationType) {
      return res.status(400).json({ 
        error: 'Both sourceType and destinationType are required' 
      });
    }

    const validation = serviceRegistry.validateSyncRequirements(
      req.session, 
      sourceType, 
      destinationType
    );

    if (!validation.success) {
      return res.status(400).json({ 
        valid: false, 
        error: validation.message 
      });
    }

    // Get service capabilities for the UI
    const sourceCapabilities = serviceRegistry.getServiceCapabilities(sourceType);
    const destCapabilities = serviceRegistry.getServiceCapabilities(destinationType);

    res.json({
      valid: true,
      capabilities: {
        supportsISRC: sourceCapabilities?.supportsISRC && destCapabilities?.supportsISRC,
        maxTracks: Math.min(
          sourceCapabilities?.maxPlaylistTracks || Infinity,
          destCapabilities?.maxPlaylistTracks || Infinity
        ),
        sourceService: {
          name: serviceRegistry.serviceTypes[sourceType]?.name,
          capabilities: sourceCapabilities
        },
        destinationService: {
          name: serviceRegistry.serviceTypes[destinationType]?.name,
          capabilities: destCapabilities
        }
      }
    });
  } catch (error) {
    console.error('Error validating sync:', error);
    res.status(500).json({ error: 'Failed to validate sync requirements' });
  }
});

module.exports = router;