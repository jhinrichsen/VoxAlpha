# Release System

VoxAlpha uses **git tags as the single source of truth** for versioning.

## Quick Start

```bash
# 1. Create git tag (version bump)
git tag v0.2.1

# 2. Run make release (syncs PWA version and rebuilds)
make release
```

That's it! The Makefile syncs everything from the git tag.

## What Happens

`make release` does:

1. ✅ **Checks for dirty working directory** (aborts if uncommitted changes)
2. ✅ **Reads version from latest git tag** (e.g., `v0.2.0`)
3. ✅ **Updates** `service-worker.js:7` with that version
4. ✅ **Rebuilds binary** (`voxalpha`) with new assets embedded

## Version Sources

| Component | Source | Updated By |
|-----------|--------|------------|
| **Git tag** | `git tag` | You (manual) |
| **PWA** | `service-worker.js:7` | `make release` |
| **Go binary** | `main.version` (ldflags) | `make release` |
| **Go embedded files** | All assets | `make release` |

## Complete Workflow Example

### Scenario: You fixed a bug

```bash
# 1. Make your code changes
vim script.js

# 2. Commit them
git add -A
git commit -m "Fix German umlaut transcription"

# 3. Tag with new version (patch: 0.2.0 → 0.2.1)
git tag v0.2.1

# 4. Run release (syncs service-worker.js and rebuilds)
make release

# Output:
# === VoxAlpha Release ===
# Current version: 0.2.1
# Updating service-worker.js...
# ✓ Updated service-worker.js to v0.2.1
# Rebuilding binary...
# ✓ Built voxalpha
# 🎉 Release v0.2.1 ready!

# 5. Test the update
./voxalpha
# Open installed PWA - you should see "New version available!"

# 6. Push with tags
git push && git push --tags
```

### Scenario: New feature (minor version)

```bash
vim script.js
git add -A && git commit -m "Add Czech alphabet support"
git tag v0.3.0  # Minor bump: 0.2.1 → 0.3.0
make release
git push && git push --tags
```

### Scenario: Breaking change (major version)

```bash
vim storage.js
git add -A && git commit -m "Breaking: New storage format"
git tag v1.0.0  # Major bump: 0.3.0 → 1.0.0
make release
git push && git push --tags
```

## Semantic Versioning Rules

| Version Type | When to Use | Example |
|--------------|-------------|---------|
| **PATCH** (x.y.Z) | Bug fixes, typos, performance improvements | 1.0.0 → 1.0.1 |
| **MINOR** (x.Y.z) | New features, backwards-compatible | 1.0.0 → 1.1.0 |
| **MAJOR** (X.y.z) | Breaking changes, API changes | 1.0.0 → 2.0.0 |

### Examples by Category

**Patch (1.0.0 → 1.0.1):**
- Fixed transcription accuracy
- Improved error messages
- Performance optimization
- CSS styling tweaks

**Minor (1.0.0 → 1.1.0):**
- Added new alphabet
- New training mode
- Export/import feature
- New UI options

**Major (1.0.0 → 2.0.0):**
- Changed storage format (requires migration)
- Removed old features
- Complete UI redesign
- New architecture

## Git Tag Management

### Current Tags
```bash
git tag
# v0.1.0
# v0.1.1
# v0.2.0
# v1.0.0  ← Current
```

### Tag Format
- Format: `vX.Y.Z` (e.g., `v1.0.1`)
- Annotated tags with release message
- Automatically created by release tool

### Manual Tag Operations

```bash
# List all tags
git tag

# View tag details
git show v1.0.0

# Delete local tag (if needed)
git tag -d v1.0.0

# Delete remote tag (if needed)
git push origin :refs/tags/v1.0.0

# Push all tags
git push --tags
```

## Troubleshooting

### "Tag already exists"

```bash
# If you need to recreate a tag:
git tag -d v1.0.1              # Delete local
git push origin :refs/tags/v1.0.1  # Delete remote
make release-patch MESSAGE='Fixed issue'  # Recreate
```

### "Current version not found"

The release tool reads from `service-worker.js`. Ensure line 7 has:
```javascript
const VERSION = '1.0.0';
```

### Dry run to test

```bash
cd tools/release
./release -type patch -message "Test" -dry-run
```

### Manual version bump

If you need to skip automation:
1. Edit `service-worker.js:7` - Change VERSION
2. Edit `version.js` - Update VERSION, VERSION_NAME, BUILD_DATE
3. Edit `VERSION.md` - Add changelog entry
4. Run `make build`
5. Create tag: `git tag -a v1.0.1 -m "Release message"`

## Build and Deploy

### Local Development
```bash
# Build and run
make build
./voxalpha

# Or just run directly
make run
```

### Production Build
```bash
# After releasing
make build

# Binary is now at ./voxalpha
# Contains all assets with new version embedded
```

## CI/CD Integration

For automated releases in CI/CD pipelines:

```bash
# In your CI script:
cd tools/release
./release -type patch -message "Auto-release from CI" -tag=false

# Then deploy the binary
deploy ./voxalpha
```

## Version History Tracking

Every release is automatically logged in `VERSION.md`:

```markdown
## Version History

### v1.0.1 (2025-11-11)
- Fixed German umlaut transcription

### v1.0.0 (2025-11-11)
- Initial release
```

## Release Checklist

Before releasing:
- [ ] All changes tested locally
- [ ] Tests passing (if applicable)
- [ ] Choose correct version bump type
- [ ] Write clear release message
- [ ] Run release command
- [ ] Test update notification
- [ ] Commit and push with tags

After releasing:
- [ ] Update production deployment
- [ ] Monitor for issues
- [ ] Update external documentation if needed

## Files Modified by Release Tool

```
VoxAlpha/
├── service-worker.js      # Line 7: VERSION updated
├── version.js             # VERSION, VERSION_NAME, BUILD_DATE updated
├── VERSION.md             # Changelog entry added
├── voxalpha               # Binary rebuilt with new assets
└── .git/
    └── refs/tags/v1.0.1   # Git tag created
```

## Summary

**For most releases, you only need:**

```bash
make release-patch MESSAGE='Your change description'
```

Everything else happens automatically! 🚀
