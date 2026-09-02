/**
 * Client-side ambient types for Vite's build-time environment variables.
 *
 * `vite/client` is what declares `import.meta.env` (plus the baked-in MODE /
 * DEV / PROD flags) on the global scope. Without that reference the source
 * only works at build time and `npm run lint` (tsc --noEmit) rejects every
 * `import.meta.env.*` read, which is what failed the CI quality gate.
 *
 * A variable that is unset at build time is `undefined` at runtime even though
 * it is typed as `string` here, so always read it with a fallback (`|| ''`).
 *
 * This file must stay a script -- no top-level import/export -- so the
 * interfaces below merge with the ones declared by `vite/client`.
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Firebase web app config, baked into the client bundle at build time.
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;

  // Maps JS key when baked into the bundle; otherwise InteractiveMapDisplay
  // falls back to fetching it from /api/config/maps-key at runtime.
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
