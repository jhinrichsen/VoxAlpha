# Version Management

VoxAlpha uses **Semantic Versioning** (MAJOR.MINOR.PATCH) for releases.

## Current Version

**v1.0.0** - Initial Release (2025-11-11)

## Semantic Versioning

Version format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible API changes, major UI overhaul)
- **MINOR**: New features (backwards-compatible functionality)
- **PATCH**: Bug fixes (backwards-compatible fixes)

Examples:
- `1.0.0` → `1.0.1` - Bug fix
- `1.0.0` → `1.1.0` - New feature
- `1.0.0` → `2.0.0` - Breaking change

## How to Release a New Version

### 1. Update Version Number

Edit `service-worker.js` (line 7):
```javascript
const VERSION = '1.0.1';  // Increment based on change type
```

### 2. Update Version Info (Optional)

Edit `version.js`:
```javascript
export const VERSION = '1.0.1';
export const VERSION_NAME = 'Bug Fix Release';
export const BUILD_DATE = '2025-11-12';
```

### 3. Rebuild and Deploy

```bash
# Rebuild the Go binary with new version embedded
go build -o voxalpha main.go

# Or rebuild with version tag
go build -ldflags "-X main.version=1.0.1" -o voxalpha main.go
```

### 4. Test Update Notification

1. Start the old version and install the PWA
2. Update the version number in `service-worker.js`
3. Rebuild and restart the server
4. Open the installed PWA
5. You should see the update notification banner

## Update Notification Flow

When you release a new version:

1. **Browser detects change**: Service worker file changed (different VERSION)
2. **Downloads new SW**: New service worker installs in background
3. **Shows banner**: "New version available!" with animated icon
4. **User clicks "Update Now"**: Page reloads with new version
5. **Old cache cleared**: Previous version cache is deleted automatically

## Version History

### v1.0.0 (2025-11-11) - Initial Release
- ✅ Fully functional PWA with offline support
- ✅ German (DIN 5009) and English (NATO) alphabets
- ✅ Two training modes: Type & Listen, Listen & Speak
- ✅ Service worker with automatic updates
- ✅ Semantic versioning system
- ✅ Update notification UI
- ✅ All 8 icon sizes (72x72 to 512x512)
- ✅ Automated screenshot generation tool
- ✅ COOP/COEP headers for WASM support
- ⚠️ Whisper.cpp STT has runtime issues (using fallback)

## Development Tips

### Testing Updates Locally

```bash
# Terminal 1: Run old version
VERSION=1.0.0 ./voxalpha

# Update service-worker.js to VERSION='1.0.1'

# Terminal 2: Rebuild and run new version
go build -o voxalpha main.go
./voxalpha -port 8082

# Visit localhost:8081, then refresh - you should see update notification
```

### Cache Naming Convention

The service worker automatically generates cache names from the version:
- Version `1.0.0` → Cache: `voxalpha-v1-0-0`
- Version `1.2.3` → Cache: `voxalpha-v1-2-3`

This ensures old caches are properly cleaned up on updates.

## Best Practices

1. **Always increment version** when making changes
2. **Use PATCH** for bug fixes (1.0.0 → 1.0.1)
3. **Use MINOR** for new features (1.0.0 → 1.1.0)
4. **Use MAJOR** for breaking changes (1.0.0 → 2.0.0)
5. **Test update flow** before releasing
6. **Document changes** in this file's Version History

## Troubleshooting

**Update notification not showing?**
- Check browser console for Service Worker logs
- Verify VERSION changed in service-worker.js
- Try hard refresh (Ctrl+F5 or Cmd+Shift+R)
- Check Application → Service Workers in DevTools

**Old version still cached?**
- Clear site data in browser settings
- Unregister service worker in DevTools
- Close all tabs and reopen
