const axios = require('axios');
const BaseService = require('../base/BaseService');
const appleConfig = require('../../config/apple');
const { generateAppleMusicToken } = require('../../utils/tokenGenerator');
const { appleMusicRateLimiter } = require('../../utils/rateLimiter');

class AppleMusicAdapter extends BaseService {
  constructor(userToken) {
    super('apple', { userToken });
    
    this.userToken = userToken;
    this.developerToken = generateAppleMusicToken();
    
    this.apiClient = axios.create({
      baseURL: appleConfig.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${this.developerToken}`,
        'Music-User-Token': userToken,
        'Content-Type': 'application/json'
      }
    });
    
    this.isConnected = !!userToken;
  }

  async getCurrentUser() {
    // Apple Music API doesn't have a direct /me endpoint for user info
    // We can get some info from the storefront, but for now return basic info
    try {
      const response = await this.apiClient.get('/me/storefront');
      return {
        id: 'apple_user', // Apple doesn't expose user ID
        name: 'Apple Music User',
        email: null, // Not available through Apple Music API
        serviceName: this.serviceName,
        storefront: response.data.data?.[0]?.id || 'us',
        originalUser: response.data
      };
    } catch (error) {
      // Return basic info if storefront call fails
      return {
        id: 'apple_user',
        name: 'Apple Music User',
        email: null,
        serviceName: this.serviceName,
        storefront: 'us'
      };
    }
  }

  async getUserPlaylists(limit = 100) {
    try {
      await appleMusicRateLimiter.throttle();
      
      const response = await this.apiClient.get('/me/library/playlists', {
        params: { limit }
      });

      if (!response.data.data) {
        return [];
      }

      return response.data.data.map(playlist => this.normalizePlaylist(playlist));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPlaylistTracks(playlistId) {
    try {
      const allTracks = [];
      let nextUrl = `/me/library/playlists/${playlistId}/tracks`;
      
      while (nextUrl) {
        let params = { limit: 100, include: 'catalog' };
        
        if (nextUrl !== `/me/library/playlists/${playlistId}/tracks`) {
          const url = new URL(this.apiClient.defaults.baseURL + nextUrl);
          url.searchParams.set('include', 'catalog');
          nextUrl = url.pathname;
          params = Object.fromEntries(url.searchParams);
        }
        
        const response = await this.apiClient.get(nextUrl, { params });
        
        if (response.data.data) {
          const normalizedTracks = response.data.data.map(track => 
            this.normalizeAppleTrack(track)
          );
          allTracks.push(...normalizedTracks);
        }
        
        nextUrl = response.data.next ? 
          response.data.next.replace(this.apiClient.defaults.baseURL, '') : null;
      }
      
      return allTracks;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPlaylistDetails(playlistId) {
    try {
      const response = await this.apiClient.get(`/me/library/playlists/${playlistId}`, {
        params: {
          include: 'tracks'
        }
      });
      return this.normalizePlaylist(response.data.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchTracks(query, limit = 10) {
    try {
      // Apply rate limiting before making the request
      await appleMusicRateLimiter.throttle();
      
      const response = await this.apiClient.get('/catalog/us/search', {
        params: {
          term: query,
          types: 'songs',
          limit
        }
      });

      if (!response.data.results?.songs?.data) {
        return [];
      }

      return response.data.results.songs.data.map(track => this.normalizeTrack(track));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchByISRC(isrc) {
    try {
      // Apply rate limiting before making the request
      await appleMusicRateLimiter.throttle();
      
      const response = await this.apiClient.get('/catalog/us/songs', {
        params: {
          filter: { isrc }
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        return this.normalizeTrack(response.data.data[0]);
      }
      return null;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPlaylist(name, description = '', trackIds = []) {
    try {
      const playlistData = {
        attributes: {
          name,
          description
        }
      };

      const response = await this.apiClient.post('/me/library/playlists', playlistData);

      if (trackIds.length > 0 && response.data?.data?.[0]) {
        const playlistId = response.data.data[0].id;
        await this.addTracksToPlaylist(playlistId, trackIds);
      }

      return this.normalizePlaylist(response.data.data?.[0] || response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addTracksToPlaylist(playlistId, trackIds) {
    try {
      const tracks = trackIds.map(id => ({
        id,
        type: 'songs'
      }));

      // Apple Music has a limit on tracks per request, so batch them
      // Add rate limiting to avoid hitting API limits
      const batchSize = 100;
      const delayBetweenBatches = 1500; // 1.5 seconds between batches
      
      for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize);
        
        // Add delay before each batch (except the first one)
        if (i > 0) {
          console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
        
        console.log(`Adding tracks ${i + 1}-${Math.min(i + batchSize, tracks.length)} of ${tracks.length}`);
        
        await this.apiClient.post(
          `/me/library/playlists/${playlistId}/tracks`,
          { data: batch }
        );
      }

      return await this.getPlaylistDetails(playlistId);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async findPlaylistByName(name) {
    try {
      const playlists = await this.getUserPlaylists();
      return playlists.find(playlist => 
        playlist.name === name || playlist.name === `${name} (from Spotify)`
      ) || null;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Apple Music specific methods

  normalizeAppleTrack(track) {
    // Handle both library tracks and catalog tracks
    if (track.relationships?.catalog?.data?.[0]) {
      // This is a library track with catalog relationship
      const catalogTrack = track.relationships.catalog.data[0];
      return this.normalizeTrack(catalogTrack);
    } else {
      // This is already a catalog track or direct track
      return this.normalizeTrack(track);
    }
  }

  getCatalogIdFromLibraryTrack(libraryTrack) {
    if (libraryTrack.relationships?.catalog?.data?.[0]?.id) {
      return libraryTrack.relationships.catalog.data[0].id;
    }
    
    if (libraryTrack.type === 'songs') {
      return libraryTrack.id;
    }
    
    return null;
  }

  async getPlaylistCatalogTrackIds(playlistId) {
    try {
      const tracks = await this.getPlaylistTracks(playlistId);
      return tracks.map(track => track.id).filter(Boolean);
    } catch (error) {
      console.error('Error getting catalog track IDs:', error);
      return [];
    }
  }

  // Override base class methods for Apple Music specific behavior

  extractArtistName(track) {
    return track.attributes?.artistName || 'Unknown Artist';
  }

  extractAlbumName(track) {
    return track.attributes?.albumName || 'Unknown Album';
  }

  extractISRC(track) {
    return track.attributes?.isrc || null;
  }

  extractPlaylistImage(playlist) {
    // Apple Music playlists might not have images in the same way
    return null;
  }

  extractPlaylistOwner(playlist) {
    return 'Me'; // Apple Music library playlists are always owned by the user
  }

  normalizeTrack(track) {
    return {
      id: track.id,
      name: track.attributes?.name || track.attributes?.title || 'Unknown',
      artist: this.extractArtistName(track),
      album: this.extractAlbumName(track),
      duration: track.attributes?.durationInMillis || 0,
      isrc: this.extractISRC(track),
      uri: track.attributes?.url,
      serviceName: this.serviceName,
      originalTrack: track
    };
  }

  normalizePlaylist(playlist) {
    if (!playlist) return null;
    
    return {
      id: playlist.id,
      name: playlist.attributes?.name || 'Unknown Playlist',
      description: playlist.attributes?.description?.standard || '',
      trackCount: playlist.relationships?.tracks?.data?.length || 0,
      image: this.extractPlaylistImage(playlist),
      owner: this.extractPlaylistOwner(playlist),
      serviceName: this.serviceName,
      originalPlaylist: playlist
    };
  }

  getCapabilities() {
    return {
      canRead: true,
      canWrite: true,
      canSearch: true,
      canCreatePlaylists: true,
      supportsISRC: true,
      maxPlaylistTracks: 100000,
      batchSize: 100
    };
  }

  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        return new Error('Apple Music authentication failed');
      } else if (status === 403) {
        return new Error('Insufficient Apple Music permissions');
      } else if (status === 429) {
        return new Error('Apple Music rate limit exceeded');
      }
      
      return new Error(data.errors?.[0]?.detail || 'Apple Music API error');
    }
    
    return error;
  }
}

module.exports = AppleMusicAdapter;