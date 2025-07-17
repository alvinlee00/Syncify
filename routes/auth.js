const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const spotifyConfig = require('../config/spotify');
const AppleAuthService = require('../services/appleAuthService');

const generateRandomString = (length) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

router.get('/spotify', (req, res) => {
  const state = generateRandomString(16);
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: spotifyConfig.clientId,
    scope: spotifyConfig.scopes,
    redirect_uri: spotifyConfig.redirectUri,
    state: state
  });

  res.redirect(`${spotifyConfig.authEndpoint}?${params}`);
});

router.get('/spotify/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/?error=' + error);
  }

  if (state !== req.session.oauthState) {
    return res.redirect('/?error=state_mismatch');
  }

  try {
    const tokenResponse = await axios.post(
      spotifyConfig.tokenEndpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: spotifyConfig.redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            `${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`
          ).toString('base64')
        }
      }
    );

    req.session.spotifyTokens = {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      expiresIn: tokenResponse.data.expires_in,
      tokenType: tokenResponse.data.token_type,
      obtainedAt: Date.now()
    };

    const userResponse = await axios.get(`${spotifyConfig.apiBaseUrl}/me`, {
      headers: {
        'Authorization': `Bearer ${tokenResponse.data.access_token}`
      }
    });

    req.session.spotifyUser = {
      id: userResponse.data.id,
      displayName: userResponse.data.display_name,
      email: userResponse.data.email
    };

    res.redirect('/?spotify=connected');
  } catch (error) {
    console.error('Spotify auth error:', error.response?.data || error.message);
    res.redirect('/?error=spotify_auth_failed');
  }
});

router.post('/spotify/refresh', async (req, res) => {
  if (!req.session.spotifyTokens?.refreshToken) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  try {
    const response = await axios.post(
      spotifyConfig.tokenEndpoint,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: req.session.spotifyTokens.refreshToken
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            `${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`
          ).toString('base64')
        }
      }
    );

    req.session.spotifyTokens.accessToken = response.data.access_token;
    req.session.spotifyTokens.expiresIn = response.data.expires_in;
    req.session.spotifyTokens.obtainedAt = Date.now();

    res.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

router.post('/apple/token', (req, res) => {
  const { userToken } = req.body;
  
  if (!userToken) {
    return res.status(400).json({ error: 'User token required' });
  }

  req.session.appleUserToken = userToken;
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

router.get('/apple/developer-token', (req, res) => {
  try {
    const { generateAppleMusicToken } = require('../utils/tokenGenerator');
    const token = generateAppleMusicToken();
    res.json({ developerToken: token });
  } catch (error) {
    console.error('Error generating developer token:', error);
    res.status(500).json({ error: 'Failed to generate developer token' });
  }
});

// Sign in with Apple routes
router.get('/apple/signin', (req, res) => {
  try {
    const appleAuth = new AppleAuthService();
    const state = generateRandomString(16);
    req.session.appleOauthState = state;
    
    const authUrl = appleAuth.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Apple Sign in error:', error);
    res.redirect('/?error=apple_signin_failed');
  }
});

router.post('/apple/callback', async (req, res) => {
  const { code, state, id_token, user } = req.body;

  if (!code || !state) {
    return res.redirect('/?error=apple_signin_failed');
  }

  if (state !== req.session.appleOauthState) {
    return res.redirect('/?error=state_mismatch');
  }

  try {
    const appleAuth = new AppleAuthService();
    
    // Exchange authorization code for tokens
    const tokenResponse = await appleAuth.validateAuthorizationCode(code);
    
    // Decode the ID token to get user info
    const userInfo = appleAuth.decodeIdToken(tokenResponse.id_token || id_token);
    
    // If this is the first sign in, Apple provides user data
    if (user) {
      const userData = JSON.parse(user);
      userInfo.firstName = userData.name?.firstName;
      userInfo.lastName = userData.name?.lastName;
    }
    
    // Store Apple authentication in session
    req.session.appleAuth = {
      sub: userInfo.sub,
      email: userInfo.email,
      emailVerified: userInfo.emailVerified,
      isPrivateEmail: userInfo.isPrivateEmail,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token
    };
    
    // Also set the Apple Music user token if available
    if (tokenResponse.access_token) {
      req.session.appleUserToken = tokenResponse.access_token;
    }
    
    res.redirect('/?apple=signedin');
  } catch (error) {
    console.error('Apple callback error:', error);
    res.redirect('/?error=apple_signin_failed');
  }
});

router.post('/apple/refresh', async (req, res) => {
  if (!req.session.appleAuth?.refreshToken) {
    return res.status(401).json({ error: 'No Apple refresh token available' });
  }

  try {
    const appleAuth = new AppleAuthService();
    const tokenResponse = await appleAuth.refreshToken(req.session.appleAuth.refreshToken);
    
    req.session.appleAuth.accessToken = tokenResponse.access_token;
    req.session.appleAuth.idToken = tokenResponse.id_token;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Apple token refresh error:', error);
    res.status(401).json({ error: 'Failed to refresh Apple token' });
  }
});

module.exports = router;