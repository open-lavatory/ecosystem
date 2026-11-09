const path = require('path')

const generic = path.join(__dirname, 'generic.js')
const camera = path.join(__dirname, 'camera.js')
const security = path.join(__dirname, 'security.js')
const pager = path.join(__dirname, 'pager-view.js')

const GENERIC = [
  /^@react-native-firebase\//,
  /^@datadog\/mobile-react-native$/,
  /^expo-datadog$/,
  /^@notifee\/react-native$/,
  /^react-native-keychain$/,
  /^react-native-share$/,
  /^react-native-ble-plx$/,
  /^@ledgerhq\/device-transport-kit-react-native-ble$/,
  /^react-native-quick-crypto$/,
  /^react-native-quick-base64$/,
  /^react-native-webview$/,
  /^react-native-webrtc$/,
  /^react-native-webview-crypto$/,
  /^react-native-device-crypto$/,
  /^react-native-capture-protection$/,
  /^freerasp-react-native$/,
  /^react-native-nitro-modules$/,
  /^react-native-permissions$/,
  /^burnt$/,
  /^@react-native-menu\/menu$/,
]

module.exports = function withWebStubs(config) {
  const original = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web') {
      if (/react-native-web\/dist\/(cjs\/)?exports\/Appearance$/.test(moduleName) && /theme\/provider\/safeTheme\.tsx$/.test(context.originModulePath)) {
        return { type: 'sourceFile', filePath: path.join(__dirname, 'react-native-appearance.js') }
      }
      if (moduleName === 'react-native-mmkv') return { type: 'sourceFile', filePath: path.join(__dirname, 'mmkv.js') }
      if (moduleName === 'react-native-vision-camera') return { type: 'sourceFile', filePath: camera }
      if (/platform\/security$/.test(moduleName)) return { type: 'sourceFile', filePath: security }
      if (moduleName === 'react-native-pager-view') return { type: 'sourceFile', filePath: pager }
      if (GENERIC.some((re) => re.test(moduleName))) return { type: 'sourceFile', filePath: generic }
    }
    return original(context, moduleName, platform)
  }
  return config
}
