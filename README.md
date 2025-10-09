# VoxAlpha

**Offline Speech Spelling Trainer** for DIN 5009 (German) and NATO/ICAO (English) alphabets.

VoxAlpha is a fully offline, installable web application that helps you learn and practice spelling alphabets using speech recognition and text-to-speech technology. All processing happens in your browser—no internet connection required after initial load.

## Features

- **Two Spelling Alphabets**
  - German: DIN 5009:2022 (Aachen, Bremen, Chemnitz... - German cities)
  - English: NATO/ICAO (Alpha, Bravo, Charlie...)

- **Two Training Modes**
  - **Type & Listen**: Type or click letters to hear their spelling alphabet
  - **Listen & Speak**: See a letter and speak its code word (speech recognition)

- **Fully Offline**
  - Works without internet after first visit
  - Speech-to-text via whisper.cpp (WASM)
  - Text-to-speech via eSpeak-ng (WASM)
  - All data cached locally

- **Progressive Web App**
  - Install to home screen
  - Dark/light theme based on system preference
  - Responsive design for mobile and desktop

## Quick Start

### Prerequisites

- A modern web browser (Chrome/Edge recommended)
- A local HTTP server (required for PWA and offline features)

### Running Locally

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd VoxAlpha
   ```

2. **Start a local HTTP server**

   Using Python 3:
   ```bash
   python -m http.server 8080
   ```

   Using Node.js (http-server):
   ```bash
   npx http-server -p 8080
   ```

   Using PHP:
   ```bash
   php -S localhost:8080
   ```

   Using BusyBox:
   ```bash
   busybox httpd -f -p 8080
   ```

3. **Open in browser**
   ```
   http://localhost:8080
   ```

4. **Grant microphone access** when prompted (required for Listen & Speak mode)

### Using the App

#### Type & Listen Mode
1. Toggle language (DE/EN) in the top-right corner
2. Type letters in the text field, or click letter buttons
3. Hear the corresponding spelling alphabet words
4. Learn how each letter is spelled in the phonetic alphabet

#### Listen & Speak Mode
1. See a random letter displayed with its code word
2. Hold the microphone button and speak the code word
3. Receive instant feedback (correct/incorrect)
4. Click "Next" or auto-advance on correct answer
5. Practice until you master the alphabet!

## Project Structure

```
VoxAlpha/
├── index.html              # Main app page
├── style.css              # Responsive styles with dark/light theme
├── script.js              # Core app logic
├── storage.js             # IndexedDB wrapper
├── manifest.json          # PWA manifest
├── service-worker.js      # Offline caching
├── data/
│   └── alphabets.json     # DIN 5009 & NATO/ICAO mappings
├── lib/
│   ├── whisper-wrapper.js # STT integration (placeholder)
│   └── tts-wrapper.js     # TTS integration (placeholder)
└── tests/
    ├── index.html         # Test runner page
    ├── test-framework.js  # Minimal test framework
    ├── alphabet.test.js   # Unit tests
    └── integration.test.js # Integration tests
```

## Running Tests

1. Start the local HTTP server
2. Navigate to `http://localhost:8080/tests/`
3. Click "Run All Tests" to execute the test suite

Tests include:
- Alphabet data validation
- Text spelling logic
- Answer normalization and matching
- Storage persistence
- STT/TTS integration

## Technology Stack

- **Plain HTML/CSS/JavaScript** (no frameworks)
- **IndexedDB** for local storage
- **Service Worker** for offline capability
- **Web Audio API** for audio processing
- **whisper.cpp** (WASM) for speech-to-text *(integration pending)*
- **eSpeak-ng** (WASM) for text-to-speech *(integration pending)*

## Development Status

### Completed ✅
- Project structure and core files
- Alphabet data (DIN 5009 & NATO/ICAO)
- Responsive UI with dark/light theme
- IndexedDB storage layer
- STT/TTS wrapper interfaces
- Core app logic and both modes
- PWA manifest
- Service worker for offline caching
- Unit and integration tests

