class SyncifyApp {
    constructor() {
        this.services = {};
        this.connectedServices = [];
        this.selectedSource = null;
        this.selectedDestination = null;
        this.selectedPlaylist = null;
        this.developerToken = null;
        this.init();
    }

    async init() {
        await this.loadServices();
        this.setupEventListeners();
        this.setupAppleMusic();
        this.updateUI();
    }

    setupEventListeners() {
        // Service modal close
        const serviceModalClose = document.getElementById('service-modal-close');
        if (serviceModalClose) {
            serviceModalClose.addEventListener('click', () => {
                document.getElementById('service-modal').classList.add('hidden');
            });
        }

        // Sync modal close
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                document.getElementById('sync-modal').classList.add('hidden');
            });
        }

        // Service selectors
        const sourceService = document.getElementById('source-service');
        const destService = document.getElementById('dest-service');

        sourceService.addEventListener('change', (e) => {
            this.selectedSource = e.target.value;
            this.onServiceSelectionChange();
        });

        destService.addEventListener('change', (e) => {
            this.selectedDestination = e.target.value;
            this.onServiceSelectionChange();
        });

        // Start sync button
        const startSyncBtn = document.getElementById('start-sync');
        if (startSyncBtn) {
            startSyncBtn.addEventListener('click', () => {
                this.startSync();
            });
        }

        // Modal backdrop clicks
        window.addEventListener('click', (event) => {
            const syncModal = document.getElementById('sync-modal');
            const serviceModal = document.getElementById('service-modal');
            
            if (event.target === syncModal) {
                syncModal.classList.add('hidden');
            }
            if (event.target === serviceModal) {
                serviceModal.classList.add('hidden');
            }
        });
    }

    async loadServices() {
        try {
            const response = await fetch('/api/services');
            const data = await response.json();
            
            this.services = {};
            this.connectedServices = [];
            
            data.services.forEach(service => {
                this.services[service.type] = service;
                if (service.connected) {
                    this.connectedServices.push(service.type);
                }
            });

            console.log('Loaded services:', this.services);
            console.log('Connected services:', this.connectedServices);
        } catch (error) {
            console.error('Error loading services:', error);
        }
    }

    updateUI() {
        this.renderServiceCards();
        this.updateConnectedCount();
        this.updateServiceSelectors();
        this.updateSyncSectionVisibility();
    }

    renderServiceCards() {
        const container = document.getElementById('services-grid');
        const connectSection = document.getElementById('connect-services');
        const availableContainer = document.getElementById('available-services');

        container.innerHTML = '';
        availableContainer.innerHTML = '';

        const hasConnectedServices = this.connectedServices.length > 0;
        const hasAvailableServices = Object.keys(this.services).some(type => !this.services[type].connected);

        if (!hasConnectedServices) {
            container.innerHTML = '<div class="loading">No services connected yet. Connect your first service below.</div>';
        }

        // Render connected services
        this.connectedServices.forEach(serviceType => {
            const service = this.services[serviceType];
            const card = this.createServiceCard(service, true);
            container.appendChild(card);
        });

        // Render available services
        Object.values(this.services).forEach(service => {
            if (!service.connected) {
                const card = this.createAvailableServiceCard(service);
                availableContainer.appendChild(card);
            }
        });

        // Show/hide connect section
        if (hasAvailableServices) {
            connectSection.classList.remove('hidden');
        } else {
            connectSection.classList.add('hidden');
        }
    }

    createServiceCard(service, isConnected) {
        const card = document.createElement('div');
        card.className = `service-card card ${isConnected ? 'connected' : 'disconnected'}`;
        
        const iconClass = service.type === 'spotify' ? 'spotify' : 'apple';
        const statusClass = isConnected ? 'connected' : 'disconnected';
        const statusText = isConnected ? '✓ Connected' : '○ Disconnected';

        card.innerHTML = `
            <div class="service-header">
                <div class="service-icon ${iconClass}">${service.type === 'spotify' ? 'S' : '🎵'}</div>
                <div class="service-status ${statusClass}">${statusText}</div>
            </div>
            <div class="service-name">${service.name}</div>
            ${service.user ? `<div class="service-user">Connected as: ${service.user}</div>` : ''}
            <div class="service-capabilities">
                ${service.capabilities?.supportsISRC ? '<span class="capability-badge">ISRC Matching</span>' : ''}
                ${service.capabilities?.canCreatePlaylists ? '<span class="capability-badge">Create Playlists</span>' : ''}
                ${service.capabilities?.maxPlaylistTracks ? `<span class="capability-badge">${service.capabilities.maxPlaylistTracks} Track Limit</span>` : ''}
            </div>
            <div class="service-actions">
                ${isConnected ? `<button class="btn btn-disconnect" data-service="${service.type}">Disconnect</button>` : ''}
                <button class="btn btn-manage" data-service="${service.type}">Manage</button>
            </div>
        `;

        // Add event listeners
        const disconnectBtn = card.querySelector('.btn-disconnect');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnectService(service.type);
            });
        }

        const manageBtn = card.querySelector('.btn-manage');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                this.openServiceModal(service);
            });
        }

        return card;
    }

    createAvailableServiceCard(service) {
        const card = document.createElement('div');
        card.className = 'available-service';
        
        const iconClass = service.type === 'spotify' ? 'spotify' : 'apple';
        
        card.innerHTML = `
            <div class="service-icon ${iconClass}">${service.type === 'spotify' ? 'S' : '🎵'}</div>
            <div class="service-name">${service.name}</div>
            <div class="service-connect-text">Click to connect</div>
        `;

        card.addEventListener('click', () => {
            this.connectService(service.type);
        });

        return card;
    }

    updateConnectedCount() {
        const countElement = document.getElementById('connected-count');
        const count = this.connectedServices.length;
        countElement.textContent = `${count} connected`;
    }

    updateServiceSelectors() {
        const sourceSelect = document.getElementById('source-service');
        const destSelect = document.getElementById('dest-service');

        // Clear options
        sourceSelect.innerHTML = '<option value="">Select source service...</option>';
        destSelect.innerHTML = '<option value="">Select destination service...</option>';

        // Add connected services
        this.connectedServices.forEach(serviceType => {
            const service = this.services[serviceType];
            const option = new Option(service.name, serviceType);
            sourceSelect.appendChild(option.cloneNode(true));
            destSelect.appendChild(option);
        });

        // Enable/disable selectors
        const hasServices = this.connectedServices.length > 0;
        sourceSelect.disabled = !hasServices;
        destSelect.disabled = !hasServices;
    }

    updateSyncSectionVisibility() {
        const syncSection = document.getElementById('sync-section');
        const hasServices = this.connectedServices.length >= 2;
        
        if (hasServices) {
            syncSection.classList.remove('hidden');
        } else {
            syncSection.classList.add('hidden');
        }
    }

    async connectService(serviceType) {
        if (serviceType === 'spotify') {
            window.location.href = '/auth/spotify';
        } else if (serviceType === 'apple') {
            await this.connectAppleMusic();
        }
    }

    async connectAppleMusic() {
        try {
            if (!this.developerToken) {
                await this.setupAppleMusic();
            }

            const music = MusicKit.getInstance();
            const userToken = await music.authorize();
            
            if (userToken) {
                await this.saveAppleMusicToken(userToken);
                await this.loadServices();
                this.updateUI();
            }
        } catch (error) {
            console.error('Apple Music connection error:', error);
            alert('Failed to connect to Apple Music. Please try again.');
        }
    }

    async setupAppleMusic() {
        try {
            const response = await fetch('/auth/apple/developer-token');
            const data = await response.json();
            
            if (data.developerToken) {
                this.developerToken = data.developerToken;
                
                await MusicKit.configure({
                    developerToken: this.developerToken,
                    app: {
                        name: 'Syncify',
                        build: '1.0.0'
                    }
                });
            }
        } catch (error) {
            console.error('Error setting up Apple Music:', error);
        }
    }

    async saveAppleMusicToken(userToken) {
        try {
            const response = await fetch('/auth/apple/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userToken })
            });

            if (response.ok) {
                await this.loadServices();
                this.updateUI();
            }
        } catch (error) {
            console.error('Error saving Apple Music token:', error);
        }
    }

    async disconnectService(serviceType) {
        try {
            const response = await fetch(`/api/services/${serviceType}/disconnect`, {
                method: 'POST'
            });

            if (response.ok) {
                await this.loadServices();
                this.updateUI();
                
                // Reset selections if disconnected service was selected
                if (this.selectedSource === serviceType) {
                    this.selectedSource = null;
                    document.getElementById('source-service').value = '';
                }
                if (this.selectedDestination === serviceType) {
                    this.selectedDestination = null;
                    document.getElementById('dest-service').value = '';
                }
                
                this.onServiceSelectionChange();
            }
        } catch (error) {
            console.error('Error disconnecting service:', error);
        }
    }

    async openServiceModal(service) {
        const modal = document.getElementById('service-modal');
        const content = document.getElementById('service-modal-content');
        
        content.innerHTML = `
            <h2>${service.name} Management</h2>
            <div class="loading">Loading...</div>
        `;
        
        modal.classList.remove('hidden');
        
        // This could be expanded to show service-specific management options
        // For now, just show basic info
        setTimeout(() => {
            content.innerHTML = `
                <h2>${service.name} Management</h2>
                <p>Service: ${service.name}</p>
                <p>Status: ${service.connected ? 'Connected' : 'Disconnected'}</p>
                ${service.user ? `<p>User: ${service.user}</p>` : ''}
                <p>This feature will be expanded in future updates.</p>
            `;
        }, 500);
    }

    async onServiceSelectionChange() {
        const capabilitiesSection = document.getElementById('sync-capabilities');
        const playlistStep = document.getElementById('step-playlists');
        const optionsStep = document.getElementById('step-options');

        if (this.selectedSource && this.selectedDestination) {
            // Validate sync combination
            try {
                const response = await fetch('/api/services/validate-sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sourceType: this.selectedSource,
                        destinationType: this.selectedDestination
                    })
                });

                const data = await response.json();
                
                if (data.valid) {
                    this.showSyncCapabilities(data.capabilities);
                    capabilitiesSection.classList.remove('hidden');
                    
                    // Load source playlists
                    await this.loadSourcePlaylists();
                    playlistStep.classList.remove('hidden');
                } else {
                    alert('Cannot sync between these services: ' + data.error);
                    capabilitiesSection.classList.add('hidden');
                    playlistStep.classList.add('hidden');
                    optionsStep.classList.add('hidden');
                }
            } catch (error) {
                console.error('Error validating sync:', error);
            }
        } else {
            capabilitiesSection.classList.add('hidden');
            playlistStep.classList.add('hidden');
            optionsStep.classList.add('hidden');
        }
    }

    showSyncCapabilities(capabilities) {
        const container = document.querySelector('.capability-info');
        
        container.innerHTML = '';
        
        if (capabilities.supportsISRC) {
            container.innerHTML += '<span class="capability-badge">🎵 ISRC Matching Supported</span>';
        }
        
        if (capabilities.maxTracks && capabilities.maxTracks !== Infinity) {
            container.innerHTML += `<span class="capability-badge">📊 Max ${capabilities.maxTracks} Tracks</span>`;
        }

        container.innerHTML += `<span class="capability-badge">📤 From: ${capabilities.sourceService.name}</span>`;
        container.innerHTML += `<span class="capability-badge">📥 To: ${capabilities.destinationService.name}</span>`;
    }

    async loadSourcePlaylists() {
        const container = document.getElementById('source-playlists');
        container.innerHTML = '<div class="loading">Loading playlists...</div>';

        try {
            const response = await fetch(`/api/services/${this.selectedSource}/playlists`);
            const data = await response.json();

            this.renderPlaylists(data.playlists);
        } catch (error) {
            console.error('Error loading playlists:', error);
            container.innerHTML = '<div class="error">Failed to load playlists</div>';
        }
    }

    renderPlaylists(playlists) {
        const container = document.getElementById('source-playlists');
        container.innerHTML = '';

        playlists.forEach(playlist => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.playlistId = playlist.id;
            
            item.innerHTML = `
                <img src="${playlist.image || '/placeholder.png'}" alt="${playlist.name}" class="playlist-thumbnail">
                <div class="playlist-details">
                    <div class="playlist-title">${playlist.name}</div>
                    <div class="playlist-meta">${playlist.trackCount} tracks • by ${playlist.owner}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                this.selectPlaylist(playlist, item);
            });

            container.appendChild(item);
        });
    }

    selectPlaylist(playlist, element) {
        // Remove previous selection
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked item
        element.classList.add('selected');
        
        this.selectedPlaylist = playlist;
        
        // Show options step
        document.getElementById('step-options').classList.remove('hidden');
        
        // Enable start sync button
        document.getElementById('start-sync').disabled = false;
    }

    async startSync() {
        if (!this.selectedSource || !this.selectedDestination || !this.selectedPlaylist) {
            alert('Please select source service, destination service, and a playlist');
            return;
        }

        const modal = document.getElementById('sync-modal');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const syncResults = document.getElementById('sync-results');
        const resultsContent = document.getElementById('results-content');
        const statusSource = document.getElementById('status-source');
        const statusDestination = document.getElementById('status-destination');
        const statusProgress = document.getElementById('status-progress');

        // Get sync options
        const syncMode = document.querySelector('input[name="sync-mode"]:checked').value;
        const customName = document.getElementById('custom-name').value;

        // Reset modal state
        modal.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        syncResults.classList.add('hidden');

        // Update status
        statusSource.textContent = this.services[this.selectedSource].name;
        statusDestination.textContent = this.services[this.selectedDestination].name;
        statusProgress.textContent = 'Starting...';

        try {
            const requestBody = {
                sourceType: this.selectedSource,
                destinationType: this.selectedDestination,
                sourcePlaylistId: this.selectedPlaylist.id,
                options: {
                    updateExisting: syncMode === 'update',
                    playlistName: customName || undefined
                }
            };

            const response = await fetch('/api/sync/playlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            this.handleSyncEvent(data, {
                                progressFill, progressText, statusProgress,
                                syncResults, resultsContent
                            });
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Sync error:', error);
            alert('Failed to sync playlist');
        }
    }

    handleSyncEvent(eventData, elements) {
        const { progressFill, progressText, statusProgress, syncResults, resultsContent } = elements;

        if (eventData.progress !== undefined) {
            progressFill.style.width = `${eventData.progress}%`;
            progressText.textContent = `${eventData.progress}%`;
            statusProgress.textContent = `${eventData.current}/${eventData.total} tracks processed`;
        }

        if (eventData.success !== undefined) {
            if (eventData.success) {
                this.displaySyncResults(eventData.result, resultsContent);
                syncResults.classList.remove('hidden');
                statusProgress.textContent = 'Completed successfully';
            } else {
                alert('Sync failed: ' + (eventData.error || 'Unknown error'));
                statusProgress.textContent = 'Failed';
            }
        }

        if (eventData.error) {
            alert(`Sync error: ${eventData.error}`);
            statusProgress.textContent = 'Error occurred';
        }
    }

    displaySyncResults(result, container) {
        const successRate = ((result.matchedTracks / result.totalTracks) * 100).toFixed(1);
        
        let html = `
            <div class="result-item"><strong>Playlist:</strong> ${result.sourcePlaylist?.name || 'Unknown'}</div>
            <div class="result-item"><strong>Source:</strong> ${result.sourceService}</div>
            <div class="result-item"><strong>Destination:</strong> ${result.destinationService}</div>
            <div class="result-item"><strong>Total tracks:</strong> ${result.totalTracks}</div>
            <div class="result-item"><strong>Successfully matched:</strong> ${result.matchedTracks} (${successRate}%)</div>
            <div class="result-item"><strong>Sync mode:</strong> ${result.syncMode}</div>
            <div class="result-item"><strong>Duration:</strong> ${(result.duration / 1000).toFixed(1)} seconds</div>
        `;

        if (result.unmatchedTracks.length > 0) {
            html += `
                <div class="unmatched-tracks">
                    <h4>Unmatched tracks (${result.unmatchedTracks.length}):</h4>
                    ${result.unmatchedTracks.map(track => `
                        <div class="unmatched-track">
                            ${track.name} - ${track.artist}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SyncifyApp();
});