module.exports = {
  withStallion: (Component) => Component,
  useStallionUpdate: () => ({ currentlyRunningBundle: null }),
  addEventListener: () => {},
  removeEventListener: () => {}
}
