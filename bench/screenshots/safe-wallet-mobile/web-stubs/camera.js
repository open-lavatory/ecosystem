const React = require('react')
function Camera() { return null }
Camera.getCameraPermissionStatus = () => 'granted'
Camera.requestCameraPermission = async () => 'granted'
Camera.getMicrophonePermissionStatus = () => 'granted'
Camera.requestMicrophonePermission = async () => 'granted'
module.exports = {
  __esModule: true,
  Camera,
  useCameraDevice: () => ({ id: 'web-stub' }),
  useCodeScanner: (config) => config,
  useCameraPermission: () => ({ hasPermission: true, requestPermission: async () => true }),
  useCameraDevices: () => [],
}
