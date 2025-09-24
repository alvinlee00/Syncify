from fuzzywuzzy import fuzz
from typing import Optional, List
import re
import asyncio

from app.models.track import Track, MatchResult

class TrackMatcher:
    def __init__(self, destination_service):
        self.destination_service = destination_service
        self.isrc_threshold = 100  # ISRC matches must be exact
        self.fuzzy_threshold = 85  # Minimum similarity for fuzzy matching
        self.exact_threshold = 95   # High similarity threshold for exact matches

    async def match_track(self, source_track: Track) -> MatchResult:
        """
        Match a source track to a destination track using multiple strategies
        """
        # Strategy 1: ISRC matching (most accurate)
        if source_track.isrc:
            isrc_match = self._match_by_isrc(source_track)
            if isrc_match:
                return MatchResult(
                    source_track=source_track,
                    destination_track=isrc_match,
                    match_confidence=100.0,
                    match_method="isrc"
                )

        # Strategy 2: Exact title + artist matching
        exact_match = self._match_by_exact_search(source_track)
        if exact_match:
            confidence = self._calculate_confidence(source_track, exact_match)
            if confidence >= self.exact_threshold:
                return MatchResult(
                    source_track=source_track,
                    destination_track=exact_match,
                    match_confidence=confidence,
                    match_method="exact"
                )

        # Strategy 3: Fuzzy matching with cleaned titles
        fuzzy_match = self._match_by_fuzzy_search(source_track)
        if fuzzy_match:
            confidence = self._calculate_confidence(source_track, fuzzy_match)
            if confidence >= self.fuzzy_threshold:
                return MatchResult(
                    source_track=source_track,
                    destination_track=fuzzy_match,
                    match_confidence=confidence,
                    match_method="fuzzy"
                )

        # No match found
        return MatchResult(
            source_track=source_track,
            destination_track=None,
            match_confidence=0.0,
            match_method=None
        )

    def _match_by_isrc(self, source_track: Track) -> Optional[Track]:
        """Match track by ISRC code"""
        try:
            if hasattr(self.destination_service, 'search_by_isrc'):
                return self.destination_service.search_by_isrc(source_track.isrc)
            return None
        except Exception:
            return None

    def _match_by_exact_search(self, source_track: Track) -> Optional[Track]:
        """Match track by exact title and artist search"""
        try:
            # Create search query with track name and artist
            query = f"{source_track.name} {source_track.artist}"
            results = self.destination_service.search_track(query, limit=10)

            # Find the best match from results
            best_match = None
            best_score = 0

            for track in results:
                score = self._calculate_confidence(source_track, track)
                if score > best_score:
                    best_score = score
                    best_match = track

            return best_match if best_score >= self.exact_threshold else None
        except Exception:
            return None

    def _match_by_fuzzy_search(self, source_track: Track) -> Optional[Track]:
        """Match track using fuzzy string matching"""
        try:
            # Clean and create various search queries
            cleaned_name = self._clean_track_name(source_track.name)
            cleaned_artist = self._clean_artist_name(source_track.artist)

            queries = [
                f"{cleaned_name} {cleaned_artist}",
                f"{source_track.name} {cleaned_artist}",
                f"{cleaned_name} {source_track.artist}",
                source_track.name  # Last resort: just the track name
            ]

            best_match = None
            best_score = 0

            for query in queries:
                results = self.destination_service.search_track(query, limit=20)

                for track in results:
                    score = self._calculate_confidence(source_track, track)
                    if score > best_score:
                        best_score = score
                        best_match = track

            return best_match if best_score >= self.fuzzy_threshold else None
        except Exception:
            return None

    def _calculate_confidence(self, source_track: Track, candidate_track: Track) -> float:
        """Calculate match confidence between two tracks"""

        # Clean track names for comparison
        source_name = self._clean_track_name(source_track.name)
        candidate_name = self._clean_track_name(candidate_track.name)

        source_artist = self._clean_artist_name(source_track.artist)
        candidate_artist = self._clean_artist_name(candidate_track.artist)

        # Calculate fuzzy ratios
        name_ratio = fuzz.ratio(source_name.lower(), candidate_name.lower())
        artist_ratio = fuzz.ratio(source_artist.lower(), candidate_artist.lower())

        # Token sort ratio for better matching of reordered words
        name_token_ratio = fuzz.token_sort_ratio(source_name.lower(), candidate_name.lower())
        artist_token_ratio = fuzz.token_sort_ratio(source_artist.lower(), candidate_artist.lower())

        # Use the better of the two ratios for each field
        final_name_ratio = max(name_ratio, name_token_ratio)
        final_artist_ratio = max(artist_ratio, artist_token_ratio)

        # Weighted average (name is slightly more important)
        confidence = (final_name_ratio * 0.6) + (final_artist_ratio * 0.4)

        # Bonus for duration similarity (if available)
        if source_track.duration_ms and candidate_track.duration_ms:
            duration_diff = abs(source_track.duration_ms - candidate_track.duration_ms)
            if duration_diff <= 2000:  # Within 2 seconds
                confidence += 5
            elif duration_diff <= 5000:  # Within 5 seconds
                confidence += 2

        # Bonus for album match
        if source_track.album and candidate_track.album:
            album_ratio = fuzz.ratio(source_track.album.lower(), candidate_track.album.lower())
            if album_ratio > 80:
                confidence += 3

        # Penalty for compilation albums (prefer original releases)
        if candidate_track.album:
            album_lower = candidate_track.album.lower()
            compilation_keywords = [
                'hits', 'greatest', 'best of', 'collection', 'compilation',
                'anthology', 'essentials', 'ultimate', 'complete', 'now',
                'various artists', 'soundtrack', 'tribute', 'covers'
            ]

            if any(keyword in album_lower for keyword in compilation_keywords):
                confidence -= 8  # Significant penalty for compilation albums

            # Extra penalty for year-specific compilations like "2021 Hits"
            if re.search(r'\b(19|20)\d{2}\b.*hits', album_lower):
                confidence -= 5

        return min(confidence, 100.0)  # Cap at 100

    def _clean_track_name(self, name: str) -> str:
        """Clean track name for better matching"""
        if not name:
            return ""

        # Remove common suffixes and prefixes
        name = re.sub(r'\s*\([^)]*\)\s*', '', name)  # Remove parentheses content
        name = re.sub(r'\s*\[[^\]]*\]\s*', '', name)  # Remove brackets content

        # Remove common version indicators
        version_patterns = [
            r'\s*-\s*(remaster|remastered|remix|acoustic|live|radio edit|extended|instrumental).*$',
            r'\s*(remaster|remastered|remix|acoustic|live|radio edit|extended|instrumental).*$',
            r'\s*\d{4}\s*(remaster|remastered).*$'
        ]

        for pattern in version_patterns:
            name = re.sub(pattern, '', name, flags=re.IGNORECASE)

        # Clean up extra whitespace
        name = re.sub(r'\s+', ' ', name).strip()

        return name

    def _clean_artist_name(self, artist: str) -> str:
        """Clean artist name for better matching"""
        if not artist:
            return ""

        # Handle featured artists
        artist = re.sub(r'\s*(feat\.|featuring|ft\.|with)\s+.*$', '', artist, flags=re.IGNORECASE)

        # Remove "The" prefix for bands
        artist = re.sub(r'^The\s+', '', artist, flags=re.IGNORECASE)

        # Clean up extra whitespace
        artist = re.sub(r'\s+', ' ', artist).strip()

        return artist

    async def match_tracks_batch(self, source_tracks: List[Track], on_progress=None) -> List[MatchResult]:
        """Match multiple tracks with progress reporting"""
        results = []

        for i, track in enumerate(source_tracks):
            result = await self.match_track(track)
            results.append(result)

            if on_progress:
                progress = int((i + 1) / len(source_tracks) * 100)
                on_progress(progress, i + 1, len(source_tracks))

            # Small delay to avoid overwhelming the API
            await asyncio.sleep(0.1)

        return results