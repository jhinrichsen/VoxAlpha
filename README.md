# VoxAlpha

**Offline Speech Spelling Trainer** for DIN 5009 (German) and NATO/ICAO (English) alphabets.

VoxAlpha is a fully offline Progressive Web App that helps you learn and practice spelling alphabets using speech recognition and text-to-speech. All processing happens in your browser.

## Features

- **Two Spelling Alphabets**
  - German: DIN 5009:2022 (Aachen, Bremen, Chemnitz...)
  - English: NATO/ICAO (Alpha, Bravo, Charlie...)

- **Two Training Modes**
  - **Type & Listen**: Type letters to hear their spelling alphabet
  - **Listen & Speak**: Speak the code word for displayed letters

- **Fully Offline**
  - Speech-to-text via whisper.cpp (WASM)
  - All data cached locally
  - Works without internet after first visit

- **Progressive Web App**
  - Installable to home screen
  - Dark/light theme
  - Responsive design

## Quick Start

### Running Locally

```bash
# Clone and enter directory
git clone https://github.com/jhinrichsen/VoxAlpha.git
cd VoxAlpha

# Download Whisper model (required, 253MB)
make download-model

# Build and run
make build
./voxalpha
```

Open http://localhost:8081 in your browser.

Grant microphone access when prompted (required for Listen & Speak mode).

### Using Go Run

```bash
make download-model
go run .
```

### Model Selection

By default, the tiny model is embedded. For better accuracy, use the small model:

```bash
./voxalpha --model dist/ggml-small-q8_0.bin
```

See [MODEL_COMPARISON.md](MODEL_COMPARISON.md) for model details.

## Deployment

### Self-hosted (Go Binary)

```bash
# Download model
make download-model

# Build binary
make build

# Deploy voxalpha binary
# Model must be available via --model flag or in dist/
```

The `voxalpha` binary embeds all web assets from `dist/`.

### Cloudflare Pages

```bash
# Install Wrangler CLI (once)
npm install -g wrangler

# Login to Cloudflare (once)
wrangler login

# Download model and deploy
make download-model
wrangler pages deploy dist --project-name=voxalpha
```

**Note:** The `dist/_headers` file is Cloudflare Pages-specific and sets required CORS headers (COOP/COEP) for whisper.cpp WASM support. Other hosting platforms may require different configuration.

## Technology

- Plain HTML/CSS/JavaScript (no frameworks)
- Go web server with embedded assets
- IndexedDB for local storage
- Service Worker for offline capability
- whisper.cpp (WASM) for speech recognition
- PWA installable on all platforms

## License

GPL-3.0 - see [LICENSE](LICENSE) and [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md)

## Links

- [DIN 5009:2022](https://www.din.de/en/getting-involved/standards-committees/nia/din-5009-2022-11)
- [NATO Phonetic Alphabet](https://en.wikipedia.org/wiki/NATO_phonetic_alphabet)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
