/**
 * SomeSonic - Subsonic Music Player
 * Main application entry point
 */

import { SubsonicClient } from './subsonic.js';
import { AudioPlayer } from './player.js';
import { AudioVisualizer } from './visualizer.js';

// Application state
const state = {
    client: null,
    player: null,
    visualizer: null,
    library: {
        artists: [],
        albums: [],
        currentAlbum: null
    },
    playlist: [],
    currentTrack: null,
    expandedNodes: new Set(),
    settings: {
        serverUrl: '',
        username: '',
        password: ''
    }
};

// DOM Elements
const elements = {};

/**
 * Initialize application
 */
async function init() {
    // Cache DOM elements
    cacheElements();
    
    // Initialize Subsonic client
    state.client = new SubsonicClient();
    
    // Initialize audio player
    const audioElement = document.getElementById('audio-player');
    state.player = new AudioPlayer(audioElement);
    setupPlayerCallbacks();
    
    // Initialize visualizer
    const waveformCanvas = document.getElementById('waveformCanvas');
    const spectrogramCanvas = document.getElementById('spectroCanvas');
    state.visualizer = new AudioVisualizer(waveformCanvas, spectrogramCanvas);
    state.visualizer.init();
    state.visualizer.start();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load saved settings
    loadSettings();
    
    // Check if we have credentials and try to connect
    if (state.settings.serverUrl && state.settings.username && state.settings.password) {
        await connectToServer();
    } else {
        showSettingsModal();
    }
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
    elements.libraryTree = document.getElementById('library-tree');
    elements.playlistBody = document.getElementById('playlist-body');
    elements.sidebarCover = document.getElementById('sidebar-cover');
    elements.coverPlaceholder = document.getElementById('cover-placeholder');
    elements.coverOverlayText = document.getElementById('cover-overlay-text');
    elements.filterInput = document.getElementById('filter-input');
    elements.viewSelect = document.getElementById('view-select');
    elements.statusFormat = document.getElementById('status-format');
    elements.statusBitrate = document.getElementById('status-bitrate');
    elements.statusSamplerate = document.getElementById('status-samplerate');
    elements.statusChannels = document.getElementById('status-channels');
    elements.statusTime = document.getElementById('status-time');
    elements.settingsModal = document.getElementById('settings-modal');
    elements.serverUrl = document.getElementById('server-url');
    elements.username = document.getElementById('username');
    elements.password = document.getElementById('password');
    elements.connectionStatus = document.getElementById('connection-status');
}

/**
 * Setup audio player callbacks
 */
function setupPlayerCallbacks() {
    state.player.onTrackChange = (track) => {
        state.currentTrack = track;
        updateNowPlaying(track);
        highlightCurrentTrack(track);
        
        // Update sidebar cover
        updateSidebarCover(track);
        
        // Connect visualizer to audio
        const analyser = state.player.getAnalyser();
        if (analyser) {
            state.visualizer.setAnalyser(analyser);
        }
    };

    state.player.onTimeUpdate = ({ currentTime, duration }) => {
        const current = AudioPlayer.formatTime(currentTime);
        const total = AudioPlayer.formatTime(duration);
        elements.statusTime.textContent = `${current} / ${total}`;
    };

    state.player.onPlayStateChange = (isPlaying) => {
        // Update visualization mode
        if (isPlaying) {
            state.visualizer.isDemoMode = false;
        }
    };
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', handleMenuClick);
    });

    // Filter input
    elements.filterInput.addEventListener('input', debounce(() => {
        filterLibrary(elements.filterInput.value);
    }, 300));

    // View select
    elements.viewSelect.addEventListener('change', () => {
        loadLibrary();
    });

    // Settings modal
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('cancel-settings').addEventListener('click', hideSettingsModal);
    document.getElementById('test-connection').addEventListener('click', testConnection);

    // Close modal on backdrop click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            hideSettingsModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

/**
 * Handle menu clicks
 */
