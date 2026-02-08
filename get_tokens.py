#!/usr/bin/env python3
"""
Helper script to extract authentication tokens for GitHub Secrets setup
Run this AFTER authenticating with both services in the web app
"""
import sys
from fastapi import Request
from fastapi.testclient import TestClient
import json

# This is a helper to get your tokens for setting up GitHub Actions
print("""
╔════════════════════════════════════════════════════════════════╗
║         Syncify Token Extraction Helper                       ║
╚════════════════════════════════════════════════════════════════╝

This script helps you get the tokens needed for GitHub Actions.

INSTRUCTIONS:
1. Start the web app: python run.py
2. Go to http://127.0.0.1:3000
3. Connect BOTH Spotify and Apple Music
4. Keep the browser open and the server running
5. Open a NEW terminal and run this script: python get_tokens.py

Note: This script is for LOCAL SETUP ONLY. Never commit tokens to git!
""")

print("\n" + "="*60)
print("METHOD 1: Manual Token Extraction (Recommended)")
print("="*60)

print("""
For SPOTIFY refresh token:
  1. After connecting Spotify in the web app
  2. Check your terminal where 'python run.py' is running
  3. Look for log output after OAuth callback
  4. Copy the 'refresh_token' value

For APPLE MUSIC user token:
  1. After connecting Apple Music in the web app
  2. Open browser DevTools (press F12)
  3. Go to Console tab
  4. Run: MusicKit.getInstance().musicUserToken
  5. Copy the token value (very long string)

For APPLE PRIVATE KEY:
  1. Open your .p8 file in a text editor
  2. Copy the ENTIRE contents including:
     -----BEGIN PRIVATE KEY-----
     ...
     -----END PRIVATE KEY-----
""")

print("\n" + "="*60)
print("METHOD 2: Quick Copy from .env")
print("="*60)

try:
    from dotenv import dotenv_values
    env_values = dotenv_values('.env')

    print("\nFrom your .env file, you'll need these for GitHub Secrets:")
    print("\nSPOTIFY_CLIENT_ID:")
    print(f"  {env_values.get('SPOTIFY_CLIENT_ID', 'NOT FOUND')}")

    print("\nSPOTIFY_CLIENT_SECRET:")
    print(f"  {env_values.get('SPOTIFY_CLIENT_SECRET', 'NOT FOUND')}")

    print("\nAPPLE_TEAM_ID:")
    print(f"  {env_values.get('APPLE_TEAM_ID', 'NOT FOUND')}")

    print("\nAPPLE_KEY_ID:")
    print(f"  {env_values.get('APPLE_KEY_ID', 'NOT FOUND')}")

    print("\nAPPLE_PRIVATE_KEY_PATH:")
    private_key_path = env_values.get('APPLE_PRIVATE_KEY_PATH')
    if private_key_path:
        print(f"  {private_key_path}")
        print(f"\n  To get the private key contents:")
        print(f"  cat {private_key_path}")
    else:
        print("  NOT FOUND")

except ImportError:
    print("\n⚠️  python-dotenv not installed, skipping .env parsing")
except Exception as e:
    print(f"\n⚠️  Error reading .env: {e}")

print("\n" + "="*60)
print("NEXT STEPS")
print("="*60)
print("""
1. Gather all the tokens using Method 1 above
2. Go to GitHub repo > Settings > Secrets > Actions
3. Add each secret:
   - SPOTIFY_CLIENT_ID
   - SPOTIFY_CLIENT_SECRET
   - SPOTIFY_REFRESH_TOKEN (from Method 1)
   - APPLE_TEAM_ID
   - APPLE_KEY_ID
   - APPLE_PRIVATE_KEY (full .p8 file contents)
   - APPLE_MUSIC_USER_TOKEN (from Method 1)

4. Edit sync_config.yml with your playlist IDs
5. Push to GitHub and enable Actions

See AUTOMATED_SYNC_SETUP.md for detailed instructions!
""")

print("="*60 + "\n")
