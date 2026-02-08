# Automated Playlist Sync Setup Guide

This guide will help you set up automated playlist syncing using GitHub Actions that runs every 6 hours.

## Overview

The automated sync system consists of:
- `sync_config.yml` - Configuration file defining which playlists to sync
- `sync_runner.py` - Python script that performs the syncs
- `.github/workflows/sync.yml` - GitHub Actions workflow that runs on a schedule

## Prerequisites

1. GitHub repository for your Syncify project
2. Active Spotify and Apple Music accounts
3. API credentials for both services

## Setup Steps

### 1. Get Your Spotify Refresh Token

The refresh token allows the automated script to get new access tokens without user interaction.

**Option A: Use the web app to get the refresh token**

1. Start your Syncify web app locally:
   ```bash
   python run.py
   ```

2. Go to http://127.0.0.1:3000 and connect Spotify

3. Check the server logs - after successful authentication, you'll see the refresh token printed

4. Copy the refresh token for use in GitHub Secrets

**Option B: Extract from session (if already connected)**

1. Add this temporary endpoint to `app/routes/auth.py`:
   ```python
   @router.get("/spotify/tokens")
   async def get_spotify_tokens(request: Request):
       """DEBUG: Get current Spotify tokens"""
       tokens = request.session.get("spotify_tokens", {})
       return {"refresh_token": tokens.get("refresh_token")}
   ```

2. Start the server, connect Spotify, then visit:
   http://127.0.0.1:3000/auth/spotify/tokens

3. Copy the `refresh_token` value

### 2. Get Your Apple Music User Token

Apple Music user tokens are long-lived (6 months) but must be manually refreshed.

1. Start your Syncify web app locally
2. Go to http://127.0.0.1:3000 and connect Apple Music
3. Open browser DevTools (F12) > Console tab
4. Run this command:
   ```javascript
   MusicKit.getInstance().musicUserToken
   ```
5. Copy the token value

**Important:** Apple Music user tokens expire after ~6 months. You'll need to refresh this token periodically.

### 3. Get Your Spotify Playlist IDs

1. Open Spotify (web or desktop app)
2. Right-click on a playlist > Share > Copy link to playlist
3. The playlist ID is the last part of the URL:
   ```
   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
                                      ^^^^^^^^^^^^^^^^^^^^^^
                                      This is the playlist ID
   ```
4. Copy the playlist ID for each playlist you want to sync

### 4. Set Up GitHub Secrets

Go to your GitHub repository > Settings > Secrets and variables > Actions > New repository secret

Add these secrets:

