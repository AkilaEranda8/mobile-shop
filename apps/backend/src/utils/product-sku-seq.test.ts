import {
  analyzeProductSkus,
  formatSkuFromSeq,
  parseProductSkuSequence,
} from './product-sku-seq'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function testParseProductSkuSequence() {
  assert(parseProductSkuSequence('00001')?.type === 'numeric', '00001 numeric')
  assert(parseProductSkuSequence('00025')?.n === 25, '00025 value')
  assert(parseProductSkuSequence('IPHONE-SKU-00012')?.type === 'prefixed', 'prefixed type')
  assert(parseProductSkuSequence('00001-128GB-BLA') === null, 'variant sku ignored')
  assert(parseProductSkuSequence('IPH15PM-256') === null, 'manual sku ignored')
}

function testAnalyzeNumericTenant() {
  const skus = ['00001', '00002', '00025', '00001-128GB-BLA']
  const { format, maxSeq } = analyzeProductSkus(skus, 'IPHONE-SKU')
  assert(format.type === 'numeric', 'numeric format')
  assert(maxSeq === 25, 'max 25')
  assert(formatSkuFromSeq(format, 26) === '00026', 'next 00026')
}

function testAnalyzePrefixedTenant() {
  const skus = ['DEMO-SKU-00001', 'DEMO-SKU-00008']
  const { format, maxSeq } = analyzeProductSkus(skus, 'DEMO-SKU')
  assert(format.type === 'prefixed', 'prefixed format')
  assert(maxSeq === 8, 'max 8')
  assert(formatSkuFromSeq(format, 9) === 'DEMO-SKU-00009', 'next prefixed')
}

function testEmptyUsesDefaultPrefix() {
  const { format, maxSeq } = analyzeProductSkus([], 'IPHONE-SKU')
  assert(format.type === 'prefixed', 'empty defaults prefixed')
  assert(maxSeq === 0, 'empty max 0')
  assert(formatSkuFromSeq(format, 1) === 'IPHONE-SKU-00001', 'first prefixed sku')
}

testParseProductSkuSequence()
testAnalyzeNumericTenant()
testAnalyzePrefixedTenant()
testEmptyUsesDefaultPrefix()

console.log('product-sku-seq.test.ts: all passed')
