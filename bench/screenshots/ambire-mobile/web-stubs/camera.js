const permission = { granted: true, canAskAgain: true, status: 'granted', expires: 'never' }

module.exports = {
  CameraView: () => null,
  useCameraPermissions: () => [permission, async () => permission],
  scanFromURLAsync: async () => []
}
