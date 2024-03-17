const fs = require('fs')
const { Transform } = require('stream')
let native
try {
  native = require('bindings')('chunk');
} catch (err) { }

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

    this._chunker = new Chunker({
      depth: !options.filter ? 0 : -1,
      property: this._propertyCallback.bind(this)
    })

    this._offset = 0
    this._data = []
  }

  _transform(chunk, encoding, callback) {
    try {
      this._data.push(chunk)

      const currentOffset = this._offset
      const { read, validTo, validFrom, lastValidFrom } = this._chunker.write(chunk.slice(currentOffset))
      this._offset = currentOffset + read - chunk.byteLength
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
        if (lastValidFrom > validTo) {
          this._data = [curBuffer.slice(lastValidFrom)]
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
        this._chunker.depth(meta.target.length)
      }
    }
  }
}

class WASMChunker {
  constructor({ depth, property }) {
    this._memory = new global.WebAssembly.Memory({ initial: 2 })
    this._parser = new global.WebAssembly.Instance(wasmModule, {
      js: {
        mem: this._memory,
        callback: property,
      },
    })
    this._index = Buffer.from(this._memory.buffer, 0, 16)
    if (depth > -1) {
      this.depth(depth)
    }
  }

  write(chunk) {
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
    chunk.copy(buf, 1 << 16, 0, buf.length)
    buf[(1 << 16) + chunk.length] = 0 // end of chunk indicator
    const indexCount = this._parser.exports.write()
    return {
      read: indexCount,
      validTo: this._index.readInt32LE(4),
      validFrom: this._index.readInt32LE(0),
      lastValidFrom: this._index.readInt32LE(8),
    }
  }

  depth(depth) {
    this._index.writeInt32LE(depth + 24, 12)
  }
}

const Chunker = native ? native.Chunker : WASMChunker

module.exports.JSONStream = JSONStream