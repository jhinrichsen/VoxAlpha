GO ?= CGO_ENABLED=0 go
BINARY ?= dist/voxalpha
# Always strip leading 'v' from git tag (v1.2.3 -> 1.2.3, v1.2.3-5-gabc123 -> 1.2.3-5-gabc123)
VERSION ?= $(shell git describe --tags 2>/dev/null | sed 's/^v//' || echo "dev")
LDFLAGS = -X main.version=$(VERSION)
DISTFLAGS = -trimpath -ldflags "-s -w $(LDFLAGS)"

# PWA source files (explicit list for file-based targets)
PWA_FILES = \
	.htaccess \
	alphabets.json \
	analyze-match.js \
	clear-cache.html \
	favicon.svg \
	german-cities.txt \
	index.html \
	manifest.json \
	robots.txt \
	script.js \
	style.css \
	tts-wrapper.js \
	version.js \
	voxalpha.html \
	whisper-api.html \
	whisper-wrapper.js

PWA_LIB = $(wildcard lib/whisper/*)
PWA_ICONS = $(wildcard icons/*.png)
PWA_SCREENSHOTS = $(wildcard screenshots/*.png)
PWA_AUDIO_DE = $(wildcard audio/de/*.wav)
PWA_AUDIO_EN = $(wildcard audio/en/*.wav)

# Generate target paths in dist/pwa/
PWA_TARGETS = \
	$(addprefix dist/pwa/,$(PWA_FILES)) \
	$(addprefix dist/pwa/,$(PWA_LIB)) \
	$(addprefix dist/pwa/,$(PWA_ICONS)) \
	$(addprefix dist/pwa/,$(PWA_SCREENSHOTS)) \
	$(addprefix dist/pwa/,$(PWA_AUDIO_DE)) \
	$(addprefix dist/pwa/,$(PWA_AUDIO_EN)) \
	dist/pwa/service-worker.js

.PHONY: all
all: pwa build test ## Build PWA, binary, and run tests

.PHONY: clean
clean: ## Remove build artifacts
	rm -f $(BINARY)
	rm -rf dist/

.PHONY: pwa
pwa: $(PWA_TARGETS) ## Build PWA with file-based targets
	echo "✓ PWA built in dist/pwa/ (version: $(VERSION))"

# Pattern rules for simple file copies (install -D creates dirs, -m 644 = rw-r--r--)
dist/pwa/%.html: %.html
	install -D -m 644 $< $@

dist/pwa/%.js: %.js
	install -D -m 644 $< $@

dist/pwa/%.css: %.css
	install -D -m 644 $< $@

dist/pwa/%.json: %.json
	install -D -m 644 $< $@

dist/pwa/%.txt: %.txt
	install -D -m 644 $< $@

dist/pwa/%.svg: %.svg
	install -D -m 644 $< $@

dist/pwa/.htaccess: .htaccess
	install -D -m 644 $< $@

# Pattern rules for subdirectories
dist/pwa/lib/%: lib/%
	install -D -m 644 $< $@

dist/pwa/icons/%.png: icons/%.png
	install -D -m 644 $< $@

dist/pwa/screenshots/%.png: screenshots/%.png
	install -D -m 644 $< $@

dist/pwa/audio/de/%.wav: audio/de/%.wav
	install -D -m 644 $< $@

dist/pwa/audio/en/%.wav: audio/en/%.wav
	install -D -m 644 $< $@

# Version tracking - regenerate .version when git tag changes
.version: FORCE
	@echo "$(VERSION)" | cmp -s - $@ || echo "$(VERSION)" > $@

.PHONY: FORCE
FORCE:

# Special rules for version injection (depend on .version to rebuild when tag changes)
dist/pwa/service-worker.js: service-worker.js .version
	mkdir -p $(@D)
	sed "s/__VERSION__/$(VERSION)/g" $< > $@

dist/pwa/voxalpha.html: voxalpha.html .version
	mkdir -p $(@D)
	sed "s/__VERSION__/$(VERSION)/g" $< > $@

.PHONY: build
build: $(BINARY) ## Build Go binary

# Binary depends on PWA files and model (Go embed doesn't track file changes)
$(BINARY): $(PWA_TARGETS) $(MODEL_FILE)
	mkdir -p $(dir $(BINARY))
	$(GO) build -ldflags "-X 'main.version=$(VERSION)'" -o $(BINARY) .

.PHONY: run
run: build ## Start dev server (requires build first)
	./$(BINARY)

.PHONY: test
test: pwa ## Run tests (requires PWA build first)
	$(GO) test -v ./tests/

# Model management (cache survives 'make clean')
MODEL_NAME = ggml-small-q8_0.bin
MODEL_URL = https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$(MODEL_NAME)
MODEL_CACHE = .cache/$(MODEL_NAME)
MODEL_FILE = dist/$(MODEL_NAME)

# Download to cache (only if not already cached)
$(MODEL_CACHE):
	@echo "Downloading Whisper small model (253MB)..."
	@mkdir -p .cache
	@curl -L -o $@ $(MODEL_URL)
	@echo "✓ Model cached in .cache/"

# Copy from cache to dist
$(MODEL_FILE): $(MODEL_CACHE)
	@mkdir -p dist
	@cp $< $@
	@echo "✓ Model ready in dist/"

.PHONY: download-model
download-model: $(MODEL_FILE) ## Download Whisper model (cached)

.PHONY: clean-model
clean-model: ## Remove model from dist (cache preserved)
	rm -f $(MODEL_FILE)

.PHONY: purge-model
purge-model: clean-model ## Remove model completely (including cache)
	rm -f $(MODEL_CACHE)

# Cross-platform builds
.PHONY: dist
dist: pwa
	mkdir -p dist/$$GOOS/$$GOARCH
	$(GO) build $(DISTFLAGS) -o dist/$$GOOS/$$GOARCH/ .

.PHONY: dists
dists: clean pwa ## Build for all platforms
	GOOS=linux GOARCH=amd64 $(MAKE) dist
	GOOS=linux GOARCH=arm64 $(MAKE) dist
	GOOS=linux GOARCH=386 $(MAKE) dist
	GOOS=linux GOARCH=arm $(MAKE) dist
	GOOS=darwin GOARCH=amd64 $(MAKE) dist
	GOOS=darwin GOARCH=arm64 $(MAKE) dist
	GOOS=windows GOARCH=amd64 $(MAKE) dist
	GOOS=windows GOARCH=arm64 $(MAKE) dist
	echo "✓ Built binaries for all platforms in dist/"

# Deployment (requires lftp)
# Note: kambriw_6 user lands directly in VoxAlpha directory
DEPLOY_USER ?= kambriw_6
DEPLOY_SERVER ?= www239.your-server.de
DEPLOY_PASS_FILE ?= ~/.ssh/voxalpha.pass

.PHONY: deploy
deploy: pwa ## Deploy PWA to server (syncs with delete)
	@echo "Deploying PWA (version $(VERSION))..."
	@lftp -e "set ftp:ssl-force true; set ssl:verify-certificate no; open -u $(DEPLOY_USER),$$(cat $(DEPLOY_PASS_FILE)) ftp://$(DEPLOY_SERVER); mirror --reverse --delete --only-newer dist/pwa/ . ; quit"
	@echo "✓ Deployed to $(DEPLOY_SERVER)"

.PHONY: deploy-dry
deploy-dry: pwa ## Dry-run deployment (shows what would change)
	@echo "Would deploy version $(VERSION):"
	@lftp -e "set ftp:ssl-force true; set ssl:verify-certificate no; open -u $(DEPLOY_USER),$$(cat $(DEPLOY_PASS_FILE)) ftp://$(DEPLOY_SERVER); mirror --reverse --delete --dry-run --only-newer dist/pwa/ . ; quit" 2>&1 | sed 's/$(DEPLOY_USER):[^@]*@/$(DEPLOY_USER):***@/g'

# TTS Audio Snippets (Piper)
PIPER_VERSION ?= 2023.11.14-2
PIPER_RELEASE_URL = https://github.com/rhasspy/piper/releases/download/$(PIPER_VERSION)/piper_linux_x86_64.tar.gz
PIPER_VOICES_URL = https://huggingface.co/rhasspy/piper-voices/resolve/main
PIPER_DIR ?= $(CURDIR)/deps/piper
PIPER_BIN = $(PIPER_DIR)/piper
PIPER_MODEL_DE = $(PIPER_DIR)/de_DE-thorsten-medium.onnx
PIPER_MODEL_EN = $(PIPER_DIR)/en_US-amy-medium.onnx
SNIPPETS_DIR = audio

# File-based targets for Piper download (Make handles idempotency)
$(PIPER_BIN):
	@echo "Downloading Piper $(PIPER_VERSION)..."
	@mkdir -p $(PIPER_DIR)
	@curl -L $(PIPER_RELEASE_URL) | tar -xzf - -C deps/

$(PIPER_MODEL_DE): $(PIPER_BIN)
	@echo "Downloading German voice (Thorsten)..."
	@curl -L -o $@ $(PIPER_VOICES_URL)/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx
	@curl -L -o $@.json $(PIPER_VOICES_URL)/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json

$(PIPER_MODEL_EN): $(PIPER_BIN)
	@echo "Downloading English voice (Amy)..."
	@curl -L -o $@ $(PIPER_VOICES_URL)/en/en_US/amy/medium/en_US-amy-medium.onnx
	@curl -L -o $@.json $(PIPER_VOICES_URL)/en/en_US/amy/medium/en_US-amy-medium.onnx.json

.PHONY: download-piper
download-piper: $(PIPER_BIN) $(PIPER_MODEL_DE) $(PIPER_MODEL_EN) ## Download Piper TTS binary and voice models
	@echo "✓ Piper installed in $(PIPER_DIR)"

.PHONY: clean-piper
clean-piper: ## Remove Piper installation
	rm -rf $(PIPER_DIR)

# DIN 5009:2022 German alphabet (city names)
DIN5009_WORDS = \
	A:Aachen B:Berlin C:Chemnitz D:Düsseldorf E:Essen F:Frankfurt \
	G:Goslar H:Hamburg I:Ingelheim J:Jena K:Köln L:Leipzig \
	M:München N:Nürnberg O:Offenbach P:Potsdam Q:Quickborn R:Rostock \
	S:Salzwedel T:Tübingen U:Unna V:Völklingen W:Wuppertal X:Xanten \
	Y:Ypsilon Z:Zwickau AE:Umlaut-Aachen OE:Umlaut-Offenbach UE:Umlaut-Unna SZ:Eszett

# NATO/ICAO alphabet
NATO_WORDS = \
	A:Alpha B:Bravo C:Charlie D:Delta E:Echo F:Foxtrot \
	G:Golf H:Hotel I:India J:Juliet K:Kilo L:Lima \
	M:Mike N:November O:Oscar P:Papa Q:Quebec R:Romeo \
	S:Sierra T:Tango U:Uniform V:Victor W:Whiskey X:X-ray \
	Y:Yankee Z:Zulu

.PHONY: snippets
snippets: snippets-de snippets-en ## Generate all TTS audio snippets

.PHONY: snippets-de
snippets-de: ## Generate German DIN 5009 audio snippets
	@echo "Generating German (DIN 5009) snippets with Piper/Thorsten..."
	@mkdir -p $(SNIPPETS_DIR)/de
	@for entry in $(DIN5009_WORDS); do \
		letter=$${entry%%:*}; \
		word=$${entry#*:}; \
		outfile="$(SNIPPETS_DIR)/de/$${letter}.wav"; \
		if [ ! -f "$$outfile" ]; then \
			echo "  $$letter -> $$word"; \
			(cd $(PIPER_DIR) && echo "$$word" | LD_LIBRARY_PATH=. ./piper \
				--model de_DE-thorsten-medium.onnx \
				--output_file "$(CURDIR)/$$outfile" 2>/dev/null); \
		fi; \
	done
	@echo "✓ German snippets in $(SNIPPETS_DIR)/de/"

.PHONY: snippets-en
snippets-en: ## Generate English NATO audio snippets
	@echo "Generating English (NATO) snippets with Piper/Amy..."
	@mkdir -p $(SNIPPETS_DIR)/en
	@for entry in $(NATO_WORDS); do \
		letter=$${entry%%:*}; \
		word=$${entry#*:}; \
		outfile="$(SNIPPETS_DIR)/en/$${letter}.wav"; \
		if [ ! -f "$$outfile" ]; then \
			echo "  $$letter -> $$word"; \
			(cd $(PIPER_DIR) && echo "$$word" | LD_LIBRARY_PATH=. ./piper \
				--model en_US-amy-medium.onnx \
				--output_file "$(CURDIR)/$$outfile" 2>/dev/null); \
		fi; \
	done
	@echo "✓ English snippets in $(SNIPPETS_DIR)/en/"

.PHONY: clean-snippets
clean-snippets: ## Remove generated audio snippets
	rm -rf $(SNIPPETS_DIR)

# Playback individual snippets: make speak-din-a, make speak-nato-b
speak-din-%:
	@aplay $(SNIPPETS_DIR)/de/$(shell echo $* | tr a-z A-Z).wav 2>/dev/null

speak-nato-%:
	@aplay $(SNIPPETS_DIR)/en/$(shell echo $* | tr a-z A-Z).wav 2>/dev/null
