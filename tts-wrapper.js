/**
 * Piper TTS wrapper - plays pre-generated WAV snippets
 * Fully offline - no Web Speech API, no network requests
 */

class PiperTTS {
    constructor() {
        this.initialized = false;
        this.language = 'en';
        this.audioContext = null;
        this.audioCache = new Map();
    }

    /**
     * Initialize TTS
     * @param {string} language - Language code ('en' or 'de')
     */
    async init(language = 'en') {
        this.language = language;

        try {
            console.log(`[PiperTTS] Initializing for language: ${language}`);
            this.initialized = true;
            console.log('[PiperTTS] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[PiperTTS] Failed to initialize:', error);
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
     * Get the WAV file path for a word
     * @param {string} word - The word to speak
     * @returns {string} Path to the WAV file
     */
    _getAudioPath(word) {
        const langDir = this.language === 'de' ? 'de' : 'en';

        // Map word to letter code
        // German DIN 5009 mappings
        const deWordToLetter = {
            'aachen': 'A', 'berlin': 'B', 'chemnitz': 'C', 'düsseldorf': 'D',
            'essen': 'E', 'frankfurt': 'F', 'goslar': 'G', 'hamburg': 'H',
            'ingelheim': 'I', 'jena': 'J', 'köln': 'K', 'leipzig': 'L',
            'münchen': 'M', 'nürnberg': 'N', 'offenbach': 'O', 'potsdam': 'P',
            'quickborn': 'Q', 'rostock': 'R', 'salzwedel': 'S', 'tübingen': 'T',
            'unna': 'U', 'völklingen': 'V', 'wuppertal': 'W', 'xanten': 'X',
            'ypsilon': 'Y', 'zwickau': 'Z',
            'umlaut-aachen': 'AE', 'umlaut-offenbach': 'OE', 'umlaut-unna': 'UE',
            'umlaut aachen': 'AE', 'umlaut offenbach': 'OE', 'umlaut unna': 'UE',
            'eszett': 'SZ'
        };

        // NATO alphabet mappings
        const enWordToLetter = {
            'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D',
            'echo': 'E', 'foxtrot': 'F', 'golf': 'G', 'hotel': 'H',
            'india': 'I', 'juliett': 'J', 'kilo': 'K', 'lima': 'L',
            'mike': 'M', 'november': 'N', 'oscar': 'O', 'papa': 'P',
            'quebec': 'Q', 'romeo': 'R', 'sierra': 'S', 'tango': 'T',
            'uniform': 'U', 'victor': 'V', 'whiskey': 'W', 'x-ray': 'X',
            'yankee': 'Y', 'zulu': 'Z'
        };

        const wordLower = word.toLowerCase();
        const mapping = this.language === 'de' ? deWordToLetter : enWordToLetter;
        const letter = mapping[wordLower];

        if (!letter) {
            console.warn(`[PiperTTS] Unknown word: ${word}`);
            return null;
        }

        return `./audio/${langDir}/${letter}.wav`;
    }

    /**
     * Load and cache audio buffer
     * @param {string} path - Path to WAV file
     * @returns {Promise<AudioBuffer>}
     */
    async _loadAudio(path) {
        // Check cache first
        if (this.audioCache.has(path)) {
            return this.audioCache.get(path);
        }

        // Create AudioContext on first use (after user gesture)
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log(`[PiperTTS] AudioContext created (sample rate: ${this.audioContext.sampleRate}Hz)`);
        }

        // Fetch and decode audio
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load audio: ${path} (${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // Cache for future use
        this.audioCache.set(path, audioBuffer);
        console.log(`[PiperTTS] Cached audio: ${path}`);

        return audioBuffer;
    }

    /**
     * Speak a word using pre-generated WAV snippet
     * @param {string} word - Word to speak (e.g., "Alpha", "Berlin")
     * @returns {Promise<void>}
     */
    async speak(word) {
        if (!this.initialized) {
            throw new Error('PiperTTS not initialized');
        }

        const path = this._getAudioPath(word);
        if (!path) {
            console.error(`[PiperTTS] No audio file for word: ${word}`);
            return;
        }

        try {
            console.log(`[PiperTTS] Speaking: "${word}" (${path})`);

            const audioBuffer = await this._loadAudio(path);

            // Play the audio
            await new Promise((resolve, reject) => {
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.audioContext.destination);
                source.onended = resolve;
                source.onerror = reject;
                source.start(0);
            });

            console.log('[PiperTTS] Speech completed');
        } catch (error) {
            console.error('[PiperTTS] Speech failed:', error);
            throw error;
        }
    }

    /**
     * Stop any ongoing speech
     */
    stop() {
        // Web Audio API doesn't have a global stop - individual sources are fire-and-forget
        // For now, just log
        console.log('[PiperTTS] Stop requested');
    }

    /**
     * Set language for TTS
     * @param {string} language - Language code ('en' or 'de')
     */
    async setLanguage(language) {
        if (this.language !== language) {
            this.language = language;
            console.log(`[PiperTTS] Language changed to: ${language}`);
        }
    }

    /**
     * Get available voices (for API compatibility)
     * @returns {Array} List of available voices
     */
    getVoices() {
        return [
            { name: 'Thorsten (German)', lang: 'de-DE' },
            { name: 'Amy (English)', lang: 'en-US' }
        ];
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        this.audioCache.clear();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.initialized = false;
        console.log('[PiperTTS] Destroyed');
    }
}

// Export singleton instance (API compatible with old espeakTTS)
export const espeakTTS = new PiperTTS();

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
