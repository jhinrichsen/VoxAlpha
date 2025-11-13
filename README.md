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

## Version

**Current Version:** v1.0.0 (Initial Release)

VoxAlpha uses [Semantic Versioning](https://semver.org/).

**Release Management:**
- **Single source of truth:** Git tags control versioning
- **Quick release:** `git tag v0.2.1 && make release` - See [RELEASE.md](RELEASE.md)
- **Update System:** [UPDATES.md](UPDATES.md)

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

### Deployment

To build and deploy VoxAlpha:

1. **Download Whisper model** (required for speech recognition):
   ```bash
   make download-model
   ```
   This downloads the `ggml-small-q8_0.bin` model (253MB) to `dist/`.

   **Note:** The Whisper model is required but not included in the repository due to its size. It must be downloaded separately before deployment.

2. **Build the binary**:
   ```bash
   make build
   ```

3. **Deploy** the `voxalpha` binary to your server

The application embeds all assets from `dist/` except the Whisper model, which should be provided via the `--model` flag or placed in `dist/`.

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

## PWA Checklist

VoxAlpha is a fully compliant Progressive Web App (PWA). Here's what makes it installable:

### ✅ Core Requirements
Based on [Web.dev PWA Checklist](https://web.dev/pwa-checklist/) and [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable):

- **Web App Manifest** (`manifest.json`)
  - ✅ `name` and `short_name` defined
  - ✅ `icons` array with at least 192x192 and 512x512 PNG icons
  - ✅ `start_url` specified
  - ✅ `display: "standalone"` for app-like experience
  - ✅ `theme_color` and `background_color` set
  - ✅ `description` for app stores
  - ✅ `screenshots` for enhanced install prompts (wide: 1280x720, narrow: 540x720)

- **Service Worker** (`service-worker.js`)
  - ✅ Registered in main application script (`script.js:64`)
  - ✅ Caches essential resources for offline use
  - ✅ Implements cache-first strategy for static assets
  - ✅ Serves cached content when offline
  - ✅ Handles cache versioning and cleanup

- **Icons** (`icons/` directory)
  - ✅ 8 icon sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
  - ✅ PNG format for broad compatibility
  - ✅ Maskable icons for adaptive icon support
  - ✅ Generated from vector source (`favicon.svg`)

- **HTTPS / Secure Context**
  - ✅ Service Worker requires HTTPS (or localhost for development)
  - ✅ COOP/COEP headers set for SharedArrayBuffer support (`main.go:66-67`)
  - ✅ Cross-Origin isolation for WASM threading

- **Responsive Design**
  - ✅ Viewport meta tag configured
  - ✅ Mobile-friendly UI (works at 540px width)
  - ✅ Touch-friendly controls

### 📸 Screenshots

Screenshots are automatically generated using the chromedp-based tool in `tools/screenshot/`:

```bash
cd tools/screenshot
APP_URL=http://localhost:8081 ./screenshot
```

This creates:
- `screenshots/screenshot-wide.png` (1280x720) - Desktop/tablet view
- `screenshots/screenshot-narrow.png` (540x720) - Mobile view

The tool automatically handles the Whisper model download dialog.

### 🔧 Testing PWA Installation

1. **Start the server:**
   ```bash
   ./voxalpha
   # or
   go run main.go
   ```

2. **Open in Chrome/Edge:**
   Navigate to `http://localhost:8081`

3. **Install the PWA:**
   - Look for install icon (⊕) in address bar
   - Click and select "Install"
   - App opens as standalone window

4. **Verify offline functionality:**
   - Install the app
   - Stop the server
   - Reopen the app - it should still work!

### 📚 References

- [PWA Checklist - web.dev](https://web.dev/pwa-checklist/)
- [Making PWAs installable - MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Web App Manifest - W3C](https://www.w3.org/TR/appmanifest/)
- [Service Worker API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## Browser Support

### Recommended for Full PWA Experience:
- **Chrome 90+** - Full PWA support with native install prompt
- **Edge 90+** - Full PWA support with native install prompt

### Firefox Support:
- **Firefox Desktop** - ⚠️ Limited PWA installation support
  - All features work (offline, service worker, manifest)
  - No native "Install" button in Firefox
  - **Workarounds:**
    - Use the "[PWAs for Firefox](https://addons.mozilla.org/en-US/firefox/addon/pwas-for-firefox/)" extension
    - On Windows: Enable experimental flag `browser.taskbarTabs.enabled` in `about:config` (Firefox 143+)
    - Or simply use as a regular website (full functionality, just not installed)
- **Firefox Android** - ✅ Full PWA support with installation

### Minimum Requirements (All Browsers):
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
- Manual input required for speech recognition (Whisper WASM blocked)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [DIN 5009:2022 Standard](https://www.din.de/en/getting-involved/standards-committees/nia/din-5009-2022-11)
- [NATO Phonetic Alphabet](https://en.wikipedia.org/wiki/NATO_phonetic_alphabet)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [eSpeak-ng](https://github.com/espeak-ng/espeak-ng)
