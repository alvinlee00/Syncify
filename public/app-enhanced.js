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
        this.initializeAnimations();
    }

    initializeAnimations() {
        // Add page load animations
        document.querySelectorAll('.card').forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });

        // Add intersection observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.sync-step').forEach(step => {
            observer.observe(step);
        });
    }

    setupEventListeners() {
        // Service modal close
        const serviceModalClose = document.getElementById('service-modal-close');
        if (serviceModalClose) {
            serviceModalClose.addEventListener('click', () => {
                this.closeModal('service-modal');
            });
        }

        // Sync modal close
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal('sync-modal');
            });
        }

        // Service selectors
        const sourceService = document.getElementById('source-service');
        const destService = document.getElementById('dest-service');

        sourceService.addEventListener('change', (e) => {
            this.selectedSource = e.target.value;
            this.onServiceSelectionChange();
            this.animateServiceSelection(e.target);
        });

        destService.addEventListener('change', (e) => {
            this.selectedDestination = e.target.value;
            this.onServiceSelectionChange();
            this.animateServiceSelection(e.target);
        });

        // Start sync button
        const startSyncBtn = document.getElementById('start-sync');
        if (startSyncBtn) {
            startSyncBtn.addEventListener('click', () => {
                this.animateButton(startSyncBtn);
                this.startSync();
            });
        }

        // Modal backdrop clicks
        window.addEventListener('click', (event) => {
            const syncModal = document.getElementById('sync-modal');
            const serviceModal = document.getElementById('service-modal');
            
            if (event.target === syncModal) {
                this.closeModal('sync-modal');
            }
            if (event.target === serviceModal) {
                this.closeModal('service-modal');
            }
        });

        // Add keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = document.querySelectorAll('.modal:not(.hidden)');
                modals.forEach(modal => {
                    this.closeModal(modal.id);
                });
            }
        });
    }

    animateServiceSelection(element) {
        element.style.transform = 'scale(0.98)';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 150);
    }

    animateButton(button) {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 150);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.opacity = '1';
        }, 200);
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

    updateConnectedCount() {
        const countElement = document.getElementById('connected-count');
        const count = this.connectedServices.length;
        
        countElement.textContent = `${count} connected`;
        
        // Animate count change
        countElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            countElement.style.transform = 'scale(1)';
        }, 200);
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

        // Render connected services with staggered animation
        this.connectedServices.forEach((serviceType, index) => {
            const service = this.services[serviceType];
            const card = this.createServiceCard(service, true);
            
            // Add entrance animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            container.appendChild(card);
            
            setTimeout(() => {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });

        // Render available services
        Object.values(this.services).forEach((service, index) => {
            if (!service.connected) {
                const card = this.createAvailableServiceCard(service);
                
                // Add entrance animation
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                
                availableContainer.appendChild(card);
                
                setTimeout(() => {
                    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'scale(1)';
                }, index * 100);
            }
        });

        // Show/hide connect section with animation
        if (hasAvailableServices) {
            connectSection.style.display = 'block';
            setTimeout(() => {
                connectSection.classList.remove('hidden');
            }, 10);
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

        // Add hover animations
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });

        // Add event listeners
        const disconnectBtn = card.querySelector('.btn-disconnect');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.animateButton(disconnectBtn);
                this.disconnectService(service.type);
            });
        }

        const manageBtn = card.querySelector('.btn-manage');
        if (manageBtn) {
            manageBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.animateButton(manageBtn);
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
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.style.transform = 'scale(1)';
                this.connectService(service.type);
            }, 150);
        });

        return card;
    }

    updateServiceSelectors() {
        const sourceSelect = document.getElementById('source-service');
        const destSelect = document.getElementById('dest-service');

        // Clear existing options
        sourceSelect.innerHTML = '<option value="">Select source service...</option>';
        destSelect.innerHTML = '<option value="">Select destination service...</option>';

        // Enable/disable based on connected services
        const hasConnected = this.connectedServices.length > 0;
        sourceSelect.disabled = !hasConnected;
        destSelect.disabled = !hasConnected;

        // Add connected services as options
        this.connectedServices.forEach(serviceType => {
            const service = this.services[serviceType];
            
            const sourceOption = new Option(service.name, serviceType);
            const destOption = new Option(service.name, serviceType);
            
            sourceSelect.appendChild(sourceOption);
            destSelect.appendChild(destOption);
        });
    }

    updateSyncSectionVisibility() {
        const syncSection = document.getElementById('sync-section');
        
        if (this.connectedServices.length >= 2) {
            syncSection.style.display = 'block';
            setTimeout(() => {
                syncSection.classList.remove('hidden');
                syncSection.style.opacity = '0';
                syncSection.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    syncSection.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    syncSection.style.opacity = '1';
                    syncSection.style.transform = 'translateY(0)';
                }, 50);
            }, 10);
        } else {
            syncSection.style.opacity = '0';
            syncSection.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                syncSection.classList.add('hidden');
            }, 500);
        }
    }

    async connectService(serviceType) {
        if (serviceType === 'spotify') {
            window.location.href = '/auth/spotify';
        } else if (serviceType === 'apple') {
            await this.connectAppleMusic();
        }
    }

    // Apple Music methods
    async setupAppleMusic() {
        if (typeof MusicKit !== 'undefined') {
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
                    
                    console.log('Apple Music configured successfully');
                }
            } catch (error) {
                console.error('Error setting up Apple Music:', error);
            }
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
            console.error('Error connecting Apple Music:', error);
            alert('Failed to connect to Apple Music. Please try again.');
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
            
            if (!response.ok) {
                throw new Error('Failed to save Apple Music token');
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
                // Animate card removal
                const card = document.querySelector(`[data-service="${serviceType}"]`).closest('.service-card');
                if (card) {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    
                    setTimeout(async () => {
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
                    }, 300);
                }
            }
        } catch (error) {
            console.error('Error disconnecting service:', error);
        }
    }

    async openServiceModal(service) {
        const modal = document.getElementById('service-modal');
        const content = document.getElementById('service-modal-content');
        
        // Show modal with animation
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.opacity = '1';
        }, 10);
        
        content.innerHTML = `
            <h2>${service.name} Management</h2>
            <div class="loading">Loading...</div>
        `;
        
        // This could be expanded to show service-specific management options
        // For now, just show basic info
        setTimeout(() => {
            content.innerHTML = `
                <h2>${service.name} Management</h2>
                <div class="service-info">
                    <p><strong>Service:</strong> ${service.name}</p>
                    <p><strong>Status:</strong> ${service.connected ? 'Connected' : 'Disconnected'}</p>
                    ${service.user ? `<p><strong>User:</strong> ${service.user}</p>` : ''}
                    <p class="info-text">More management features coming soon!</p>
                </div>
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
                    
                    // Animate capabilities section
                    capabilitiesSection.style.display = 'block';
                    capabilitiesSection.style.opacity = '0';
                    capabilitiesSection.style.transform = 'translateY(-10px)';
                    
                    setTimeout(() => {
                        capabilitiesSection.classList.remove('hidden');
                        capabilitiesSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        capabilitiesSection.style.opacity = '1';
                        capabilitiesSection.style.transform = 'translateY(0)';
                    }, 10);
                    
                    // Load source playlists
                    await this.loadSourcePlaylists();
                    
                    // Animate playlist step
                    playlistStep.style.display = 'block';
                    playlistStep.style.opacity = '0';
                    playlistStep.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        playlistStep.classList.remove('hidden');
                        playlistStep.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        playlistStep.style.opacity = '1';
                        playlistStep.style.transform = 'translateY(0)';
                    }, 100);
                } else {
                    alert('Cannot sync between these services: ' + data.error);
                    this.hideSteps([capabilitiesSection, playlistStep, optionsStep]);
                }
            } catch (error) {
                console.error('Error validating sync:', error);
            }
        } else {
            this.hideSteps([capabilitiesSection, playlistStep, optionsStep]);
        }
    }

    hideSteps(elements) {
        elements.forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                element.classList.add('hidden');
            }, 300);
        });
    }

    showSyncCapabilities(capabilities) {
        const container = document.querySelector('.capability-info');
        
        container.innerHTML = '';
        
        const badges = [];
        
        if (capabilities.supportsISRC) {
            badges.push('<span class="capability-badge">ISRC Matching Supported</span>');
        }
        
        if (capabilities.maxTracks && capabilities.maxTracks !== Infinity) {
            badges.push(`<span class="capability-badge">Max ${capabilities.maxTracks} Tracks</span>`);
        }

        badges.push(`<span class="capability-badge">From: ${capabilities.sourceService.name}</span>`);
        badges.push(`<span class="capability-badge">To: ${capabilities.destinationService.name}</span>`);
        
        // Add badges with animation
        badges.forEach((badge, index) => {
            setTimeout(() => {
                container.innerHTML += badge;
                const addedBadge = container.lastElementChild;
                addedBadge.style.opacity = '0';
                addedBadge.style.transform = 'scale(0.8)';
                
                setTimeout(() => {
                    addedBadge.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    addedBadge.style.opacity = '1';
                    addedBadge.style.transform = 'scale(1)';
                }, 10);
            }, index * 50);
        });
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

        playlists.forEach((playlist, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.playlistId = playlist.id;
            
            // Add entrance animation
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            
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
            
            // Animate in
            setTimeout(() => {
                item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, index * 50);
        });
    }

    selectPlaylist(playlist, element) {
        // Remove previous selection with animation
        document.querySelectorAll('.playlist-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked item
        element.classList.add('selected');
        
        this.selectedPlaylist = playlist;
        
        // Show options step with animation
        const optionsStep = document.getElementById('step-options');
        optionsStep.style.display = 'block';
        optionsStep.style.opacity = '0';
        optionsStep.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            optionsStep.classList.remove('hidden');
            optionsStep.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            optionsStep.style.opacity = '1';
            optionsStep.style.transform = 'translateY(0)';
        }, 10);
        
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

        // Show modal with animation
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.style.opacity = '1';
        }, 10);

        // Reset modal state
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        syncResults.classList.add('hidden');

        // Update status
        statusSource.textContent = this.services[this.selectedSource].name;
        statusDestination.textContent = this.services[this.selectedDestination].name;
        statusProgress.textContent = 'Starting sync...';

        try {
            const response = await fetch('/api/sync/playlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sourceType: this.selectedSource,
                    destinationType: this.selectedDestination,
                    sourcePlaylistId: this.selectedPlaylist.id,
                    options: {
                        updateExisting: syncMode === 'update',
                        playlistName: customName || null
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Sync failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                let eventType = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log(`SSE Event: ${eventType}`, data);
                            
                            if (eventType === 'progress') {
                                this.handleSyncProgress(data, progressFill, progressText, statusProgress);
                            } else if (eventType === 'complete') {
                                this.showSyncCompleteResults(data, syncResults, resultsContent);
                            } else if (eventType === 'error') {
                                this.showSyncError(data, syncResults, resultsContent);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e, 'Line:', line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Sync error:', error);
            statusProgress.textContent = 'Sync failed';
            resultsContent.innerHTML = `<p class="error">Sync failed: ${error.message}</p>`;
            syncResults.classList.remove('hidden');
        }
    }

    handleSyncProgress(data, progressFill, progressText, statusProgress) {
        if (data.progress !== undefined) {
            const percentage = Math.round(data.progress);
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${percentage}%`;
        }

        if (data.message) {
            statusProgress.textContent = data.message;
        }
    }

    showSyncCompleteResults(data, syncResults, resultsContent) {
        const result = data.result;
        let html = '';
        
        if (result.syncMode === 'update') {
            // Update mode - show what was added
            html = `
                <div class="result-item">
                    <strong>Playlist updated successfully!</strong>
                </div>
                <div class="result-item">
                    <strong>Playlist Name:</strong> ${result.playlistName}
                </div>
                <div class="result-item">
                    <strong>Mode:</strong> Update (added new tracks only)
                </div>
                <div class="result-item">
                    <strong>New tracks added:</strong> ${result.matchedTracks}
                </div>
                <div class="result-item">
                    <strong>Duration:</strong> ${(result.duration / 1000).toFixed(1)} seconds
                </div>
            `;
        } else {
            // Create mode - show full sync results
            const successRate = result.totalTracks > 0 ? 
                Math.round((result.matchedTracks / result.totalTracks) * 100) : 0;
            
            html = `
                <div class="result-item">
                    <strong>Playlist created successfully!</strong>
                </div>
                <div class="result-item">
                    <strong>Playlist Name:</strong> ${result.playlistName}
                </div>
                <div class="result-item">
                    <strong>Tracks Synced:</strong> ${result.matchedTracks} / ${result.totalTracks} (${successRate}%)
                </div>
                <div class="result-item">
                    <strong>Duration:</strong> ${(result.duration / 1000).toFixed(1)} seconds
                </div>
            `;
        }
        
        // Add unmatched tracks if any
        if (result.unmatchedTracks && result.unmatchedTracks.length > 0) {
            html += `
                <div class="unmatched-tracks">
                    <h4>Unmatched Tracks (${result.unmatchedTracks.length}):</h4>
                    ${result.unmatchedTracks.map(track => `
                        <div class="unmatched-track">${track.artist || 'Unknown'} - ${track.name || 'Unknown'}</div>
                    `).join('')}
                </div>
            `;
        }
        
        resultsContent.innerHTML = html;
        this.showResults(syncResults);
    }
    
    showSyncError(data, syncResults, resultsContent) {
        resultsContent.innerHTML = `
            <div class="result-item error">
                <strong>Sync failed:</strong> ${data.error || 'Unknown error'}
            </div>
        `;
        this.showResults(syncResults);
    }
    
    showResults(syncResults) {

        // Animate results
        syncResults.style.opacity = '0';
        syncResults.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            syncResults.classList.remove('hidden');
            syncResults.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            syncResults.style.opacity = '1';
            syncResults.style.transform = 'translateY(0)';
        }, 10);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SyncifyApp();
});

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        animation: fadeInUp 0.5s ease forwards;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .service-info {
        padding: var(--space-4);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-md);
        margin-top: var(--space-4);
    }

    .service-info p {
        margin-bottom: var(--space-2);
    }

    .service-info p:last-child {
        margin-bottom: 0;
    }

    .info-text {
        color: var(--color-text-secondary);
        font-style: italic;
        margin-top: var(--space-4) !important;
    }

    .error {
        color: var(--color-error);
    }

    .service-connect-text {
        color: var(--color-text-secondary);
        font-size: var(--font-size-sm);
        margin-top: var(--space-2);
    }
`;
document.head.appendChild(style);