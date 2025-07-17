/**
 * Rate limiter utility for API requests
 */
class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow; // in milliseconds
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    
    // Remove requests older than the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    // If we've reached the limit, wait until we can make another request
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest) + 100; // Add 100ms buffer
      
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Record this request
    this.requests.push(Date.now());
  }
}

// Apple Music rate limiter
// Apple Music allows approximately 900 requests per hour
// We'll limit to 10 requests per 1 second for maximum performance
const appleMusicRateLimiter = new RateLimiter(10, 1000);

// Spotify rate limiter
// Spotify is more lenient, but we'll still add some throttling
const spotifyRateLimiter = new RateLimiter(30, 1000);

module.exports = {
  RateLimiter,
  appleMusicRateLimiter,
  spotifyRateLimiter
};