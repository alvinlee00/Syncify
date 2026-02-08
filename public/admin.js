/**
 * Syncify Admin Panel
 * Manages token display, playlist viewing, and GitHub Actions setup
 */

class AdminPanel {
    constructor() {
        this.tokens = null;
        this.playlists = null;
        this.init();
    }

    async init() {
        try {
            await this.loadTokens();
            await this.loadPlaylists();
        } catch (error) {
            this.showError(error.message);
        }
    }

    async loadTokens() {
        try {
            const response = await fetch('/admin/tokens');
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to load tokens');
            }

            this.tokens = await response.json();
            this.renderConnectionStatus();
            this.renderGitHubSecrets();
            this.renderGHCommands();
        } catch (error) {
            throw new Error(`Failed to load tokens: ${error.message}`);
        }
    }

    async loadPlaylists() {
        try {
            const response = await fetch('/admin/playlists');
            if (!response.ok) {
                throw new Error('Failed to load playlists');
            }

            this.playlists = await response.json();
            this.renderPlaylists();
        } catch (error) {
            console.error('Error loading playlists:', error);
            document.getElementById('playlists').innerHTML = `
                <div class="error">Failed to load playlists: ${error.message}</div>
            `;
        }
    }

    renderConnectionStatus() {
        const container = document.getElementById('connection-status');
        const { connected } = this.tokens;

        container.innerHTML = `
            <div style="display: flex; gap: 1rem;">
                <div>
                    <strong>Spotify:</strong>
                    <span class="status-badge ${connected.spotify ? 'status-connected' : 'status-disconnected'}">
                        ${connected.spotify ? '✓ Connected' : '✗ Not Connected'}
                    </span>
                </div>
                <div>
                    <strong>Apple Music:</strong>
                    <span class="status-badge ${connected.apple ? 'status-connected' : 'status-disconnected'}">
                        ${connected.apple ? '✓ Connected' : '✗ Not Connected'}
                    </span>
                </div>
            </div>
            ${!connected.spotify || !connected.apple ? `
                <p style="margin-top: 1rem; color: var(--text-secondary);">
                    Connect missing services on the <a href="/" style="color: var(--accent-color);">main page</a> first.
                </p>
            ` : ''}
        `;
    }

    renderGitHubSecrets() {
        const container = document.getElementById('github-secrets');
        const { github_secrets } = this.tokens;

        if (!github_secrets || github_secrets.length === 0) {
            container.innerHTML = '<div class="error">No tokens available. Please connect services first.</div>';
            return;
        }

        container.innerHTML = github_secrets.map(secret => `
            <div class="token-item">
                <div class="token-header">
                    <div class="token-name">${secret.name}</div>
                    <button class="copy-btn" onclick="adminPanel.copyToClipboard('${this.escapeHtml(secret.value)}', this)">
                        Copy
                    </button>
                </div>
                <div class="token-description">${secret.description}</div>
                <div class="token-value masked" onclick="this.classList.toggle('masked')" title="Click to reveal">
                    ${secret.value || '(empty)'}
                </div>
            </div>
        `).join('');
    }

    renderGHCommands() {
        const container = document.getElementById('gh-commands');
        const { github_secrets } = this.tokens;

        if (!github_secrets || github_secrets.length === 0) {
            container.innerHTML = '<div class="error">No secrets available.</div>';
            return;
        }

        // Generate gh secret set commands
        const commands = github_secrets
            .filter(secret => secret.value) // Only include secrets with values
            .map(secret => {
                // Escape single quotes in value for bash
                const escapedValue = secret.value.replace(/'/g, "'\\''");
                return `gh secret set ${secret.name} -b '${escapedValue}'`;
            })
            .join('\n');

        container.innerHTML = `
            <div class="info-box" style="margin-bottom: 1rem;">
                <strong>Prerequisites:</strong> Install GitHub CLI: <code>brew install gh</code> (Mac) or see
                <a href="https://cli.github.com/" target="_blank" style="color: var(--accent-color);">cli.github.com</a>
            </div>
            <div class="command-block">
                <pre>${commands}</pre>
            </div>
            <button class="copy-all-btn" onclick="adminPanel.copyToClipboard(\`${this.escapeForTemplate(commands)}\`, this)">
                📋 Copy All Commands
            </button>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                Run these commands in your repository directory. The GitHub CLI will prompt you to authenticate if needed.
            </p>
        `;
    }

    renderPlaylists() {
        const container = document.getElementById('playlists');
        const { spotify, apple } = this.playlists;

        if (!spotify.length && !apple.length) {
            container.innerHTML = '<div class="error">No playlists found. Please connect services first.</div>';
            return;
        }

        let html = '';

        if (spotify.length > 0) {
            html += `
                <h3 style="margin-bottom: 1rem;">Spotify Playlists</h3>
                <div class="playlist-grid">
                    ${spotify.map(playlist => `
                        <div class="playlist-card">
                            <div class="playlist-name">${this.escapeHtml(playlist.name)}</div>
                            <div class="playlist-info">
                                ${playlist.track_count} tracks · by ${this.escapeHtml(playlist.owner || 'Unknown')}
                            </div>
                            <div class="playlist-id">
                                ID: ${playlist.id}
                                <button class="copy-btn" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                                        onclick="adminPanel.copyToClipboard('${playlist.id}', this)">
                                    Copy ID
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (apple.length > 0) {
            html += `
                <h3 style="margin: 2rem 0 1rem;">Apple Music Playlists</h3>
                <div class="playlist-grid">
                    ${apple.map(playlist => `
                        <div class="playlist-card">
                            <div class="playlist-name">${this.escapeHtml(playlist.name)}</div>
                            <div class="playlist-info">${playlist.track_count} tracks</div>
                            <div class="playlist-id">
                                ID: ${playlist.id}
                                <button class="copy-btn" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                                        onclick="adminPanel.copyToClipboard('${playlist.id}', this)">
                                    Copy ID
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);

            // Visual feedback
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            button.classList.add('copied');

            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
            alert('Failed to copy to clipboard. Please copy manually.');
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Also show in connection status
        document.getElementById('connection-status').innerHTML = `
            <div class="error">${message}</div>
            <p style="margin-top: 1rem;">
                Please <a href="/" style="color: var(--accent-color);">go back to the main page</a> and connect your services.
            </p>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeForTemplate(text) {
        return text.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    }
}

// Initialize admin panel when page loads
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});
