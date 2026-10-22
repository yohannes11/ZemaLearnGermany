// Adds to app.json what depends on the build: a test build that talks to a development server over plain
// http:// (EXPO_PUBLIC_API_URL, see .env.example) must allow cleartext traffic, which Android refuses in release
// builds. Builds for the live site use https:// and keep the strict default.
module.exports = ({ config }) => {
  const insecureServer = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');
  return {
    ...config,
    plugins: [...config.plugins, ['expo-build-properties', { android: { usesCleartextTraffic: insecureServer } }]],
  };
};
