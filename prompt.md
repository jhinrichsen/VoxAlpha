# Project Prompt: VoxAlpha – Offline Speech Spelling Trainer

## Objective

Create a fully offline, installable web application named **VoxAlpha** that enables users to train and evaluate spelling proficiency using spoken and typed input. The app must be compact, efficient, and function entirely offline as a Progressive Web App (PWA), with no dependencies or external services.

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
- All assets must run in-browser

### Speech-to-Text (STT): whisper.cpp (WASM)
- Use ggml-base.en.bin or similar minimal model
- Compile to WebAssembly
- Models must be stored and loaded via IndexedDB or localStorage
- Model quality is intentionally minimal to simulate real-world conditions:
  - Low-end microphones
  - Background noise
  - Speech distortion

### Text-to-Speech (TTS): espeak-ng (WASM)
- Run entirely offline in-browser
- Preload phoneme data and voice files

### Alphabet Logic
- Hardcode language-to-alphabet mapping:
  - "de" → DIN 5009
  - "en" → NATO
- Alphabets stored as JSON or TS files
- Normalize input/output (e.g., "Oscar" ≈ "Oskar")

### Storage
- Use IndexedDB or localStorage to:
  - Cache STT/TTS model files
  - Persist language selection
  - Optionally log evaluation history

## UI Requirements

- Minimal interface:
  - One language toggle
  - One alphabet display area
- No routing or complex components
- Fully responsive layout using plain CSS
- Use prefers-color-scheme (Media Queries Level 5)
- manifest.json must define dark/light icons using the "media" attribute

## Framework Policy

- Strongly prefer plain HTML, JavaScript, and CSS
- Do not use frameworks, bundlers, or package managers unless essential
- If a framework is selected, provide written justification explaining:
  - What technical problem it solves
  - Why that benefit outweighs the added complexity and dependency surface

## Testing

- Unit tests:
  - Mapping letters to spelling words (DIN and NATO)
  - Word-to-sequence expansion logic

- Integration tests:
  - Simulated STT results (mocked input)
  - TTS output triggers
  - Language-switch state retention

- Testing libraries must be minimal and browser-compatible

## Deliverables

- index.html
- script.js
- style.css
- manifest.json (with light/dark icon declarations using media queries)
- service-worker.js
- data/alphabets.json or alphabets.ts
- lib/whisper-wrapper.js
- lib/tts-wrapper.js
- storage.js (IndexedDB/localStorage abstraction)
- README.md with setup, install, and usage instructions
