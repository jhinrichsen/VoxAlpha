/**
 * Unit tests for alphabet mapping and word-to-spelling logic
 */

import { describe, it, expect, beforeAll } from './test-framework.js';

let alphabets;

beforeAll(async () => {
    // Load alphabet data
    const response = await fetch('../data/alphabets.json');
    alphabets = await response.json();
});

describe('Alphabet Data', () => {
    it('should load alphabet data', () => {
        expect(alphabets).toBeDefined();
        expect(alphabets).toHaveProperty('en');
        expect(alphabets).toHaveProperty('de');
    });

    it('should have correct NATO/ICAO alphabet', () => {
        const nato = alphabets.en.alphabet;
        expect(nato['A']).toBe('Alpha');
        expect(nato['B']).toBe('Bravo');
        expect(nato['C']).toBe('Charlie');
        expect(nato['Z']).toBe('Zulu');
    });

    it('should have correct DIN 5009 alphabet', () => {
        const din = alphabets.de.alphabet;
        expect(din['A']).toBe('Aachen');
        expect(din['B']).toBe('Bremen');
        expect(din['Ä']).toBe('Umlaut Aachen');
        expect(din['Z']).toBe('Zerbst');
    });

    it('should have 26 letters in English alphabet', () => {
        const nato = alphabets.en.alphabet;
        expect(Object.keys(nato).length).toBe(26);
    });

    it('should have all special German characters', () => {
        const din = alphabets.de.alphabet;
        expect(din).toHaveProperty('Ä');
        expect(din).toHaveProperty('Ö');
        expect(din).toHaveProperty('Ü');
        expect(din).toHaveProperty('ß');
    });
});

describe('Text Spelling Logic', () => {
    function spellText(text, language) {
        const alphabet = alphabets[language].alphabet;
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

    it('should spell single letter in English', () => {
        const result = spellText('A', 'en');
        expect(result).toBe('Alpha');
    });

    it('should spell word in English', () => {
        const result = spellText('ABC', 'en');
        expect(result).toBe('Alpha - Bravo - Charlie');
    });

    it('should spell single letter in German', () => {
        const result = spellText('A', 'de');
        expect(result).toBe('Aachen');
    });

    it('should spell word in German', () => {
        const result = spellText('ABC', 'de');
        expect(result).toBe('Aachen - Bremen - Chemnitz');
    });

    it('should handle spaces', () => {
        const result = spellText('A B', 'en');
        expect(result).toBe('Alpha - (space) - Bravo');
    });

    it('should handle lowercase input', () => {
        const result = spellText('abc', 'en');
        expect(result).toBe('Alpha - Bravo - Charlie');
    });

    it('should handle German umlauts', () => {
        const result = spellText('ÄÖÜ', 'de');
        expect(result).toBe('Umlaut Aachen - Umlaut Oldenburg - Umlaut Unna');
    });

    it('should handle unknown characters', () => {
        const result = spellText('A1B', 'en');
        expect(result).toBe('Alpha - 1 - Bravo');
    });
});

describe('Text Normalization', () => {
    function normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9äöüß]/g, '');
    }

    it('should normalize text to lowercase', () => {
        expect(normalizeText('ALPHA')).toBe('alpha');
    });

    it('should remove whitespace', () => {
        expect(normalizeText('  alpha  ')).toBe('alpha');
    });

    it('should remove special characters', () => {
        expect(normalizeText('alpha!')).toBe('alpha');
        expect(normalizeText('alpha-bravo')).toBe('alphabravo');
    });

    it('should preserve German characters', () => {
        expect(normalizeText('AACHEN')).toBe('aachen');
        expect(normalizeText('GRÖßE')).toBe('größe');
    });

    it('should handle mixed input', () => {
        expect(normalizeText('  Alpha 123!  ')).toBe('alpha123');
    });
});

describe('Answer Matching', () => {
    function normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9äöüß]/g, '');
    }

    function checkAnswer(transcription, expected) {
        const normalized = normalizeText(transcription);
        const expectedNorm = normalizeText(expected);
        return normalized.includes(expectedNorm) || expectedNorm.includes(normalized);
    }

    it('should match exact answer', () => {
        expect(checkAnswer('Alpha', 'Alpha')).toBe(true);
    });

    it('should match case-insensitive', () => {
        expect(checkAnswer('alpha', 'Alpha')).toBe(true);
        expect(checkAnswer('ALPHA', 'Alpha')).toBe(true);
    });

    it('should match with extra whitespace', () => {
        expect(checkAnswer('  Alpha  ', 'Alpha')).toBe(true);
    });

    it('should match substring', () => {
        expect(checkAnswer('I said Alpha', 'Alpha')).toBe(true);
    });

    it('should reject incorrect answer', () => {
        expect(checkAnswer('Bravo', 'Alpha')).toBe(false);
    });

    it('should handle German words', () => {
        expect(checkAnswer('aachen', 'Aachen')).toBe(true);
        expect(checkAnswer('BREMEN', 'Bremen')).toBe(true);
    });

    it('should handle partial matches', () => {
        expect(checkAnswer('Alph', 'Alpha')).toBe(true);
        expect(checkAnswer('Alpha', 'Alph')).toBe(true);
    });
});
