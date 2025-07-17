const express = require('express');
const router = express.Router();
const SpotifyService = require('../services/spotifyService');
const AppleService = require('../services/appleService');

const requireAuth = (req, res, next) => {
  if (!req.session.spotifyTokens?.accessToken) {
    return res.status(401).json({ error: 'Spotify not authenticated' });
  }
  if (!req.session.appleUserToken) {
    return res.status(401).json({ error: 'Apple Music not authenticated' });
  }
  next();
};

router.get('/spotify', async (req, res) => {
  if (!req.session.spotifyTokens?.accessToken) {
    return res.status(401).json({ error: 'Spotify not authenticated' });
  }

  try {
    const spotifyService = new SpotifyService(req.session.spotifyTokens.accessToken);
    const playlists = await spotifyService.getUserPlaylists();
    
    res.json({
      playlists: playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.tracks.total,
        image: playlist.images?.[0]?.url,
        owner: playlist.owner.display_name
      }))
    });
  } catch (error) {
    console.error('Error fetching Spotify playlists:', error);
    
    if (error.message === 'Spotify access token expired') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

router.get('/apple', requireAuth, async (req, res) => {
  try {
    const appleService = new AppleService(req.session.appleUserToken);
    const response = await appleService.getUserPlaylists();
    
    res.json({
      playlists: response.data?.map(playlist => ({
        id: playlist.id,
        name: playlist.attributes.name,
        description: playlist.attributes.description?.standard,
        trackCount: playlist.relationships?.tracks?.data?.length || 0
      })) || []
    });
  } catch (error) {
    console.error('Error fetching Apple playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

router.get('/spotify/:playlistId/tracks', async (req, res) => {
  if (!req.session.spotifyTokens?.accessToken) {
    return res.status(401).json({ error: 'Spotify not authenticated' });
  }

  try {
    const spotifyService = new SpotifyService(req.session.spotifyTokens.accessToken);
    const tracks = await spotifyService.getPlaylistTracks(req.params.playlistId);
    
    res.json({
      tracks: tracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0]?.name,
        album: track.album?.name,
        duration: track.duration_ms,
        isrc: track.external_ids?.isrc
      }))
    });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

module.exports = router;