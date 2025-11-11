/**
 * VoxAlpha Version Information
 * Semantic Versioning: MAJOR.MINOR.PATCH
 *
 * MAJOR: Breaking changes (incompatible API changes)
 * MINOR: New features (backwards-compatible)
 * PATCH: Bug fixes (backwards-compatible)
 */

export const VERSION = '1.0.0';
export const VERSION_NAME = 'Initial Release';
export const BUILD_DATE = '2025-11-11';

// For service worker cache naming
export const CACHE_VERSION = `v${VERSION.replace(/\./g, '-')}`;
