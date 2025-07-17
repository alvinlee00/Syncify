const config = {
  clientId: process.env.APPLE_SERVICE_ID,
  teamId: process.env.APPLE_TEAM_ID,
  keyId: process.env.APPLE_SIGNIN_KEY_ID,
  privateKeyPath: process.env.APPLE_SIGNIN_PRIVATE_KEY_PATH,
  redirectUri: process.env.APPLE_SIGNIN_REDIRECT_URI,
  scope: 'name email',
  responseType: 'code id_token',
  responseMode: 'form_post',
  authEndpoint: 'https://appleid.apple.com/auth/authorize',
  tokenEndpoint: 'https://appleid.apple.com/auth/token',
  revokeEndpoint: 'https://appleid.apple.com/auth/revoke'
};

module.exports = config;