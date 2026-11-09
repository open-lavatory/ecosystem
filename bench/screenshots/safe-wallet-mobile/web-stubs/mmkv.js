function createMMKV(config = {}) {
  const prefix = `mmkv:${config.id || 'default'}:`
  const keys = () => Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  return {
    set: (key, value) => localStorage.setItem(prefix + key, String(value)),
    getString: (key) => {
      const v = localStorage.getItem(prefix + key)
      return v === null ? undefined : v
    },
    getNumber: (key) => {
      const v = localStorage.getItem(prefix + key)
      return v === null ? undefined : Number(v)
    },
    getBoolean: (key) => {
      const v = localStorage.getItem(prefix + key)
      return v === null ? undefined : v === 'true'
    },
    contains: (key) => localStorage.getItem(prefix + key) !== null,
    getAllKeys: () => keys().map((k) => k.slice(prefix.length)),
    remove: (key) => {
      const had = localStorage.getItem(prefix + key) !== null
      localStorage.removeItem(prefix + key)
      return had
    },
    clearAll: () => keys().forEach((k) => localStorage.removeItem(k)),
  }
}
module.exports = { __esModule: true, createMMKV, MMKV: createMMKV }
