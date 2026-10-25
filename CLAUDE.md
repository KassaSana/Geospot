# GeoSpot

Expo (SDK 58) React Native app at the repo root; Express + MongoDB API in `backend/`, deployed on Render.

## Commands
- `npm run check` — lint (app + backend) and backend tests. Run it before calling a change done.
- One backend test: `cd backend && node --test --test-name-pattern="login" "tests/*.test.js"`
- After changing imports or app dependencies, confirm the bundle builds: `npx expo export --platform android --output-dir <temp dir>`
- Add app dependencies with `npx expo install <pkg>`, not `npm install`, so versions match the SDK. Then run `npx expo-doctor`.
- Try the whole app locally with no credentials: `.claude/launch.json` has `api-memory` (API on :3000 with an in-memory DB and seeded locations) and `web` (the app in a browser, pointed at it). Password reset codes print to the API log.

## Gotchas
- All app requests go through `api.js`, which adds the login token. It targets `EXPO_PUBLIC_API_URL`, else the deployed API — a backend change does nothing for the app until it is deployed.
- Every route except signup, login, `forgotPassword` and `resetPassword` requires a token; use `req.user.uid`, never a `uid`/`email` from the body, to decide whose data to change.
- Deploys use `render.yaml` (Render blueprint). A fresh database gets the seed locations on startup.
- Days, the 9:00 reveal and streaks use Gainesville time (`backend/lib/spotClock.js`). The daily spot rotates through locations with `isActive: true`.
- Never send secrets to clients. The User schema strips `password` and reset-code fields in `toJSON`/`toObject`, but `.lean()` skips that transform — select fields explicitly when using it.
- `backend/app.js` builds the Express app and exports it; `backend/server.js` connects to Mongo and listens. Tests import `app.js` and run against `mongodb-memory-server` (the first run downloads MongoDB).
- Secrets stay server-side; never put keys in app code (Expo bundles them into the app). The only required setting is `MONGO_URI`: photos are stored in MongoDB (`/images/:id`, saved as paths that `mediaUrl` in `api.js` resolves), and directions open the phone's maps app.
- `react-native-maps` and `expo-secure-store` have no web support: `screens/Map.web.jsx` stands in for the map and `api.js` uses localStorage on web.
- ESLint includes the React Compiler rules: don't call setState synchronously in an effect (set it in a `.then` callback); refetch on screen focus with `useFocusEffect`.
- Node 22.13+ (`.nvmrc` pins 24).
