GO ?= CGO_ENABLED=0 go
BINARY ?= voxalpha
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
	echo "Updating service-worker.js..."; \
	sed -i "s/const VERSION = '[^']*'/const VERSION = '$$VERSION'/" service-worker.js; \
	echo "✓ Updated service-worker.js to $$VERSION"; \
	echo "Rebuilding binary with version..."; \
	$(GO) build -ldflags "-X 'main.version=$$VERSION'" -o $(BINARY) .; \
	echo "✓ Built $(BINARY) $$VERSION"; \
	echo ""; \
	echo "🎉 Release $$VERSION ready!"; \
	echo "   - Git tag: v$$VERSION"; \
	echo "   - Service worker: $$VERSION"; \
	echo "   - Go binary: $$VERSION"
