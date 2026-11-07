module.exports = {
  getItem: async (key) => global.__adsFixture.storage.get(key) || null,
  setItem: async (key, value) => {
    global.__adsFixture.storage.set(key, value);
    global.__adsFixture.writes.push({ key, value });
  },
};
