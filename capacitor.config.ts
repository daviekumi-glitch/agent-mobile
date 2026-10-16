import type { CapacitorConfig } from "@capacitor/cli";

// ---------------------------------------------------------------------------
// Capacitor configuration — this is what turns the web app into an installable
// Android application.
//
// The shell is a *remote-URL* wrapper rather than a static export on purpose.
// Agent Mobile is a server-rendered app: its streaming chat route, Supabase SSR
// cookie sessions and API handlers only exist when Node is serving it. A static
// export would produce an app with no backend. So the WebView loads the deployed
// URL and the app behaves exactly as the web app does.
//
// Which URL gets baked in
// ----------------------
// 1. `CAPACITOR_APP_URL` if set (CI passes this through).
// 2. `NEXT_PUBLIC_APP_URL` otherwise.
// 3. `PRODUCTION_URL` in `src/lib/mobile/app-url.ts` as the last resort.
//
// The Android build additionally injects `NEXT_PUBLIC_BUILD_APP_URL` via
// BuildConfig at compile time, and the in-app setup screen lets the user point
// the app at a different backend at runtime. See README → Android.
// ---------------------------------------------------------------------------

const appUrl =
  process.env.CAPACITOR_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://agent-mobile.vercel.app";

const config: CapacitorConfig = {
  appId: "com.daviekumi.agentmobile",
  appName: "Agent Mobile",
  webDir: "public",

  server: {
    url: appUrl,
    // Never allow plaintext HTTP to the app origin.
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    // Leave WebView debugging off in release builds.
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      // Matches --background in src/app/globals.css (dark theme).
      backgroundColor: "#141419",
      androidSplashResourceName: "splash",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
    Keyboard: {
      resize: "native",
      style: "dark",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
