import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation; the web build (dev only) uses localStorage
const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key) => localStorage.getItem(key),
      setItemAsync: async (key, value) => localStorage.setItem(key, value),
      deleteItemAsync: async (key) => localStorage.removeItem(key),
    }
  : SecureStore;

// Point the app at a local backend with EXPO_PUBLIC_API_URL=http://<your-ip>:3000
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://geospotbackend.onrender.com';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// JSON request to the backend with the saved login token attached.
// Throws ApiError with the server's message when the response is not 2xx.
export async function api(path, { method = 'GET', body } = {}) {
  const token = await storage.getItemAsync('token');
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }
  return data;
}

// The logged-in user is { uid, email, username }; the token proves it to the backend
export async function saveSession({ token, user }) {
  await storage.setItemAsync('token', token);
  await storage.setItemAsync('user', JSON.stringify(user));
}

export async function getSessionUser() {
  const raw = await storage.getItemAsync('user');
  return raw ? JSON.parse(raw) : null;
}

export async function updateSessionUser(changes) {
  const user = await getSessionUser();
  if (user) {
    await storage.setItemAsync('user', JSON.stringify({ ...user, ...changes }));
  }
}

export async function clearSession() {
  await storage.deleteItemAsync('token');
  await storage.deleteItemAsync('user');
}

// Send the user back to Login when their session is missing or expired
export async function handleAuthError(error, navigation) {
  if (error instanceof ApiError && error.status === 401) {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    return true;
  }
  return false;
}
