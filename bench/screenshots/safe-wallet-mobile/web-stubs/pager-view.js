const React = require('react')
const { View } = require('react-native')
class PagerView extends React.Component {
  setPage() {}
  setPageWithoutAnimation() {}
  setScrollEnabled() {}
  render() {
    return React.createElement(View, { style: this.props.style }, this.props.children)
  }
}
module.exports = { __esModule: true, default: PagerView, PagerView }
