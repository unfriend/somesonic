/**
 * Audio Player Module
 * Handles audio playback, queue management, and audio analysis
 */

export class AudioPlayer {
    constructor(audioElement) {
        this.audio = audioElement;
        this.queue = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.volume = 1.0;
        this.repeat = 'none'; // 'none', 'one', 'all'
        this.shuffle = false;
        this.shuffledQueue = [];
        
        // Audio context for visualization
        this.audioContext = null;
        this.analyser = null;
        this.sourceNode = null;
        
        // Event callbacks
        this.onTrackChange = null;
        this.onPlayStateChange = null;
        this.onTimeUpdate = null;
        this.onEnded = null;
        this.onError = null;

        this._setupEventListeners();
    }

    /**
     * Setup audio element event listeners
     */
    _setupEventListeners() {
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            if (this.onPlayStateChange) this.onPlayStateChange(true);
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            if (this.onPlayStateChange) this.onPlayStateChange(false);
        });

        this.audio.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate({
                    currentTime: this.audio.currentTime,
                    duration: this.audio.duration || 0
                });
            }
        });

        this.audio.addEventListener('ended', () => {
            this._handleEnded();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            if (this.onError) this.onError(e);
        });

        this.audio.addEventListener('loadedmetadata', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate({
                    currentTime: 0,
                    duration: this.audio.duration || 0
                });
            }
        });
    }

    /**
     * Handle track ended
     */
    _handleEnded() {
        if (this.onEnded) this.onEnded();

        if (this.repeat === 'one') {
            this.audio.currentTime = 0;
            this.play();
        } else if (this.hasNext()) {
            this.next();
        } else if (this.repeat === 'all' && this.queue.length > 0) {
            this.playIndex(0);
        }
    }

    /**
     * Initialize audio context for visualization
     */
    initAudioContext() {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect audio element to analyser
            this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
            this.sourceNode.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
        } catch (e) {
            console.error('Failed to initialize audio context:', e);
        }
    }

    /**
     * Get analyser for visualization
     * @returns {AnalyserNode|null}
     */
    getAnalyser() {
        if (!this.audioContext) {
            this.initAudioContext();
        }
        return this.analyser;
    }

    /**
     * Set the playback queue
     * @param {Array} tracks - Array of track objects
     */
    setQueue(tracks) {
        this.queue = [...tracks];
        this.shuffledQueue = this._shuffleArray([...tracks]);
        this.currentIndex = -1;
    }

    /**
     * Add tracks to queue
     * @param {Array} tracks - Tracks to add
     */
    addToQueue(tracks) {
        this.queue.push(...tracks);
        this.shuffledQueue = this._shuffleArray([...this.queue]);
    }

    /**
     * Clear the queue
     */
    clearQueue() {
        this.queue = [];
        this.shuffledQueue = [];
        this.currentIndex = -1;
    }

    /**
     * Get current queue
     * @returns {Array}
     */
    getQueue() {
        return this.shuffle ? this.shuffledQueue : this.queue;
    }

    /**
     * Get current track
     * @returns {Object|null}
     */
    getCurrentTrack() {
        const queue = this.getQueue();
        if (this.currentIndex >= 0 && this.currentIndex < queue.length) {
            return queue[this.currentIndex];
        }
        return null;
    }

    /**
     * Play a track at index
     * @param {number} index - Track index
     */
    async playIndex(index) {
        const queue = this.getQueue();
        if (index < 0 || index >= queue.length) return;

        this.currentIndex = index;
        const track = queue[index];

        if (track.streamUrl) {
            this.audio.src = track.streamUrl;
            
            // Resume audio context if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            try {
                await this.audio.play();
                if (this.onTrackChange) this.onTrackChange(track);
            } catch (e) {
                console.error('Playback error:', e);
                if (this.onError) this.onError(e);
            }
        }
    }

    /**
     * Play/resume
     */
    async play() {
        if (this.currentIndex < 0 && this.queue.length > 0) {
            this.playIndex(0);
        } else {
            // Resume audio context if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            try {
                await this.audio.play();
            } catch (e) {
                console.error('Play error:', e);
            }
        }
    }

    /**
     * Pause
     */
    pause() {
        this.audio.pause();
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Stop playback
     */
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    /**
     * Check if has next track
     * @returns {boolean}
     */
    hasNext() {
        return this.currentIndex < this.getQueue().length - 1;
    }

    /**
     * Check if has previous track
     * @returns {boolean}
     */
    hasPrevious() {
        return this.currentIndex > 0;
    }

    /**
     * Play next track
     */
    next() {
        if (this.hasNext()) {
            this.playIndex(this.currentIndex + 1);
        }
    }

    /**
     * Play previous track
     */
    previous() {
        if (this.audio.currentTime > 3) {
            // If more than 3 seconds into song, restart it
            this.audio.currentTime = 0;
        } else if (this.hasPrevious()) {
            this.playIndex(this.currentIndex - 1);
        }
    }

    /**
     * Seek to position
     * @param {number} time - Time in seconds
     */
    seek(time) {
        if (isFinite(time)) {
            this.audio.currentTime = time;
        }
    }

    /**
     * Seek to percentage
     * @param {number} percent - 0-100
     */
    seekPercent(percent) {
        if (this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
        }
    }

    /**
     * Set volume
     * @param {number} volume - 0-1
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this.volume;
    }

    /**
     * Get volume
     * @returns {number}
     */
    getVolume() {
        return this.volume;
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.audio.muted = !this.audio.muted;
    }

    /**
     * Set repeat mode
     * @param {string} mode - 'none', 'one', 'all'
     */
    setRepeat(mode) {
        this.repeat = mode;
    }

    /**
     * Toggle shuffle
     */
    toggleShuffle() {
        this.shuffle = !this.shuffle;
        
        if (this.shuffle) {
            // Keep current track at index 0 in shuffled queue
            const current = this.getCurrentTrack();
            this.shuffledQueue = this._shuffleArray([...this.queue]);
            
            if (current) {
                const idx = this.shuffledQueue.findIndex(t => t.id === current.id);
                if (idx > 0) {
                    [this.shuffledQueue[0], this.shuffledQueue[idx]] = 
                    [this.shuffledQueue[idx], this.shuffledQueue[0]];
                }
                this.currentIndex = 0;
            }
        } else {
            // Find current track in original queue
            const current = this.getCurrentTrack();
            if (current) {
                this.currentIndex = this.queue.findIndex(t => t.id === current.id);
            }
        }
    }

    /**
     * Shuffle an array
     * @param {Array} array 
     * @returns {Array}
     */
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Get playback state
     * @returns {Object}
     */
    getState() {
        return {
            isPlaying: this.isPlaying,
            currentTime: this.audio.currentTime,
            duration: this.audio.duration || 0,
            volume: this.volume,
            muted: this.audio.muted,
            repeat: this.repeat,
            shuffle: this.shuffle,
            currentTrack: this.getCurrentTrack(),
            queueLength: this.queue.length,
            currentIndex: this.currentIndex
        };
    }

    /**
     * Format time in seconds to mm:ss
     * @param {number} seconds 
     * @returns {string}
     */
    static formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

export default AudioPlayer;
