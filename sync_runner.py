#!/usr/bin/env python3
"""
Syncify Automated Sync Runner
Runs playlist syncs based on sync_config.yml configuration
Designed to run in GitHub Actions or other CI/CD environments
"""
import os
import sys
import yaml
import asyncio
from typing import Dict, List
from datetime import datetime

from app.services.spotify_service import SpotifyService
from app.services.apple_music_service import AppleMusicService
from app.services.sync_service import SyncService


class SyncRunner:
    def __init__(self, config_path: str = "sync_config.yml"):
        """Initialize sync runner with configuration"""
        self.config = self._load_config(config_path)
        self.spotify_service = None
        self.apple_service = None

    def _load_config(self, config_path: str) -> Dict:
        """Load sync configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                print(f"✅ Loaded configuration from {config_path}")
                return config
        except FileNotFoundError:
            print(f"❌ Configuration file not found: {config_path}")
            print("Please create sync_config.yml with your playlist configurations")
            sys.exit(1)
        except yaml.YAMLError as e:
            print(f"❌ Error parsing YAML configuration: {e}")
            sys.exit(1)

    def _initialize_services(self):
        """Initialize music service clients with stored credentials"""
        # Get Spotify credentials from environment
        spotify_refresh_token = os.getenv("SPOTIFY_REFRESH_TOKEN")
        if not spotify_refresh_token:
            print("❌ SPOTIFY_REFRESH_TOKEN not found in environment")
            print("Please set up your Spotify refresh token as a GitHub Secret")
            sys.exit(1)

        # Refresh Spotify access token using refresh token
        try:
            tokens = SpotifyService.refresh_access_token(spotify_refresh_token)
            self.spotify_service = SpotifyService(tokens["access_token"])
            print("✅ Spotify service initialized")
        except Exception as e:
            print(f"❌ Failed to initialize Spotify: {e}")
            sys.exit(1)

        # Get Apple Music credentials from environment
        apple_user_token = os.getenv("APPLE_MUSIC_USER_TOKEN")
        if not apple_user_token:
            print("❌ APPLE_MUSIC_USER_TOKEN not found in environment")
            print("Please set up your Apple Music user token as a GitHub Secret")
            sys.exit(1)

        try:
            self.apple_service = AppleMusicService(apple_user_token)
            print("✅ Apple Music service initialized")
        except Exception as e:
            print(f"❌ Failed to initialize Apple Music: {e}")
            sys.exit(1)

    def _get_service(self, service_type: str):
        """Get initialized service by type"""
        if service_type.lower() == "spotify":
            return self.spotify_service
        elif service_type.lower() == "apple":
            return self.apple_service
        else:
            raise ValueError(f"Unknown service type: {service_type}")

    async def run_sync_job(self, job: Dict) -> Dict:
        """Run a single sync job"""
        job_name = job.get("name", "Unnamed Job")
        print(f"\n{'='*60}")
        print(f"🔄 Starting sync job: {job_name}")
        print(f"{'='*60}")

        try:
            # Get source service and playlist
            source_config = job["source"]
            source_service = self._get_service(source_config["service"])
            source_playlist_id = source_config["playlist_id"]

            # Get destination service and settings
            dest_config = job["destination"]
            dest_service = self._get_service(dest_config["service"])
            dest_mode = dest_config.get("mode", "create")
            dest_playlist_name = dest_config.get("playlist_name")

            print(f"📥 Source: {source_config['service']} - Playlist ID: {source_playlist_id}")
            print(f"📤 Destination: {dest_config['service']} - Mode: {dest_mode}")

            # Fetch source playlist
            print(f"⏳ Fetching source playlist...")
            source_playlist = source_service.get_playlist(source_playlist_id)
            print(f"✅ Found playlist: {source_playlist.name} ({len(source_playlist.tracks)} tracks)")

            # Create a mock session dict for sync service
            session = {
                "spotify_tokens": {"access_token": self.spotify_service.access_token} if self.spotify_service else None,
                "apple_user_token": self.apple_service.user_token if self.apple_service else None,
                "apple_developer_token": self.apple_service.developer_token if self.apple_service else None,
            }

            # Prepare sync request
            sync_request = {
                "source": {
                    "type": source_config["service"],
                    "playlistId": source_playlist_id
                },
                "destination": {
                    "type": dest_config["service"],
                    "mode": dest_mode,
                    "playlistName": dest_playlist_name or f"{source_playlist.name} (from {source_config['service'].title()})"
                }
            }

            # Run sync
            print(f"⏳ Starting sync process...")
            result = await SyncService.sync_playlist(session, sync_request)

            # Report results
            if result.success:
                print(f"\n✅ Sync completed successfully!")
                print(f"   Matched: {result.matched_count}/{result.total_tracks} tracks")
                print(f"   Destination playlist: {result.destination_playlist_name}")
                if result.destination_playlist_id:
                    print(f"   Playlist ID: {result.destination_playlist_id}")
            else:
                print(f"\n❌ Sync failed: {result.error}")

            return {
                "job_name": job_name,
                "success": result.success,
                "matched": result.matched_count,
                "total": result.total_tracks,
                "error": result.error
            }

        except Exception as e:
            print(f"\n❌ Error running sync job '{job_name}': {e}")
            import traceback
            traceback.print_exc()
            return {
                "job_name": job_name,
                "success": False,
                "error": str(e)
            }

    async def run_all_jobs(self) -> List[Dict]:
        """Run all configured sync jobs"""
        print(f"\n{'='*60}")
        print(f"🚀 Syncify Automated Sync Runner")
        print(f"⏰ Started at: {datetime.utcnow().isoformat()}Z")
        print(f"{'='*60}")

        # Initialize services
        self._initialize_services()

        # Get sync jobs from config
        jobs = self.config.get("sync_jobs", [])
        if not jobs:
            print("⚠️  No sync jobs configured in sync_config.yml")
            return []

        print(f"\n📋 Found {len(jobs)} sync job(s) to run\n")

        # Run all jobs
        results = []
        for i, job in enumerate(jobs, 1):
            print(f"\n[Job {i}/{len(jobs)}]")
            result = await self.run_sync_job(job)
            results.append(result)

        # Print summary
        print(f"\n{'='*60}")
        print(f"📊 Sync Summary")
        print(f"{'='*60}")

        successful = sum(1 for r in results if r["success"])
        failed = len(results) - successful

        print(f"✅ Successful: {successful}")
        print(f"❌ Failed: {failed}")

        for result in results:
            status = "✅" if result["success"] else "❌"
            job_name = result["job_name"]
            if result["success"]:
                print(f"{status} {job_name}: {result['matched']}/{result['total']} tracks matched")
            else:
                print(f"{status} {job_name}: {result.get('error', 'Unknown error')}")

        print(f"\n⏰ Completed at: {datetime.utcnow().isoformat()}Z")
        print(f"{'='*60}\n")

        # Exit with error code if any jobs failed
        if failed > 0:
            sys.exit(1)

        return results


async def main():
    """Main entry point"""
    runner = SyncRunner()
    await runner.run_all_jobs()


if __name__ == "__main__":
    asyncio.run(main())
