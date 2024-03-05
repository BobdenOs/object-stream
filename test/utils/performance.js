const kb = 1024
const mb = kb * kb
const gb = mb * kb

const round = n => ((n * 100) >>> 0) / 100
const pad = n => `${round(n)}`.padStart(11, ' ')

const measure = !!process.argv.slice(2).find(arg => arg in { "--performance": 1, "--perf": 1, "-p": 1 })

module.exports.log = function (start, bytes, objects) {
  if (!measure) return
  const stack = {}
  Error.captureStackTrace(stack)

  const caller = /[^\\/]*\.test\.js/.exec(stack.stack.split('\n')[2])[0]
  const dur = performance.now() - start

  console.log('=====', caller, '=====')
  console.log('stream size:', `~${round(bytes / mb)}mb (duration: ${round(dur)}ms)`)
  console.log(pad(bytes / dur / kb), 'kib/ms')
  console.log(pad(bytes / dur / mb * 1000), 'mib/sec')
  console.log(pad(bytes / dur / gb * 1000 * 60), 'gib/min')
  console.log(pad(objects / dur), 'obj/ms')
}
