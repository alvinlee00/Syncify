const axios = require('axios');
const BaseService = require('../base/BaseService');
const spotifyConfig = require('../../config/spotify');

class SpotifyAdapter extends BaseService {
  constructor(accessToken) {
    super('spotify', { accessToken });
    
    this.accessToken = accessToken;
    this.apiClient = axios.create({
      baseURL: spotifyConfig.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.isConnected = !!accessToken;
  }

  async getCurrentUser() {
    try {
      const response = await this.apiClient.get('/me');
      return {
        id: response.data.id,
        name: response.data.display_name,
        email: response.data.email,
        serviceName: this.serviceName,
        originalUser: response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserPlaylists(limit = 50) {
    try {
      let playlists = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await this.apiClient.get('/me/playlists', {
          params: { limit, offset }
        });

        const normalizedPlaylists = response.data.items.map(playlist => 
          this.normalizePlaylist(playlist)
        );
        
        playlists = playlists.concat(normalizedPlaylists);
        hasMore = response.data.next !== null;
        offset += limit;
      }

      return playlists;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPlaylistTracks(playlistId) {
    try {
      let tracks = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await this.apiClient.get(`/playlists/${playlistId}/tracks`, {
          params: {
            limit: 100,
            offset,
            fields: 'items(track(id,name,artists,album,external_ids,duration_ms,uri)),next'
          }
        });

        const items = response.data.items.filter(item => item.track && !item.track.is_local);
        const normalizedTracks = items.map(item => this.normalizeTrack(item.track));
        tracks = tracks.concat(normalizedTracks);
        
        hasMore = response.data.next !== null;
        offset += 100;
      }

      return tracks;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPlaylistDetails(playlistId) {
    try {
      const response = await this.apiClient.get(`/playlists/${playlistId}`, {
        params: {
          fields: 'id,name,description,images,owner,tracks(total)'
        }
      });
      return this.normalizePlaylist(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchTracks(query, limit = 10) {
    try {
      const response = await this.apiClient.get('/search', {
        params: {
          q: query,
          type: 'track',
          limit
        }
      });

      return response.data.tracks.items.map(track => this.normalizeTrack(track));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchByISRC(isrc) {
    try {
      const response = await this.apiClient.get('/search', {
        params: {
          q: `isrc:${isrc}`,
          type: 'track',
          limit: 1
        }
      });

      if (response.data.tracks.items.length > 0) {
        return this.normalizeTrack(response.data.tracks.items[0]);
      }
      return null;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createPlaylist(name, description = '', trackIds = []) {
    try {
      // First get the current user ID
      const user = await this.getCurrentUser();
      
      // Create the playlist
      const playlistResponse = await this.apiClient.post(`/users/${user.id}/playlists`, {
        name,
        description,
        public: false
      });

      const playlist = this.normalizePlaylist(playlistResponse.data);

      // Add tracks if provided
      if (trackIds.length > 0) {
        await this.addTracksToPlaylist(playlist.id, trackIds);
      }

      return playlist;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async addTracksToPlaylist(playlistId, trackIds) {
    try {
      // Spotify accepts URIs, so convert IDs to URIs if needed
      const trackUris = trackIds.map(id => 
        id.startsWith('spotify:track:') ? id : `spotify:track:${id}`
      );

      // Spotify has a limit of 100 tracks per request
      const batchSize = 100;
      for (let i = 0; i < trackUris.length; i += batchSize) {
        const batch = trackUris.slice(i, i + batchSize);
        
        await this.apiClient.post(`/playlists/${playlistId}/tracks`, {
          uris: batch
        });
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
        playlist.name.toLowerCase() === name.toLowerCase()
      ) || null;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Override base class methods for Spotify-specific behavior

  extractArtistName(track) {
    if (track.artists && track.artists.length > 0) {
      return track.artists[0].name;
    }
    return 'Unknown Artist';
  }

  extractAlbumName(track) {
    return track.album?.name || 'Unknown Album';
  }

  extractISRC(track) {
    return track.external_ids?.isrc || null;
  }

  extractPlaylistImage(playlist) {
    if (playlist.images && playlist.images.length > 0) {
      return playlist.images[0].url;
    }
    return null;
  }

  extractPlaylistOwner(playlist) {
    return playlist.owner?.display_name || playlist.owner?.id || 'Unknown';
  }

  getCapabilities() {
    return {
      canRead: true,
      canWrite: true,
      canSearch: true,
      canCreatePlaylists: true,
      supportsISRC: true,
      maxPlaylistTracks: 10000,
      batchSize: 100
    };
  }

  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        return new Error('Spotify access token expired');
      } else if (status === 403) {
        return new Error('Insufficient Spotify permissions');
      } else if (status === 429) {
        return new Error('Spotify rate limit exceeded');
      }
      
      return new Error(data.error?.message || 'Spotify API error');
    }
    
    return error;
  }
}

module.exports = SpotifyAdapter;