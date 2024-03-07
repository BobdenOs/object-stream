const assert = require('assert/strict')
const { Readable } = require('stream')

const { JSONStream } = require('../lib')

module.exports = (async () => {
  const source = Readable.from((function* () {
    yield '[{"a":b}]'
  })(), { objectMode: false })

  const json = new JSONStream()

  source.pipe(json)
  try {
    for await (const obj of json) { /**/ }
    assert(false, 'Ensure the invalid json contents throw an error.')
  } catch (err) { /**/ }
})
