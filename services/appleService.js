const axios = require('axios');
const appleConfig = require('../config/apple');
const { generateAppleMusicToken } = require('../utils/tokenGenerator');

class AppleService {
  constructor(userToken) {
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
  }

  async searchCatalog(query, types = ['songs'], limit = 5) {
    try {
      const response = await this.apiClient.get('/catalog/us/search', {
        params: {
          term: query,
          types: types.join(','),
          limit
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchByISRC(isrc) {
    try {
      const response = await this.apiClient.get('/catalog/us/songs', {
        params: {
          filter: { isrc }
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserPlaylists() {
    try {
      const response = await this.apiClient.get('/me/library/playlists', {
        params: { limit: 100 }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPlaylist(name, description = '', trackIds = []) {
    try {
      // Apple Music API expects attributes at the top level for playlist creation
      const playlistData = {
        attributes: {
          name,
          description
        }
      };

      // Create playlist without tracks first
      const response = await this.apiClient.post('/me/library/playlists', playlistData);

      // If we have tracks, add them after playlist creation
      if (trackIds.length > 0 && response.data?.data?.[0]) {
        const playlistId = response.data.data[0].id;
        await this.addTracksToPlaylist(playlistId, trackIds);
      }

      return response.data?.data?.[0] || response.data;
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

      const response = await this.apiClient.post(
        `/me/library/playlists/${playlistId}/tracks`,
        {
          data: tracks
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPlaylist(playlistId) {
    try {
      const response = await this.apiClient.get(`/me/library/playlists/${playlistId}`, {
        params: {
          include: 'tracks'
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async findPlaylistByName(name) {
    try {
      const playlists = await this.getUserPlaylists();
      if (!playlists.data) return null;
      
      // Look for exact match or match with "(from Spotify)" suffix
      const exactMatch = playlists.data.find(p => 
        p.attributes.name === name || 
        p.attributes.name === `${name} (from Spotify)`
      );
      
      return exactMatch || null;
    } catch (error) {
      console.error('Error finding playlist by name:', error);
      return null;
    }
  }

  async getPlaylistTracks(playlistId) {
    try {
      const allTracks = [];
      let nextUrl = `/me/library/playlists/${playlistId}/tracks`;
      
      while (nextUrl) {
        let params = { limit: 100, include: 'catalog' };
        
        // If it's a pagination URL, extract any existing params and merge
        if (nextUrl !== `/me/library/playlists/${playlistId}/tracks`) {
          const url = new URL(this.apiClient.defaults.baseURL + nextUrl);
          // Keep existing params but ensure we have include=catalog
          url.searchParams.set('include', 'catalog');
          nextUrl = url.pathname;
          params = Object.fromEntries(url.searchParams);
        }
        
        const response = await this.apiClient.get(nextUrl, { params });
        
        
        if (response.data.data) {
          allTracks.push(...response.data.data);
        }
        
        // Check for pagination
        nextUrl = response.data.next ? response.data.next.replace(this.apiClient.defaults.baseURL, '') : null;
      }
      
      return allTracks;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Helper method to extract catalog ID from a library track
  getCatalogIdFromLibraryTrack(libraryTrack) {
    // Try to get catalog ID from relationships
    if (libraryTrack.relationships?.catalog?.data?.[0]?.id) {
      return libraryTrack.relationships.catalog.data[0].id;
    }
    
    // Fallback: if it's already a catalog track, use its ID
    if (libraryTrack.type === 'songs') {
      return libraryTrack.id;
    }
    
    // If we can't find catalog ID, return null
    return null;
  }

  // Get catalog IDs from existing playlist tracks for comparison
  async getPlaylistCatalogTrackIds(playlistId) {
    try {
      const tracks = await this.getPlaylistTracks(playlistId);
      const catalogIds = [];
      
      for (const track of tracks) {
        const catalogId = this.getCatalogIdFromLibraryTrack(track);
        if (catalogId) {
          catalogIds.push(catalogId);
        }
      }
      
      return catalogIds;
    } catch (error) {
      console.error('Error getting catalog track IDs:', error);
      return [];
    }
  }

  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        return new Error('Apple Music authentication failed');
      } else if (status === 403) {
        return new Error('Insufficient permissions for Apple Music');
      } else if (status === 429) {
        return new Error('Apple Music rate limit exceeded');
      }
      
      return new Error(data.errors?.[0]?.detail || 'Apple Music API error');
    }
    
    return error;
  }
}

module.exports = AppleService;