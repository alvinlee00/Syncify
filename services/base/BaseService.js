/**
 * Abstract base class for all music streaming services
 * Defines the common interface that all services must implement
 */
class BaseService {
  constructor(serviceName, credentials) {
    if (this.constructor === BaseService) {
      throw new Error('BaseService is abstract and cannot be instantiated directly');
    }
    
    this.serviceName = serviceName;
    this.credentials = credentials;
    this.isConnected = false;
  }

  // Abstract methods that must be implemented by all services
  
  /**
   * Get the current authenticated user info
   * @returns {Promise<Object>} User object with id, name, email
   */
  async getCurrentUser() {
    throw new Error('getCurrentUser must be implemented by subclass');
  }

  /**
   * Get all playlists for the authenticated user
   * @param {number} limit - Maximum number of playlists to fetch
   * @returns {Promise<Array>} Array of playlist objects
   */
  async getUserPlaylists(limit = 50) {
    throw new Error('getUserPlaylists must be implemented by subclass');
  }

  /**
   * Get all tracks from a specific playlist
   * @param {string} playlistId - The playlist identifier
   * @returns {Promise<Array>} Array of track objects
   */
  async getPlaylistTracks(playlistId) {
    throw new Error('getPlaylistTracks must be implemented by subclass');
  }

  /**
   * Get detailed information about a playlist
   * @param {string} playlistId - The playlist identifier
   * @returns {Promise<Object>} Playlist object with metadata
   */
  async getPlaylistDetails(playlistId) {
    throw new Error('getPlaylistDetails must be implemented by subclass');
  }

  /**
   * Search for tracks in the service's catalog
   * @param {string} query - Search query string
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of track objects
   */
  async searchTracks(query, limit = 10) {
    throw new Error('searchTracks must be implemented by subclass');
  }

  /**
   * Search for a specific track by ISRC code
   * @param {string} isrc - International Standard Recording Code
   * @returns {Promise<Object|null>} Track object or null if not found
   */
  async searchByISRC(isrc) {
    throw new Error('searchByISRC must be implemented by subclass');
  }

  /**
   * Create a new playlist
   * @param {string} name - Playlist name
   * @param {string} description - Playlist description
   * @param {Array} trackIds - Array of track IDs to add
   * @returns {Promise<Object>} Created playlist object
   */
  async createPlaylist(name, description = '', trackIds = []) {
    throw new Error('createPlaylist must be implemented by subclass');
  }

  /**
   * Add tracks to an existing playlist
   * @param {string} playlistId - The playlist identifier
   * @param {Array} trackIds - Array of track IDs to add
   * @returns {Promise<Object>} Updated playlist object
   */
  async addTracksToPlaylist(playlistId, trackIds) {
    throw new Error('addTracksToPlaylist must be implemented by subclass');
  }

  /**
   * Find a playlist by name
   * @param {string} name - Playlist name to search for
   * @returns {Promise<Object|null>} Playlist object or null if not found
   */
  async findPlaylistByName(name) {
    throw new Error('findPlaylistByName must be implemented by subclass');
  }

  // Common utility methods that can be shared across services

  /**
   * Normalize a track object to a common format
   * @param {Object} track - Service-specific track object
   * @returns {Object} Normalized track object
   */
  normalizeTrack(track) {
    return {
      id: track.id,
      name: track.name || track.title,
      artist: this.extractArtistName(track),
      album: this.extractAlbumName(track),
      duration: track.duration_ms || track.duration || 0,
      isrc: this.extractISRC(track),
      uri: track.uri || track.url,
      serviceName: this.serviceName,
      originalTrack: track
    };
  }

  /**
   * Normalize a playlist object to a common format
   * @param {Object} playlist - Service-specific playlist object
   * @returns {Object} Normalized playlist object
   */
  normalizePlaylist(playlist) {
    return {
      id: playlist.id,
      name: playlist.name || playlist.title,
      description: playlist.description || '',
      trackCount: playlist.trackCount || playlist.tracks?.total || 0,
      image: this.extractPlaylistImage(playlist),
      owner: this.extractPlaylistOwner(playlist),
      serviceName: this.serviceName,
      originalPlaylist: playlist
    };
  }

  /**
   * Extract artist name from track object (to be overridden if needed)
   * @param {Object} track - Track object
   * @returns {string} Artist name
   */
  extractArtistName(track) {
    if (track.artists && track.artists.length > 0) {
      return track.artists[0].name;
    }
    return track.artist || track.artistName || 'Unknown Artist';
  }

  /**
   * Extract album name from track object (to be overridden if needed)
   * @param {Object} track - Track object
   * @returns {string} Album name
   */
  extractAlbumName(track) {
    if (track.album) {
      return track.album.name || track.album;
    }
    return track.albumName || 'Unknown Album';
  }

  /**
   * Extract ISRC from track object (to be overridden if needed)
   * @param {Object} track - Track object
   * @returns {string|null} ISRC code or null
   */
  extractISRC(track) {
    return track.external_ids?.isrc || track.isrc || null;
  }

  /**
   * Extract playlist image URL (to be overridden if needed)
   * @param {Object} playlist - Playlist object
   * @returns {string|null} Image URL or null
   */
  extractPlaylistImage(playlist) {
    if (playlist.images && playlist.images.length > 0) {
      return playlist.images[0].url;
    }
    return playlist.image || playlist.imageUrl || null;
  }

  /**
   * Extract playlist owner info (to be overridden if needed)
   * @param {Object} playlist - Playlist object
   * @returns {string} Owner name or ID
   */
  extractPlaylistOwner(playlist) {
    if (playlist.owner) {
      return playlist.owner.display_name || playlist.owner.name || playlist.owner.id;
    }
    return playlist.ownerName || 'Unknown';
  }

  /**
   * Check if the service is properly authenticated
   * @returns {boolean} True if service is ready to use
   */
  isAuthenticated() {
    return this.isConnected && this.credentials;
  }

  /**
   * Get service information
   * @returns {Object} Service metadata
   */
  getServiceInfo() {
    return {
      name: this.serviceName,
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated(),
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Get service capabilities (to be overridden by subclasses)
   * @returns {Object} Capability flags
   */
  getCapabilities() {
    return {
      canRead: true,
      canWrite: true,
      canSearch: true,
      canCreatePlaylists: true,
      supportsISRC: false
    };
  }

  /**
   * Handle service-specific errors
   * @param {Error} error - The error to handle
   * @returns {Error} Standardized error
   */
  handleError(error) {
    // Default error handling - can be overridden by subclasses
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        return new Error(`${this.serviceName} authentication failed`);
      } else if (status === 403) {
        return new Error(`${this.serviceName} access forbidden`);
      } else if (status === 429) {
        return new Error(`${this.serviceName} rate limit exceeded`);
      }
      
      return new Error(data.error?.message || `${this.serviceName} API error`);
    }
    
    return error;
  }
}

module.exports = BaseService;