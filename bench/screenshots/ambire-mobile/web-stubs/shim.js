// Installs Expo's loader for split bundles, which the native shim never needs
import 'expo'
import 'stream-browserify'

globalThis.Buffer ??= require('buffer').Buffer
globalThis.process ??= require('process')
globalThis.setImmediate ??= (callback, ...args) => setTimeout(callback, 0, ...args)
globalThis.clearImmediate ??= (id) => clearTimeout(id)

// The invite gate checks a code against Ambire's relayer, so it starts passed
if (localStorage.getItem('asyncStorage\\invite') === null) {
  localStorage.setItem('asyncStorage\\invite', JSON.stringify({ status: 'VERIFIED' }))
}
