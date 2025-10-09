/**
 * VoxAlpha - Main Application Logic
 * Offline Speech Spelling Trainer
 */

import { storage } from './storage.js';
import { whisperSTT, AudioProcessor } from './lib/whisper-wrapper.js';
import { espeakTTS } from './lib/tts-wrapper.js';

class VoxAlpha {
    constructor() {
        this.currentLanguage = 'en';
        this.currentMode = 'input';
        this.alphabets = null;
        this.audioProcessor = null;
        this.isRecording = false;
        this.currentChallenge = null;

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

            // Register service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(reg => console.log('[VoxAlpha] Service Worker registered', reg))
                    .catch(err => console.error('[VoxAlpha] Service Worker registration failed', err));
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
            textInput: document.getElementById('text-input'),
            alphabetGrid: document.getElementById('alphabet-grid'),
            spelledOutput: document.getElementById('spelled-output'),

            // Output mode elements
            outputMode: document.getElementById('output-mode'),
            currentLetter: document.getElementById('current-letter'),
            expectedWord: document.getElementById('expected-word'),
            recordBtn: document.getElementById('record-btn'),
            manualAnswer: document.getElementById('manual-answer'),
            checkBtn: document.getElementById('check-btn'),
            transcription: document.getElementById('transcription'),
            feedback: document.getElementById('feedback'),
            nextBtn: document.getElementById('next-btn'),

            // Status elements
            status: document.getElementById('status'),
            sttStatus: document.getElementById('stt-status'),
            ttsStatus: document.getElementById('tts-status')
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
     * Initialize Speech-to-Text
     */
    async initSTT() {
        try {
            this.updateModelStatus('stt', 'loading');
            await whisperSTT.init(this.currentLanguage);
            this.updateModelStatus('stt', 'loaded');
        } catch (error) {
            console.error('[VoxAlpha] STT initialization failed:', error);
            this.updateModelStatus('stt', 'error');
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

        // Input mode
        this.elements.textInput.addEventListener('input', (e) => this.handleTextInput(e));

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
        this.elements.nextBtn.addEventListener('click', () => this.nextChallenge());

        // Manual answer input
        this.elements.checkBtn.addEventListener('click', () => this.checkManualAnswer());
        this.elements.manualAnswer.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkManualAnswer();
            }
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
            this.elements.textInput.value = '';
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
            btn.title = word;
            btn.addEventListener('click', () => this.speakLetter(letter, word));
            this.elements.alphabetGrid.appendChild(btn);
        }
    }

    /**
     * Handle text input in input mode
     */
    async handleTextInput(event) {
        const text = event.target.value.toUpperCase();
        if (!text) {
            this.elements.spelledOutput.textContent = '';
            return;
        }

        const spelled = this.spellText(text);
        this.elements.spelledOutput.textContent = spelled;

        // Speak the last character
        const lastChar = text[text.length - 1];
        const alphabet = this.alphabets[this.currentLanguage].alphabet;
        if (alphabet[lastChar]) {
            await espeakTTS.speak(alphabet[lastChar]);
        }
    }

    /**
     * Spell text using current alphabet
     */
    spellText(text) {
        const alphabet = this.alphabets[this.currentLanguage].alphabet;
        const words = [];

        for (const char of text.toUpperCase()) {
            if (alphabet[char]) {
                words.push(alphabet[char]);
            } else if (char === ' ') {
                words.push('(space)');
            } else {
                words.push(char);
            }
        }

        return words.join(' - ');
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

            // Append to text input
            this.elements.textInput.value += letter;
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
        this.elements.expectedWord.style.display = 'none'; // Hide the answer
        this.elements.transcription.textContent = '';
        this.elements.feedback.textContent = '';
        this.elements.feedback.className = 'feedback';
        this.elements.manualAnswer.value = ''; // Clear manual input

        console.log(`[VoxAlpha] New challenge: ${randomLetter} (${alphabet[randomLetter]})`);
    }

    /**
     * Check manually typed answer
     */
    checkManualAnswer() {
        const answer = this.elements.manualAnswer.value.trim();
        if (!answer) {
            this.elements.feedback.textContent = 'Please type an answer first';
            this.elements.feedback.className = 'feedback';
            return;
        }

        this.elements.transcription.textContent = `You typed: ${answer}`;
        this.checkAnswer(answer);
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
            this.elements.feedback.textContent = '';
            this.elements.feedback.className = 'feedback';

            this.isRecording = true;
            this.elements.recordBtn.classList.add('recording');
            this.elements.transcription.textContent = 'Recording...';

            // Start collecting audio samples
            this.audioProcessor.startRecording();

            console.log('[VoxAlpha] Recording started');
        } catch (error) {
            console.error('[VoxAlpha] Failed to start recording:', error);
            this.elements.transcription.textContent = 'Error: ' + error.message;
            this.isRecording = false;
            this.elements.recordBtn.classList.remove('recording');
        }
    }

    /**
     * Stop recording and process audio
     */
    async stopRecording() {
        if (!this.isRecording) return;

        try {
            this.elements.recordBtn.classList.remove('recording');
            this.elements.transcription.textContent = 'Processing...';

            // Stop recording and get audio data
            const audioData = await this.audioProcessor.stopRecording();

            if (!audioData || audioData.length === 0) {
                this.elements.transcription.textContent = '(no audio recorded)';
                return;
            }

            // Transcribe
            const transcription = await whisperSTT.transcribe(audioData);
            this.elements.transcription.textContent = transcription || '(no speech detected)';

            // Check answer
            this.checkAnswer(transcription);

        } catch (error) {
            console.error('[VoxAlpha] Recording/transcription failed:', error);
            this.elements.transcription.textContent = 'Error: ' + error.message;
        } finally {
            this.isRecording = false;
        }
    }

    /**
     * Check if the transcribed answer matches the expected word
     */
    checkAnswer(transcription) {
        // Show the expected answer after they respond
        this.elements.expectedWord.style.display = 'block';

        if (!transcription || !this.currentChallenge) {
            this.elements.feedback.textContent = 'No answer detected';
            this.elements.feedback.className = 'feedback incorrect';
            return;
        }

        // Normalize both strings for comparison
        const normalized = this.normalizeText(transcription);
        const expected = this.normalizeText(this.currentChallenge.word);

        const isCorrect = normalized.includes(expected) || expected.includes(normalized);

        if (isCorrect) {
            this.elements.feedback.textContent = '✓ Correct!';
            this.elements.feedback.className = 'feedback correct';

            // Auto-advance after 1.5 seconds
            setTimeout(() => this.nextChallenge(), 1500);
        } else {
            this.elements.feedback.textContent = `✗ Wrong! It was: ${this.currentChallenge.word}`;
            this.elements.feedback.className = 'feedback incorrect';
        }
    }

    /**
     * Normalize text for comparison
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9äöüß]/g, '');
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
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new VoxAlpha();
        app.init();
    });
} else {
    const app = new VoxAlpha();
    app.init();
}
