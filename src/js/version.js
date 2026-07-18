/* Single source of truth for the app version (semver: MAJOR.MINOR.PATCH).
 * Bump this on every release. It feeds both the footer label and the Service
 * Worker cache name, so a single edit invalidates the cache and updates the UI.
 */
const APP_VERSION = "0.3.0";
