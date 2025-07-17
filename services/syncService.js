const TrackMatcher = require('../utils/trackMatcher');
const serviceRegistry = require('./serviceRegistry');

class SyncService {
  constructor(sourceService, destinationService) {
    this.sourceService = sourceService;
    this.destinationService = destinationService;
    this.trackMatcher = new TrackMatcher(destinationService);
  }

  /**
   * Create a sync service instance from session data
   * @param {Object} session - Express session object
   * @param {string} sourceType - Source service type
   * @param {string} destinationType - Destination service type
   * @returns {SyncService} SyncService instance
   */
  static createFromSession(session, sourceType, destinationType) {
    const connectedServices = serviceRegistry.getConnectedServices(session);
    
    const sourceService = connectedServices[sourceType];
    const destinationService = connectedServices[destinationType];
    
    if (!sourceService) {
      throw new Error(`Source service ${sourceType} is not connected`);
    }
    
    if (!destinationService) {
      throw new Error(`Destination service ${destinationType} is not connected`);
    }
    
    return new SyncService(sourceService, destinationService);
  }

  async syncPlaylist(sourcePlaylistId, options = {}) {
    const syncResult = {
      sourcePlaylist: null,
      destinationPlaylist: null,
      sourceService: this.sourceService.serviceName,
      destinationService: this.destinationService.serviceName,
      totalTracks: 0,
      matchedTracks: 0,
      unmatchedTracks: [],
      errors: [],
      startTime: Date.now(),
      endTime: null,
      syncMode: options.updateExisting ? 'update' : 'create'
    };

    try {
      console.log(`Starting sync from ${this.sourceService.serviceName} to ${this.destinationService.serviceName}`);

      // Get source playlist details
      syncResult.sourcePlaylist = await this.sourceService.getPlaylistDetails(sourcePlaylistId);
      console.log(`Source playlist: ${syncResult.sourcePlaylist.name}`);

      // Get all tracks from source playlist
      const sourceTracks = await this.sourceService.getPlaylistTracks(sourcePlaylistId);
      syncResult.totalTracks = sourceTracks.length;
      console.log(`Found ${syncResult.totalTracks} tracks in source playlist`);

      if (sourceTracks.length === 0) {
        console.log('No tracks to sync');
        syncResult.endTime = Date.now();
        return syncResult;
      }

      // Check if destination playlist already exists
      let destinationPlaylist = null;
      let playlistName;

      if (options.updateExisting) {
        // For updates, first try to find playlist with original name
        const originalName = options.playlistName || syncResult.sourcePlaylist.name;
        destinationPlaylist = await this.destinationService.findPlaylistByName(originalName);
        
        if (destinationPlaylist) {
          console.log(`Found existing destination playlist for update: ${destinationPlaylist.name}`);
          playlistName = destinationPlaylist.name; // Use existing playlist name
          syncResult.syncMode = 'update';
        } else {
          // If not found with original name, try with service suffix
          const nameWithSuffix = `${originalName} (from ${this.sourceService.serviceName})`;
          destinationPlaylist = await this.destinationService.findPlaylistByName(nameWithSuffix);
          
          if (destinationPlaylist) {
            console.log(`Found existing destination playlist with suffix: ${destinationPlaylist.name}`);
            playlistName = destinationPlaylist.name;
            syncResult.syncMode = 'update';
          } else {
            console.log(`No existing playlist found for update, will create new one`);
            playlistName = originalName; // Create with original name, not suffix
            syncResult.syncMode = 'create';
          }
        }
      } else {
        // For create mode, use custom name or generate one with service suffix
        playlistName = options.playlistName || 
          `${syncResult.sourcePlaylist.name} (from ${this.sourceService.serviceName})`;
      }

      // Match tracks between services
      const matchResults = await this.matchAllTracks(sourceTracks, options.onProgress);

      // Collect matched track IDs
      const matchedTrackIds = [];
      for (const result of matchResults) {
        if (result.destinationTrack) {
          matchedTrackIds.push(result.destinationTrack.id);
          syncResult.matchedTracks++;
        } else {
          syncResult.unmatchedTracks.push({
            name: result.sourceTrack.name,
            artist: result.sourceTrack.artist,
            album: result.sourceTrack.album
          });
        }
      }

      console.log(`Matched ${syncResult.matchedTracks} out of ${syncResult.totalTracks} tracks`);

      // Create or update destination playlist
      if (matchedTrackIds.length > 0) {
        if (destinationPlaylist && syncResult.syncMode === 'update') {
          // Update existing playlist - only add new tracks
          console.log(`Updating existing playlist: ${destinationPlaylist.name}`);
          
          // Get existing tracks in the destination playlist
          const existingTracks = await this.destinationService.getPlaylistTracks(destinationPlaylist.id);
          const existingTrackIds = new Set(existingTracks.map(track => track.id));
          
          // Filter out tracks that are already in the playlist
          const newTrackIds = matchedTrackIds.filter(id => !existingTrackIds.has(id));
          
          console.log(`Found ${existingTracks.length} existing tracks, adding ${newTrackIds.length} new tracks`);
          
          if (newTrackIds.length > 0) {
            syncResult.destinationPlaylist = await this.destinationService.addTracksToPlaylist(
              destinationPlaylist.id, 
              newTrackIds
            );
            syncResult.matchedTracks = newTrackIds.length;
            syncResult.message = `Added ${newTrackIds.length} new tracks`;
          } else {
            console.log('All tracks already exist in the playlist');
            syncResult.destinationPlaylist = destinationPlaylist;
            syncResult.matchedTracks = 0;
            syncResult.message = 'All tracks already exist in the playlist';
          }
        } else {
          // Create new playlist
          console.log(`Creating new playlist: ${playlistName}`);
          const description = options.playlistDescription || 
            `Synced from ${this.sourceService.serviceName} on ${new Date().toLocaleDateString()}`;
          
          syncResult.destinationPlaylist = await this.destinationService.createPlaylist(
            playlistName,
            description,
            matchedTrackIds
          );
        }
      } else {
        console.log('No matched tracks to sync');
      }

      syncResult.endTime = Date.now();
      syncResult.duration = syncResult.endTime - syncResult.startTime;

      console.log(`Sync completed in ${(syncResult.duration / 1000).toFixed(1)} seconds`);
      return syncResult;

    } catch (error) {
      console.error('Sync error:', error);
      syncResult.errors.push(error.message);
      syncResult.endTime = Date.now();
      syncResult.duration = syncResult.endTime - syncResult.startTime;
      throw error;
    }
  }

