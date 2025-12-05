GO ?= CGO_ENABLED=0 go
BINARY ?= dist/voxalpha
# Always strip leading 'v' from git tag (v1.2.3 -> 1.2.3)
VERSION ?= $(shell git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "dev")
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

# Generate target paths in dist/pwa/
PWA_TARGETS = \
	$(addprefix dist/pwa/,$(PWA_FILES)) \
	$(addprefix dist/pwa/,$(PWA_LIB)) \
	$(addprefix dist/pwa/,$(PWA_ICONS)) \
	$(addprefix dist/pwa/,$(PWA_SCREENSHOTS)) \
	dist/pwa/service-worker.js

.PHONY: all
all: pwa build test ## Build PWA, binary, and run tests

.PHONY: clean
clean: ## Remove build artifacts
	rm -f $(BINARY)
	rm -rf dist/

.PHONY: pwa
pwa: $(PWA_TARGETS) ## Build PWA with file-based targets
	@echo "✓ PWA built in dist/pwa/ (version: $(VERSION))"

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

# Special rules for version injection (still need mkdir for redirection)
dist/pwa/service-worker.js: service-worker.js
	mkdir -p $(@D)
	sed "s/__VERSION__/$(VERSION)/g" $< > $@

dist/pwa/voxalpha.html: voxalpha.html
	mkdir -p $(@D)
	sed "s/__VERSION__/$(VERSION)/g" $< > $@

.PHONY: build
build: pwa ## Build Go binary (requires PWA build first)
	@mkdir -p $(dir $(BINARY))
	$(GO) build -ldflags "-X 'main.version=$(VERSION)'" -o $(BINARY) .

.PHONY: run
run: build ## Start dev server (requires build first)
	./$(BINARY)

.PHONY: test
test: pwa ## Run tests (requires PWA build first)
	$(GO) test -v ./tests/

# Model management
MODEL_URL = https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q8_0.bin
MODEL_FILE = dist/ggml-small-q8_0.bin

$(MODEL_FILE):
	@echo "Downloading Whisper small model (253MB)..."
	curl -L -o $@ $(MODEL_URL)
	@echo "✓ Model downloaded"

.PHONY: download-model
download-model: $(MODEL_FILE)

.PHONY: clean-model
clean-model:
	rm -f $(MODEL_FILE)

# Cross-platform builds
.PHONY: dist
dist: pwa
	@mkdir -p dist/$$GOOS/$$GOARCH
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
	@echo "✓ Built binaries for all platforms in dist/"

# Deployment (requires rclone)
SFTP_USER ?= kambriw
SFTP_SERVER ?= www239.your-server.de
SFTP_TARGET ?= public_html/VoxAlpha
RCLONE_DEST = :sftp:$(SFTP_TARGET)/ --sftp-host=$(SFTP_SERVER) --sftp-user=$(SFTP_USER)

.PHONY: deploy
deploy: pwa ## Deploy PWA to server
	@echo "Deploying PWA (version $(VERSION))..."
	rclone sync dist/pwa/ $(RCLONE_DEST) --exclude '*.bin'
	@echo "✓ Deployed to $(SFTP_SERVER):$(SFTP_TARGET)"

.PHONY: deploy-dry
deploy-dry: pwa ## Dry-run deployment
	@echo "Version would be: $(VERSION)"
	rclone sync dist/pwa/ $(RCLONE_DEST) --exclude '*.bin' --dry-run

.PHONY: deploy-model
deploy-model: ## Deploy Whisper model file
	rclone copy $(MODEL_FILE) $(RCLONE_DEST)
