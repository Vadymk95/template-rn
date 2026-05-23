import * as SecureStore from 'expo-secure-store';

import { SECURE_STORAGE_KEYS } from '@/lib/storageKeys';

export const setAuthToken = async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(SECURE_STORAGE_KEYS.authToken, token);
};

export const getAuthToken = async (): Promise<string | null> => {
    return SecureStore.getItemAsync(SECURE_STORAGE_KEYS.authToken);
};

export const clearAuthToken = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(SECURE_STORAGE_KEYS.authToken);
};
