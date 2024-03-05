const assert = require('assert/strict')
const { Readable } = require('stream')

const { log } = require('./utils/performance.js')
const { JSONStream } = require('../lib/index.js')

module.exports = (async () => {
  // 1mil character string
  const totalObjects = 1 << 8
  const largeString = Buffer.alloc(1 << 18).fill(' '.charCodeAt(0))

  const totalRawSize = totalObjects * (9 + largeString.byteLength * 4) + 1
  const source = Readable.from((function* () {
    const open = Buffer.from('[{"a":"')
    const close = Buffer.from('"}')

    yield open
    yield largeString
    yield largeString
    yield largeString
    yield largeString
    yield close

    open[0] = ','.charCodeAt(0)
    for (let i = 0; i < totalObjects; i++) {
      yield open
      yield largeString
      yield largeString
      yield largeString
      yield largeString
      yield close
    }
    yield ']'
  })(), { objectMode: false })

  const json = new JSONStream()

  source.pipe(json)

  const start = performance.now()
  let objCount = 0
  for await (const obj of json) {
    objCount++
    assert(typeof obj === 'object', 'Ensure that type is object.')
    assert('a' in obj, 'Ensure that the object has the "a" property.')
    // assert(obj.a === 'b', 'Ensure that the value of "a" is "b".')
  }

  log(start, totalRawSize, totalObjects)

  assert(objCount === totalObjects + 1, 'Ensure the correct amount of objects are passed.')
})