| Secret Name | Value | Where to get it |
|------------|-------|-----------------|
| `SPOTIFY_CLIENT_ID` | Your Spotify client ID | From your `.env` file or [Spotify Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify client secret | From your `.env` file or [Spotify Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_REFRESH_TOKEN` | Your Spotify refresh token | From Step 1 above |
| `APPLE_TEAM_ID` | Your Apple Team ID | From your `.env` file or [Apple Developer Account](https://developer.apple.com/account/) |
| `APPLE_KEY_ID` | Your Apple Music Key ID | From your `.env` file or Apple Developer Account |
| `APPLE_PRIVATE_KEY` | Your Apple Music private key contents | **Full contents** of your `.p8` file (open in text editor and copy all) |
| `APPLE_MUSIC_USER_TOKEN` | Your Apple Music user token | From Step 2 above |

**Important Notes:**
- For `APPLE_PRIVATE_KEY`, copy the **entire file contents** including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- These secrets are encrypted and only accessible to your GitHub Actions workflows
- Never commit these values directly to your repository

### 5. Configure Your Sync Jobs

Edit `sync_config.yml` to specify which playlists to sync:

```yaml
sync_jobs:
  - name: "My Workout Playlist"
    source:
      service: spotify
      playlist_id: "37i9dQZF1DXcBWIGoYBM5M"  # Replace with your playlist ID
    destination:
      service: apple
      mode: update  # or "create" for first time
      playlist_name: "Workout Mix (from Spotify)"

  - name: "Chill Vibes"
    source:
      service: spotify
      playlist_id: "your_playlist_id_here"
    destination:
      service: apple
      mode: update
      playlist_name: "Chill Vibes (from Spotify)"
```

### 6. Commit and Push

```bash
git add sync_config.yml sync_runner.py .github/workflows/sync.yml
git commit -m "Add automated playlist sync"
git push origin main
```

### 7. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. If prompted, click "I understand my workflows, go ahead and enable them"
4. You should see the "Automated Playlist Sync" workflow listed

### 8. Test the Workflow

Don't wait 6 hours - test it now!

1. Go to Actions tab > "Automated Playlist Sync"
2. Click "Run workflow" dropdown > "Run workflow"
3. Watch the job run in real-time
4. Check the logs to ensure syncs complete successfully

## Sync Schedule

The workflow runs every 6 hours at:
- 00:00 UTC (midnight)
- 06:00 UTC (6 AM)
- 12:00 UTC (noon)
- 18:00 UTC (6 PM)

To change the schedule, edit the cron expression in `.github/workflows/sync.yml`:

```yaml
schedule:
  - cron: '0 */6 * * *'  # Current: every 6 hours
  # - cron: '0 0 * * *'  # Daily at midnight UTC
  # - cron: '0 */1 * * *'  # Every hour
  # - cron: '0 8,20 * * *'  # Twice daily at 8 AM and 8 PM UTC
```

[Cron expression reference](https://crontab.guru/)

## Monitoring

### View Sync Logs

1. Go to repository > Actions tab
2. Click on a workflow run
3. Click on the "sync" job
4. Expand "Run playlist sync" to see detailed logs

### Notifications

GitHub will send you email notifications if the workflow fails. To customize notifications:
1. Go to Settings > Notifications
2. Configure "Actions" notification preferences

## Troubleshooting

### "SPOTIFY_REFRESH_TOKEN not found"
- Make sure you added the secret to GitHub repository settings
- Secret names are case-sensitive

### "Failed to initialize Apple Music"
- Check that `APPLE_PRIVATE_KEY` contains the full `.p8` file contents
- Verify `APPLE_TEAM_ID` and `APPLE_KEY_ID` are correct
- Apple Music user token may have expired (re-generate using Step 2)

### "Invalid user token" (Apple Music)
Apple Music user tokens expire after ~6 months. When this happens:
1. Run the web app locally
2. Re-authenticate with Apple Music
3. Get the new user token (Step 2)
4. Update the `APPLE_MUSIC_USER_TOKEN` secret in GitHub

### Playlist Not Syncing
- Verify the playlist ID is correct
- Check that the playlist is not private/collaborative
- Review the sync logs in GitHub Actions for specific errors

## Maintenance

**Every 6 months:**
- Refresh your Apple Music user token (user tokens expire)
- Update the `APPLE_MUSIC_USER_TOKEN` secret

**As needed:**
- Update `sync_config.yml` to add/remove playlists
- Commit and push changes - they'll be picked up in the next run

## Security Best Practices

✅ **DO:**
- Store all tokens as GitHub Secrets
- Use branch protection rules to prevent accidental secret exposure
- Regularly rotate your Spotify client secret

❌ **DON'T:**
- Commit tokens or API keys directly to your repository
- Share your refresh tokens or user tokens
- Make your repository public if it contains sensitive configuration

## Costs

GitHub Actions is free for:
- Public repositories: Unlimited minutes
- Private repositories: 2,000 minutes/month (free tier)

At 4 runs per day (every 6 hours), each taking ~2 minutes:
- **Daily usage:** ~8 minutes
- **Monthly usage:** ~240 minutes

This is well within the free tier for private repositories.

## Need Help?

- Check GitHub Actions logs for detailed error messages
- Review the main Syncify documentation
- Open an issue on the repository

---

**Happy syncing! 🎵**
