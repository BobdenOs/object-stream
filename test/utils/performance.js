const kb = 1024
const mb = kb * kb
const gb = mb * kb

const round = n => ((n * 100) >>> 0) / 100
const pad = n => `${round(n)}`.padStart(11, ' ')

const measure = !!process.argv.slice(2).find(arg => arg in { "--performance": 1, "--perf": 1, "-p": 1 })

const loggers = {}

module.exports.log = function (start, bytes, objects) {
  if (!measure) return
  const dur = performance.now() - start

  const stack = {}
  Error.captureStackTrace(stack)

  const caller = /[^\\/]*\.test\.js/.exec(stack.stack.split('\n')[2])[0]
  const collector = loggers[caller] ??= {
    counter: 0,
    duration: 0,
    bytes,
    objects,
  }

  collector.counter++
  collector.duration += dur
  process.stdout.write('.')
}

module.exports.summary = function () {
  if (!measure) return ''
  for (const caller in loggers) {
    const average = loggers[caller]
    average.duration /= average.counter
    console.log('=====', caller, '=====')
    console.log('total size:', `~${round(average.bytes * average.counter / mb)}mb (duration: ${round(average.duration * average.counter)}ms)`)
    console.log('stream size:', `~${round(average.bytes / mb)}mb (duration: ${round(average.duration)}ms)`)
    console.log(pad(average.bytes / average.duration / kb), 'kib/ms')
    console.log(pad(average.bytes / average.duration / mb * 1000), 'mib/sec')
    console.log(pad(average.bytes / average.duration / gb * 1000 * 60), 'gib/min')
    console.log(pad(average.objects / average.duration), 'obj/ms')
  }
}
