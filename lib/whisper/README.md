# Whisper.cpp WASM Integration

## Downloaded Files

- `main.js` (1.5MB) - Whisper WASM module with embedded WASM binary
- `helpers.js` (6.4KB) - Helper functions for loading models and audio processing
- `coi-serviceworker.js` (5.9KB) - Service worker for CORS/COEP headers
- `ggml-tiny-q5_1.bin` (31MB) - Whisper Tiny model, multilingual, quantized

## Integration Steps

### 1. Load the WASM Module

Add to HTML:
```html
<script src="lib/whisper/coi-serviceworker.js"></script>
<script src="lib/whisper/helpers.js"></script>
<script src="lib/whisper/main.js"></script>
```

### 2. Initialize Module

```javascript
var Module = {
    print: console.log,
    printErr: console.error,
    setStatus: function(text) { console.log('Whisper:', text); }
};
```

### 3. Load Model into WASM Filesystem

```javascript
// Load model from local file or IndexedDB
const modelUrl = './lib/whisper/ggml-tiny-q5_1.bin';
const modelData = await fetch(modelUrl).then(r => r.arrayBuffer());
const modelBuffer = new Uint8Array(modelData);

// Store in WASM filesystem
Module.FS_createDataFile("/", "whisper.bin", modelBuffer, true, true);
```

### 4. Initialize Whisper Instance

```javascript
const instance = Module.init('whisper.bin');
```

### 5. Transcribe Audio

```javascript
// audio = Float32Array of PCM samples at 16kHz, mono
// language = 'en' or 'de'
// threads = number of threads (default: 8)
// translate = false for transcription, true for translation

const result = Module.full_default(instance, audio, language, threads, false);
console.log('Transcription:', result);
```

## Audio Processing

Whisper expects:
- **Sample Rate**: 16kHz
- **Channels**: Mono (1 channel)
- **Format**: Float32Array of PCM samples
- **Range**: -1.0 to 1.0

Convert browser audio:
```javascript
const audioContext = new AudioContext({ sampleRate: 16000 });
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const samples = audioBuffer.getChannelData(0); // Float32Array
```

## Current Status

- ✅ Files downloaded
- ⏳ Integration pending - requires:
  - Loading main.js in HTML
  - Initializing Module properly
  - Handling CORS/COEP headers with service worker
  - Converting AudioProcessor output to Whisper format
  - Managing WASM filesystem

## References

- Official demo: https://ggml.ai/whisper.cpp/
- GitHub repo: https://github.com/ggml-org/whisper.cpp
- WASM example: https://github.com/ggml-org/whisper.cpp/tree/master/examples/whisper.wasm
