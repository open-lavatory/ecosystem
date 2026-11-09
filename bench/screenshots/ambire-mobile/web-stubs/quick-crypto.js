const webCrypto = globalThis.crypto
const browserGetRandomValues = webCrypto.getRandomValues.bind(webCrypto)

const getRandomValues = (array) => browserGetRandomValues(array)

module.exports = {
  getRandomValues,
  install: () => Object.defineProperty(webCrypto, 'getRandomValues', { value: getRandomValues }),
  CryptoKey: globalThis.CryptoKey,
  subtle: webCrypto.subtle,
  webcrypto: webCrypto
}
