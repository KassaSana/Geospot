# GeoSpot

Expo (SDK 58) React Native app at the repo root; Express + MongoDB API in `backend/`, deployed on Render.

## Commands
- `npm run check` — lint (app + backend) and backend tests. Run it before calling a change done.
- One backend test: `cd backend && node --test --test-name-pattern="login" "tests/*.test.js"`
- After changing imports or app dependencies, confirm the bundle builds: `npx expo export --platform android --output-dir <temp dir>`
- Add app dependencies with `npx expo install <pkg>`, not `npm install`, so versions match the SDK. Then run `npx expo-doctor`.
- Run the API locally: `cd backend && npm run dev` (needs `backend/.env`, see `backend/.env.example`).

## Gotchas
- The app calls the deployed API at `https://geospotbackend.onrender.com` (hardcoded in `screens/`). A backend change does nothing for the app until it is deployed.
- There are no auth tokens yet: routes trust the `uid`/`email` sent in the body. Don't assume `req.user` exists.
- The logged-in user lives in `expo-secure-store` under `user` (`{ uid, email, username }`). AsyncStorage only caches map locations.
- Never send `password` to clients. The User schema strips it in `toJSON`/`toObject`, but `.lean()` skips that transform — select fields explicitly when using it.
- `backend/app.js` builds the Express app and exports it; `backend/server.js` connects to Mongo and listens. Tests import `app.js` and run against `mongodb-memory-server` (the first run downloads MongoDB).
- Secrets stay server-side. The Google Maps key is only read by the backend's `/directions` route; never put keys in app code (Expo bundles them into the app).
- ESLint includes the React Compiler rules: don't call setState synchronously in an effect; refetch on screen focus with `useFocusEffect`.
- Node 22.13+ (`.nvmrc` pins 24).
