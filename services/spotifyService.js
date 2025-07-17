const axios = require('axios');
const spotifyConfig = require('../config/spotify');

class SpotifyService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.apiClient = axios.create({
      baseURL: spotifyConfig.apiBaseUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getCurrentUser() {
    try {
      const response = await this.apiClient.get('/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserPlaylists(limit = 50) {
    try {
      let playlists = [];
      let offset = 0;
      let hasMore = true;

      // Get user's regular playlists
      while (hasMore) {
        const response = await this.apiClient.get('/me/playlists', {
          params: { limit, offset }
        });

        playlists = playlists.concat(response.data.items);
        hasMore = response.data.next !== null;
        offset += limit;
      }

      // Note: Spotify-owned playlists (Discover Weekly, Release Radar, etc.) 
      // are not returned by the /me/playlists endpoint.
      // These playlists need to be accessed through different means or 
      // users need to add them to their library first.

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
        tracks = tracks.concat(items.map(item => item.track));
        
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
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }


  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        return new Error('Spotify access token expired');
      } else if (status === 403) {
        return new Error('Insufficient permissions');
      } else if (status === 429) {
        return new Error('Rate limit exceeded');
      }
      
      return new Error(data.error?.message || 'Spotify API error');
    }
    
    return error;
  }
}

module.exports = SpotifyService;