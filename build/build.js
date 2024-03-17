const { execSync } = require('child_process')
const { resolve } = require('path')
const { createWriteStream, copyFileSync, rmSync, statSync } = require('fs')
const { platform } = require('os')
const { request } = require('https')

const wabtVersion = '1.0.34'

const os = platform()
const exe = os === 'win32' ? '.exe' : ''
const curPlatform = {
  win32: 'windows',
  linux: 'ubuntu',
  darwin: 'maxos',
}[os]

if (!curPlatform) {
  console.error(`No wabt release available for the current platform: "${os}"`)
  process.exit(1)
}

const extract = function () {
  execSync(`tar${exe} -x -f wabt.tar.gz wabt-${wabtVersion}/bin/wat2wasm${exe}`, { cwd: __dirname })
  copyFileSync(
    resolve(__dirname, `wabt-${wabtVersion}/bin/wat2wasm${exe}`),
    resolve(__dirname, `wat2wasm${exe}`)
  )
  rmSync(resolve(__dirname, `wabt-${wabtVersion}`), { force: true, recursive: true })
  rmSync(resolve(__dirname, 'wabt.tar.gz'))
}

const compile = function () {
  execSync(`./wat2wasm${exe} -o ../lib/chunk.wasm ../lib/chunk.wat`, { cwd: __dirname })
}

try {
  // Check that wat2wasm exists
  statSync(resolve(__dirname, `./wat2wasm${exe}`))
  compile()
} catch (err) {
  // Download wabt archive
  const file = createWriteStream(resolve(__dirname, 'wabt.tar.gz'), {
    flags: 'wx', // Fail if the file already exists
  })

  file.on('open', () => {
    const req = request({
      method: 'GET',
      host: 'github.com',
      path: `/WebAssembly/wabt/releases/download/${wabtVersion}/wabt-${wabtVersion}-${curPlatform}.tar.gz`
    })

    const onResponse = function (res) {
      if (res.statusCode === 302) {
        const req = request(res.headers.location)
        req.on('response', onResponse)
        req.end()
        return
      } else if (res.statusCode != 200) {
        console.log(`Failed to download wabt with status "${res.statusCode}".`)
        process.exit(1)
      }
      res.pipe(file)
    }

    req.on('response', onResponse)

    req.end()
  })

  file.on('error', () => {
    console.log('using existing wabt.tar.gz')
  })

  file.on('close', () => {
    extract()
    compile()
  })
}