function handleMenuClick(e) {
    const menu = e.target.dataset.menu;
    switch (menu) {
        case 'file':
            showSettingsModal();
            break;
        case 'playback':
            state.player.togglePlay();
            break;
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboard(e) {
    // Don't handle if typing in input
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            state.player.togglePlay();
            break;
        case 'ArrowRight':
            if (e.ctrlKey) {
                state.player.next();
            } else {
                state.player.seek(state.player.audio.currentTime + 5);
            }
            break;
        case 'ArrowLeft':
            if (e.ctrlKey) {
                state.player.previous();
            } else {
                state.player.seek(state.player.audio.currentTime - 5);
            }
            break;
        case 'ArrowUp':
            state.player.setVolume(state.player.getVolume() + 0.1);
            break;
        case 'ArrowDown':
            state.player.setVolume(state.player.getVolume() - 0.1);
            break;
    }
}

/**
 * Connect to Subsonic server
 */
async function connectToServer() {
    const { serverUrl, username, password } = state.settings;
    state.client.setCredentials(serverUrl, username, password);

    try {
        const success = await state.client.ping();
        if (success) {
            hideSettingsModal();
            await loadLibrary();
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        console.error('Connection error:', error);
        showError('Failed to connect to server. Check your settings.');
        showSettingsModal();
    }
}

/**
 * Load library data
 */
async function loadLibrary() {
    const viewType = elements.viewSelect.value;
    elements.libraryTree.innerHTML = '<div class="loading-message">Loading library...</div>';

    try {
        const albums = await state.client.getAlbumList({ type: 'alphabeticalByArtist', size: 500 });
        state.library.albums = albums;

        // Group albums by artist
        const artistMap = new Map();
        albums.forEach(album => {
            const artist = album.artist || 'Unknown Artist';
            if (!artistMap.has(artist)) {
                artistMap.set(artist, []);
            }
            artistMap.get(artist).push(album);
        });

        state.library.artists = Array.from(artistMap.entries()).map(([name, albums]) => ({
            name,
            albums,
            trackCount: albums.reduce((sum, a) => sum + (a.songCount || 0), 0)
        }));

        renderLibraryTree();
    } catch (error) {
        console.error('Failed to load library:', error);
        elements.libraryTree.innerHTML = '<div class="error-message">Failed to load library. Click File to configure server.</div>';
    }
}

/**
 * Render library tree
 */
function renderLibraryTree() {
    const container = elements.libraryTree;
    const filter = elements.filterInput.value.toLowerCase();
    
    let totalTracks = state.library.artists.reduce((sum, a) => sum + a.trackCount, 0);
    
    let html = `<div class="tree-node tree-group">
        <span class="expander">-</span>All Music (${totalTracks})
    </div>`;

    state.library.artists.forEach(artist => {
        // Filter by name
        if (filter && !artist.name.toLowerCase().includes(filter)) {
            return;
        }

        const isExpanded = state.expandedNodes.has(`artist-${artist.name}`);
        const expander = isExpanded ? '-' : '+';

        html += `<div class="tree-node" data-type="artist" data-name="${escapeHtml(artist.name)}">
            <span class="expander">${expander}</span>${escapeHtml(artist.name)} (${artist.trackCount})
        </div>`;

        if (isExpanded) {
            artist.albums.forEach(album => {
                const albumName = album.name || 'Unknown Album';
                const year = album.year ? `[${album.year}] ` : '';
                html += `<div class="tree-node tree-item" style="padding-left: 30px;" 
                    data-type="album" data-id="${album.id}">
                    ${year}${escapeHtml(albumName)} (${album.songCount || 0})
                </div>`;
            });
        }
    });

    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.tree-node').forEach(node => {
        node.addEventListener('click', handleTreeNodeClick);
    });
}

/**
 * Handle tree node click
 */
