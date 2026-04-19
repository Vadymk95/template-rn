import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'auth_token';

export const setAuthToken = async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
};

export const getAuthToken = async (): Promise<string | null> => {
    return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
};

export const clearAuthToken = async (): Promise<void> => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
};
