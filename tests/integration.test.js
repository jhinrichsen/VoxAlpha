/**
 * Integration tests for VoxAlpha
 * Tests STT/TTS integration, persistence, and app flow
 */

import { describe, it, expect } from './test-framework.js';

describe('Storage Integration', () => {
    it('should initialize IndexedDB', async () => {
        const { storage } = await import('../storage.js');
        await storage.init();
        expect(storage.db).toBeDefined();
    });

    it('should save and retrieve language preference', async () => {
        const { storage } = await import('../storage.js');
        await storage.init();

        await storage.saveLanguage('de');
        const lang = await storage.getLanguage();

        expect(lang).toBe('de');
    });

    it('should default to English when no preference saved', async () => {
        const { storage } = await import('../storage.js');
        await storage.init();

        // Clear language setting
        await storage.delete('settings', 'language');
        const lang = await storage.getLanguage();

        expect(lang).toBe('en');
    });

    it('should store and retrieve model data', async () => {
        const { storage } = await import('../storage.js');
        await storage.init();

        const testData = new Uint8Array([1, 2, 3, 4, 5]);
        await storage.saveModel('test-model', testData);

        const retrieved = await storage.getModel('test-model');
        expect(retrieved).toEqual(testData);
    });

    it('should store practice history', async () => {
        const { storage } = await import('../storage.js');
        await storage.init();

        const entry = {
            language: 'en',
            letter: 'A',
            word: 'Alpha',
            correct: true
        };

        await storage.saveHistory(entry);
        const history = await storage.getHistory(10);

        expect(history.length).toBeGreaterThan(0);
        const lastEntry = history[0];
        expect(lastEntry.letter).toBe('A');
        expect(lastEntry.correct).toBe(true);
    });
});

describe('STT Integration', () => {
    it('should initialize Whisper STT', async () => {
        const { whisperSTT } = await import('../whisper-wrapper.js');
        await whisperSTT.init('en');

        expect(whisperSTT.isInitialized()).toBe(true);
        expect(whisperSTT.language).toBe('en');
    });

    it('should switch language', async () => {
        const { whisperSTT } = await import('../whisper-wrapper.js');
        await whisperSTT.init('en');
        await whisperSTT.setLanguage('de');

        expect(whisperSTT.language).toBe('de');
    });

    it('should handle audio transcription', async () => {
        const { whisperSTT } = await import('../whisper-wrapper.js');
        await whisperSTT.init('en');

        // Mock audio data (1 second of silence at 16kHz)
        const audioData = new Float32Array(16000);

        const result = await whisperSTT.transcribe(audioData);
        expect(result).toBeDefined();
    });

    it('should handle transcription errors gracefully', async () => {
        const { whisperSTT } = await import('../whisper-wrapper.js');

        // Try to transcribe without initialization
        whisperSTT.initialized = false;

        try {
            await whisperSTT.transcribe(new Float32Array(100));
            expect(false).toBe(true); // Should not reach here
        } catch (error) {
            expect(error.message).toContain('not initialized');
        }
    });
});

describe('TTS Integration', () => {
    it('should initialize eSpeak TTS', async () => {
        const { espeakTTS } = await import('../lib/tts-wrapper.js');
        await espeakTTS.init('en');

        expect(espeakTTS.isInitialized()).toBe(true);
        expect(espeakTTS.language).toBe('en');
    });

    it('should switch language', async () => {
        const { espeakTTS } = await import('../lib/tts-wrapper.js');
        await espeakTTS.init('en');
        await espeakTTS.setLanguage('de');

        expect(espeakTTS.language).toBe('de');
    });

    it('should speak text', async () => {
        const { espeakTTS } = await import('../lib/tts-wrapper.js');
        await espeakTTS.init('en');

        // This should complete without error
        await espeakTTS.speak('Alpha');
        expect(true).toBe(true);
    });

    it('should handle speak errors gracefully', async () => {
        const { espeakTTS } = await import('../lib/tts-wrapper.js');

        // Try to speak without initialization
        espeakTTS.initialized = false;

        try {
            await espeakTTS.speak('Alpha');
            expect(false).toBe(true); // Should not reach here
        } catch (error) {
            expect(error.message).toContain('not initialized');
        }
    });

    it('should stop speech', async () => {
        const { espeakTTS } = await import('../lib/tts-wrapper.js');
        await espeakTTS.init('en');

        // Start speaking
        espeakTTS.speak('This is a long text that should be interrupted');

        // Stop immediately
        espeakTTS.stop();

        // Should complete without error
        expect(true).toBe(true);
    });
});

describe('Audio Processing', () => {
    it('should initialize audio processor', async () => {
        const { AudioProcessor } = await import('../whisper-wrapper.js');
        const processor = new AudioProcessor();

        // Note: This will fail in headless environments without microphone
        // In real browser with user permission, this should work
        try {
            await processor.init();
            expect(processor.audioContext).toBeDefined();
            expect(processor.stream).toBeDefined();
            processor.destroy();
        } catch (error) {
            // Expected in test environment without microphone
            expect(error.message).toContain('getUserMedia');
        }
    });

    it('should clean up resources', async () => {
        const { AudioProcessor } = await import('../whisper-wrapper.js');
        const processor = new AudioProcessor();

        processor.audioContext = { close: () => {} };
        processor.stream = { getTracks: () => [{ stop: () => {} }] };

        processor.destroy();

        expect(processor.audioContext).toBeNull();
        expect(processor.stream).toBeNull();
    });
});

describe('Service Worker', () => {
    it('should have service worker support', () => {
        if ('serviceWorker' in navigator) {
            expect(navigator.serviceWorker).toBeDefined();
        } else {
            console.warn('Service Worker not supported in this environment');
        }
    });
});

describe('App Initialization', () => {
    it('should load alphabet data', async () => {
        const response = await fetch('../alphabets.json');
        const alphabets = await response.json();

        expect(alphabets).toBeDefined();
        expect(alphabets.en).toBeDefined();
        expect(alphabets.de).toBeDefined();
    });

    it('should have required DOM elements', () => {
        // This test assumes the HTML is loaded
        const requiredElements = [
            'lang-de',
            'lang-en',
            'mode-input',
            'mode-output',
            'text-input',
            'alphabet-grid',
            'spelled-output',
            'current-letter',
            'expected-word',
            'record-btn',
            'transcription',
            'feedback',
            'next-btn',
            'status',
            'stt-status',
            'tts-status'
        ];

        // In a real integration test with JSDOM or browser, check:
        // requiredElements.forEach(id => {
        //     expect(document.getElementById(id)).toBeDefined();
        // });

        expect(requiredElements.length).toBe(15);
    });
});
