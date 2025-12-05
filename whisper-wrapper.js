/**
 * Whisper.cpp WASM wrapper for offline speech-to-text
 * Uses the actual Whisper WASM module loaded in index.html
 */

class WhisperSTT {
    constructor() {
        this.initialized = false;
        this.modelLoaded = false;
        this.instance = null;
        this.language = 'en';
        this.transcriptionCount = 0;

        // Instance reload disabled by default - only real leaks fixed (blob URLs, audioData)
        // If iPhone still freezes, set this to 10 to reload instance periodically
        this.maxTranscriptionsBeforeReload = Infinity;
        console.log('[Whisper] Instance reload disabled - testing with blob/buffer cleanup only');
    }

    /**
     * Initialize Whisper STT and load model
     * @param {string} language - Language code ('en' or 'de')
     */
    async init(language = 'en') {
        this.language = language;

        try {
            console.log(`[Whisper] Initializing STT for language: ${language}`);

            // Wait for Module to be ready
            if (typeof Module === 'undefined') {
                throw new Error('Whisper Module not loaded. Make sure main.js is included in HTML.');
            }

            // Wait for WASM to be ready
            await this.waitForModule();

            // Load the model
            await this.loadModel();

            this.initialized = true;
            console.log('[Whisper] STT initialized successfully');
            return true;
        } catch (error) {
            console.error('[Whisper] Failed to initialize STT:', error);
            throw error;
        }
    }

