const assert = require('assert/strict')
const { Readable } = require('stream')

const { JSONStream } = require('../lib')

module.exports = (async () => {
  const source = Readable.from((function* () {
    yield '[{"a"'
    yield ':"\\' // Escape first character of next chunk
    yield '""}]'
  })(), { objectMode: false })

  const json = new JSONStream()

  source.pipe(json)

  let objCount = 0
  for await (const obj of json) {
    objCount++
    assert(typeof obj === 'object', 'Ensure that type is object.')
    assert('a' in obj, 'Ensure that the object has the "a" property.')
    assert(obj.a === '"', 'Ensure that the value of "a" is \'"\'.')
  }
  assert(objCount === 1, 'Ensure the correct amount of objects are passed.')
})
