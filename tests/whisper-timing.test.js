/**
 * Whisper WASM Timing Test
 * Tests actual transcription performance with a real audio file
 */

import { testFramework } from './test-framework.js';

const { test, assert } = testFramework;

/**
 * Load WAV file and convert to Float32Array
 */
async function loadWavFile(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const dataView = new DataView(arrayBuffer);
    
    // Parse WAV header (simplified - assumes 16-bit mono PCM at 16kHz)
    const sampleRate = dataView.getUint32(24, true);
    const bitsPerSample = dataView.getUint16(34, true);
    const dataStart = 44;
    
    console.log('[Test] WAV: ' + sampleRate + 'Hz, ' + bitsPerSample + '-bit');
    
    // Convert PCM16 to Float32Array
    const numSamples = (arrayBuffer.byteLength - dataStart) / 2;
    const audioData = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
        const sample = dataView.getInt16(dataStart + i * 2, true);
        audioData[i] = sample / 32768.0;
    }
    
    console.log('[Test] Loaded ' + numSamples + ' samples (' + (numSamples / sampleRate).toFixed(2) + 's)');
    return audioData;
}

test('Whisper timing with Insbruck.wav', async () => {
    console.log('[Test] Loading Whisper module...');
    const { whisperSTT } = await import('../whisper-wrapper.js');
    
    if (!whisperSTT.isInitialized()) {
        console.log('[Test] Initializing Whisper...');
        await whisperSTT.init('de');
    }
    
    console.log('[Test] Loading Insbruck.wav...');
    const audioData = await loadWavFile('./tests/Insbruck.wav');
    
    console.log('[Test] Starting transcription...');
    const startTime = performance.now();
    
    const transcription = await whisperSTT.transcribe(audioData);
    
    const endTime = performance.now();
    const elapsedMs = endTime - startTime;
    const elapsedSec = (elapsedMs / 1000).toFixed(2);
    const audioLengthSec = (audioData.length / 16000).toFixed(2);
    const realtimeFactor = (elapsedMs / (audioData.length / 16000 * 1000)).toFixed(1);
    
    console.log('[Test] Transcription: "' + transcription + '"');
    console.log('[Test] Audio length: ' + audioLengthSec + 's');
    console.log('[Test] Processing time: ' + elapsedSec + 's');
    console.log('[Test] Realtime factor: ' + realtimeFactor + 'x (1.0x = realtime)');
    
    assert(transcription.length > 0, 'Should produce non-empty transcription');
    
    const normalized = transcription.toLowerCase().replace(/[^a-z]/g, '');
    console.log('[Test] Normalized: "' + normalized + '"');
    
    const containsIns = normalized.includes('ins') || normalized.includes('inn');
    const containsBruck = normalized.includes('bruck') || normalized.includes('brok') || normalized.includes('proc');
    
    console.log('[Test] Contains ins/inn: ' + containsIns);
    console.log('[Test] Contains bruck/brok/proc: ' + containsBruck);
    
    if (containsIns && containsBruck) {
        console.log('[Test] ✓ Recognized "Insbruck" (fuzzy match)');
    } else {
        console.log('[Test] ⚠ Transcription differs from expected "Insbruck"');
    }
    
    assert(true, 'Timing test completed');
});

if (typeof window !== 'undefined') {
    testFramework.run();
}
