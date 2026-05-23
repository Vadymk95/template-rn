import * as SecureStore from 'expo-secure-store';

import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/secureToken';
import { SECURE_STORAGE_KEYS } from '@/lib/storageKeys';

describe('secureToken', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('setAuthToken writes to SecureStore under a stable key', async () => {
        await setAuthToken('secret');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
            SECURE_STORAGE_KEYS.authToken,
            'secret'
        );
    });

    it('getAuthToken reads from the same key', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored');
        await expect(getAuthToken()).resolves.toBe('stored');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.authToken);
    });

    it('clearAuthToken deletes the same key', async () => {
        await clearAuthToken();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.authToken);
    });

    it('setAuthToken still delegates when token is empty string (caller decides validity)', async () => {
        await setAuthToken('');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.authToken, '');
    });
});