    /**
     * Wait for Whisper Module to be ready
     */
    async waitForModule() {
        return new Promise((resolve, reject) => {
            if (Module.calledRun) {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (Module.calledRun) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Whisper Module failed to initialize'));
            }, 10000);
        });
    }

    /**
     * Reload Whisper instance (without reloading the model)
     * This is much lighter than loadModel() - only recreates the instance
     */
    async reloadInstance() {
        console.log('[Whisper] Reloading instance (keeping model in memory)...');

        // Clean up old instance if exists
        if (this.instance) {
            try {
                // Try to free the instance (if the WASM module supports it)
                if (Module.free && typeof Module.free === 'function') {
                    Module.free(this.instance);
                    console.log('[Whisper] Old instance freed');
                }
            } catch (e) {
                console.warn('[Whisper] Could not free old instance:', e);
            }
            this.instance = null;
        }

        // Recreate instance with existing model in WASM FS
        const modelName = 'whisper.bin';
        try {
            this.instance = Module.init(modelName);
            if (this.instance) {
                console.log('[Whisper] New Whisper instance created:', this.instance);
                return true;
            } else {
                throw new Error('Failed to create Whisper instance');
            }
        } catch (error) {
            console.error('[Whisper] Failed to reload instance:', error);
            throw error;
        }
    }

    /**
     * Load Whisper model into WASM filesystem
     */
    async loadModel() {
        console.log('[Whisper] Loading model...');

        // Check if external model URL is configured
        let modelUrl = './ggml-small-q8_0.bin';
        let modelSize = 253; // MB

        try {
            const configResponse = await fetch('/api/config');
            if (configResponse.ok) {
                const config = await configResponse.json();
                if (config.modelUrl) {
                    modelUrl = config.modelUrl;
                    // Estimate size based on model path (if provided) or URL
                    const modelPath = config.modelPath || modelUrl;
                    if (modelPath.includes('base')) {
                        modelSize = 81;
                    } else if (modelPath.includes('small')) {
                        modelSize = 244;
                    } else if (modelPath.includes('medium')) {
                        modelSize = 769;
                    } else if (modelPath.includes('large')) {
                        modelSize = 1550;
                    }
                    console.log(`[Whisper] Using external model: ${modelUrl} (~${modelSize}MB)`);
                }
            }
        } catch (err) {
            console.log('[Whisper] No external model configured, using embedded tiny model');
        }

        const modelName = 'whisper.bin';

        // Use the loadRemote function from helpers.js
        return new Promise((resolve, reject) => {
            const cbProgress = (progress) => {
                // Update progress bar if callback exists
                if (window.whisperProgressCallback) {
                    window.whisperProgressCallback(progress);
                }
            };

            const cbReady = (dst, data) => {
                console.log(`[Whisper] Model data received, storing in WASM FS...`);

                // Store in WASM filesystem
                try {
                    // Delete if exists
                    try {
                        Module.FS_unlink(modelName);
                    } catch (e) {
                        // File doesn't exist, ignore
                    }

                    // Create file in WASM FS
                    Module.FS_createDataFile("/", modelName, data, true, true);
                    console.log('[Whisper] Model stored in WASM filesystem');

                    // Initialize Whisper instance
                    this.instance = Module.init(modelName);
                    if (this.instance) {
                        console.log('[Whisper] Whisper instance created:', this.instance);
                        this.modelLoaded = true;
                        resolve();
                    } else {
                        reject(new Error('Failed to create Whisper instance'));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            const cbCancel = () => {
                reject(new Error('Model loading cancelled'));
            };

            const cbPrint = (text) => {
                console.log('[Whisper]', text);
            };

            // Check if loadRemote is available
            if (typeof loadRemote === 'undefined') {
                reject(new Error('loadRemote function not available. Make sure helpers.js is loaded.'));
                return;
            }

            // Load model with caching
            loadRemote(modelUrl, modelName, modelSize, cbProgress, cbReady, cbCancel, cbPrint);
        });
    }

    /**
     * Check if STT is initialized
     */
    isInitialized() {
        return this.initialized && this.modelLoaded;
    }

    /**
     * Transcribe audio data
     * @param {Float32Array} audioData - Audio samples (16kHz, mono, -1.0 to 1.0)
     * @returns {Promise<string>} Transcribed text
     */
    async transcribe(audioData) {
        if (!this.isInitialized()) {
            throw new Error('Whisper STT not initialized or model not loaded');
        }

        if (!audioData || audioData.length === 0) {
            console.warn('[Whisper] No audio data provided');
            return '';
        }

        // Whisper expects minimum 1 second of audio
        const minSamples = 16000; // 1 second at 16kHz
        let originalAudioData = null;
        if (audioData.length < minSamples) {
            console.warn(`[Whisper] Audio too short (${audioData.length} samples, need ${minSamples}). Padding with zeros.`);
            originalAudioData = audioData; // Keep reference to clear later
            const padded = new Float32Array(minSamples);
            padded.set(audioData, 0);
            audioData = padded;
            // Clear original short audio
            originalAudioData = null;
        }

        try {
            console.log(`[Whisper] Transcribing ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s)`);
            console.log(`[Whisper] Audio stats: min=${Math.min(...audioData).toFixed(3)}, max=${Math.max(...audioData).toFixed(3)}`);

            // Save audio to downloadable WAV for debugging
            let wavBlob = this.audioDataToWav(audioData, 16000);
            let url = URL.createObjectURL(wavBlob);

            // Auto-download the WAV file if ?download=1 or ?debug=1 query parameter is set
            const urlParams = new URLSearchParams(window.location.search);
            const shouldDownload = urlParams.get('download') === '1' || urlParams.get('debug') === '1';

            if (shouldDownload) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `voxalpha-recording-${timestamp}.wav`;

                let a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                console.log(`[Whisper] Auto-downloading captured audio as: ${filename}`);
                console.log('[Whisper] File should appear in your Downloads folder');

                // Clean up blob URL and references to prevent memory leak
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    wavBlob = null;
                    url = null;
                    a = null;
                }, 100);
            } else {
                console.log(`[Whisper] Auto-download disabled. Blob URL created for debugging`);
                // Clean up blob URL and references after short delay
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    wavBlob = null;
                    url = null;
                }, 1000);
            }

            // Check if audio is completely silent before attempting transcription
            const maxLevel = Math.max(...audioData.map(Math.abs));
            if (maxLevel === 0) {
                console.error('[Whisper] Cannot transcribe silent audio');
                throw new Error('Audio is silent - check microphone settings');
            }

            // Intercept output using dynamic callbacks
            const result = await new Promise((resolve, reject) => {
                let transcriptionText = '';
                let completed = false;
                let outputLineCount = 0;
                let lastOutputTime = Date.now();

                const timeout = setTimeout(() => {
                    console.log(`[Whisper] Timeout after 30s - received ${outputLineCount} output lines`);
                    window.whisperPrintCallback = null;
                    window.whisperPrintErrCallback = null;
                    if (!completed) {
                        completed = true;
                        reject(new Error(`Transcription timeout - received ${outputLineCount} output lines`));
                    }
                }, 30000);

                const finish = () => {
                    if (completed) return;
                    completed = true;
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    window.whisperPrintCallback = null;
                    window.whisperPrintErrCallback = null;
                    resolve(transcriptionText.trim());
                };

                const handleOutput = (text) => {
                    outputLineCount++;
                    lastOutputTime = Date.now();
                    // Log ALL output to see what we're getting
                    console.log(`[Whisper] Output line ${outputLineCount}: "${text}"`);

                    // Match transcription lines: [00:00:00.000 --> 00:00:01.000]   Text
                    const match = text.match(/\[[\d:\.]+\s+-->\s+[\d:\.]+\]\s+(.+)/);
                    if (match) {
                        transcriptionText += match[1].trim() + ' ';
                        console.log(`[Whisper] Captured transcription: "${match[1].trim()}"`);
                    }

                    // Complete when we see timing summary
                    if (text.includes('total time')) {
                        console.log(`[Whisper] Transcription complete (${outputLineCount} lines): "${transcriptionText}"`);
                        // Small delay to ensure all output is processed
                        setTimeout(() => finish(), 100);
                    }
                };

                // Set up dynamic callbacks BEFORE calling Module.full_default
                window.whisperPrintCallback = handleOutput;
                window.whisperPrintErrCallback = handleOutput;

                console.log('[Whisper] Callbacks configured:', {
                    printCallback: typeof window.whisperPrintCallback,
                    printErrCallback: typeof window.whisperPrintErrCallback
                });

                // Check for completion after output stops (fallback mechanism)
                // Wait 20+ seconds because transcription processing can take 15-20 seconds
                const checkInterval = setInterval(() => {
                    const timeSinceLastOutput = Date.now() - lastOutputTime;
                    if (outputLineCount > 0 && timeSinceLastOutput > 20000 && !completed) {
                        console.log(`[Whisper] No output for ${timeSinceLastOutput}ms, assuming complete`);
                        finish();
                    }
                }, 2000);

                try {
                    console.log('[Whisper] Calling Module.full_default...');
                    // Use all available CPU cores for faster transcription
                    const numThreads = navigator.hardwareConcurrency || 4;
                    console.log(`[Whisper] Using ${numThreads} threads`);
                    
                    // Call is synchronous and prints happen during execution
                    const returnCode = Module.full_default(
                        this.instance,
                        audioData,
                        this.language,
                        numThreads,
                        false
                    );
                    console.log(`[Whisper] Module.full_default returned: ${returnCode}`);

                    if (returnCode !== 0) {
                        clearTimeout(timeout);
                        clearInterval(checkInterval);
                        window.whisperPrintCallback = null;
                        window.whisperPrintErrCallback = null;
                        reject(new Error(`Whisper failed with code ${returnCode}`));
                    }
                    
                    // If function returned successfully but we have no output yet,
                    // wait a bit for callbacks to fire
                    if (outputLineCount === 0) {
                        console.log('[Whisper] Waiting for output callbacks...');
                    }
                } catch (err) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    window.whisperPrintCallback = null;
                    window.whisperPrintErrCallback = null;
                    reject(err);
                }
            });

            console.log(`[Whisper] Transcription result: "${result}"`);

            // Explicitly clear audio data to free memory
            audioData = null;

            // Increment transcription counter and check if we need to reload instance
            this.transcriptionCount++;
            if (this.transcriptionCount >= this.maxTranscriptionsBeforeReload) {
                console.log(`[Whisper] Reloading Whisper instance after ${this.transcriptionCount} transcriptions to prevent memory leak`);
                this.transcriptionCount = 0;
                // Reload only the instance (NOT the 253 MB model!) to clear accumulated state
                await this.reloadInstance();
            }

            return result;

        } catch (error) {
            console.error('[Whisper] Transcription failed:', error);
            // Clear audio data even on error
            audioData = null;
            throw error;
        } finally {
            // Try to trigger garbage collection hint (non-standard, but helps where supported)
            if (window.gc) {
                console.log('[Whisper] Triggering manual GC');
                window.gc();
            }
        }
    }

    /**
     * Convert Float32Array audio to WAV blob
     */
    audioDataToWav(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // Write PCM samples
        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Set language for transcription
     * @param {string} language - Language code ('en' or 'de')
     */
    async setLanguage(language) {
        if (this.language !== language) {
            this.language = language;
            console.log(`[Whisper] Language changed to: ${language}`);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.instance) {
            // Whisper.cpp WASM doesn't have explicit destroy
            this.instance = null;
        }
        this.initialized = false;
        this.modelLoaded = false;
        console.log('[Whisper] STT destroyed');
    }
}

