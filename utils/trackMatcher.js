class TrackMatcher {
  constructor(destinationService) {
    this.destinationService = destinationService;
  }

  async matchTrack(sourceTrack) {
    const matchResult = {
      sourceTrack,
      destinationTrack: null,
      matchMethod: null,
      confidence: 0
    };

    try {
      // Try ISRC matching first (most accurate)
      if (sourceTrack.isrc) {
        const isrcMatch = await this.matchByISRC(sourceTrack.isrc);
        if (isrcMatch) {
          matchResult.destinationTrack = isrcMatch;
          matchResult.matchMethod = 'isrc';
          matchResult.confidence = 100;
          return matchResult;
        }
      }

      const trackName = this.normalizeString(sourceTrack.name);
      const artistName = this.normalizeString(sourceTrack.artist);
      const albumName = this.normalizeString(sourceTrack.album);

      // Try artist + track name matching
      const artistTrackMatch = await this.matchByArtistAndTrack(trackName, artistName);
      if (artistTrackMatch) {
        matchResult.destinationTrack = artistTrackMatch;
        matchResult.matchMethod = 'artist_track';
        matchResult.confidence = 90;
        return matchResult;
      }

      // Try album + track name matching
      const albumTrackMatch = await this.matchByAlbumAndTrack(trackName, albumName, artistName);
      if (albumTrackMatch) {
        matchResult.destinationTrack = albumTrackMatch;
        matchResult.matchMethod = 'album_track';
        matchResult.confidence = 80;
        return matchResult;
      }

      // Try fuzzy matching as last resort
      const fuzzyMatch = await this.fuzzyMatch(trackName, artistName);
      if (fuzzyMatch) {
        matchResult.destinationTrack = fuzzyMatch;
        matchResult.matchMethod = 'fuzzy';
        matchResult.confidence = 70;
        return matchResult;
      }

    } catch (error) {
      console.error('Error matching track:', error);
    }

    return matchResult;
  }

  async matchByISRC(isrc) {
    try {
      const track = await this.destinationService.searchByISRC(isrc);
      return track;
    } catch (error) {
      console.error('ISRC search error:', error);
    }
    return null;
  }

  async matchByArtistAndTrack(trackName, artistName) {
    try {
      const searchQuery = `${trackName} ${artistName}`;
      const results = await this.destinationService.searchTracks(searchQuery, 10);
      
      if (results && results.length > 0) {
        for (const track of results) {
          const destTrackName = this.normalizeString(track.name);
          const destArtistName = this.normalizeString(track.artist);
          
          if (this.similarityScore(trackName, destTrackName) > 0.9 &&
              this.similarityScore(artistName, destArtistName) > 0.9) {
            return track;
          }
        }
      }
    } catch (error) {
      console.error('Artist/track search error:', error);
    }
    return null;
  }

  async matchByAlbumAndTrack(trackName, albumName, artistName) {
    try {
      const searchQuery = `${trackName} ${albumName}`;
      const results = await this.destinationService.searchTracks(searchQuery, 10);
      
      if (results && results.length > 0) {
        for (const track of results) {
          const destTrackName = this.normalizeString(track.name);
          const destAlbumName = this.normalizeString(track.album);
          const destArtistName = this.normalizeString(track.artist);
          
          if (this.similarityScore(trackName, destTrackName) > 0.9 &&
              this.similarityScore(albumName, destAlbumName) > 0.8 &&
              this.similarityScore(artistName, destArtistName) > 0.7) {
            return track;
          }
        }
      }
    } catch (error) {
      console.error('Album/track search error:', error);
    }
    return null;
  }

  async fuzzyMatch(trackName, artistName) {
    try {
      const searchQuery = trackName;
      const results = await this.destinationService.searchTracks(searchQuery, 20);
      
      if (results && results.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const track of results) {
          const destTrackName = this.normalizeString(track.name);
          const destArtistName = this.normalizeString(track.artist);
          
          const trackScore = this.similarityScore(trackName, destTrackName);
          const artistScore = this.similarityScore(artistName, destArtistName);
          const totalScore = (trackScore * 0.7) + (artistScore * 0.3);
          
          if (totalScore > bestScore && totalScore > 0.7) {
            bestScore = totalScore;
            bestMatch = track;
          }
        }
        
        return bestMatch;
      }
    } catch (error) {
      console.error('Fuzzy search error:', error);
    }
    return null;
  }

  normalizeString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  similarityScore(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = TrackMatcher;