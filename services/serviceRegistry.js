const SpotifyAdapter = require('./adapters/SpotifyAdapter');
const AppleMusicAdapter = require('./adapters/AppleMusicAdapter');

/**
 * Service Registry manages all music streaming service adapters
 * Provides a centralized way to access and manage service instances
 */
class ServiceRegistry {
  constructor() {
    this.serviceTypes = {
      spotify: {
        name: 'Spotify',
        adapter: SpotifyAdapter,
        icon: '🎵',
        color: '#1db954',
        requiresCredentials: ['accessToken']
      },
      apple: {
        name: 'Apple Music',
        adapter: AppleMusicAdapter,
        icon: '🍎',
        color: '#fc3c44',
        requiresCredentials: ['userToken']
      }
      // Future services can be added here:
      // youtube: { name: 'YouTube Music', adapter: YouTubeAdapter, ... },
      // tidal: { name: 'Tidal', adapter: TidalAdapter, ... },
    };
  }

  /**
   * Get all available service types
   * @returns {Object} Object with service type definitions
   */
  getAvailableServices() {
    return Object.keys(this.serviceTypes).map(type => ({
      type,
      name: this.serviceTypes[type].name,
      icon: this.serviceTypes[type].icon,
      color: this.serviceTypes[type].color,
      requiresCredentials: this.serviceTypes[type].requiresCredentials
    }));
  }

  /**
   * Create a service instance for a given type
   * @param {string} serviceType - The type of service (spotify, apple, etc.)
   * @param {Object} credentials - Service-specific credentials
   * @returns {BaseService} Service instance
   */
  createService(serviceType, credentials) {
    const serviceConfig = this.serviceTypes[serviceType];
    
    if (!serviceConfig) {
      throw new Error(`Unknown service type: ${serviceType}`);
    }

    const ServiceAdapter = serviceConfig.adapter;
    
    // Validate required credentials
    const missingCredentials = serviceConfig.requiresCredentials.filter(
      cred => !credentials[cred]
    );
    
    if (missingCredentials.length > 0) {
      throw new Error(
        `Missing required credentials for ${serviceType}: ${missingCredentials.join(', ')}`
      );
    }

    // Create service instance with appropriate credentials
    switch (serviceType) {
      case 'spotify':
        return new ServiceAdapter(credentials.accessToken);
      case 'apple':
        return new ServiceAdapter(credentials.userToken);
      default:
        throw new Error(`No adapter implementation for service type: ${serviceType}`);
    }
  }

  /**
   * Get connected services from session data
   * @param {Object} session - Express session object
   * @returns {Object} Object with connected service instances
   */
  getConnectedServices(session) {
    const connectedServices = {};

    // Check Spotify connection
    if (session.spotifyTokens?.accessToken) {
      try {
        connectedServices.spotify = this.createService('spotify', {
          accessToken: session.spotifyTokens.accessToken
        });
      } catch (error) {
        console.error('Error creating Spotify service:', error);
      }
    }

    // Check Apple Music connection
    if (session.appleUserToken) {
      try {
        connectedServices.apple = this.createService('apple', {
          userToken: session.appleUserToken
        });
      } catch (error) {
        console.error('Error creating Apple Music service:', error);
      }
    }

    return connectedServices;
  }

  /**
   * Get connection status for all services
   * @param {Object} session - Express session object
   * @returns {Object} Connection status for each service
   */
  getConnectionStatus(session) {
    const status = {};

    Object.keys(this.serviceTypes).forEach(serviceType => {
      status[serviceType] = this.isServiceConnected(session, serviceType);
    });

    return status;
  }

  /**
   * Check if a specific service is connected
   * @param {Object} session - Express session object
   * @param {string} serviceType - The service type to check
   * @returns {boolean} True if service is connected
   */
  isServiceConnected(session, serviceType) {
    switch (serviceType) {
      case 'spotify':
        return !!(session.spotifyTokens?.accessToken);
      case 'apple':
        return !!(session.appleUserToken);
      default:
        return false;
    }
  }

  /**
   * Get user information for connected services
   * @param {Object} session - Express session object
   * @returns {Object} User info for each connected service
   */
  getConnectedServiceUsers(session) {
    const users = {};

    if (session.spotifyUser && this.isServiceConnected(session, 'spotify')) {
      users.spotify = {
        id: session.spotifyUser.id,
        name: session.spotifyUser.displayName,
        email: session.spotifyUser.email,
        serviceName: 'spotify'
      };
    }

    if (session.appleAuth && this.isServiceConnected(session, 'apple')) {
      users.apple = {
        id: session.appleAuth.sub,
        name: session.appleAuth.firstName && session.appleAuth.lastName 
          ? `${session.appleAuth.firstName} ${session.appleAuth.lastName}`
          : 'Apple Music User',
        email: session.appleAuth.isPrivateEmail ? 'Private Email' : session.appleAuth.email,
        serviceName: 'apple'
      };
    }

    return users;
  }

  /**
   * Validate that required services are connected for a sync operation
   * @param {Object} session - Express session object
   * @param {string} sourceType - Source service type
   * @param {string} destinationType - Destination service type
   * @returns {Object} Validation result with success flag and message
   */
  validateSyncRequirements(session, sourceType, destinationType) {
    const sourceConnected = this.isServiceConnected(session, sourceType);
    const destConnected = this.isServiceConnected(session, destinationType);

    if (!sourceConnected && !destConnected) {
      return {
        success: false,
        message: `Both ${this.serviceTypes[sourceType]?.name} and ${this.serviceTypes[destinationType]?.name} must be connected`
      };
    }

    if (!sourceConnected) {
      return {
        success: false,
        message: `${this.serviceTypes[sourceType]?.name} must be connected to read playlists`
      };
    }

    if (!destConnected) {
      return {
        success: false,
        message: `${this.serviceTypes[destinationType]?.name} must be connected to create playlists`
      };
    }

    if (sourceType === destinationType) {
      return {
        success: false,
        message: 'Source and destination services must be different'
      };
    }

    return { success: true };
  }

  /**
   * Get service capabilities for UI display
   * @param {string} serviceType - The service type
   * @returns {Object} Service capabilities
   */
  getServiceCapabilities(serviceType) {
    const serviceConfig = this.serviceTypes[serviceType];
    if (!serviceConfig) return null;

    // Create a temporary instance to get capabilities (without credentials for metadata)
    try {
      const tempInstance = new serviceConfig.adapter(null);
      return tempInstance.getCapabilities();
    } catch (error) {
      // Return default capabilities if we can't create instance
      return {
        canRead: true,
        canWrite: true,
        canSearch: true,
        canCreatePlaylists: true,
        supportsISRC: false
      };
    }
  }

  /**
   * Disconnect a service from the session
   * @param {Object} session - Express session object
   * @param {string} serviceType - The service type to disconnect
   */
  disconnectService(session, serviceType) {
    switch (serviceType) {
      case 'spotify':
        delete session.spotifyTokens;
        delete session.spotifyUser;
        break;
      case 'apple':
        delete session.appleUserToken;
        delete session.appleAuth;
        break;
    }
  }
}

// Export singleton instance
module.exports = new ServiceRegistry();