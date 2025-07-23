# Syncify - Universal Playlist Sync (Python Edition)

Sync playlists between Spotify and Apple Music with intelligent track matching.

**✨ Now powered by Python/FastAPI for better performance and reliability!**

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure API Credentials
Copy `.env.example` to `.env` and fill in your credentials:

```env
# Spotify API (Free Developer Account)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Apple Music API (Paid Developer Account $99/year)
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY_PATH=./your_private_key.p8

# Apple Sign In
APPLE_SERVICE_ID=your_service_id
APPLE_SIGNIN_KEY_ID=your_signin_key_id
APPLE_SIGNIN_PRIVATE_KEY_PATH=./your_signin_key.p8
```

### 3. Run the Application
```bash
python run.py
```

Visit **http://127.0.0.1:3000** in your browser.

## 🎵 Features

- **Universal Sync**: Spotify ↔ Apple Music playlist synchronization
- **Smart Matching**: ISRC codes + fuzzy matching for accurate track identification
- **Real-time Progress**: Live sync progress with detailed reports
- **OAuth Authentication**: Secure authentication for both services
- **Modern Architecture**: FastAPI backend with lightweight frontend

## Usage

1. **Connect Spotify**: Click "Connect Spotify" and authorize the app
2. **Connect Apple Music**: Click "Connect Apple Music" and sign in with your Apple ID
3. **Select Playlist**: Choose a Spotify playlist to sync
4. **Sync**: Click "Sync to Apple Music" and monitor the progress
5. **Review Results**: Check which tracks were successfully matched and which couldn't be found

## How It Works

1. Fetches all tracks from your selected Spotify playlist
2. For each track, attempts to find a match in Apple Music's catalog
3. Creates a new playlist in Apple Music with all matched tracks
4. Provides a detailed report of the sync process

## Troubleshooting

- **Spotify token expired**: The app will automatically refresh tokens
- **Apple Music not connecting**: Ensure your developer credentials are correct
- **Tracks not matching**: Some tracks may not be available in your region's Apple Music catalog

## Future Enhancements

- Auto-sync functionality (every 30 minutes)
- Two-way synchronization
- Batch playlist syncing
- Sync history and analytics

## License

ISC