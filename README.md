# Syncify - Spotify to Apple Music Playlist Sync

Syncify allows you to sync your Spotify playlists to Apple Music, combining Spotify's excellent playlist curation with Apple Music's audio quality.

## Features

- OAuth authentication for both Spotify and Apple Music
- One-click playlist syncing
- Intelligent track matching using:
  - ISRC codes (most accurate)
  - Track name + artist matching
  - Fuzzy matching algorithms
- Real-time sync progress tracking
- Detailed sync reports showing matched and unmatched tracks

## Prerequisites

### Spotify Developer Account (Free)
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Note your Client ID and Client Secret
4. Add `http://127.0.0.1:3000/auth/spotify/callback` as a Redirect URI

### Apple Developer Account ($99/year)
1. Sign up at [Apple Developer](https://developer.apple.com)
2. Create a MusicKit identifier
3. Generate a private key for MusicKit
4. Note your Team ID and Key ID

## Setup

1. Clone the repository:
```bash
git clone https://github.com/alvinlee00/Syncify.git
cd Syncify
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Spotify and Apple credentials:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
APPLE_TEAM_ID=your_apple_team_id
APPLE_KEY_ID=your_apple_key_id
APPLE_PRIVATE_KEY_PATH=./path/to/your/key.p8
```

4. Place your Apple Music private key (.p8 file) in the project directory

5. Start the server:
```bash
npm start
```

6. Open http://127.0.0.1:3000 in your browser

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