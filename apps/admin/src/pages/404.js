const React = require('react')

function Custom404() {
  return React.createElement(
    'div',
    { style: { padding: 48, fontFamily: 'system-ui, sans-serif', textAlign: 'center' } },
    React.createElement('h1', { style: { fontSize: 28, fontWeight: 700, marginBottom: 8 } }, '404'),
    React.createElement('p', { style: { color: '#64748b' } }, 'This page could not be found.'),
  )
}

module.exports = Custom404
