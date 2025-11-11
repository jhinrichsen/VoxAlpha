/**
 * eSpeak-ng WASM wrapper for offline text-to-speech
 * This is a placeholder implementation that will need to be integrated
 * with the actual espeak-ng WASM build
 */

class ESpeakTTS {
    constructor() {
        this.initialized = false;
        this.language = 'en';
        this.wasmModule = null;
        this.audioContext = null;
    }

    /**
     * Initialize eSpeak TTS
     * @param {string} language - Language code ('en' or 'de')
     */
    async init(language = 'en') {
        this.language = language;

        try {
            console.log(`[eSpeak] Initializing TTS for language: ${language}`);

            // Don't create AudioContext yet - wait for user interaction
            // It will be created on first speak() call

            // TODO: Load espeak-ng WASM module
            // For now, this is a placeholder that simulates loading
            await new Promise(resolve => setTimeout(resolve, 500));

            // TODO: Load voice data and phoneme rules for the selected language
            // The data should be loaded from IndexedDB cache or fetched if not cached

            this.initialized = true;
            console.log('[eSpeak] TTS initialized successfully');
            return true;
        } catch (error) {
            console.error('[eSpeak] Failed to initialize TTS:', error);
            throw error;
        }
    }

    /**
     * Check if TTS is initialized
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Speak text using TTS
     * @param {string} text - Text to speak
     * @param {Object} options - TTS options (rate, pitch, volume)
     * @returns {Promise<void>}
     */
    async speak(text, options = {}) {
        if (!this.initialized) {
            throw new Error('eSpeak TTS not initialized');
        }

        // Create AudioContext on first use (after user gesture)
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log(`[eSpeak] AudioContext created (sample rate: ${this.audioContext.sampleRate}Hz)`);
        }

        const {
            rate = 1.0,
            pitch = 1.0,
            volume = 1.0
        } = options;

        try {
            console.log(`[eSpeak] Speaking: "${text}"`);

            // TODO: Call espeak-ng WASM synthesis
            // This should:
            // 1. Convert text to phonemes using espeak-ng rules
            // 2. Synthesize audio using the WASM module
            // 3. Play the audio through Web Audio API

            // For now, use a mock implementation
            await this._mockSpeak(text, { rate, pitch, volume });

            console.log('[eSpeak] Speech completed');
        } catch (error) {
            console.error('[eSpeak] Speech failed:', error);
            throw error;
        }
    }

    /**
     * Mock TTS for development/testing
     * Uses Web Speech API as fallback until espeak-ng WASM is integrated
     * @private
     */
    async _mockSpeak(text, options) {
        // Check if Web Speech API is available (fallback for development)
        if ('speechSynthesis' in window) {
            return new Promise((resolve, reject) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = this.language === 'de' ? 'de-DE' : 'en-US';
                utterance.rate = options.rate;
                utterance.pitch = options.pitch;
                utterance.volume = options.volume;

                utterance.onend = resolve;
                utterance.onerror = reject;

                window.speechSynthesis.speak(utterance);
            });
        } else {
            // If Web Speech API is not available, just simulate a delay
            console.warn('[eSpeak] Web Speech API not available, using mock delay');
            await new Promise(resolve => setTimeout(resolve, text.length * 50));
        }
    }

    /**
     * Stop any ongoing speech
     */
    stop() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        // TODO: Stop espeak-ng WASM playback
        console.log('[eSpeak] Speech stopped');
    }

    /**
     * Set language for TTS
     * @param {string} language - Language code ('en' or 'de')
     */
    async setLanguage(language) {
        if (this.language !== language) {
            this.language = language;
            // TODO: Reload voice data for new language
            console.log(`[eSpeak] Language changed to: ${language}`);
        }
    }

    /**
     * Get available voices
     * @returns {Array} List of available voices
     */
    getVoices() {
        // TODO: Return espeak-ng WASM voices
        // For now, return Web Speech API voices as fallback
        if ('speechSynthesis' in window) {
            return window.speechSynthesis.getVoices();
        }
        return [];
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.wasmModule) {
            // TODO: Clean up WASM module resources
            this.wasmModule = null;
        }

        this.initialized = false;
        console.log('[eSpeak] TTS destroyed');
    }
}

// Export singleton instance
export const espeakTTS = new ESpeakTTS();

/**
 * Audio playback utilities
 */
export class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.currentSource = null;
    }

    /**
     * Initialize audio context
     */
    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[AudioPlayer] Initialized');
        }
        return this.audioContext;
    }

    /**
     * Play audio buffer
     * @param {AudioBuffer} buffer - Audio buffer to play
     * @returns {Promise<void>}
     */
    async play(buffer) {
        if (!this.audioContext) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                // Stop any currently playing audio
                this.stop();

                this.currentSource = this.audioContext.createBufferSource();
                this.currentSource.buffer = buffer;
                this.currentSource.connect(this.audioContext.destination);

                this.currentSource.onended = () => {
                    this.currentSource = null;
                    resolve();
                };

                this.currentSource.start(0);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Play audio from Float32Array samples
     * @param {Float32Array} samples - Audio samples
     * @param {number} sampleRate - Sample rate (default: 22050)
     * @returns {Promise<void>}
     */
    async playSamples(samples, sampleRate = 22050) {
        if (!this.audioContext) {
            await this.init();
        }

        const buffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
        buffer.getChannelData(0).set(samples);

        return this.play(buffer);
    }

    /**
     * Stop any currently playing audio
     */
    stop() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Ignore errors if already stopped
            }
            this.currentSource = null;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        console.log('[AudioPlayer] Destroyed');
    }
}
