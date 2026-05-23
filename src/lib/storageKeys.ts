/**
 * External storage contracts — AsyncStorage (cache) + expo-secure-store (secrets).
 *
 * **Mobile-specific rationale**: cannot push hotfix instantly. Renaming a key
 * without migration code = silent data loss for existing users on app upgrade
 * (their AsyncStorage / SecureStore values become orphaned).
 *
 * The two boundaries are kept in **separate objects** because their threat
 * model differs:
 *   - `STORAGE_KEYS`        — plaintext on disk; cache / preferences / non-secrets
 *   - `SECURE_STORAGE_KEYS` — Keychain (iOS) / EncryptedSharedPreferences (Android);
 *                             credentials, tokens, anything that grants API access
 *
 * See `.cursor/brain/SKELETONS.md` § `src/lib/secureToken.ts` + § persist-ed stores.
 */

/** Keys written to AsyncStorage (plaintext). Stable across releases. */
export const STORAGE_KEYS = {
    /** Zustand `persist` name for `useUserStore`. */
    userPersist: 'user'
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Keys written to `expo-secure-store` (Keychain / EncryptedSharedPreferences). Stable across releases. */
export const SECURE_STORAGE_KEYS = {
    /** Auth token used by `setAuthToken` / `getAuthToken` / `clearAuthToken`. */
    authToken: 'auth_token'
} as const;

export type SecureStorageKey = (typeof SECURE_STORAGE_KEYS)[keyof typeof SECURE_STORAGE_KEYS];
