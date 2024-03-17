# object-stream

A JSON buffer to Object converter stream implementation.

## implementations

The liberary has currently 2 implementations. One in WASM and one in NAPI. As NAPI can be difficult to make work. The WASM implementation is precompiled and platform independant.

- chunk.wat
- chunk.cc

### performance

Comparing the WASM and the NAPI implementation. There is not a large difference in real world performance. The NAPI implementation is ~1.2x faster then the WASM implementation in all aspects. But when removing the `JSON.parse` from the implementation it becomes clear that the NAPI implementation is ~2x faster then the WASM implementation in producing the chunk information. This is probably related to the WASM implementation being isolated and requiring to memcpy the chunks into its owned memory.
