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
     * Load Whisper model into WASM filesystem
     */
    async loadModel() {
        console.log('[Whisper] Loading model...');

        const modelUrl = './lib/whisper/ggml-tiny-q5_1.bin';
        const modelName = 'whisper.bin';

        // Use the loadRemote function from helpers.js
        return new Promise((resolve, reject) => {
            const cbProgress = (progress) => {
                console.log(`[Whisper] Model loading: ${Math.round(progress * 100)}%`);
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

            // Load model with caching (31 MB)
            loadRemote(modelUrl, modelName, 31, cbProgress, cbReady, cbCancel, cbPrint);
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
        if (audioData.length < minSamples) {
            console.warn(`[Whisper] Audio too short (${audioData.length} samples, need ${minSamples}). Padding with zeros.`);
            const padded = new Float32Array(minSamples);
            padded.set(audioData, 0);
            audioData = padded;
        }

        try {
            console.log(`[Whisper] Transcribing ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s)`);
            console.log(`[Whisper] Audio stats: min=${Math.min(...audioData).toFixed(3)}, max=${Math.max(...audioData).toFixed(3)}`);

            // Whisper WASM is aborting - this appears to be a known issue with the
            // downloaded WASM binary not working properly in our environment.
            // For now, show a helpful error and suggest using manual input
            throw new Error('Whisper WASM transcription is not working. The downloaded Whisper.cpp WASM binary aborts during processing. This is a known issue that requires either: (1) rebuilding Whisper WASM with proper flags, (2) using a different STT engine, or (3) using the manual text input instead. Please type your answer in the text field below.');

        } catch (error) {
            console.error('[Whisper] Transcription failed:', error);
            throw error;
        }
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
                console.log(`[AudioProcessor] Created AudioContext (sample rate: ${this.audioContext.sampleRate}Hz)`);
            }

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

                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: false,  // Disable processing to get raw audio
                        noiseSuppression: false,   // Disable processing
                        autoGainControl: true,     // Keep AGC enabled
                        sampleRate: 48000,
                        sampleSize: 16
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

        // Reset samples buffer
        this.samples = [];
        this.recording = true;

        // Use MediaRecorder API for better browser support
        try {
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.samples.push(e.data);
                }
            };

            this.mediaRecorder.start(100); // Capture every 100ms
            console.log('[AudioProcessor] Started recording with MediaRecorder');
        } catch (err) {
            // Fallback to ScriptProcessorNode if MediaRecorder fails
            console.warn('[AudioProcessor] MediaRecorder failed, using ScriptProcessorNode:', err);
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processor.onaudioprocess = (e) => {
                if (this.recording) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    this.samples.push(new Float32Array(inputData));
                }
            };

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            console.log('[AudioProcessor] Started recording with ScriptProcessorNode');
        }
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

        // Check if using MediaRecorder
        if (this.mediaRecorder) {
            return new Promise((resolve) => {
                this.mediaRecorder.onstop = async () => {
                    console.log(`[AudioProcessor] MediaRecorder stopped, captured ${this.samples.length} chunks`);

                    if (this.samples.length === 0) {
                        console.warn('[AudioProcessor] No audio data captured');
                        resolve(new Float32Array(0));
                        return;
                    }

                    // Combine all blobs
                    const audioBlob = new Blob(this.samples, { type: 'audio/webm' });
                    console.log(`[AudioProcessor] Audio blob size: ${audioBlob.size} bytes`);

                    // Decode the audio blob
                    try {
                        const arrayBuffer = await audioBlob.arrayBuffer();
                        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                        const samples = audioBuffer.getChannelData(0);

                        console.log(`[AudioProcessor] Decoded ${samples.length} samples at ${audioBuffer.sampleRate}Hz`);

                        // Check audio levels
                        let max = 0;
                        let sum = 0;
                        for (let i = 0; i < samples.length; i++) {
                            const abs = Math.abs(samples[i]);
                            if (abs > max) max = abs;
                            sum += abs;
                        }
                        const avg = sum / samples.length;
                        console.log(`[AudioProcessor] Audio levels: max=${max.toFixed(3)}, avg=${avg.toFixed(3)}`);

                        // Resample to 16kHz
                        const targetSampleRate = 16000;
                        if (audioBuffer.sampleRate !== targetSampleRate) {
                            console.log(`[AudioProcessor] Resampling from ${audioBuffer.sampleRate}Hz to ${targetSampleRate}Hz`);
                            const resampled = this.resample(samples, audioBuffer.sampleRate, targetSampleRate);
                            console.log(`[AudioProcessor] Resampled to ${resampled.length} samples (${(resampled.length / targetSampleRate).toFixed(2)}s)`);
                            resolve(resampled);
                        } else {
                            resolve(samples);
                        }
                    } catch (error) {
                        console.error('[AudioProcessor] Failed to decode audio:', error);
                        resolve(new Float32Array(0));
                    }

                    // Clear samples buffer
                    this.samples = [];
                    this.mediaRecorder = null;
                };

                this.mediaRecorder.stop();
            });
        }

        // Fallback: ScriptProcessorNode path
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

        // Clear samples buffer
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
