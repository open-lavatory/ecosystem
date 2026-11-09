const mod = require('react-native-web/dist/cjs/exports/Appearance')
const Appearance = { ...(mod.default || mod), setColorScheme: () => {} }
module.exports = { __esModule: true, default: Appearance }