  async matchAllTracks(sourceTracks, onProgress) {
    const results = [];
    const batchSize = 5; // Process in small batches to avoid rate limits

    console.log(`Starting track matching for ${sourceTracks.length} tracks`);

    for (let i = 0; i < sourceTracks.length; i += batchSize) {
      const batch = sourceTracks.slice(i, i + batchSize);
      
      const batchPromises = batch.map(track => 
        this.trackMatcher.matchTrack(track)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Report progress
      if (onProgress) {
        const progress = Math.round((results.length / sourceTracks.length) * 100);
        onProgress(progress, results.length, sourceTracks.length);
      }

      // Rate limiting delay
      await this.rateLimitDelay();
    }

    console.log(`Track matching completed: ${results.filter(r => r.destinationTrack).length}/${results.length} matched`);
    return results;
  }

  async getUserPlaylists() {
    try {
      const [sourcePlaylists, destinationPlaylists] = await Promise.all([
        this.sourceService.getUserPlaylists(),
        this.destinationService.getUserPlaylists()
      ]);

      return {
        source: {
          service: this.sourceService.serviceName,
          playlists: sourcePlaylists
        },
        destination: {
          service: this.destinationService.serviceName,
          playlists: destinationPlaylists
        }
      };
    } catch (error) {
      console.error('Error fetching playlists:', error);
      throw error;
    }
  }

  /**
   * Get sync capabilities between the two services
   * @returns {Object} Sync capabilities and limitations
   */
  getSyncCapabilities() {
    const sourceCapabilities = this.sourceService.getCapabilities();
    const destinationCapabilities = this.destinationService.getCapabilities();

    return {
      canSync: sourceCapabilities.canRead && destinationCapabilities.canWrite,
      canCreatePlaylists: destinationCapabilities.canCreatePlaylists,
      supportsISRC: sourceCapabilities.supportsISRC && destinationCapabilities.supportsISRC,
      maxPlaylistTracks: Math.min(
        sourceCapabilities.maxPlaylistTracks || Infinity,
        destinationCapabilities.maxPlaylistTracks || Infinity
      ),
      batchSize: Math.min(
        sourceCapabilities.batchSize || 100,
        destinationCapabilities.batchSize || 100
      ),
      sourceService: {
        name: this.sourceService.serviceName,
        capabilities: sourceCapabilities
      },
      destinationService: {
        name: this.destinationService.serviceName,
        capabilities: destinationCapabilities
      }
    };
  }

  /**
   * Validate that a sync operation can be performed
   * @param {string} sourcePlaylistId - Source playlist ID
   * @param {Object} options - Sync options
   * @returns {Object} Validation result
   */
  async validateSync(sourcePlaylistId, options = {}) {
    try {
      // Check if source playlist exists and is accessible
      const sourcePlaylist = await this.sourceService.getPlaylistDetails(sourcePlaylistId);
      if (!sourcePlaylist) {
        return { valid: false, error: 'Source playlist not found' };
      }

      // Check capabilities
      const capabilities = this.getSyncCapabilities();
      if (!capabilities.canSync) {
        return { valid: false, error: 'Sync not supported between these services' };
      }

      // Check track count limits
      if (sourcePlaylist.trackCount > capabilities.maxPlaylistTracks) {
        return { 
          valid: false, 
          error: `Playlist has ${sourcePlaylist.trackCount} tracks, but destination service supports maximum ${capabilities.maxPlaylistTracks} tracks` 
        };
      }

      return { valid: true, sourcePlaylist, capabilities };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  rateLimitDelay() {
    // Delay to respect API rate limits
    // Apple Music needs more time between requests
    const delay = this.destinationService.serviceName === 'Apple Music' ? 200 : 100;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = SyncService;