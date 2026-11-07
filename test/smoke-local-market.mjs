#!/usr/bin/env node
/* 本机插件商城 —— format-1 索引、本机 npm registry、安全边界与真实安装测试。 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'xtds-local-market-test-'))
const INSTALL_DIR = path.join(TEMP, 'install')
const NPM_CACHE = path.join(TEMP, 'npm-cache')
fs.mkdirSync(INSTALL_DIR, { recursive: true })

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) {
    pass++
    console.log('  ok   ' + label)
  } else {
    fail++
    console.log('  FAIL ' + label + (extra === undefined ? '' : '  -> ' + String(extra).slice(0, 800)))
  }
}

function requestWithHost(port, host, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: 'GET',
      headers: { Host: host },
    }, (res) => {
      res.resume()
      res.once('end', () => resolve(res.statusCode))
    })
    req.once('error', reject)
    req.end()
  })
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      shell: process.platform === 'win32',
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, 120000)
    child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (status, signal) => {
      clearTimeout(timer)
      resolve({ status, signal, timedOut, stdout, stderr })
    })
  })
}

let market = null
try {
  const mod = await import(pathToFileURL(path.join(ROOT, 'tools', 'local-market.mjs')).href)
  market = await mod.startLocalMarket({ port: 0, openBrowser: false })

  console.log('\n[1] format-1 索引与本机来源')
  check('服务只绑定 127.0.0.1', market.server.address().address === '127.0.0.1', JSON.stringify(market.server.address()))
  const healthRes = await fetch(market.baseUrl + '/health')
  const health = await healthRes.json()
  check('health 为 200', healthRes.status === 200)
  check('health 身份正确', health.ok === true && health.name === 'xtds-start-dsh' && health.version === '0.1.0', JSON.stringify(health))

  const indexRes = await fetch(market.indexUrl)
  const index = await indexRes.json()
  check('index 为 200', indexRes.status === 200)
  check('index format = 1', index.format === 1, String(index.format))
  check('index 标题含英文（DSH 必需）', !!index.title && typeof index.title.en === 'string' && index.title.en.length > 0)
  check('index 描述含英文（DSH 必需）', !!index.description && typeof index.description.en === 'string' && index.description.en.length > 0)
  check('index 只有一个插件', Array.isArray(index.plugins) && index.plugins.length === 1, index.plugins && index.plugins.length)
  const entry = index.plugins && index.plugins[0]
  check('插件名 = xtds-start-dsh', entry && entry.name === 'xtds-start-dsh', entry && entry.name)
  check('插件版本 = 0.1.0', entry && entry.versions && entry.versions[0] && entry.versions[0].version === '0.1.0', entry && entry.versions && entry.versions[0] && entry.versions[0].version)
  check('安装来源为 npm', entry && entry.versions[0].source.type === 'npm', entry && entry.versions[0].source.type)
  check('npm registry 指向本机', entry && entry.versions[0].source.registry === market.registryUrl, entry && entry.versions[0].source.registry)
  check('没有直接 tarball source（DSH 不接受）', entry && entry.versions[0].source.tarball === undefined)
  check('分类 id 已在 metadata 声明', entry && entry.metadata.category === 'startup' && !!index.metadata.categories.startup)
  check('索引保留沈宏宏署名', entry && /沈宏宏/.test(entry.author) && /6shenhonghong9/.test(entry.author), entry && entry.author)
  check('索引保留 LeeRolling 署名', entry && /LeeRolling/.test(entry.author), entry && entry.author)

  console.log('\n[2] npm packument 与 tarball')
  const packRes = await fetch(market.baseUrl + '/xtds-start-dsh')
  const packument = await packRes.json()
  check('packument 为 200', packRes.status === 200)
  check('dist-tags.latest = 0.1.0', packument['dist-tags'] && packument['dist-tags'].latest === '0.1.0', packument['dist-tags'] && packument['dist-tags'].latest)
  const manifest = packument.versions && packument.versions['0.1.0']
  check('version manifest 存在', !!manifest)
  check('manifest 身份正确', manifest && manifest.name === 'xtds-start-dsh' && manifest.version === '0.1.0')
  check('manifest 声明 DSH bundle patch', manifest && manifest.dsh && manifest.dsh.bundle && manifest.dsh.bundle.patch === './cordis.patch.yml')
  check('dist.tarball 是本机绝对地址', manifest && typeof manifest.dist.tarball === 'string' && manifest.dist.tarball.startsWith(market.baseUrl + '/'), manifest && manifest.dist.tarball)
  check('dist.integrity 为 sha512', manifest && /^sha512-/.test(manifest.dist.integrity), manifest && manifest.dist.integrity)
  check('dist.shasum 为 40 位十六进制', manifest && /^[0-9a-f]{40}$/.test(manifest.dist.shasum), manifest && manifest.dist.shasum)

  const tarRes = await fetch(manifest.dist.tarball)
  const tarBytes = Buffer.from(await tarRes.arrayBuffer())
  const digest = 'sha512-' + createHash('sha512').update(tarBytes).digest('base64')
  check('tarball 为 200', tarRes.status === 200)
  check('tarball 内容与 integrity 一致', digest === market.integrity)
  check('tarball 是 gzip', tarBytes[0] === 0x1f && tarBytes[1] === 0x8b)
  check('tarball 大小与本地发布包一致', tarBytes.length === market.tarballSize, `${tarBytes.length} / ${market.tarballSize}`)
  const headRes = await fetch(manifest.dist.tarball, { method: 'HEAD' })
  check('HEAD tarball = 200 且无 body', headRes.status === 200 && (await headRes.arrayBuffer()).byteLength === 0)
  check('HEAD Content-Length 正确', Number(headRes.headers.get('content-length')) === tarBytes.length, headRes.headers.get('content-length'))

  console.log('\n[3] 用 npm 从本机 registry 真实安装')
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const install = await run(npm, [
    'install',
    'xtds-start-dsh@0.1.0',
    '--prefix',
    INSTALL_DIR,
    '--registry',
    market.registryUrl,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
    '--cache',
    NPM_CACHE,
    '--loglevel=error',
  ], {
    cwd: TEMP,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  })
  check('npm install 退出码 = 0', install.status === 0 && install.timedOut === false, String(install.status) + ' ' + String(install.stderr || install.stdout).trim())
  const installedPackage = path.join(INSTALL_DIR, 'node_modules', 'xtds-start-dsh', 'package.json')
  let installed = null
  try { installed = JSON.parse(fs.readFileSync(installedPackage, 'utf8')) } catch {}
  check('已安装 package.json 可读', !!installed, installedPackage)
  check('已安装身份 = xtds-start-dsh@0.1.0', installed && installed.name === 'xtds-start-dsh' && installed.version === '0.1.0', installed && `${installed.name}@${installed.version}`)
  check('已安装包仍是 private: true', installed && installed.private === true)
  check('已安装包带 cordis.patch.yml', fs.existsSync(path.join(INSTALL_DIR, 'node_modules', 'xtds-start-dsh', 'cordis.patch.yml')))
  check('已安装包带默认暖白模板', fs.existsSync(path.join(INSTALL_DIR, 'node_modules', 'xtds-start-dsh', 'templates', 'archive-warm', 'template.json')))

  console.log('\n[4] 本机商城安全边界')
  const landingRes = await fetch(market.landingUrl)
  const landing = await landingRes.text()
  check('操作说明页为 200', landingRes.status === 200)
  check('说明页展示索引地址', landing.includes(market.indexUrl))
  check('说明页提到启用自定义插件索引', /自定义插件索引/.test(landing))
  check('说明页保留暖白视觉署名', /沈宏宏/.test(landing) && /LeeRolling/.test(landing))
  check('package.json 不在商城根目录暴露', (await fetch(market.baseUrl + '/package.json')).status === 404)
  check('编码的目录穿越被拒', (await fetch(market.baseUrl + '/%2e%2e/package.json')).status === 404)
  check('未知资源为 404', (await fetch(market.baseUrl + '/xtds-start-dsh/-/../../package.json')).status === 404)
  check('POST 被拒为 405', (await fetch(market.indexUrl, { method: 'POST' })).status === 405)
  check('非本机 Host 被拒为 403', (await requestWithHost(market.port, 'evil.example', '/index.json')) === 403)
} finally {
  if (market) {
    try { await market.close() } catch {}
  }
  try { fs.rmSync(TEMP, { recursive: true, force: true }) } catch {}
}

console.log('\n============================')
console.log('  通过 ' + pass + ' / 失败 ' + fail)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
