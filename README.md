#  GeoSpot Setup Guide


---

## Backend Setup (Render + MongoDB Atlas)

The API runs on a free Render service backed by a free MongoDB Atlas database. Photos are stored in the database, and the map uses your phone's maps app for directions, so there are no other accounts or API keys.

1. **MongoDB Atlas:** create a free M0 cluster and a database user. Under Network Access allow `0.0.0.0/0` (Render's free tier has no fixed IP). Copy the connection string.
2. **Render:** New > Blueprint > pick this repo. It reads `render.yaml`, asks for `MONGO_URI` (paste the Atlas string), and generates `JWT_SECRET`. Leave `SMTP_URL`/`MAIL_FROM` empty unless you want password reset emails (see `backend/.env.example`).
3. The first start adds the seed locations. Render redeploys on every push to `main`.
4. The app uses `https://geospot-kassasana.onrender.com` by default (`api.js`). If Render gives the service a different URL, change it there.

The free service sleeps after ~15 minutes idle, so the first request after that takes up to a minute.

---

## Frontend Setup (React Native with Expo)

You’ll be running the frontend using **Expo Go** on your phone or using the web browser via tunnel.

### 🔧 Initial Setup (One-Time)

Use **Node 24** (see `.nvmrc`; Node 22.13+ also works). No global Expo install is needed — `npx expo` uses the project's own version.

The app targets **Expo SDK 58**, so install the current **Expo Go** from the App Store / Play Store.

---

## Run the Frontend

1. Open a terminal and go to the root of the project:

   ```bash
   cd geospot  # if not already there
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start Expo using **tunnel mode** (important for physical device access):

   ```bash
   npx expo start --tunnel
   ```

   This will open **Expo DevTools** in your browser.

---

## Run the App on Your Phone

1. Download the **Expo Go** app:
   - iOS: App Store
   - Android: Google Play

2. Make sure your phone and computer are on the **same Wi-Fi network**.

3. In **Expo DevTools**, **scan the QR code** shown under "Tunnel" using the **Expo Go** app.

   Your app should launch on your phone!

---

## Development

- `npm run check` lints the app and backend and runs the backend tests (they use an in-memory MongoDB, so no database is needed).
- Quickest local setup: `cd backend && npm run dev:memory` starts the API with a throwaway in-memory database and the seed locations. Then run the app with `EXPO_PUBLIC_API_URL=http://<your computer's IP>:3000 npx expo start` (or `npx expo start --web` with `http://localhost:3000`).
- To run the API against a real database: copy `backend/.env.example` to `backend/.env`, fill it in, then `cd backend && npm install && npm run dev`.
- `cd backend && npm run seed` replaces the map locations with the seed list (a new database gets them automatically).
- The daily spot rotates through locations with `isActive: true` and is revealed at 9:00 Gainesville time.

---

## Troubleshooting Tips

- **Backend not working?** Check the service's logs on Render; it needs `MONGO_URI` set and Atlas network access open.
- **Can’t scan the QR?** Ensure your phone and laptop are on the **same Wi-Fi**, and you’re using **Tunnel mode** (`--tunnel`).

---