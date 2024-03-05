const fs = require('fs')

const files = fs.readdirSync(__dirname)

  ;
(async () => {
  let failures = 0

  const results = []
  for (const file of files) {
    // skip self
    if (!file.endsWith('.test.js')) continue

    let status = 'fulfilled'
    let reason, start
    try {
      const test = require('./' + file)
      start = performance.now()
      await test()
    } catch (e) {
      failures = 1
      reason = e
      status = 'rejected'
    }
    const duration = (((performance.now() - start) * 100) >>> 0) / 100
    results.push({ file, status, reason, duration })
  }

  let logs = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      logs.push(`PASS ${result.file} (${result.duration}ms)`)
    } else {
      logs.push(`FAIL ${result.file} (${result.duration}ms):\n  ${result.reason.message}`)
    }
  }
  console.log(logs.join('\n'))
  process.exit(failures)
})()
