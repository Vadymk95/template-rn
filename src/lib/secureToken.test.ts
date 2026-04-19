import * as SecureStore from 'expo-secure-store';

import { clearAuthToken, getAuthToken, setAuthToken } from '@/lib/secureToken';

describe('secureToken', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('setAuthToken writes to SecureStore under a stable key', async () => {
        await setAuthToken('secret');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'secret');
    });

    it('getAuthToken reads from the same key', async () => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('stored');
        await expect(getAuthToken()).resolves.toBe('stored');
        expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_token');
    });

    it('clearAuthToken deletes the same key', async () => {
        await clearAuthToken();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    });

    it('setAuthToken still delegates when token is empty string (caller decides validity)', async () => {
        await setAuthToken('');
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', '');
    });
});