### Pending WASM Integration ⚠️
- **whisper.cpp WASM**: Currently using placeholder. Real STT requires:
  - Compiled whisper.cpp WASM module
  - GGML model files (ggml-base.en.bin, etc.)
  - Integration with AudioProcessor

- **eSpeak-ng WASM**: Currently uses Web Speech API fallback. Real TTS requires:
  - Compiled eSpeak-ng WASM module
  - Voice data files for de/en
  - AudioPlayer integration

## Browser Support

**Recommended:**
- Chrome 90+
- Edge 90+

**Minimum requirements:**
- ES6 modules support
- IndexedDB
- Web Audio API
- Service Workers
- MediaDevices API (for microphone access)

## Offline Functionality

VoxAlpha uses a Service Worker to cache all resources after the first visit:

1. **First visit**: Downloads and caches all files
2. **Subsequent visits**: Loads from cache (instant, offline-capable)
3. **Updates**: Service Worker updates in background

### Cached Resources
- HTML, CSS, JavaScript files
- Alphabet data
- STT/TTS WASM modules *(when integrated)*
- Model files *(when integrated)*

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `http://localhost:8080/tests/`
5. Submit a pull request

## WASM Integration Guide

To integrate real WASM modules:

### For whisper.cpp:
1. Build whisper.cpp for WebAssembly
2. Place WASM files in `lib/whisper/`
3. Update `lib/whisper-wrapper.js` with actual WASM loading
4. Load GGML models via IndexedDB

### For eSpeak-ng:
1. Build eSpeak-ng for WebAssembly
2. Place WASM files in `lib/espeak/`
3. Update `lib/tts-wrapper.js` with actual synthesis
4. Load voice data files via IndexedDB

## Known Issues

### Whisper.cpp WASM Integration (Critical Issue)

**Status**: The downloaded Whisper.cpp WASM binary (`lib/whisper/main.js` and `ggml-tiny-q5_1.bin`) aborts during transcription with `RuntimeError: Aborted()`.

**What Works**:
- ✅ Whisper model downloads and caches (31MB)
- ✅ Whisper instance initializes successfully
- ✅ Audio recording via MediaRecorder API
- ✅ Audio resampling to 16kHz mono
- ✅ Audio levels are correct (`-0.569` to `0.354` range)

**What Fails**:
- ❌ `Module.full_default()` call aborts immediately
- ❌ No transcription output despite correct audio input

**Root Cause**: The pre-built WASM binary from ggml.ai may have been compiled without proper browser compatibility flags, or requires specific runtime conditions not met in our environment.

**Workarounds**:
1. **Manual Input**: Use the text field to type answers (currently functional)
2. **Web Speech API**: Only works in Chrome/Edge (not Firefox by default)

**Potential Fixes** (Requires Development):
1. **Rebuild Whisper WASM** with proper Emscripten flags:
   ```bash
   emcc -sASSERTIONS=1 -sALLOW_MEMORY_GROWTH=1 -sEXPORTED_FUNCTIONS=...
   ```
2. **Use Alternative STT**: Switch to Vosk-WASM or transformers.js
3. **Server-side STT**: Add optional backend transcription service

**For Developers**: The Whisper initialization code is in `lib/whisper-wrapper.js:145-195`. Audio capture works perfectly (see logs), but the WASM module aborts during `Module.full_default()` execution.

### Other Limitations

- TTS falls back to Web Speech API (not fully offline, but functional)
- No icons included (manifest references placeholder paths)
- No screenshots included
- Manual input required for speech recognition (Whisper WASM blocked)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [DIN 5009:2022 Standard](https://www.din.de/en/getting-involved/standards-committees/nia/din-5009-2022-11)
- [NATO Phonetic Alphabet](https://en.wikipedia.org/wiki/NATO_phonetic_alphabet)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [eSpeak-ng](https://github.com/espeak-ng/espeak-ng)
