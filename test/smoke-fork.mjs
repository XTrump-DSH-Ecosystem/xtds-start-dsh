#!/usr/bin/env node
/* XTDS fork 专项测试：默认单幕、旧配置归一化、离线更新/商店、身份一致。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const HOME = path.join(os.tmpdir(), 'xtds-fork-smoke-' + Date.now() + '-' + Math.random().toString(36).slice(2))
const IDENTITY_FILE = path.join(HOME, 'dsh-startup-identity.json')
fs.mkdirSync(HOME, { recursive: true })
process.env.DSH_HOME = HOME
delete process.env.XTDS_UPDATE_REPO
delete process.env.DSH_STORE_URL

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) {
    pass++
    console.log('  ok   ' + label)
  } else {
    fail++
    console.log('  FAIL ' + label + (extra === undefined ? '' : '  -> ' + String(extra).slice(0, 500)))
  }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }

const ROUTES = new Map()
const webServer = {
  register(route) {
    const key = (route.kind || 'exact') + ' ' + route.path
    if (ROUTES.has(key)) throw new Error('duplicate route ' + key)
    ROUTES.set(key, route)
    return () => ROUTES.delete(key)
  },
  tapIndex() { return () => {} },
}
const ctx = {
  webServer,
  on() { return () => {} },
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'connection') return { requestRejection: () => undefined }
    return undefined
  },
  effect(fn) {
    const dispose = fn()
    return () => { if (typeof dispose === 'function') dispose() }
  },
  logger: { warn() {} },
}

class FakeReq extends EventEmitter {
  constructor(method, body, url) {
    super()
    this.method = method
    this.headers = { host: '127.0.0.1:3080' }
    this.url = url || '/'
    process.nextTick(() => {
      if (body !== undefined) this.emit('data', Buffer.from(body))
      this.emit('end')
    })
  }
}
function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; return this },
    end(buf) { this.body = buf === undefined ? '' : Buffer.from(buf).toString('utf8') },
  }
}
async function call(routePath, method = 'GET', body, url) {
  const route = ROUTES.get('exact ' + routePath)
  if (!route) throw new Error('route missing: ' + routePath)
  const res = fakeRes()
  await route.handler(new FakeReq(method, body, url), res)
  return { res, json: JSON.parse(res.body || '{}') }
}

let networkCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = async () => {
  networkCalls++
  throw new Error('network must stay off')
}

try {
  const pkg = JSON.parse(read('package.json'))
  const patch = read('cordis.patch.yml')
  const indexJs = read('lib/index.js')
  const clientJs = read('lib/client.js')

  console.log('\n[1] 包与模块身份')
  check('package name = xtds-start-dsh', pkg.name === 'xtds-start-dsh', pkg.name)
  check('package version = 0.1.0', pkg.version === '0.1.0', pkg.version)
  check('package private = true', pkg.private === true, String(pkg.private))
  check('package license = MIT', pkg.license === 'MIT', pkg.license)
  check('cordis bundle id/name = xtds-start-dsh',
    /id:\s*xtds-start-dsh/.test(patch) && /name:\s*xtds-start-dsh/.test(patch))
  check('lib/index.js 导出同名插件', /const name = 'xtds-start-dsh'/.test(indexJs))
  check('lib/client.js loader id = xtds-start-dsh', /id:\s*'xtds-start-dsh'/.test(clientJs))
  check('没有旧 loader id', !/id:\s*'dsh-boot-suite'/.test(indexJs) && !/id:\s*'dsh-boot-suite'/.test(clientJs))
  check('旧包名仍保留在卸载兼容清单中',
    /xtds-boot-suite/.test(read('tools/emergency-uninstall.ps1')) &&
    /xtds-boot-suite/.test(read('tools/install.ps1')))

  const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href)
  mod.default.apply(ctx)

  console.log('\n[2] 默认单幕')
  let r = await call('/dsh-startup/config')
  check('GET config ok', r.json.ok === true)
  check('默认 template = archive-warm', r.json.config.template === 'archive-warm', r.json.config.template)
  check('默认 act2 = 空', r.json.config.act2 === '', JSON.stringify(r.json.config.act2))
  check('默认值也声明单幕', r.json.defaults.template === 'archive-warm' && r.json.defaults.act2 === '')
  check('默认主题为 light', r.json.config.theme === 'light', r.json.config.theme)
  check('身份资料默认仍是公开旧值', r.json.config.identity === 'JOYCE MOORE' && r.json.config.identityId === '0087' && r.json.config.accessLevel === '3',
    JSON.stringify({ identity: r.json.config.identity, id: r.json.config.identityId, level: r.json.config.accessLevel }))
  check('默认身份资料落在独立文件', fs.existsSync(IDENTITY_FILE))
  check('client.js 的离线兜底也是单幕', /template: 'archive-warm', act2: ''/.test(clientJs))

  console.log('\n[3] 旧配置归一化')
  fs.rmSync(IDENTITY_FILE, { force: true })
  fs.writeFileSync(path.join(HOME, 'dsh-startup.json'), JSON.stringify({
    template: 'whale-girl-scan',
    act2: 'deep-sonar',
    identity: 'OLD CONFIG',
  }), 'utf8')
  r = await call('/dsh-startup/config')
  check('旧 template 回退 archive-warm', r.json.config.template === 'archive-warm', r.json.config.template)
  check('旧 act2 回退为空', r.json.config.act2 === '', JSON.stringify(r.json.config.act2))
  check('其他旧字段仍可读', r.json.config.identity === 'OLD CONFIG', r.json.config.identity)

  fs.writeFileSync(path.join(HOME, 'dsh-startup.json'), JSON.stringify({
    template: 'dsh-intro-full',
    act2: 'whale-girl-scan-4k-h264',
  }), 'utf8')
  r = await call('/dsh-startup/config')
  check('另一组旧 template 也回退', r.json.config.template === 'archive-warm', r.json.config.template)
  check('另一组旧 act2 也回退', r.json.config.act2 === '', JSON.stringify(r.json.config.act2))

  const missingAct2 = await call('/dsh-startup/config', 'POST', JSON.stringify({ patch: { template: 'archive-warm' } }))
  check('新配置未给 act2 时保持空', missingAct2.json.config.act2 === '', JSON.stringify(missingAct2.json.config.act2))

  console.log('\n[4] 未配置环境变量时，更新与商店关闭')
  r = await call('/dsh-startup/update-check')
  check('update-check 不访问网络', networkCalls === 0, String(networkCalls))
  check('update-check ok=false', r.json.ok === false)
  check('update-check disabled=true', r.json.disabled === true, JSON.stringify(r.json.disabled))
  check('update-check 当前版本 0.1.0', r.json.current === '0.1.0', r.json.current)
  check('update-check 明确提示已关闭', /关闭/.test(String(r.json.error)), r.json.error)

  r = await call('/dsh-startup/store')
  check('store 不访问网络', networkCalls === 0, String(networkCalls))
  check('store ok=false', r.json.ok === false)
  check('store 列表为空', Array.isArray(r.json.templates) && r.json.templates.length === 0)
  check('store 明确提示未配置', /未配置/.test(String(r.json.error)), r.json.error)

  console.log('\n[5] 内置模板只剩两个')
  const ids = fs.readdirSync(path.join(ROOT, 'templates'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'templates', d.name, 'template.json')))
    .map((d) => d.name)
    .sort()
  check('templates = archive-warm + xtds-character-reveal',
    ids.join(',') === 'archive-warm,xtds-character-reveal', ids.join(','))
} finally {
  globalThis.fetch = realFetch
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch {}
}

console.log('\n============================')
console.log('  通过 ' + pass + ' / 失败 ' + fail)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
