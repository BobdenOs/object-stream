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
    this._filter = {
      target: options.filter || [],
      start: -1,
      path: [],
    }
    this._memory = new global.WebAssembly.Memory({ initial: 2 })
    this._index = Buffer.from(this._memory.buffer, 0, 16)
    this._parser = new global.WebAssembly.Instance(wasmModule, {
      js: {
        mem: this._memory,
        callback: this._propertyCallback.bind(this),
      },
    })

    if (!options.filter) {
      this._index.writeUint32LE(24, 12)
    }

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
        this._index = Buffer.from(this._memory.buffer, 0, 16)
      }

      const buf = new Uint8Array(this._memory.buffer, 0, this._memory.buffer.byteLength)
      chunk.copy(buf, 1 << 16, this._offset, buf.length)
      buf[(1 << 16) + chunk.length] = 0 // end of chunk indicator

      const currentOffset = this._offset
      const indexCount = this._parser.exports.write()
      this._offset = indexCount - chunk.byteLength

      const validFrom = this._index.readInt32LE(0)
      const validTo = this._index.readInt32LE(4)
      if (validTo > 0) {
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
        const lastValidStart = this._index.readInt32LE(8)
        if (lastValidStart > validTo) {
          this._data = [curBuffer.slice(lastValidStart)]
        } else {
          // No valid start in the left over data
          this._data = []
        }
      } else if (validFrom > -1 && this._data.length === 1) {
        // Remove skipped parts
        this._data[0] = this._data[0].slice(validFrom + currentOffset)
      } else if (this._filter.start > 0) {
        this._data[0] = this._data[0].slice(this._filter.start + currentOffset)
        this._filter.start = 0
      } else if (this._data.length === 1) {
        // Remove chunks that are fully ignored
        this._data = []
      }
      callback()
    } catch (err) {
      callback(err)
    }
  }

  _propertyCallback(index) {
    const meta = this._filter
    if (index < 0) {
      meta.path.pop()
      return
    }
    if (meta.start < 0) {
      meta.start = index
    } else {
      const buffers = this._data
      const curBuffer = buffers.at(-1)

      buffers[buffers.length - 1] = curBuffer
        .slice(buffers.length === 1 ? meta.start : 0, index)
      meta.path.push(JSON.parse(buffers.length === 1 ? buffers[0] : Buffer.concat(buffers)))
      this._data = [curBuffer]
      meta.start = -1
      if (meta.path.length === meta.target.length && !meta.target.find((v, i) => meta.path[i] !== v)) {
        // Switch to processing all objects at the target level
        this._index.writeUint32LE(meta.target.length + 24, 12)
      }
    }
  }
}

module.exports.JSONStream = JSONStream