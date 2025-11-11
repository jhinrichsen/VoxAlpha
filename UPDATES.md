# PWA Update System - Quick Reference

## ✅ What's Been Implemented

Your VoxAlpha PWA now has a complete **semantic versioning** system with automatic update notifications!

### Components Added:

1. **Semantic Versioning** (`service-worker.js:7`)
   - Version: `1.0.0` (MAJOR.MINOR.PATCH)
   - Automatic cache naming based on version

2. **Update Notification UI** (`index.html:22-29`)
   - Animated banner at top of page
   - "Update Now" button
   - Dismiss option (×)
   - Smooth slide-down animation

3. **Update Detection Logic** (`script.js:675-738`)
   - Detects when new service worker is available
   - Shows notification banner automatically
   - Handles user interaction (update/dismiss)
   - Auto-reloads after update

4. **Version Management** (`VERSION.md`)
   - Complete versioning documentation
   - Release workflow
   - Version history
   - Troubleshooting guide

## 🚀 How to Release an Update

### Simple 3-Step Process:

**Step 1:** Edit `service-worker.js` (line 7)
```javascript
const VERSION = '1.0.1';  // Increment version
```

**Step 2:** Rebuild
```bash
go build -o voxalpha main.go
```

**Step 3:** Deploy
```bash
./voxalpha
```

That's it! Users will see the update notification automatically.

## 📱 User Experience

When you release an update:

1. **User opens the installed PWA**
2. **Browser checks for updates** (happens automatically)
3. **New service worker downloads** (in background, doesn't interrupt)
4. **Banner slides down from top:**
   ```
   🔄 New version available!  [Update Now] [×]
   ```
5. **User clicks "Update Now"**
6. **Page reloads with new version** (instant)
7. **Old cache automatically deleted**

## 🎨 Update Banner Features

- **Animated icon** - Rotating refresh icon (🔄)
- **Prominent button** - White "Update Now" button
- **Dismiss option** - Users can close and update later
- **Mobile responsive** - Works on all screen sizes
- **Theme-aware** - Uses app accent colors
- **Non-intrusive** - Doesn't block UI, can be dismissed

## 📋 Version Numbering Rules

| Change Type | Version Change | Example |
|------------|----------------|---------|
| Bug fix | PATCH | 1.0.0 → 1.0.1 |
| New feature | MINOR | 1.0.0 → 1.1.0 |
| Breaking change | MAJOR | 1.0.0 → 2.0.0 |

### Examples:

- Fixed transcription bug → `1.0.1`
- Added new alphabet → `1.1.0`
- Changed storage format → `2.0.0`

## 🧪 Testing Updates Locally

**Before releasing, test the update flow:**

```bash
# 1. Install current version
./voxalpha
# Open http://localhost:8081 and install PWA

# 2. Make changes and increment version
# Edit service-worker.js: VERSION = '1.0.1'

# 3. Rebuild and restart
go build -o voxalpha main.go
./voxalpha

# 4. Open the installed PWA
# You should see: "🔄 New version available!"
```

## 🔍 Debugging Updates

**Check if update detection is working:**

1. Open **DevTools** (F12)
2. Go to **Console** tab
3. Look for these logs:
   ```
   [VoxAlpha] Service Worker registered
   [VoxAlpha] Service Worker update found
   [VoxAlpha] New version available
   ```

4. Go to **Application → Service Workers**
   - Should show "waiting to activate" for new version
   - Click "skipWaiting" to force update

**Browser caching the old version?**
- Hard refresh: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- Clear site data: DevTools → Application → Clear storage
- Close all tabs and reopen

## 📝 Version History Format

Keep `VERSION.md` updated with each release:

```markdown
### v1.0.1 (2025-11-12) - Bug Fixes
- Fixed transcription accuracy for German umlauts
- Improved microphone error handling
- Updated service worker cache strategy

### v1.0.0 (2025-11-11) - Initial Release
- Initial PWA release with full offline support
```

## 🎯 Best Practices

1. ✅ **Always test locally** before deploying
2. ✅ **Increment version** for every release
3. ✅ **Document changes** in VERSION.md
4. ✅ **Use correct version type** (MAJOR/MINOR/PATCH)
5. ✅ **Clear old caches** automatically (already handled)
6. ✅ **Check logs** in console after releasing

## 🔗 Related Files

- `service-worker.js` - Version number (line 7)
- `VERSION.md` - Full documentation
- `version.js` - Optional JS version export
- `script.js:675-738` - Update detection logic
- `index.html:22-29` - Update banner HTML
- `style.css:472-595` - Update banner styles

## ❓ FAQ

**Q: How often does the browser check for updates?**
A: Automatically every 24 hours, or when user visits the app.

**Q: Can users skip updates?**
A: Yes, they can click the × button to dismiss.

**Q: Will updates break the user's data?**
A: No, IndexedDB data is preserved across updates.

**Q: What if the user never updates?**
A: Old version keeps working. No forced updates.

**Q: Can I roll back a bad update?**
A: Yes, just deploy the old version with a new patch number.

---

**Current Status:** ✅ Semantic versioning system fully implemented and ready to use!
