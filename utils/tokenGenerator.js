const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const appleConfig = require('../config/apple');

let cachedToken = null;
let tokenExpiry = null;

const generateAppleMusicToken = () => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!appleConfig.teamId || !appleConfig.keyId || !appleConfig.privateKeyPath) {
    throw new Error('Apple Music credentials not configured');
  }

  try {
    const privateKey = fs.readFileSync(
      path.resolve(appleConfig.privateKeyPath),
      'utf8'
    );

    const payload = {
      iss: appleConfig.teamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + appleConfig.tokenExpiry
    };

    cachedToken = jwt.sign(payload, privateKey, {
      algorithm: appleConfig.tokenAlgorithm,
      keyid: appleConfig.keyId
    });

    tokenExpiry = Date.now() + (appleConfig.tokenExpiry * 1000) - 60000;

    return cachedToken;
  } catch (error) {
    console.error('Error generating Apple Music token:', error);
    throw new Error('Failed to generate Apple Music developer token');
  }
};

module.exports = { generateAppleMusicToken };