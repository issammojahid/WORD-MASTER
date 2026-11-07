const env = global.__adsFixture;
module.exports = {
  Platform: { OS: "android" },
  AppState: {
    get currentState() {
      return env.appState;
    },
    addEventListener(_, listener) {
      env.listeners.add(listener);
      return { remove: () => env.listeners.delete(listener) };
    },
  },
  View: "view",
  Text: "text",
  StyleSheet: { create: (value) => value },
};
