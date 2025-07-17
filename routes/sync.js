const express = require('express');
const router = express.Router();
const SyncService = require('../services/syncService');
const serviceRegistry = require('../services/serviceRegistry');

/**
 * Check if required services are connected for the sync operation
 */
const requireServices = (req, res, next) => {
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
    return res.status(401).json({ error: validation.message });
  }

  next();
};

/**
 * Start a playlist sync operation between any two services
 */
router.post('/playlist', requireServices, async (req, res) => {
  const { 
    sourceType, 
    destinationType, 
    sourcePlaylistId, 
    options = {} 
  } = req.body;

  if (!sourcePlaylistId) {
    return res.status(400).json({ error: 'Source playlist ID required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send heartbeat every 10 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    sendEvent('heartbeat', { timestamp: Date.now() });
  }, 10000);

  try {
    // Create sync service from session data
    const syncService = SyncService.createFromSession(
      req.session, 
      sourceType, 
      destinationType
    );

    const syncOptions = {
      ...options,
      onProgress: (progress, current, total) => {
        sendEvent('progress', { 
          progress, 
          current, 
          total,
          sourceService: sourceType,
          destinationService: destinationType
        });
      }
    };

    sendEvent('start', { 
      message: `Starting sync from ${sourceType} to ${destinationType}...`,
      sourceService: sourceType,
      destinationService: destinationType
    });

    const result = await syncService.syncPlaylist(sourcePlaylistId, syncOptions);

    sendEvent('complete', {
      success: true,
      result: {
        sourceService: result.sourceService,
        destinationService: result.destinationService,
        playlistName: result.sourcePlaylist?.name,
        totalTracks: result.totalTracks,
        matchedTracks: result.matchedTracks,
        unmatchedTracks: result.unmatchedTracks,
        duration: result.duration,
        destinationPlaylistId: result.destinationPlaylist?.id,
        syncMode: result.syncMode
      }
    });

  } catch (error) {
    console.error('Sync error:', error);
    sendEvent('error', {
      success: false,
      error: error.message,
      sourceService: sourceType,
      destinationService: destinationType
    });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * Validate a sync operation before starting
 */
router.post('/validate', async (req, res) => {
  try {
    const { sourceType, destinationType, sourcePlaylistId } = req.body;

    if (!sourceType || !destinationType || !sourcePlaylistId) {
      return res.status(400).json({ 
        error: 'sourceType, destinationType, and sourcePlaylistId are required' 
      });
    }

    // Validate service connections
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

    // Create sync service and validate the specific playlist
    const syncService = SyncService.createFromSession(
      req.session, 
      sourceType, 
      destinationType
    );

    const playlistValidation = await syncService.validateSync(sourcePlaylistId);

    if (!playlistValidation.valid) {
      return res.status(400).json({
        valid: false,
        error: playlistValidation.error
      });
    }

    res.json({
      valid: true,
      sourcePlaylist: playlistValidation.sourcePlaylist,
      capabilities: playlistValidation.capabilities
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Failed to validate sync operation' 
    });
  }
});

/**
 * Check if a playlist already exists in the destination service
 */
router.post('/check-existing', async (req, res) => {
  try {
    const { sourceType, destinationType, sourcePlaylistId } = req.body;

    if (!sourceType || !destinationType || !sourcePlaylistId) {
      return res.status(400).json({ 
        error: 'sourceType, destinationType, and sourcePlaylistId are required' 
      });
    }

    const syncService = SyncService.createFromSession(
      req.session, 
      sourceType, 
      destinationType
    );
    
    // Get source playlist details
    const sourcePlaylist = await syncService.sourceService.getPlaylistDetails(sourcePlaylistId);
    
    // Check if it exists in destination service
    const existingPlaylist = await syncService.destinationService.findPlaylistByName(
      sourcePlaylist.name
    );
    
    let trackCount = 0;
    if (existingPlaylist) {
      const tracks = await syncService.destinationService.getPlaylistTracks(existingPlaylist.id);
      trackCount = tracks.length;
    }
    
    res.json({
      sourcePlaylist: {
        name: sourcePlaylist.name,
        trackCount: sourcePlaylist.trackCount
      },
      existingPlaylist: existingPlaylist ? {
        id: existingPlaylist.id,
        name: existingPlaylist.name,
        trackCount
      } : null,
      sourceService: sourceType,
      destinationService: destinationType
    });
  } catch (error) {
    console.error('Error checking existing playlist:', error);
    res.status(500).json({ error: 'Failed to check existing playlist' });
  }
});

/**
 * Get sync capabilities between two services
 */
router.post('/capabilities', (req, res) => {
  try {
    const { sourceType, destinationType } = req.body;

    if (!sourceType || !destinationType) {
      return res.status(400).json({ 
        error: 'sourceType and destinationType are required' 
      });
    }

    // Validate service connections
    const validation = serviceRegistry.validateSyncRequirements(
      req.session, 
      sourceType, 
      destinationType
    );

    if (!validation.success) {
      return res.status(400).json({ 
        error: validation.message 
      });
    }

    const syncService = SyncService.createFromSession(
      req.session, 
      sourceType, 
      destinationType
    );

    const capabilities = syncService.getSyncCapabilities();

    res.json(capabilities);

  } catch (error) {
    console.error('Error getting capabilities:', error);
    res.status(500).json({ error: 'Failed to get sync capabilities' });
  }
});

/**
 * Get overall sync status (which services are connected)
 */
router.get('/status', (req, res) => {
  try {
    const connectionStatus = serviceRegistry.getConnectionStatus(req.session);
    const connectedUsers = serviceRegistry.getConnectedServiceUsers(req.session);
    const availableServices = serviceRegistry.getAvailableServices();

    const services = availableServices.map(service => ({
      ...service,
      connected: connectionStatus[service.type] || false,
      user: connectedUsers[service.type] || null
    }));

    res.json({
      authenticated: Object.values(connectionStatus).some(Boolean),
      services,
      totalConnected: Object.values(connectionStatus).filter(Boolean).length
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

module.exports = router;