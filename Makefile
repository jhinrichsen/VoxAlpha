GO ?= CGO_ENABLED=0 go
BINARY ?= voxalpha
# Always strip leading 'v' from git tag (v1.2.3 -> 1.2.3)
VERSION ?= $(shell git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "dev")

.PHONY: all
all: build

.PHONY: build
build:
	$(GO) build -ldflags "-X 'main.version=$(VERSION)'" -o $(BINARY) .

.PHONY: run
run:
	$(GO) run .

.PHONY: clean
clean:
	rm -f $(BINARY)

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

# Deployment (requires rclone)
SFTP_USER ?= kambriw
SFTP_SERVER ?= www239.your-server.de
SFTP_TARGET ?= public_html/VoxAlpha
RCLONE_DEST = :sftp:$(SFTP_TARGET)/ --sftp-host=$(SFTP_SERVER) --sftp-user=$(SFTP_USER)

.PHONY: deploy deploy-dry deploy-model
deploy:
	@echo "Injecting version $(VERSION)..."
	@sed -i "s/voxalpha-[^'\"]*'/voxalpha-$(VERSION)'/" dist/service-worker.js
	@sed -i 's/<span class="version-indicator">[^<]*/<span class="version-indicator">$(VERSION)/' dist/voxalpha.html
	@sed -i 's/\* Version: .*/\* Version: $(VERSION)/' dist/service-worker.js
	rclone sync dist/ $(RCLONE_DEST) --exclude '*.bin' --exclude '.wrangler/**'
	@echo "Restoring placeholders..."
	@sed -i "s/voxalpha-$(VERSION)'/voxalpha-__VERSION__'/" dist/service-worker.js
	@sed -i 's/<span class="version-indicator">$(VERSION)/<span class="version-indicator">__VERSION__/' dist/voxalpha.html
	@sed -i 's/\* Version: $(VERSION)/\* Version: __VERSION__/' dist/service-worker.js

deploy-dry:
	@echo "Version would be: $(VERSION)"
	rclone sync dist/ $(RCLONE_DEST) --exclude '*.bin' --exclude '.wrangler/**' --dry-run

deploy-model:
	rclone copy dist/ggml-small-q8_0.bin $(RCLONE_DEST)

# Release management
.PHONY: release

release:
	@echo "=== VoxAlpha Release ==="
	@# Check for uncommitted changes
	@if ! git diff-index --quiet HEAD --; then \
		echo "Error: Working directory is dirty. Commit or stash changes first."; \
		exit 1; \
	fi
	@# Get current version from git tag
	@VERSION=$$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//'); \
	if [ -z "$$VERSION" ]; then \
		echo "Error: No git tags found. Create one first: git tag v1.0.0"; \
		exit 1; \
	fi; \
	echo "Current version: $$VERSION"; \
	echo "Rebuilding binary with version..."; \
	$(GO) build -ldflags "-X 'main.version=$$VERSION'" -o $(BINARY) .; \
	echo "✓ Built $(BINARY) $$VERSION"; \
	echo ""; \
	echo "🎉 Release $$VERSION ready!"; \
	echo "   - Git tag: v$$VERSION"; \
	echo "   - Go binary: $$VERSION"; \
	echo ""; \
	echo "Run 'make deploy' to deploy with version $$VERSION"