async function handleTreeNodeClick(e) {
    const node = e.currentTarget;
    const type = node.dataset.type;

    if (type === 'artist') {
        const name = node.dataset.name;
        const key = `artist-${name}`;
        
        if (state.expandedNodes.has(key)) {
            state.expandedNodes.delete(key);
        } else {
            state.expandedNodes.add(key);
        }
        renderLibraryTree();
    } else if (type === 'album') {
        const albumId = node.dataset.id;
        await loadAlbum(albumId);
    }
}

/**
 * Load album and display in playlist
 */
async function loadAlbum(albumId) {
    try {
        const album = await state.client.getAlbum(albumId);
        if (!album) return;

        state.library.currentAlbum = album;
        
        // Convert songs to playlist format
        const tracks = await Promise.all((album.song || []).map(async song => ({
            id: song.id,
            title: song.title,
            artist: song.artist || album.artist,
            album: album.name,
            albumId: album.id,
            track: song.track,
            duration: song.duration,
            bitRate: song.bitRate,
            suffix: song.suffix,
            coverArtId: song.coverArt || album.coverArt,
            streamUrl: await state.client.getStreamUrl(song.id)
        })));

        state.playlist = tracks;
        state.player.setQueue(tracks);
        
        renderPlaylist(album, tracks);
        updateSidebarCoverFromAlbum(album);
    } catch (error) {
        console.error('Failed to load album:', error);
    }
}

/**
 * Render playlist view
 */
async function renderPlaylist(album, tracks) {
    const tbody = elements.playlistBody;
    const coverUrl = album.coverArt ? await state.client.getCoverArtUrl(album.coverArt, 100) : '';
    
    let html = '';
    
    // First row with album cover
    if (tracks.length > 0) {
        const firstTrack = tracks[0];
        const isActive = state.currentTrack?.id === firstTrack.id;
        
        html += `<tr class="group-row">
            <td rowspan="${tracks.length}" class="album-cover-cell">
                <div class="cover-wrapper">
                    ${coverUrl ? `<img src="${coverUrl}" alt="Album Cover">` : ''}
                </div>
            </td>
            <td>${isActive ? '▶' : ''}</td>
            <td class="text-blue">${escapeHtml(firstTrack.artist)} - ${escapeHtml(firstTrack.album)}</td>
            <td>${String(firstTrack.track || 1).padStart(2, '0')}</td>
            <td>${escapeHtml(firstTrack.title)}</td>
            <td>${formatDuration(firstTrack.duration)}</td>
        </tr>`;

        // Rest of tracks
        for (let i = 1; i < tracks.length; i++) {
            const track = tracks[i];
            const isActive = state.currentTrack?.id === track.id;
            const activeClass = isActive ? ' class="track-row active"' : '';
            
            html += `<tr${activeClass} data-id="${track.id}">
                <td>${isActive ? '▶' : ''}</td>
                <td class="text-blue">${escapeHtml(track.artist)} - ${escapeHtml(track.album)}</td>
                <td>${String(track.track || i + 1).padStart(2, '0')}</td>
                <td>${escapeHtml(track.title)}</td>
                <td>${formatDuration(track.duration)}</td>
            </tr>`;
        }
    }

    tbody.innerHTML = html;

    // Add double-click handlers for playback
    tbody.querySelectorAll('tr').forEach((row, index) => {
        row.addEventListener('dblclick', () => {
            state.player.playIndex(index);
        });
    });
}

/**
 * Highlight current track in playlist
 */
function highlightCurrentTrack(track) {
    const tbody = elements.playlistBody;
    tbody.querySelectorAll('tr').forEach(row => {
        row.classList.remove('active');
        const playIndicator = row.querySelector('td:first-child');
        if (playIndicator) playIndicator.textContent = '';
    });

    if (track) {
        const rows = tbody.querySelectorAll('tr');
        const index = state.playlist.findIndex(t => t.id === track.id);
        if (index >= 0 && rows[index]) {
            rows[index].classList.add('active');
            const playIndicator = rows[index].querySelector('td:first-child');
            if (playIndicator) playIndicator.textContent = '▶';
        }
    }
}

