/**
 * Audio Visualization Module
 * Handles waveform and spectrogram rendering
 */

// Constants
const DEMO_ANIMATION_SPEED = 0.2;

export class AudioVisualizer {
    constructor(waveformCanvas, spectrogramCanvas, analyser = null) {
        this.waveformCanvas = waveformCanvas;
        this.spectrogramCanvas = spectrogramCanvas;
        this.waveformCtx = waveformCanvas.getContext('2d');
        this.spectrogramCtx = spectrogramCanvas.getContext('2d');
        
        this.analyser = analyser;
        this.isRunning = false;
        this.animationId = null;
        
        // Demo mode variables
        this.demoTime = 0;
        this.isDemoMode = true;
        
        // Spectrogram history
        this.spectrogramHistory = [];
        this.spectrogramWidth = 0;
        
        this._setupCanvases();
        this._setupResizeHandler();
    }

    /**
     * Setup canvas dimensions
     */
    _setupCanvases() {
        this._resizeCanvas(this.waveformCanvas);
        this._resizeCanvas(this.spectrogramCanvas);
        this.spectrogramWidth = this.spectrogramCanvas.width;
        this.spectrogramHistory = [];
    }

    /**
     * Resize canvas to match parent element
     */
    _resizeCanvas(canvas) {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    /**
     * Setup window resize handler
     */
    _setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this._setupCanvases();
                if (!this.isRunning) {
                    this._drawStaticSpectrogram();
                }
            }, 100);
        });
    }

    /**
     * Set analyser node from audio player
     */
    setAnalyser(analyser) {
        this.analyser = analyser;
        this.isDemoMode = !analyser;
    }

    /**
     * Start visualization
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._animate();
    }

    /**
     * Stop visualization
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Animation loop
     */
    _animate() {
        if (!this.isRunning) return;
        
        this._drawWaveform();
        this._drawSpectrogram();
        
        this.demoTime += DEMO_ANIMATION_SPEED;
        this.animationId = requestAnimationFrame(() => this._animate());
    }

    /**
     * Draw waveform visualization
     */
    _drawWaveform() {
        const canvas = this.waveformCanvas;
        const ctx = this.waveformCtx;
        const w = canvas.width;
        const h = canvas.height;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        // Draw center line
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();

        if (this.analyser && !this.isDemoMode) {
            // Real audio visualization
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteTimeDomainData(dataArray);

            ctx.beginPath();
            ctx.strokeStyle = '#a0a0a0';
            ctx.lineWidth = 1;

            const sliceWidth = w / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * cy;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.stroke();
        } else {
            // Demo mode - animated waveform
            this._drawDemoWaveform(ctx, w, h, cy);
        }
    }

    /**
     * Draw demo waveform when no audio is playing
     */
    _drawDemoWaveform(ctx, w, h, cy) {
        const time = this.demoTime;

        // Main waveform
        ctx.beginPath();
        ctx.strokeStyle = '#a0a0a0';
        ctx.lineWidth = 1;

        for (let x = 0; x < w; x++) {
            const freq1 = Math.sin(x * 0.05 + time);
            const freq2 = Math.sin(x * 0.13 + time * 1.5);
            const beat = Math.sin(time * 0.5) * Math.sin(x * 0.01);
            const noise = (Math.random() - 0.5) * 0.2;
            
            const y = cy + (freq1 * 20 + freq2 * 10) * beat + (noise * 50 * beat);

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Ghost waveform
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';

        for (let x = 0; x < w; x += 2) {
            const freq1 = Math.sin(x * 0.04 + time + 1);
            const beat = Math.sin(time * 0.5) * Math.sin(x * 0.015);
            const y = cy + (freq1 * 30) * beat;
            
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    /**
     * Draw spectrogram visualization
     */
    _drawSpectrogram() {
        const canvas = this.spectrogramCanvas;
        const ctx = this.spectrogramCtx;
        const w = canvas.width;
        const h = canvas.height;

        if (this.analyser && !this.isDemoMode) {
            // Real audio spectrogram
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);

            // Shift existing image left
            const imageData = ctx.getImageData(1, 0, w - 1, h);
            ctx.putImageData(imageData, 0, 0);

            // Draw new column
            for (let y = 0; y < h; y++) {
                const dataIndex = Math.floor((1 - y / h) * bufferLength);
                const value = dataArray[dataIndex];
                const intensity = value;
                
                ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity + 20})`;
                ctx.fillRect(w - 1, y, 1, 1);
            }
        } else {
            // Demo mode - scrolling spectrogram
            this._drawDemoSpectrogram(ctx, w, h);
        }
    }

    /**
     * Draw demo spectrogram when no audio is playing
     */
    _drawDemoSpectrogram(ctx, w, h) {
        const time = this.demoTime;

        // Shift existing image left
        const imageData = ctx.getImageData(1, 0, w - 1, h);
        ctx.putImageData(imageData, 0, 0);

        // Generate new vertical strip at the right edge
        for (let y = 0; y < h; y++) {
            const beat = Math.abs(Math.sin(time * 0.1)) > 0.8 ? 1 : 0.2;
            const highHat = Math.random() > 0.9 ? 1 : 0;
            
            let intensity = 0;
            
            // Bass frequencies (bottom)
            if (y > h * 0.8) {
                intensity = Math.random() * beat * 200;
            }
            // Mid frequencies
            else if (y > h * 0.4) {
                intensity = Math.random() * 50;
            }
            // High frequencies
            else {
                intensity = Math.random() * highHat * 100;
            }

            const val = Math.min(255, Math.floor(intensity));
            ctx.fillStyle = `rgb(${val}, ${val}, ${val + 20})`;
            ctx.fillRect(w - 1, y, 1, 1);
        }
    }

    /**
     * Draw static spectrogram for initial display
     */
    _drawStaticSpectrogram() {
        const canvas = this.spectrogramCanvas;
        const ctx = this.spectrogramCtx;
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        for (let x = 0; x < w; x++) {
            const bandEnergy = Math.sin(x * 0.1) * Math.sin(x * 0.03) + 1;

            for (let y = 0; y < h; y++) {
                const noise = Math.random();
                const yFactor = (y / h);

                if (noise * bandEnergy * yFactor > 0.6) {
                    const brightness = Math.floor(Math.random() * 150);
                    ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness + 30}, 0.5)`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    /**
     * Clear both canvases
     */
    clear() {
        const ww = this.waveformCanvas.width;
        const wh = this.waveformCanvas.height;
        const sw = this.spectrogramCanvas.width;
        const sh = this.spectrogramCanvas.height;
        
        this.waveformCtx.clearRect(0, 0, ww, wh);
        this.spectrogramCtx.fillStyle = '#000';
        this.spectrogramCtx.fillRect(0, 0, sw, sh);
    }

    /**
     * Initialize with static display
     */
    init() {
        this._drawStaticSpectrogram();
        
        // Draw static waveform center line
        const ctx = this.waveformCtx;
        const w = this.waveformCanvas.width;
        const h = this.waveformCanvas.height;
        const cy = h / 2;
        
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();
    }
}

export default AudioVisualizer;
