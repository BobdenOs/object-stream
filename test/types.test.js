const assert = require('assert/strict')
const { Readable } = require('stream')

const { JSONStream } = require('../lib')

module.exports = (async () => {
  const values = ["string", true, false, undefined, 123]
  const expectations = []

  for (const value of values) {
    expectations.push(value)
    expectations.push({ prop: value })
  }

  const source = Readable.from((function* () {
    yield JSON.stringify(expectations)
  })(), { objectMode: false })

  const json = new JSONStream()

  source.pipe(json)

  let objCount = 0
  for await (const obj of json) {
    if(typeof obj === 'object') {
      assert.strictEqual(obj.prop, expectations[objCount].prop, 'Ensure that the right value is created.')
    } else {
      assert.strictEqual(obj, expectations[objCount], 'Ensure that the right value is created.')
    }
    objCount++
  }
  assert(objCount === expectations.length, 'Ensure the correct amount of objects are passed.')
})
