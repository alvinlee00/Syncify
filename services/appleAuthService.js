const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const appleAuthConfig = require('../config/appleAuth');

class AppleAuthService {
  constructor() {
    this.config = appleAuthConfig;
  }

  generateClientSecret() {
    if (!this.config.teamId || !this.config.keyId || !this.config.privateKeyPath || !this.config.clientId) {
      throw new Error('Apple Sign in credentials not configured');
    }

    try {
      const privateKey = fs.readFileSync(
        path.resolve(this.config.privateKeyPath),
        'utf8'
      );

      const headers = {
        kid: this.config.keyId,
        alg: 'ES256'
      };

      const claims = {
        iss: this.config.teamId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 180, // 180 days
        aud: 'https://appleid.apple.com',
        sub: this.config.clientId
      };

      return jwt.sign(claims, privateKey, {
        algorithm: 'ES256',
        header: headers
      });
    } catch (error) {
      console.error('Error generating Apple client secret:', error);
      throw new Error('Failed to generate Apple client secret');
    }
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      response_type: this.config.responseType,
      response_mode: this.config.responseMode,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: state,
      scope: this.config.scope
    });

    return `${this.config.authEndpoint}?${params}`;
  }

  async validateAuthorizationCode(code) {
    try {
      const clientSecret = this.generateClientSecret();

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri
      });

      const response = await axios.post(this.config.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Apple token exchange error:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code');
    }
  }

  async refreshToken(refreshToken) {
    try {
      const clientSecret = this.generateClientSecret();

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(this.config.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Apple token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh token');
    }
  }

  decodeIdToken(idToken) {
    try {
      // Decode without verification for now (in production, verify with Apple's public keys)
      const decoded = jwt.decode(idToken, { complete: true });
      
      if (!decoded) {
        throw new Error('Invalid ID token');
      }

      const payload = decoded.payload;
      
      return {
        sub: payload.sub, // Unique Apple ID
        email: payload.email,
        emailVerified: payload.email_verified,
        isPrivateEmail: payload.is_private_email,
        realUserStatus: payload.real_user_status,
        authTime: payload.auth_time
      };
    } catch (error) {
      console.error('Error decoding Apple ID token:', error);
      throw new Error('Invalid ID token');
    }
  }

  async revokeToken(token) {
    try {
      const clientSecret = this.generateClientSecret();

      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        token: token,
        token_type_hint: 'refresh_token'
      });

      await axios.post(this.config.revokeEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return true;
    } catch (error) {
      console.error('Apple token revoke error:', error.response?.data || error.message);
      throw new Error('Failed to revoke token');
    }
  }
}

module.exports = AppleAuthService;