// Export singleton instance
export const whisperSTT = new WhisperSTT();

/**
 * Audio processing utilities
 */
export class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.source = null;
        this.processor = null;
        this.mediaRecorder = null;
        this.samples = [];
        this.recording = false;
    }

    /**
     * Initialize audio context and request microphone access
     */
    async init() {
        try {
            console.log(`[AudioProcessor] init() called - stream=${!!this.stream}, audioContext=${!!this.audioContext}`);

            // Don't reinitialize if already initialized
            if (this.stream && this.stream.active && this.audioContext && this.audioContext.state !== 'closed') {
                console.log('[AudioProcessor] Already initialized');
                return true;
            }

            // Create AudioContext with 16kHz sample rate (Whisper requirement)
            // Note: Browser might not support 16kHz, so we'll resample if needed
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log(`[AudioProcessor] Created AudioContext (sample rate: ${this.audioContext.sampleRate}Hz, state: ${this.audioContext.state})`);
            }

            // Don't resume AudioContext here - Chrome requires user gesture
            // We'll resume it in startRecording() when user clicks the mic button

            // List available audio devices
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(d => d.kind === 'audioinput');
                console.log('[AudioProcessor] Available microphones:', audioInputs.map(d => `${d.label || 'Unnamed'} (${d.deviceId.substring(0, 8)}...)`));
            } catch (err) {
                console.warn('[AudioProcessor] Could not enumerate devices:', err);
            }

            // Request microphone access with explicit constraints
            if (!this.stream || !this.stream.active) {
                console.log('[AudioProcessor] Requesting microphone access...');
                console.log('[AudioProcessor] Checking mediaDevices support:', {
                    hasNavigator: typeof navigator !== 'undefined',
                    hasMediaDevices: typeof navigator.mediaDevices !== 'undefined',
                    hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
                });

                // Try to get the actual microphone (not a monitor/loopback device)
                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: false,  // Disable processing to get raw audio
                        noiseSuppression: false,   // Disable processing
                        autoGainControl: true,     // Keep AGC enabled
                        sampleRate: 48000,
                        sampleSize: 16,
                        // Request actual input device (not output monitor)
                        deviceId: undefined  // Let browser pick default input
                    }
                });

                // Log which microphone we got
                const track = this.stream.getAudioTracks()[0];
                const settings = track.getSettings();
                console.log(`[AudioProcessor] Microphone access granted - stream active=${this.stream.active}`);
                console.log(`[AudioProcessor] Using microphone:`, {
                    label: track.label,
                    deviceId: settings.deviceId?.substring(0, 8) + '...',
                    sampleRate: settings.sampleRate,
                    channelCount: settings.channelCount
                });
            }

            // Verify initialization
            if (!this.stream || !this.stream.active) {
                throw new Error('Failed to initialize audio stream');
            }
            if (!this.audioContext || this.audioContext.state === 'closed') {
                throw new Error('Failed to initialize audio context');
            }

            console.log('[AudioProcessor] Initialization complete');
            return true;
        } catch (error) {
            console.error('[AudioProcessor] Failed to initialize:', error);

            // Clean up on error
            this.stream = null;
            this.audioContext = null;

            // Provide more helpful error messages
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone permission denied. Please allow microphone access.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone.');
            } else {
                throw new Error(`Microphone error: ${error.message}`);
            }
        }
    }

    /**
     * Start recording audio (continuous capture)
     */
    startRecording() {
        if (!this.stream || !this.audioContext) {
            throw new Error('AudioProcessor not initialized');
        }

        if (this.recording) {
            console.warn('[AudioProcessor] Already recording');
            return;
        }

        // Ensure AudioContext is running (critical for Chrome)
        console.log(`[AudioProcessor] AudioContext state before recording: ${this.audioContext.state}`);
        if (this.audioContext.state === 'suspended') {
            console.log('[AudioProcessor] Resuming AudioContext for recording...');
            this.audioContext.resume().then(() => {
                console.log(`[AudioProcessor] AudioContext resumed: ${this.audioContext.state}`);
            }).catch(err => {
                console.error('[AudioProcessor] Failed to resume AudioContext:', err);
            });
        }

        // Reset samples buffer
        this.samples = [];
        this.recording = true;
        this.useMediaRecorder = false;

        // Use ScriptProcessorNode for direct audio capture (more reliable than MediaRecorder)
        console.log('[AudioProcessor] Using ScriptProcessorNode for direct audio capture');
        this.source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        let chunkCount = 0;
        this.processor.onaudioprocess = (e) => {
            if (this.recording) {
                const inputData = e.inputBuffer.getChannelData(0);

                // Debug: Check if we're getting any non-zero samples
                chunkCount++;
                if (chunkCount <= 3) {
                    let max = 0;
                    for (let i = 0; i < inputData.length; i++) {
                        const abs = Math.abs(inputData[i]);
                        if (abs > max) max = abs;
                    }
                    console.log(`[AudioProcessor] Chunk ${chunkCount}: length=${inputData.length}, max=${max.toFixed(6)}`);
                }

                // Copy the data to avoid reference issues
                const chunk = new Float32Array(inputData.length);
                chunk.set(inputData);
                this.samples.push(chunk);
            }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        console.log('[AudioProcessor] Started recording with ScriptProcessorNode');
    }

    /**
     * Stop recording and return captured audio
     * @returns {Promise<Float32Array>} Audio samples at 16kHz, mono
     */
    async stopRecording() {
        if (!this.recording) {
            console.warn('[AudioProcessor] Not recording');
            return new Float32Array(0);
        }

        this.recording = false;

        // ScriptProcessorNode path (direct audio capture)
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        console.log(`[AudioProcessor] Stopped recording, captured ${this.samples.length} chunks`);

        // Concatenate all sample chunks
        const totalLength = this.samples.reduce((acc, arr) => acc + arr.length, 0);
        if (totalLength === 0) {
            console.warn('[AudioProcessor] No audio data captured');
            return new Float32Array(0);
        }

        const result = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of this.samples) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        // Clear samples buffer and explicitly null references for GC
        for (let i = 0; i < this.samples.length; i++) {
            this.samples[i] = null;
        }
        this.samples.length = 0;
        this.samples = [];

        // Check audio levels before resampling
        let max = 0;
        let sum = 0;
        for (let i = 0; i < result.length; i++) {
            const abs = Math.abs(result[i]);
            if (abs > max) max = abs;
            sum += abs;
        }
        const avg = sum / result.length;
        console.log(`[AudioProcessor] Raw audio levels: max=${max.toFixed(3)}, avg=${avg.toFixed(3)}`);

        // Warn if audio is completely silent
        if (max === 0) {
            console.error('[AudioProcessor] WARNING: Audio is completely silent! Check microphone.');
            console.error('[AudioProcessor] Possible issues:');
            console.error('[AudioProcessor]  - Microphone is muted in system settings');
            console.error('[AudioProcessor]  - Wrong microphone selected');
            console.error('[AudioProcessor]  - Browser audio permissions issue');
        }

        // Apply gain if audio is too quiet (below 0.01 max)
        if (max < 0.01 && max > 0) {
            const gain = 0.1 / max; // Normalize to 0.1 (safe level)
            console.log(`[AudioProcessor] Audio too quiet, applying gain: ${gain.toFixed(1)}x`);
            for (let i = 0; i < result.length; i++) {
                result[i] *= gain;
            }
        }

        // Resample to 16kHz if necessary
        const targetSampleRate = 16000;
        if (this.audioContext.sampleRate !== targetSampleRate) {
            console.log(`[AudioProcessor] Resampling from ${this.audioContext.sampleRate}Hz to ${targetSampleRate}Hz`);
            const resampled = this.resample(result, this.audioContext.sampleRate, targetSampleRate);
            console.log(`[AudioProcessor] Resampled to ${resampled.length} samples (${(resampled.length / targetSampleRate).toFixed(2)}s)`);
            // Clear original buffer after resampling
            result.fill(0);
            return resampled;
        } else {
            console.log(`[AudioProcessor] Captured ${result.length} samples (${(result.length / targetSampleRate).toFixed(2)}s)`);
            return result;
        }
    }

    /**
     * Resample audio to target sample rate
     * Simple linear interpolation
     */
    resample(samples, fromRate, toRate) {
        if (fromRate === toRate) {
            return samples;
        }

        const ratio = fromRate / toRate;
        const newLength = Math.round(samples.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexInt = Math.floor(srcIndex);
            const srcIndexFrac = srcIndex - srcIndexInt;

            if (srcIndexInt + 1 < samples.length) {
                // Linear interpolation
                result[i] = samples[srcIndexInt] * (1 - srcIndexFrac) +
                           samples[srcIndexInt + 1] * srcIndexFrac;
            } else {
                result[i] = samples[srcIndexInt];
            }
        }

        return result;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        console.log('[AudioProcessor] Destroyed');
    }
}
