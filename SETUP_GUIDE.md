# Quick Setup Guide for Syncify

## Prerequisites Checklist
- [ ] Node.js installed (v14 or higher)
- [ ] Spotify Developer account (free)
- [ ] Apple Developer account ($99/year)
- [ ] Your Apple Music private key (.p8 file)

## Step 1: Clone and Install
```bash
cd ~/Syncify
npm install
```

## Step 2: Configure Spotify
1. Get your credentials from https://developer.spotify.com/dashboard
2. Your app's redirect URI must be: `http://127.0.0.1:3000/auth/spotify/callback`

## Step 3: Configure Apple Music
1. Place your MusicKit .p8 file in the project root directory
2. Get your Team ID from the Apple Developer portal (top right corner)
3. Get your Key ID (shown when you downloaded the .p8 file)

## Step 3a: Configure Sign in with Apple (Optional but Recommended)
1. In Apple Developer portal, create a Service ID for Sign in with Apple
2. Configure your Service ID with redirect URL: `http://127.0.0.1:3000/auth/apple/callback`
3. Generate a Sign in with Apple private key (.p8)
4. Place this second .p8 file in the project root directory

## Step 4: Set Up Environment Variables
Edit the `.env` file with your actual credentials:

```
# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_actual_client_id_here
SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/auth/spotify/callback

# Apple Music API Credentials  
APPLE_TEAM_ID=your_10_character_team_id
APPLE_KEY_ID=your_10_character_key_id
APPLE_PRIVATE_KEY_PATH=./AuthKey_XXXXXXXXXX.p8

# Sign in with Apple Credentials (Optional)
APPLE_SERVICE_ID=com.yourname.syncify
APPLE_SIGNIN_KEY_ID=your_signin_key_id
APPLE_SIGNIN_PRIVATE_KEY_PATH=./SignInKey_XXXXXXXXXX.p8

# Server Configuration
PORT=3000
SESSION_SECRET=change-this-to-random-string
```

## Step 5: Start the Server
```bash
npm start
```

## Step 6: Open the App
1. Go to http://127.0.0.1:3000
2. Click "Connect Spotify" and log in
3. Click "Connect Apple Music" and log in
4. Select a playlist and click "Sync to Apple Music"

## Troubleshooting

### "Cannot find private key file"
- Make sure your .p8 file is in the project root
- Check the filename matches exactly in .env
- File should be named like: AuthKey_XXXXXXXXXX.p8

### "Invalid client" error from Spotify
- Double-check your Client ID and Secret
- Ensure redirect URI matches exactly: `http://127.0.0.1:3000/auth/spotify/callback`

### Apple Music won't connect
- Verify your Team ID (10 characters, like `ABCDE12345`)
- Verify your Key ID (10 characters)
- Make sure the .p8 file hasn't been modified

### "Token expired" errors
- The app handles token refresh automatically
- If issues persist, try logging out and back in

## Security Notes
- Never commit your .env file to git
- Keep your .p8 file secure and private
- Don't share your client secrets

## Need Help?
Check the full README.md for more detailed information.