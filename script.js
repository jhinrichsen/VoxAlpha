/**
 * VoxAlpha - Main Application Logic
 * Offline Speech Spelling Trainer
 */

import { storage } from './storage.js';
import { whisperSTT, AudioProcessor } from './whisper-wrapper.js';
import { espeakTTS } from './tts-wrapper.js';

class VoxAlpha {
    constructor() {
        this.currentLanguage = 'en';
        this.currentMode = 'input';
        this.alphabets = null;
        this.audioProcessor = null;
        this.isRecording = false;
        this.currentChallenge = null;
        this.recordTimeoutId = null;
        this.germanCities = [];

        // DOM elements
        this.elements = {};
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize DOM elements FIRST
            this.initDOM();

            this.updateStatus('Initializing...');

            // Initialize storage
            await storage.init();
            console.log('[VoxAlpha] Storage initialized');

            // Load saved language preference
            this.currentLanguage = await storage.getLanguage();

            // Load alphabet data
            await this.loadAlphabets();

            // Load German cities list
            await this.loadGermanCities();

            // Initialize STT and TTS
            await this.initSTT();
            await this.initTTS();

            // Initialize microphone (VoxAlpha is all about voice!)
            await this.initMicrophone();

            // Set up event listeners
            this.setupEventListeners();

            // Render initial state
            this.renderAlphabetGrid();
            this.updateLanguageUI();

            // Register service worker and set up update detection
            if ('serviceWorker' in navigator) {
                this.registerServiceWorker();
            }

            this.updateStatus('Ready');
            console.log('[VoxAlpha] Application initialized');
        } catch (error) {
            console.error('[VoxAlpha] Initialization failed:', error);
            this.updateStatus('Error: ' + error.message, 'error');
        }
    }

    /**
     * Initialize DOM elements
     */
    initDOM() {
        this.elements = {
            // Language toggle
            langDE: document.getElementById('lang-de'),
            langEN: document.getElementById('lang-en'),

            // Mode toggle
            modeInput: document.getElementById('mode-input'),
            modeOutput: document.getElementById('mode-output'),

            // Input mode elements
            inputMode: document.getElementById('input-mode'),
            inputModeLabel: document.getElementById('input-mode-label'),
            alphabetGrid: document.getElementById('alphabet-grid'),
            spelledOutput: document.getElementById('spelled-output'),

            // Output mode elements
            outputMode: document.getElementById('output-mode'),
            currentLetter: document.getElementById('current-letter'),
            expectedWord: document.getElementById('expected-word'),
            recordBtn: document.getElementById('record-btn'),
            transcription: document.getElementById('transcription'),

            // Status elements
            status: document.getElementById('status'),
            sttStatus: document.getElementById('stt-status'),
            ttsStatus: document.getElementById('tts-status'),
            alphabetStandard: document.getElementById('alphabet-standard'),

            // Update notification
            updateBanner: document.getElementById('update-banner'),
            updateBtn: document.getElementById('update-btn'),
            dismissUpdateBtn: document.getElementById('dismiss-update-btn')
        };
    }

    /**
     * Load alphabet data from JSON file
     */
    async loadAlphabets() {
        try {
            const response = await fetch('./data/alphabets.json');
            this.alphabets = await response.json();
            console.log('[VoxAlpha] Alphabets loaded');
        } catch (error) {
            console.error('[VoxAlpha] Failed to load alphabets:', error);
            throw new Error('Failed to load alphabet data');
        }
    }

    /**
     * Load German cities list for fuzzy matching
     */
    async loadGermanCities() {
        try {
            const response = await fetch('./german-cities.txt');
            const text = await response.text();
            this.germanCities = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            console.log(`[VoxAlpha] Loaded ${this.germanCities.length} German cities`);
        } catch (error) {
            console.error('[VoxAlpha] Failed to load German cities:', error);
            this.germanCities = [];
        }
    }

    /**
     * Initialize Speech-to-Text
     */
    async initSTT() {
        try {
            this.updateModelStatus('stt', 'loading');
            this.updateStatus('Loading speech recognition model (this may take a minute)...');
            await whisperSTT.init(this.currentLanguage);
            this.updateModelStatus('stt', 'loaded');
        } catch (error) {
            console.error('[VoxAlpha] STT initialization failed:', error);
            this.updateModelStatus('stt', 'error');
            throw error;
        }
    }

    /**
     * Initialize Text-to-Speech
     */
    async initTTS() {
        try {
            this.updateModelStatus('tts', 'loading');
            await espeakTTS.init(this.currentLanguage);
            this.updateModelStatus('tts', 'loaded');
        } catch (error) {
            console.error('[VoxAlpha] TTS initialization failed:', error);
            this.updateModelStatus('tts', 'error');
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Language toggle
        this.elements.langDE.addEventListener('click', () => {
            console.log('[VoxAlpha] DE button clicked');
            this.setLanguage('de');
        });
        this.elements.langEN.addEventListener('click', () => {
            console.log('[VoxAlpha] EN button clicked');
            this.setLanguage('en');
        });

        // Mode toggle
        this.elements.modeInput.addEventListener('click', () => this.setMode('input'));
        this.elements.modeOutput.addEventListener('click', () => this.setMode('output'));

        // Output mode
        this.elements.recordBtn.addEventListener('mousedown', () => this.startRecording());
        this.elements.recordBtn.addEventListener('mouseup', () => this.stopRecording());
        this.elements.recordBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        this.elements.recordBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });

        // Initialize first challenge
        this.nextChallenge();
    }

    /**
     * Set current language
     */
    async setLanguage(lang) {
        console.log(`[VoxAlpha] setLanguage called with: ${lang}, current: ${this.currentLanguage}`);

        if (this.currentLanguage === lang) {
            console.log(`[VoxAlpha] Language already set to ${lang}, skipping`);
            return;
        }

        this.currentLanguage = lang;
        await storage.saveLanguage(lang);

        // Update UI
        this.updateLanguageUI();
        this.renderAlphabetGrid();

        // Update STT and TTS
        await whisperSTT.setLanguage(lang);
        await espeakTTS.setLanguage(lang);

        // Generate new challenge if in output mode
        if (this.currentMode === 'output') {
            this.nextChallenge();
        }

        console.log(`[VoxAlpha] Language changed to: ${lang}`);
    }

    /**
     * Update language UI
     */
    updateLanguageUI() {
        this.elements.langDE.classList.toggle('active', this.currentLanguage === 'de');
        this.elements.langEN.classList.toggle('active', this.currentLanguage === 'en');

        // Update alphabet standard display and input mode label
        if (this.currentLanguage === 'de') {
            this.elements.alphabetStandard.textContent = 'DIN 5009:2022-06';
            this.elements.inputModeLabel.textContent = 'Click letters to hear the city names:';
        } else {
            this.elements.alphabetStandard.textContent = 'NATO phonetic alphabet';
            this.elements.inputModeLabel.textContent = 'Click letters to hear the code words:';
        }
    }

    /**
     * Set current mode
     */
    setMode(mode) {
        if (this.currentMode === mode) return;

        this.currentMode = mode;

        // Update UI
        this.elements.modeInput.classList.toggle('active', mode === 'input');
        this.elements.modeOutput.classList.toggle('active', mode === 'output');
        this.elements.inputMode.classList.toggle('active', mode === 'input');
        this.elements.outputMode.classList.toggle('active', mode === 'output');

        // Clear input/output
        if (mode === 'input') {
            this.elements.spelledOutput.textContent = '';
        } else {
            this.nextChallenge();
        }

        console.log(`[VoxAlpha] Mode changed to: ${mode}`);
    }

    /**
     * Initialize microphone for recording
     */
    async initMicrophone() {
        if (this.audioProcessor) {
            console.log('[VoxAlpha] Microphone already initialized');
            return;
        }

        try {
            this.updateStatus('Requesting microphone access...');
            this.audioProcessor = new AudioProcessor();
            await this.audioProcessor.init();
            this.updateStatus('Ready');
            console.log('[VoxAlpha] Microphone initialized');
        } catch (error) {
            console.error('[VoxAlpha] Failed to initialize microphone:', error);
            this.updateStatus('Microphone error: ' + error.message, 'error');
            // Show error in the UI
            this.elements.transcription.textContent = 'Microphone error: ' + error.message;
        }
    }

    /**
     * Render alphabet grid for input mode
     */
    renderAlphabetGrid() {
        const alphabet = this.alphabets[this.currentLanguage].alphabet;
        this.elements.alphabetGrid.innerHTML = '';

        for (const [letter, word] of Object.entries(alphabet)) {
            const btn = document.createElement('button');
            btn.className = 'letter-btn';
            btn.textContent = letter;
            btn.addEventListener('click', () => this.speakLetter(letter, word));
            this.elements.alphabetGrid.appendChild(btn);
        }
    }

    /**
     * Speak a letter (input mode)
     */
    async speakLetter(letter, word) {
        try {
            await espeakTTS.speak(word);

            // Append to spelled output
            const current = this.elements.spelledOutput.textContent;
            this.elements.spelledOutput.textContent = current
                ? `${current} - ${word}`
                : word;
        } catch (error) {
            console.error('[VoxAlpha] Failed to speak letter:', error);
        }
    }

    /**
     * Generate next challenge for output mode
     */
    nextChallenge() {
        const alphabet = this.alphabets[this.currentLanguage].alphabet;
        const letters = Object.keys(alphabet);
        const randomLetter = letters[Math.floor(Math.random() * letters.length)];

        this.currentChallenge = {
            letter: randomLetter,
            word: alphabet[randomLetter]
        };

        this.elements.currentLetter.textContent = randomLetter;
        this.elements.expectedWord.textContent = alphabet[randomLetter];
        this.elements.expectedWord.style.visibility = 'hidden'; // Hide the answer

        // Show help message (language-aware)
        const helpText = this.currentLanguage === 'de'
            ? 'Hold the button and speak the city name'
            : 'Hold the button and speak the code word';
        this.elements.transcription.textContent = helpText;
        this.elements.transcription.className = 'transcription help';
        
        console.log(`[VoxAlpha] New challenge: ${randomLetter} (${alphabet[randomLetter]})`);
    }


    /**
     * Start recording audio
     */
    async startRecording() {
        if (this.isRecording) return;

        // Check if microphone is initialized
        if (!this.audioProcessor) {
            this.elements.transcription.textContent = 'Microphone not initialized. Please switch modes to retry.';
            return;
        }

        try {
            this.isRecording = true;
            this.elements.recordBtn.classList.add('recording');
            this.elements.transcription.textContent = 'Recording...';
            this.elements.transcription.className = 'transcription recording';

            // Start collecting audio samples
            this.audioProcessor.startRecording();
            this.startRecordingProgress();

            console.log('[VoxAlpha] Recording started');
        } catch (error) {
            console.error('[VoxAlpha] Failed to start recording:', error);
            this.elements.transcription.textContent = 'Error: ' + error.message;
            this.isRecording = false;
            this.elements.recordBtn.classList.remove('recording');
            this.clearRecordingTimeout();
            this.resetRecordingProgress();
        }
    }

    /**
     * Stop recording and process audio
     */
    async stopRecording(dueToTimeout = false) {
        if (!this.isRecording) return;

        this.isRecording = false;
        this.clearRecordingTimeout();
        this.resetRecordingProgress();
        this.elements.recordBtn.classList.remove('recording');
        this.elements.transcription.innerHTML = '<div class="spinner"></div><span>Processing...</span>';
        this.elements.transcription.className = 'transcription processing';

        if (dueToTimeout) {
            console.log('[VoxAlpha] Recording stopped automatically after timeout');
        }

        try {
            // Stop recording and get audio data
            const audioData = await this.audioProcessor.stopRecording();

            if (!audioData || audioData.length === 0) {
                this.elements.transcription.textContent = '(no audio recorded)';
                return;
            }

            // Transcribe
            const transcription = await whisperSTT.transcribe(audioData);
            
            // Clear processing spinner
            this.elements.transcription.textContent = '';

            // Check answer
            this.checkAnswer(transcription);

        } catch (error) {
            console.error('[VoxAlpha] Recording/transcription failed:', error);
            this.elements.transcription.textContent = 'Error: ' + error.message;
        }
    }

    /**
     * Start recording timeout (10 seconds max)
     */
    startRecordingProgress() {
        this.clearRecordingTimeout();

        this.recordTimeoutId = setTimeout(() => {
            if (this.isRecording) {
                this.stopRecording(true);
            }
        }, 10000);
    }

    /**
     * No-op (progress bar removed)
     */
    resetRecordingProgress() {
        // Progress bar removed - nothing to reset
    }

    /**
     * Clear any pending recording timeout
     */
    clearRecordingTimeout() {
        if (this.recordTimeoutId) {
            clearTimeout(this.recordTimeoutId);
            this.recordTimeoutId = null;
        }
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,    // deletion
                        dp[i][j - 1] + 1,    // insertion
                        dp[i - 1][j - 1] + 1 // substitution
                    );
                }
            }
        }

        return dp[m][n];
    }

    /**
     * Check if the transcribed answer matches the expected word
     */
    checkAnswer(transcription) {
        // Show the expected answer after they respond
        this.elements.expectedWord.style.visibility = 'visible';

        if (!transcription || !this.currentChallenge) {
            this.elements.transcription.textContent = 'No answer detected';
            this.elements.transcription.className = 'transcription error';
            setTimeout(() => this.nextChallenge(), 2000);
            return;
        }

        const normalized = this.normalizeText(transcription);
        const expected = this.normalizeText(this.currentChallenge.word);

        // Special handling for Umlaut entries (Ä, Ö, Ü) which are not real cities
        const isUmlautEntry = this.currentChallenge.word.includes('Umlaut');
        
        // If German language and cities list is loaded (and not an umlaut entry), use multi-candidate matching
        if (this.currentLanguage === 'de' && this.germanCities.length > 0 && !isUmlautEntry) {
            this.checkAnswerWithCities(normalized, expected);
        } else {
            // Fallback to single-word matching for non-city entries (Umlaut, Eszett, etc.)
            this.checkAnswerSingle(normalized, expected);
        }
    }

    /**
     * Check answer using city list (multi-candidate matching)
     */
    checkAnswerWithCities(normalized, expected) {
        let bestMatches = [];
        let bestSimilarity = 0;
        
        // Get expected starting letter from challenge (normalized to handle umlauts)
        const expectedLetter = this.normalizeText(this.currentChallenge.letter);
        
        // Filter cities by starting letter for context-aware matching
        const candidateCities = this.germanCities.filter(city => {
            const firstLetter = this.normalizeText(city.charAt(0));
            return firstLetter === expectedLetter;
        });
        
        console.log(`[VoxAlpha] Context filter: ${candidateCities.length} cities start with '${this.currentChallenge.letter}' (normalized: '${expectedLetter}')`);

        // Find all best matching cities from filtered list
        const citiesToSearch = candidateCities.length > 0 ? candidateCities : this.germanCities;
        
        for (const city of citiesToSearch) {
            const normalizedCity = this.normalizeText(city);
            const distance = this.levenshteinDistance(normalized, normalizedCity);
            const maxLength = Math.max(normalized.length, normalizedCity.length);
            let similarity = 1 - (distance / maxLength);
            
            // Prefer shorter words (e.g., "Köln" over "Kronach" for "Krön")
            // Penalty for length difference - helps avoid matching longer cities
            const lengthDiff = Math.abs(normalized.length - normalizedCity.length);
            const lengthPenalty = lengthDiff * 0.05; // 5% penalty per character difference
            similarity -= lengthPenalty;
            
            // Cap similarity at 1.0 (100%)
            similarity = Math.min(1.0, similarity);

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatches = [city];
            } else if (similarity === bestSimilarity) {
                bestMatches.push(city);
            }
        }

        // If expected city is among the best matches, use it (breaks tie fairly)
        const bestMatch = bestMatches.includes(this.currentChallenge.word)
            ? this.currentChallenge.word
            : bestMatches[0];

        console.log(`[VoxAlpha] Best match: "${bestMatch}" (${(bestSimilarity * 100).toFixed(1)}%), expected: "${this.currentChallenge.word}"`);
        
        // Show top 3 alternatives for debugging
        const top3 = [];
        for (const city of citiesToSearch) {
            const normalizedCity = this.normalizeText(city);
            const distance = this.levenshteinDistance(normalized, normalizedCity);
            const maxLength = Math.max(normalized.length, normalizedCity.length);
            let similarity = 1 - (distance / maxLength);
            
            // Apply same penalty as above
            const lengthDiff = Math.abs(normalized.length - normalizedCity.length);
            similarity -= lengthDiff * 0.05;
            
            // Cap similarity at 1.0 (100%)
            similarity = Math.min(1.0, similarity);
            
            top3.push({ city, similarity });
        }
        top3.sort((a, b) => b.similarity - a.similarity);
        console.log(`[VoxAlpha] Top 3: ${top3.slice(0, 3).map(x => `${x.city} (${(x.similarity * 100).toFixed(1)}%)`).join(', ')}`);

        // Accept if best match is the expected city
        const isCorrect = this.normalizeText(bestMatch) === expected;

        if (isCorrect) {
            this.elements.transcription.textContent = `✓ Correct! "${bestMatch}"`;
            this.elements.transcription.className = 'transcription correct';
            setTimeout(() => this.nextChallenge(), 2000);
        } else {
            this.elements.transcription.textContent = `You said: "${bestMatch}". Expected: ${this.currentChallenge.word}`;
            this.elements.transcription.className = 'transcription incorrect';
            setTimeout(() => this.nextChallenge(), 3000);
        }
    }

    /**
     * Check answer against single expected word (fallback)
     */
    checkAnswerSingle(normalized, expected) {
        const distance = this.levenshteinDistance(normalized, expected);
        const maxLength = Math.max(normalized.length, expected.length);
        const similarity = 1 - (distance / maxLength);
        const threshold = 0.7;
        const isCorrect = similarity >= threshold;

        console.log(`[VoxAlpha] Match: "${normalized}" vs "${expected}" - distance=${distance}, similarity=${(similarity * 100).toFixed(1)}%, threshold=${(threshold * 100)}%`);

        if (isCorrect) {
            this.elements.transcription.textContent = `✓ Correct!`;
            this.elements.transcription.className = 'transcription correct';
            setTimeout(() => this.nextChallenge(), 1500);
        } else {
            this.elements.transcription.textContent = `✗ Wrong! Expected: ${this.currentChallenge.word}`;
            this.elements.transcription.className = 'transcription incorrect';
            setTimeout(() => this.nextChallenge(), 3000);
        }
    }

    /**
     * Normalize text for comparison
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/ä/g, 'a')
            .replace(/ö/g, 'o')
            .replace(/ü/g, 'u')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]/g, '');
    }

    /**
     * Update status message
     */
    updateStatus(message, type = 'normal') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
    }

    /**
     * Update model status indicator
     */
    updateModelStatus(model, status) {
        const element = model === 'stt' ? this.elements.sttStatus : this.elements.ttsStatus;
        const prefix = model === 'stt' ? 'STT' : 'TTS';

        const messages = {
            loading: `${prefix}: Loading...`,
            loaded: `${prefix}: Ready`,
            error: `${prefix}: Error`
        };

        element.textContent = messages[status] || `${prefix}: ${status}`;
        element.className = `model-indicator ${status}`;
    }

    /**
     * Register service worker and set up update detection
     */
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js');
            console.log('[VoxAlpha] Service Worker registered', registration);

            // Check for updates every time the page loads
            registration.update();

            // Listen for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[VoxAlpha] Service Worker update found');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker installed, show update notification
                        console.log('[VoxAlpha] New version available');
                        this.showUpdateNotification(registration);
                    }
                });
            });

            // Also check if there's a waiting service worker
            if (registration.waiting) {
                this.showUpdateNotification(registration);
            }

            // Listen for controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[VoxAlpha] Service Worker updated, reloading...');
                window.location.reload();
            });

        } catch (err) {
            console.error('[VoxAlpha] Service Worker registration failed', err);
        }
    }

    /**
     * Show update notification banner
     */
    showUpdateNotification(registration) {
        // Show the banner
        this.elements.updateBanner.classList.remove('hidden');

        // Update Now button
        this.elements.updateBtn.onclick = () => {
            console.log('[VoxAlpha] User accepted update');

            // Tell the waiting service worker to skip waiting and activate
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // Hide banner (page will reload automatically)
            this.elements.updateBanner.classList.add('hidden');
        };

        // Dismiss button
        this.elements.dismissUpdateBtn.onclick = () => {
            console.log('[VoxAlpha] User dismissed update notification');
            this.elements.updateBanner.classList.add('hidden');
        };
    }
}

// Initialize app when DOM is ready
console.log('[VoxAlpha] Script loaded, document.readyState:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[VoxAlpha] DOM ready, creating app instance');
        try {
            const app = new VoxAlpha();
            app.init();
        } catch (error) {
            console.error('[VoxAlpha] Failed to create/init app:', error);
        }
    });
} else {
    console.log('[VoxAlpha] DOM already ready, creating app instance');
    try {
        const app = new VoxAlpha();
        app.init();
    } catch (error) {
        console.error('[VoxAlpha] Failed to create/init app:', error);
    }
}
