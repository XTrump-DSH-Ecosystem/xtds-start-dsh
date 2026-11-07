#!/usr/bin/env node
/* 身份资料独立配置测试：默认值、独立文件、旧配置回退、示例文件。 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const HOME = path.join(os.tmpdir(), 'xtds-identity-smoke-' + Date.now() + '-' + Math.random().toString(36).slice(2))
const CONFIG_FILE = path.join(HOME, 'dsh-startup.json')
const IDENTITY_FILE = path.join(HOME, 'dsh-startup-identity.json')
const EXAMPLE_FILE = path.join(ROOT, 'config', 'dsh-startup-identity.example.json')

fs.mkdirSync(HOME, { recursive: true })
process.env.DSH_HOME = HOME

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
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

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
async function call(method = 'GET', body) {
  const route = ROUTES.get('exact /dsh-startup/config')
  if (!route) throw new Error('config route missing')
  const res = fakeRes()
  await route.handler(new FakeReq(method, body, '/dsh-startup/config'), res)
  return { res, json: JSON.parse(res.body || '{}') }
}

try {
  const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href)
  mod.default.apply(ctx)

  console.log('\n[1] 新安装：默认身份与独立文件')
  let r = await call()
  check('默认身份名称 = JOYCE MOORE', r.json.config.identity === 'JOYCE MOORE', r.json.config.identity)
  check('默认身份编号 = 0087', r.json.config.identityId === '0087', r.json.config.identityId)
  check('默认权限等级 = 3', r.json.config.accessLevel === '3', r.json.config.accessLevel)
  check('返回身份文件路径', r.json.identityFile === IDENTITY_FILE, r.json.identityFile)
  check('启动后生成独立身份文件', fs.existsSync(IDENTITY_FILE), IDENTITY_FILE)
  const initialIdentity = readJson(IDENTITY_FILE) || {}
  check('身份文件内容为默认值',
    initialIdentity.schemaVersion === 1 &&
    initialIdentity.identity === 'JOYCE MOORE' &&
    initialIdentity.identityId === '0087' &&
    initialIdentity.accessLevel === '3',
    JSON.stringify(initialIdentity))
  check('新安装不凭空创建主配置', !fs.existsSync(CONFIG_FILE), CONFIG_FILE)

  console.log('\n[2] 保存时只写身份文件，主配置不混入身份字段')
  r = await call('POST', JSON.stringify({ patch: { identity: 'LOCAL TEST', identityId: '2468', accessLevel: '2', speed: 1.2 } }))
  check('POST 成功并回显', r.json.ok === true && r.json.config.identity === 'LOCAL TEST', JSON.stringify(r.json.config && {
    identity: r.json.config.identity, identityId: r.json.config.identityId, accessLevel: r.json.config.accessLevel
  }))
  const main = readJson(CONFIG_FILE) || {}
  const identity = readJson(IDENTITY_FILE) || {}
  check('主配置写入 speed', main.speed === 1.2, String(main.speed))
  check('主配置不含 identity', !Object.prototype.hasOwnProperty.call(main, 'identity'))
  check('主配置不含 identityId', !Object.prototype.hasOwnProperty.call(main, 'identityId'))
  check('主配置不含 accessLevel', !Object.prototype.hasOwnProperty.call(main, 'accessLevel'))
  check('身份文件保存新值',
    identity.identity === 'LOCAL TEST' && identity.identityId === '2468' && identity.accessLevel === '2',
    JSON.stringify(identity))

  r = await call()
  check('重新读取会合并两个文件',
    r.json.config.identity === 'LOCAL TEST' && r.json.config.identityId === '2468' &&
    r.json.config.accessLevel === '2' && r.json.config.speed === 1.2,
    JSON.stringify({ identity: r.json.config.identity, id: r.json.config.identityId, level: r.json.config.accessLevel, speed: r.json.config.speed }))

  console.log('\n[3] 恢复默认会恢复公开默认身份')
  r = await call('POST', JSON.stringify({ action: 'reset' }))
  check('reset 后身份名称 = JOYCE MOORE', r.json.config.identity === 'JOYCE MOORE', r.json.config.identity)
  check('reset 后身份编号 = 0087', r.json.config.identityId === '0087', r.json.config.identityId)
  check('reset 后权限等级 = 3', r.json.config.accessLevel === '3', r.json.config.accessLevel)
  const resetMain = readJson(CONFIG_FILE) || {}
  check('reset 后主配置仍不含身份字段', !('identity' in resetMain) && !('identityId' in resetMain) && !('accessLevel' in resetMain))

  console.log('\n[4] 旧配置兼容：没有独立文件时读旧身份')
  fs.rmSync(IDENTITY_FILE, { force: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    template: 'archive-warm',
    speed: 1.4,
    identity: 'OLD CONFIG',
    identityId: '0001',
    accessLevel: '3'
  }, null, 2), 'utf8')
  r = await call()
  check('旧配置身份仍可读', r.json.config.identity === 'OLD CONFIG' && r.json.config.identityId === '0001' && r.json.config.accessLevel === '3',
    JSON.stringify({ identity: r.json.config.identity, id: r.json.config.identityId, level: r.json.config.accessLevel }))
  r = await call('POST', JSON.stringify({ patch: { speed: 1.5 } }))
  const migratedMain = readJson(CONFIG_FILE) || {}
  const migratedIdentity = readJson(IDENTITY_FILE) || {}
  check('保存其他字段时把旧身份迁入独立文件',
    migratedIdentity.identity === 'OLD CONFIG' && migratedIdentity.identityId === '0001' && migratedIdentity.accessLevel === '3',
    JSON.stringify(migratedIdentity))
  check('迁移后主配置剥离身份字段', !('identity' in migratedMain) && !('identityId' in migratedMain) && !('accessLevel' in migratedMain))

  console.log('\n[5] 示例文件沿用原来的身份资料')
  const example = readJson(EXAMPLE_FILE) || {}
  check('示例文件存在且可解析', fs.existsSync(EXAMPLE_FILE) && !!example, EXAMPLE_FILE)
  check('示例身份名称 = JOYCE MOORE', example.identity === 'JOYCE MOORE', example.identity)
  check('示例身份编号 = 0087', example.identityId === '0087', example.identityId)
  check('示例权限等级 = 3', example.accessLevel === '3', example.accessLevel)
} finally {
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch {}
}

console.log('\n============================')
console.log('  通过 ' + pass + ' / 失败 ' + fail)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
