const fs = require('fs')
const { Transform } = require('stream')

const typeMap = {
  0: 'value',
  1: 'literal',
  2: 'string',
  3: 'array',
  4: 'object',
  5: 'property',
}

// Load chunk.wasm binary
const wasmModule = new global.WebAssembly.Module(fs.readFileSync(__dirname + '/chunk.wasm'))

class JSONStream extends Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
    this._memory = new global.WebAssembly.Memory({ initial: 2 })
    this._index = Buffer.from(this._memory.buffer, 0, 12)
    this._parser = new global.WebAssembly.Instance(wasmModule, {
      js: {
        mem: this._memory,
      },
    })

    this._offset = 0
    this._data = []
  }

  _transform(chunk, encoding, callback) {
    try {
      this._data.push(chunk)
      // TODO: Put whole chunk in memory and size memory accordingly
      const pageSize = 1 << 16
      const available = this._memory.buffer.byteLength - pageSize
      if (available <= chunk.byteLength) {
        this._memory.grow(
          (
            (
              (chunk.byteLength - available) / pageSize
            ) >>> 0
          ) + 1
        )
        this._index = Buffer.from(this._memory.buffer, 0, 12)
      }

      const buf = new Uint8Array(this._memory.buffer, 0, this._memory.buffer.byteLength)
      chunk.copy(buf, 1 << 16, this._offset, buf.length)
      buf[(1 << 16) + chunk.length] = 0 // end of chunk indicator

      const currentOffset = this._offset
      const indexCount = this._parser.exports.write()
      this._offset = indexCount - chunk.byteLength

      const validFrom = this._index.readUint32LE(0)
      const validTo = this._index.readUInt32LE(4)
      if (validTo) {
        const buffers = this._data
        const curBuffer = buffers.at(-1)

        buffers[buffers.length - 1] = curBuffer
          .slice(
            buffers.length === 1 ? validFrom + currentOffset : 0,
            validTo + currentOffset
          )
        const parsed = JSON.parse(`[${buffers.length === 1 ? buffers[0] : Buffer.concat(buffers)}]`)
        for (const obj of parsed) {
          this.push(obj == null ? undefined : obj)
        }
        const lastValidStart = this._index.readUint32LE(8)
        if (lastValidStart > validTo) {
          this._data = [curBuffer.slice(lastValidStart)]
        } else {
          // No valid start in the left over data
          this._data = []
        }
      } else if (validFrom && this._data.length === 1) {
        // Remove skipped parts
        this._data[0] = this._data[0].slice(validFrom + currentOffset)
      }

      callback()
    } catch (err) {
      callback(err)
    }
  }
}

module.exports.JSONStream = JSONStream