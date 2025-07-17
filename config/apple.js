const config = {
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH,
  apiBaseUrl: 'https://api.music.apple.com/v1',
  tokenExpiry: 3600,
  tokenAlgorithm: 'ES256'
};

module.exports = config;