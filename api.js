import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// expo-secure-store has no web implementation; the web build (dev only) uses localStorage
const storage = Platform.OS === 'web'
  ? {
      getItemAsync: async (key) => localStorage.getItem(key),
      setItemAsync: async (key, value) => localStorage.setItem(key, value),
      deleteItemAsync: async (key) => localStorage.removeItem(key),
    }
  : SecureStore;

// Point the app at a local backend with EXPO_PUBLIC_API_URL=http://<your-ip>:3000.
// The default is the Render service from render.yaml.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://geospot-kassasana.onrender.com';

// Uploaded photos are stored as API paths ("/images/<id>"); older ones are full URLs
export const mediaUrl = (url) => (url?.startsWith('/') ? `${API_URL}${url}` : url);

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

// Shrinks a picked photo (an ImagePicker asset) and posts it to path as { image }.
// Photos are stored in the database, so they are kept small.
const MAX_PHOTO_WIDTH = 1080;
export async function uploadImage(path, asset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_PHOTO_WIDTH) {
    context.resize({ width: MAX_PHOTO_WIDTH });
  }
  const image = await context.renderAsync();
  const { base64 } = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return api(path, { method: 'POST', body: { image: `data:image/jpeg;base64,${base64}` } });
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
