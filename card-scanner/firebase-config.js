// Firebase web config for AI Logic (Gemini Developer API, free Spark plan). These values are public identifiers, not secrets –
// abuse is blocked by App Check (Play Integrity on Android). Leave null to run on-device only.
// Paste from Firebase console → Project settings → Your apps → Web app → SDK setup → Config.
window.FIREBASE_CONFIG = {"apiKey":"AIzaSyCX0v2odpRgIH7IM74cRcP2sRs7vYS7GRI","authDomain":"card-scanner-dd.firebaseapp.com","projectId":"card-scanner-dd","storageBucket":"card-scanner-dd.firebasestorage.app","messagingSenderId":"287239318586","appId":"1:287239318586:web:44ae8725df8130525dd903"}; // project card-scanner-dd (Spark)
// window.FIREBASE_CONFIG = { apiKey: '…', authDomain: '….firebaseapp.com', projectId: '…', storageBucket: '…', messagingSenderId: '…', appId: '1:…:web:…' };
window.FIREBASE_OPTS = {
  models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], // tried in order; all free on the Gemini Developer API free tier
  appCheckDebug: true,   // test builds: native App Check debug provider (register the debug token from logcat in the console). Set false for Play builds.
  webRecaptchaSiteKey: '' // optional: reCAPTCHA v3 site key so the web build can pass App Check
};
