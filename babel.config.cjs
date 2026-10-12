// Metro runs Babel over every module, and this project has no babel config.
// Without it, `babel-preset-expo` is never registered, so the Expo Router
// transform that defines `EXPO_ROUTER_APP_ROOT` never runs and
// `expo-router/_ctx.*` throws on `require.context(undefined, ...)`.
//
// Written as .cjs because package.json has no "type" field, which keeps the
// module format explicit.
//
// Note: since SDK 50 the router's Babel logic ships inside `babel-preset-expo`.
// The old `expo-router/babel` plugin is a deprecated no-op — do not re-add it.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
