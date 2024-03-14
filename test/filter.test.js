const assert = require('assert/strict')
const { Readable } = require('stream')

const { JSONStream } = require('../lib')

module.exports = (async () => {
  const source = Readable.from((function* () {
    yield '{"pre":[{"0":"0"}],"data":[{"a":"b"}],"post":[{"1":"1"}]}'
  })(), { objectMode: false })

  const json = new JSONStream({
    filter: ['data']
  })

  source.pipe(json)

  let objCount = 0
  for await (const obj of json) {
    objCount++
    assert(typeof obj === 'object', 'Ensure that type is object.')
    assert('a' in obj, 'Ensure that the object has the "a" property.')
    assert(obj.a === 'b', 'Ensure that the value of "a" is "b".')
  }
  assert(objCount === 1, 'Ensure the correct amount of objects are passed.')
})
