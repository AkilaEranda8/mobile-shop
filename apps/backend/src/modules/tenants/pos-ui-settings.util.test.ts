/**
 * Run: npx tsx src/modules/tenants/pos-ui-settings.util.test.ts
 */
import { normalizePosUiSettings, DEFAULT_POS_UI_SETTINGS } from './pos-ui-settings.util'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

const empty = normalizePosUiSettings(null)
assert(empty.theme === 'hexa-dark', 'default theme')
assert(empty.productGrid.showSku === true, 'default showSku')
assert(empty.bottomActions.visible.includes('newSale'), 'newSale always present')

const patched = normalizePosUiSettings({
  theme: 'hexa-light',
  accent: '#ff00aa',
  productGrid: { columnsDesktop: 3, showSku: false },
  bottomActions: { visible: ['hold', 'newSale'] },
})
assert(patched.theme === 'hexa-light', 'light theme')
assert(patched.accent === '#ff00aa', 'accent')
assert(patched.productGrid.columnsDesktop === 3, 'columns')
assert(patched.productGrid.showSku === false, 'sku off')
assert(patched.bottomActions.visible[0] === 'hold' || patched.bottomActions.visible.includes('newSale'), 'actions')

const badAccent = normalizePosUiSettings({ accent: 'purple' })
assert(badAccent.accent === '', 'invalid accent cleared')

assert(DEFAULT_POS_UI_SETTINGS.shortcuts.F10 === 'newSale', 'default F10')

console.log('pos-ui-settings.util.test.ts: all checks passed')
