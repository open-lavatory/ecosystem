const cache = new Map()
function make(name, thenable = false) {
  const isComponent = /^[A-Z]/.test(name)
  const target = isComponent ? function StubComponent() { return null } : function stubFn() {}
  const proxy = new Proxy(target, {
    get(t, key) {
      if (key === '__esModule') return true
      if (key === 'default') return proxy
      if (thenable && (key === 'then' || key === 'catch' || key === 'finally')) {
        const p = Promise.resolve(null)
        return p[key].bind(p)
      }
      if (key === 'then' || typeof key === 'symbol') return undefined
      if (key === 'prototype' || key === 'name' || key === 'length' || key === 'displayName') return t[key]
      if (!cache.has(key)) cache.set(key, make(String(key)))
      return cache.get(key)
    },
    apply() {
      return isComponent ? null : make('result', !/^use/.test(name))
    },
    construct() {
      return make('instance')
    },
  })
  return proxy
}
module.exports = make('module')