/**
 * Update now playing info
 */
function updateNowPlaying(track) {
    if (!track) return;

    document.title = `${track.title} - ${track.artist} - SomeSonic`;
    
    // Update status bar
    elements.statusFormat.textContent = (track.suffix || '---').toUpperCase();
    elements.statusBitrate.textContent = track.bitRate ? `${track.bitRate} kbps` : '--- kbps';
    elements.statusSamplerate.textContent = '44100 Hz'; // Default, could be from track metadata
    elements.statusChannels.textContent = 'stereo';
}

/**
 * Update sidebar cover art
 */
async function updateSidebarCover(track) {
    if (!track?.coverArtId) return;

    try {
        const coverUrl = await state.client.getCoverArtUrl(track.coverArtId, 300);
        elements.sidebarCover.src = coverUrl;
        elements.sidebarCover.style.display = 'block';
        elements.coverPlaceholder.style.display = 'none';
        elements.coverOverlayText.textContent = `${track.artist} - ${track.album}`.toLowerCase();
    } catch (error) {
        console.error('Failed to load cover art:', error);
    }
}

/**
 * Update sidebar cover from album
 */
async function updateSidebarCoverFromAlbum(album) {
    if (!album?.coverArt) return;

    try {
        const coverUrl = await state.client.getCoverArtUrl(album.coverArt, 300);
        elements.sidebarCover.src = coverUrl;
        elements.sidebarCover.style.display = 'block';
        elements.coverPlaceholder.style.display = 'none';
        elements.coverOverlayText.textContent = `${album.artist} - ${album.name}`.toLowerCase();
    } catch (error) {
        console.error('Failed to load cover art:', error);
    }
}

/**
 * Filter library
 */
function filterLibrary(query) {
    renderLibraryTree();
}

/**
 * Show settings modal
 */
function showSettingsModal() {
    elements.serverUrl.value = state.settings.serverUrl;
    elements.username.value = state.settings.username;
    elements.password.value = state.settings.password;
    elements.connectionStatus.className = '';
    elements.connectionStatus.textContent = '';
    elements.settingsModal.style.display = 'flex';
}

/**
 * Hide settings modal
 */
function hideSettingsModal() {
    elements.settingsModal.style.display = 'none';
}

/**
 * Save settings
 */
async function saveSettings() {
    state.settings.serverUrl = elements.serverUrl.value.trim();
    state.settings.username = elements.username.value.trim();
    state.settings.password = elements.password.value;

    // Save to localStorage
    localStorage.setItem('somesonic_settings', JSON.stringify({
        serverUrl: state.settings.serverUrl,
        username: state.settings.username,
        // Don't save password in plain text - in production, use more secure storage
        password: btoa(state.settings.password)
    }));

    await connectToServer();
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
    try {
        const saved = localStorage.getItem('somesonic_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            state.settings.serverUrl = settings.serverUrl || '';
            state.settings.username = settings.username || '';
            state.settings.password = settings.password ? atob(settings.password) : '';
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

/**
 * Test connection
 */
async function testConnection() {
    const serverUrl = elements.serverUrl.value.trim();
    const username = elements.username.value.trim();
    const password = elements.password.value;

    if (!serverUrl || !username || !password) {
        showConnectionStatus('Please fill in all fields', false);
        return;
    }

    state.client.setCredentials(serverUrl, username, password);

    try {
        const success = await state.client.ping();
        showConnectionStatus(success ? 'Connection successful!' : 'Connection failed', success);
    } catch (error) {
        showConnectionStatus(`Connection failed: ${error.message}`, false);
    }
}

/**
 * Show connection status
 */
function showConnectionStatus(message, success) {
    elements.connectionStatus.className = success ? 'success' : 'error';
    elements.connectionStatus.textContent = message;
}

/**
 * Show error message
 */
function showError(message) {
    console.error(message);
    // Could show a toast notification here
}

// Utility functions

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

export { state };
