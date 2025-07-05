# Project Prompt: VoxAlpha – Offline Speech Spelling Trainer

## Objective

Create a fully offline, installable web application named **VoxAlpha** that enables users to train and evaluate spelling proficiency using spoken and typed input. The app must function entirely in the browser, require no internet access at runtime, and be deployable as a static site via local or remote HTTP/HTTPS.

## Features and Modes

### 1. Language Toggle (de / en)
- User toggles between "de" and "en"
- This controls all behavior:
  - "de" → DIN 5009:2022 (German city names), STT/TTS in German
  - "en" → NATO/ICAO alphabet, STT/TTS in English

### 2. Input to Output
- User types or clicks a letter or word
- VoxAlpha speaks the corresponding spelling (per selected language)

### 3. Output to Input
- VoxAlpha displays a character or word
- User must pronounce the correct term(s) from the current alphabet
- Speech input is transcribed via STT and matched against expected output
- Feedback is given visually and/or audibly

## Technical Requirements

### Offline-Only Operation
- No Web Speech API
- No online inference or resources
- Must function fully offline once loaded
- App must be served via HTTP/HTTPS (not file://)
- Must work in local environments using `http-server`, `python -m http.server`, or similar

### Speech-to-Text (STT): whisper.cpp (WASM)
- Use `ggml-base.en.bin` or similar minimal model
- Compile to WebAssembly
- Models must be loaded via IndexedDB or localStorage
- Simulate poor recording conditions through use of minimal Whisper models

### Text-to-Speech (TTS): espeak-ng (WASM)
- Run entirely offline in-browser
- Load phoneme data and voice models locally

### Alphabet Logic
- Language-to-alphabet mapping must be hardcoded:
  - "de" → DIN 5009
  - "en" → NATO/ICAO
- Normalize input and match tolerantly (e.g. "Oscar" ≈ "Oskar")

### Storage
- Use IndexedDB or localStorage to:
  - Cache STT and TTS models
  - Persist language selection
  - Optionally store practice history or results

## UI Requirements

- Minimal interface:
  - One language toggle
  - One area to display the current alphabet
- Responsive layout using plain CSS
- Respect `prefers-color-scheme` for dark/light theme
- Use `manifest.json` with `media`-keyed icons for theme support

## Framework Policy

- Prefer plain HTML, JavaScript, and CSS
- Do not use frameworks, build systems, or package managers unless clearly justified
- If a framework is selected, provide explicit justification in terms of technical necessity and minimal overhead

## Testing

- Unit tests for:
  - Alphabet mapping
  - Word-to-spelling expansion logic

- Integration tests for:
  - Simulated STT transcription inputs
  - TTS triggering and playback
  - Persistence of language state

## Deliverables

- `index.html`
- `script.js`
- `style.css`
- `manifest.json` with dark/light icon declarations
- `service-worker.js`
- `data/alphabets.json`
- `lib/whisper-wrapper.js`
- `lib/tts-wrapper.js`
- `storage.js`
- `README.md` with:
  - Setup instructions for running over HTTP (e.g. using `http-server`)
  - Instructions for offline use and caching behavior
  - Supported browsers and minimum requirements

## Definition of Done (DoD)

- [ ] App loads and functions offline after initial visit
- [ ] No errors in console when offline
- [ ] Language toggle switches between German and English alphabets
- [ ] STT and TTS work without internet connection
- [ ] Models are cached in IndexedDB/localStorage
- [ ] Basic error handling for microphone access
- [ ] Dark/light theme responds to system preferences
- [ ] All core features work in latest Chrome
- [ ] No external network requests after initial load
- [ ] Basic visual feedback for user actions
