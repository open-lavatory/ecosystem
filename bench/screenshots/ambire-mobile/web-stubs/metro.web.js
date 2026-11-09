const path = require('path')

const root = path.resolve(__dirname, '..')

const STUBS = {
  'expo-camera': 'camera.js',
  'react-native-quick-crypto': 'quick-crypto.js',
  'react-native-stallion': 'stallion.js',
  'react-native-webrtc': 'webrtc.js',
  'react-native-webview': 'webview.js',
  'react-native-webview-crypto': 'webview-crypto.js'
}

const NODE_CORE = {
  crypto: 'crypto-browserify',
  stream: 'stream-browserify',
  buffer: 'buffer',
  http: 'stream-http',
  https: 'https-browserify',
  zlib: 'browserify-zlib'
}

// Platform splits whose web side the mobile screens need: the native carousel drives the native
// animated module and native fonts are embedded in the app binary
const WEB_VARIANTS = [/\/useCarouselList$/, /\/useFonts$/]

const stub = (file) => ({ type: 'sourceFile', filePath: path.join(__dirname, file) })
const isAppFile = (file) => file.startsWith(root) && !file.includes('/node_modules/')
// The mobile app's own redirect, see metro.config.js
const colibri = path.join(root, 'src/ambire-common/src/services/provider/colibri.ts')

// The web build of the app is the extension, so app modules resolve to their native side here
module.exports = function withWebStubs(config) {
  const resolveRequest = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform !== 'web') return resolveRequest(context, moduleName, platform)
    if (moduleName === './shim' && context.originModulePath === path.join(root, 'index.js')) return stub('shim.js')
    if (STUBS[moduleName]) return stub(STUBS[moduleName])
    if (/react-native-web\/dist\/(cjs\/)?exports\/Appearance$/.test(moduleName) && isAppFile(context.originModulePath)) {
      return stub('appearance.js')
    }
    if (NODE_CORE[moduleName]) return context.resolveRequest(context, NODE_CORE[moduleName], platform)
    if (isAppFile(context.originModulePath) && moduleName.startsWith('.') && !WEB_VARIANTS.some((re) => re.test(moduleName))) {
      const resolution = context.resolveRequest({ ...context, preferNativePlatform: true }, moduleName, 'android')

      return resolution.filePath === colibri ? { type: 'sourceFile', filePath: path.join(root, 'src/mobile/shims/colibri.ts') } : resolution
    }
    return context.resolveRequest(context, moduleName, platform)
  }
  return config
}
