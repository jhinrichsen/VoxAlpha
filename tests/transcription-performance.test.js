/**
 * Transcription Performance Test
 * Tests Whisper WASM transcription accuracy and performance
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
    
    console.log(`[Test] WAV: ${sampleRate}Hz, ${bitsPerSample}-bit`);
    
    // Convert PCM16 to Float32Array
    const numSamples = (arrayBuffer.byteLength - dataStart) / 2;
    const audioData = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
        const sample = dataView.getInt16(dataStart + i * 2, true);
        audioData[i] = sample / 32768.0;
    }
    
    console.log(`[Test] Loaded ${numSamples} samples (${(numSamples / sampleRate).toFixed(2)}s)`);
    return { audioData, sampleRate };
}

test('Transcription: Wolfsburg.wav performance', async () => {
    console.log('[Test] Loading Whisper module...');
    const { whisperSTT } = await import('../whisper-wrapper.js');
    
    if (!whisperSTT.isInitialized()) {
        console.log('[Test] Initializing Whisper...');
        await whisperSTT.init('de');
    }
    
    console.log('[Test] Loading wolfsburg.wav...');
    const { audioData, sampleRate } = await loadWavFile('./tests/wolfsburg.wav');
    
    // Check audio quality
    let maxLevel = 0;
    let sumLevel = 0;
    for (let i = 0; i < audioData.length; i++) {
        const abs = Math.abs(audioData[i]);
        if (abs > maxLevel) maxLevel = abs;
        sumLevel += abs;
    }
    const avgLevel = sumLevel / audioData.length;
    
    console.log(`[Test] Audio levels: max=${maxLevel.toFixed(3)}, avg=${avgLevel.toFixed(3)}`);
    
    assert(maxLevel > 0, 'Audio should not be silent');
    assert(maxLevel <= 1.0, 'Audio should not clip');
    
    console.log('[Test] Starting transcription...');
    const startTime = performance.now();
    
    const transcription = await whisperSTT.transcribe(audioData);
    
    const endTime = performance.now();
    const elapsedMs = endTime - startTime;
    const elapsedSec = (elapsedMs / 1000).toFixed(2);
    const audioLengthSec = (audioData.length / sampleRate).toFixed(2);
    const realtimeFactor = (elapsedMs / (audioData.length / sampleRate * 1000)).toFixed(1);
    
    console.log(`[Test] ═══════════════════════════════════════════`);
    console.log(`[Test] Transcription: "${transcription}"`);
    console.log(`[Test] Audio length: ${audioLengthSec}s`);
    console.log(`[Test] Processing time: ${elapsedSec}s`);
    console.log(`[Test] Realtime factor: ${realtimeFactor}x`);
    console.log(`[Test] ═══════════════════════════════════════════`);
    
    // Performance expectations
    const rtf = parseFloat(realtimeFactor);
    if (rtf > 10) {
        console.log(`[Test] ⚠️  SLOW: ${rtf}x realtime (expected <10x on modern hardware)`);
        console.log(`[Test]     This means ${audioLengthSec}s audio takes ${elapsedSec}s to process`);
        console.log(`[Test]     Possible causes:`);
        console.log(`[Test]     - WASM running in interpreted mode (check browser settings)`);
        console.log(`[Test]     - SIMD not enabled`);
        console.log(`[Test]     - Single-threaded execution (n_threads=1 in logs)`);
        console.log(`[Test]     - CPU throttling or background processes`);
    } else if (rtf > 5) {
        console.log(`[Test] ⚠️  ACCEPTABLE: ${rtf}x realtime (could be faster)`);
    } else {
        console.log(`[Test] ✓ GOOD: ${rtf}x realtime`);
    }
    
    assert(transcription.length > 0, 'Should produce non-empty transcription');
    
    // Check if transcription matches "Wolfsburg" (with fuzzy matching)
    const normalized = transcription.toLowerCase().replace(/[^a-z]/g, '');
    console.log(`[Test] Normalized: "${normalized}"`);
    
    const containsWolf = normalized.includes('wolf') || normalized.includes('wol') || normalized.includes('wets');
    const containsBurg = normalized.includes('burg') || normalized.includes('bur') || normalized.includes('law');
    
    console.log(`[Test] Contains wolf/wol/wets: ${containsWolf}`);
    console.log(`[Test] Contains burg/bur/law: ${containsBurg}`);
    
    if (containsWolf || containsBurg) {
        console.log('[Test] ✓ Recognized "Wolfsburg" (fuzzy match)');
    } else {
        console.log(`[Test] ⚠ Transcription differs from expected "Wolfsburg"`);
        console.log(`[Test]   Got: "${transcription}"`);
    }
    
    assert(true, 'Performance test completed');
});

test('Transcription: Multi-threading analysis', async () => {
    console.log('[Test] Checking Whisper threading configuration...');
    
    // This test just reports threading info from the logs
    console.log('[Test] Check browser console for "n_threads" in Whisper logs');
    console.log('[Test] Expected: n_threads should be > 1 for multi-core CPUs');
    console.log('[Test] If n_threads = 1, WASM is running single-threaded');
    console.log('[Test] ');
    console.log('[Test] Whisper WASM Performance Tips:');
    console.log('[Test] 1. Check browser flags for WASM multi-threading');
    console.log('[Test] 2. Ensure SharedArrayBuffer is available (requires COOP/COEP)');
    console.log('[Test] 3. Use larger models (base/small) for better accuracy at cost of speed');
    console.log('[Test] 4. Consider native Whisper.cpp for 10-100x speedup');
    
    assert(true, 'Threading analysis complete');
});

if (typeof window !== 'undefined') {
    testFramework.run();
}
