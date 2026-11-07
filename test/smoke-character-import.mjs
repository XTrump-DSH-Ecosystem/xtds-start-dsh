#!/usr/bin/env node
/* 自定义形象导入 —— 宿主路由端到端测试。
 *
 * 覆盖：
 *   [1] 路由存在 / 方法限制 / SVG / 改扩展名的假图片被拒
 *   [2] 有效 PNG 导入成功，生成用户覆盖模板与素材
 *   [3] 再次导入会替换旧素材，不堆积旧图
 *   [4] reset 删除本机覆盖并恢复内置占位
 *   [5] 20MB 上限 fail-closed，不残留模板
 *
 * 全程使用临时 DSH_HOME；finally 清理，绝不碰真实 ~/.dsh。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HOME = path.join(os.tmpdir(), 'xtds-character-import-' + Date.now() + '-' + Math.random().toString(36).slice(2))
fs.mkdirSync(HOME, { recursive: true })
process.env.DSH_HOME = HOME
delete process.env.XTDS_UPDATE_REPO
delete process.env.DSH_STORE_URL

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))
const USER_ROOT = path.join(HOME, 'startup-templates')
const TARGET_DIR = path.join(USER_ROOT, 'xtds-character-reveal')
const CONFIG_FILE = path.join(HOME, 'dsh-startup.json')
const PNG_1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const PNG_2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHgQCAV5c9nAAAAAASUVORK5CYII=', 'base64')

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
const connection = { requestRejection: () => undefined }
const ctx = {
  webServer,
  on() { return () => {} },
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'connection') return connection
    return undefined
  },
  effect(fn) {
    const dispose = fn()
    return () => { if (typeof dispose === 'function') dispose() }
  },
  logger: { warn() {} },
}

class FakeReq extends EventEmitter {
  constructor(method, url, chunks) {
    super()
    this.method = method
    this.headers = { host: '127.0.0.1:3080' }
    this.url = url
    this._chunks = chunks || []
    this.destroyed = false
  }
  flush() {
    for (const chunk of this._chunks) this.emit('data', chunk)
    this.emit('end')
  }
  destroy() { this.destroyed = true }
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code
      this.headers = headers || {}
      return this
    },
    end(buf) {
      this.body = buf === undefined ? '' : Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)
    },
  }
}

const routeKey = (suffix) => 'exact /dsh-startup/' + suffix
const routeOf = (suffix) => {
  const route = ROUTES.get(routeKey(suffix))
  if (!route) throw new Error('route missing: ' + suffix)
  return route
}
const parse = (res) => {
  try { return JSON.parse(res.body) } catch { return null }
}
const slash = (value) => String(value).replace(/\\/g, '/')

async function call(suffix, opts = {}) {
  const req = new FakeReq(opts.method || 'GET', opts.url || ('/dsh-startup/' + suffix), opts.chunks)
  const res = fakeRes()
  const pending = routeOf(suffix).handler(req, res)
  req.flush()
  await pending
  return { res, json: parse(res) }
}

function importCharacter(name, bytes) {
  const url = '/dsh-startup/character/import?name=' + encodeURIComponent(name)
  return call('character/import', {
    method: 'POST',
    url,
    chunks: [Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)],
  })
}

async function importTooBig() {
  const req = new FakeReq('POST', '/dsh-startup/character/import?name=too-big.png', [])
  const res = fakeRes()
  const pending = routeOf('character/import').handler(req, res)
  req.emit('data', { length: 11 * 1024 * 1024 })
  req.emit('data', { length: 11 * 1024 * 1024 })
  await pending
  return { res, json: parse(res) }
}

function userAssets() {
  try {
    return fs.readdirSync(path.join(TARGET_DIR, 'assets')).sort()
  } catch {
    return []
  }
}

try {
  const mod = await import(pathToFileURL(path.join(PLUGIN_ROOT, 'lib', 'index.js')).href)
  mod.default.apply(ctx)

  console.log('\n[1] 路由、方法限制与危险输入')
  check('注册了 POST /dsh-startup/character/import', ROUTES.has(routeKey('character/import')))
  check('注册了 POST /dsh-startup/character/reset', ROUTES.has(routeKey('character/reset')))

  let r = await call('character/import')
  check('GET import -> 405', r.res.statusCode === 405 && r.json && r.json.ok === false, String(r.res.statusCode))
  r = await call('character/reset')
  check('GET reset -> 405', r.res.statusCode === 405 && r.json && r.json.ok === false, String(r.res.statusCode))

  r = await importCharacter('evil.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
  check('SVG 被拒 -> 400', r.res.statusCode === 400 && r.json && /SVG|svg/.test(String(r.json.error)), String(r.res.statusCode) + ' ' + (r.json && r.json.error))

  r = await importCharacter('fake.png', Buffer.from('this is not an image at all'))
  check('改扩展名的非图片字节被拒 -> 400', r.res.statusCode === 400 && r.json && /不是有效/.test(String(r.json.error)), String(r.res.statusCode) + ' ' + (r.json && r.json.error))

  check('被拒请求没有生成用户目录', !fs.existsSync(TARGET_DIR))
  check('被拒请求没有写入配置', !fs.existsSync(CONFIG_FILE))

  console.log('\n[2] 有效 PNG 导入')
  r = await importCharacter('我的形象.png', PNG_1)
  const first = r.json || {}
  check('导入成功 -> 200', r.res.statusCode === 200 && first.ok === true, String(r.res.statusCode) + ' ' + (first.error || ''))
  check('返回固定模板 id', first.id === 'xtds-character-reveal', String(first.id))
  check('返回显示名（去扩展名）', first.name === '我的形象', String(first.name))
  check('返回文件路径位于临时 DSH_HOME', slash(first.file).startsWith(slash(TARGET_DIR) + '/'), slash(first.file))
  check('原图字节完整落盘', userAssets().length === 1 && Buffer.compare(fs.readFileSync(path.join(TARGET_DIR, 'assets', userAssets()[0])), PNG_1) === 0, userAssets().join(','))

  const tplFile = path.join(TARGET_DIR, 'template.json')
  let tpl = null
  try { tpl = JSON.parse(fs.readFileSync(tplFile, 'utf8')) } catch {}
  check('用户 template.json 已生成且可解析', !!tpl)
  if (tpl) {
    const layer = (tpl.layers || []).find((item) => item && item.id === 'character-slot')
    check('模板 id 固定为 xtds-character-reveal', tpl.id === 'xtds-character-reveal', String(tpl.id))
    check('作者标为用户自定义，不冒用原作者', tpl.author === 'XTDS 用户自定义', String(tpl.author))
    check('许可标为用户自备素材', /用户自备/.test(String(tpl.license)), String(tpl.license))
    check('角色图层仍叫 character-slot', !!layer)
    check('角色图层指向导入素材', !!layer && layer.src === userAssets()[0], layer && layer.src)
    check('角色图层保留占位回退', !!layer && layer.fallbackSrc === 'character-slot.svg', layer && layer.fallbackSrc)
  }
  check('配置 act2 已写入 xtds-character-reveal', first.config && first.config.act2 === 'xtds-character-reveal', first.config && first.config.act2)
  check('响应附带可播放的覆盖模板', first.template && first.template.id === 'xtds-character-reveal')

  console.log('\n[3] 再次导入替换旧图')
  const oldAsset = userAssets()[0]
  r = await importCharacter('第二个形象.png', PNG_2)
  const second = r.json || {}
  check('第二次导入成功', r.res.statusCode === 200 && second.ok === true, String(r.res.statusCode) + ' ' + (second.error || ''))
  check('旧图被清理，只剩一张新图', userAssets().length === 1 && userAssets()[0] !== oldAsset, userAssets().join(','))
  check('新图字节正确', userAssets().length === 1 && Buffer.compare(fs.readFileSync(path.join(TARGET_DIR, 'assets', userAssets()[0])), PNG_2) === 0)

  console.log('\n[4] reset 恢复内置占位')
  r = await call('character/reset', { method: 'POST' })
  const reset = r.json || {}
  check('reset 成功', r.res.statusCode === 200 && reset.ok === true, String(r.res.statusCode) + ' ' + (reset.error || ''))
  check('用户覆盖目录已删除', !fs.existsSync(TARGET_DIR))
  check('reset 后仍选中形象揭示槽位', reset.config && reset.config.act2 === 'xtds-character-reveal', reset.config && reset.config.act2)
  const resetLayer = reset.template && (reset.template.layers || []).find((item) => item && item.id === 'character-slot')
  check('reset 返回内置占位图层', !!resetLayer && resetLayer.src === 'character-slot.svg', resetLayer && resetLayer.src)

  console.log('\n[5] 20MB 上限')
  r = await importTooBig()
  check('超过 20MB -> 413', r.res.statusCode === 413 && r.json && r.json.ok === false, String(r.res.statusCode))
  check('超限请求没有重建用户目录', !fs.existsSync(TARGET_DIR))
} finally {
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch {}
}

console.log('\n============================')
console.log('  通过 ' + pass + ' / 失败 ' + fail)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
