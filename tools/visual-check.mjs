#!/usr/bin/env node
/* 真实浏览器视觉验收（XTDS fork，独立浏览器验证）
 *
 * 不启动真实 DSH，不碰真实 profile。流程：
 *   1) 临时 DSH_HOME + 假 host ctx 启动插件路由与注入行
 *   2) 无头 Chrome/Edge 打开真实注入页，确认默认暖白单幕、无第二幕
 *   3) 恢复占位 → 确认占位线稿可见
 *   4) 通过宿主导入路由导入一张测试 PNG → 确认自定义形象可见
 *   5) 删掉测试图片 → 确认回退占位且动画安全结束
 *
 * 截图写入 docs/evidence/，用于人工复核。退出码 0=全过。
 *
 * 用法：
 *   node tools/visual-check.mjs [--chrome=路径] [--speed=1]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'docs', 'evidence')
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=')
  return i === -1 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)]
}))

function pickBrowser(preferred) {
  const candidates = [
    preferred,
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean)
  for (const file of candidates) {
    try { fs.accessSync(file, fs.constants.X_OK); return file } catch (e) { /* 换下一个 */ }
  }
  return ''
}

const BROWSER = pickBrowser(args.chrome)
if (!BROWSER) {
  console.error('找不到 Chrome / Edge；可用 --chrome= 指定可执行文件。')
  process.exit(2)
}

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'xtds-visual-home-'))
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'xtds-visual-profile-'))
process.env.DSH_HOME = HOME
delete process.env.XTDS_UPDATE_REPO
delete process.env.DSH_STORE_URL
fs.mkdirSync(OUT_DIR, { recursive: true })
console.log('临时 DSH_HOME: ' + HOME)

const CONFIG_FILE = path.join(HOME, 'dsh-startup.json')
const USER_TEMPLATE_ROOT = path.join(HOME, 'startup-templates', 'xtds-character-reveal')
fs.writeFileSync(CONFIG_FILE, JSON.stringify({
  enabled: true,
  mode: 'always',
  theme: 'light',
  speed: Number(args.speed || 1),
  requireInteraction: true,
  allowSkip: false,
  sound: false,
  voice: false,
  template: 'archive-warm',
  act2: ''
}, null, 2), 'utf8')

let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) {
    pass++
    console.log('  PASS  ' + name + (detail ? '   [' + detail + ']' : ''))
  } else {
    fail++
    console.log('  FAIL  ' + name + (detail ? '   [' + detail + ']' : ''))
  }
}

/* 32×18 四色测试图，作为独立 base64 fixture 保存，避免自造 PNG 编码。 */
function makeTestPng() {
  const file = path.join(ROOT, 'tools', 'fixtures', 'test-character.png.b64')
  return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64')
}

/* ── 假 host：保留真实插件 apply + 真实路由，只替换 webServer 承载 ─────── */
const ROUTES = []
const INJECT_LISTENERS = []
const connection = { requestRejection: () => undefined }
const webServer = {
  register(route) {
    ROUTES.push(route)
    return () => {
      const at = ROUTES.indexOf(route)
      if (at >= 0) ROUTES.splice(at, 1)
    }
  },
  tapIndex() { return () => {} }
}
const webCtx = {
  webServer,
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'connection') return connection
    return undefined
  },
  on(name, fn) {
    if (name === 'webserver/index-inject') {
      INJECT_LISTENERS.push(fn)
      return () => {
        const at = INJECT_LISTENERS.indexOf(fn)
        if (at >= 0) INJECT_LISTENERS.splice(at, 1)
      }
    }
    return () => {}
  }
}
const ctx = {
  webServer,
  inject(deps, fn) { if (typeof fn === 'function') fn(webCtx) },
  on: webCtx.on,
  get: webCtx.get,
  effect(fn) {
    const dispose = fn()
    return () => { if (typeof dispose === 'function') dispose() }
  },
  logger: { warn() {}, error() {} }
}

const plugin = await import(pathToFileURL(path.join(ROOT, 'lib', 'index.js')).href)
plugin.default.apply(ctx)
if (!ROUTES.length) {
  console.error('插件没有注册任何路由；环境初始化失败')
  process.exit(2)
}

function jsValue(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')
}
function buildPage() {
  const rows = []
  for (const listener of INJECT_LISTENERS) listener(rows)
  if (!rows.length) throw new Error('没有拿到 webserver/index-inject 行')
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>xtds-start-dsh visual check</title>',
    `<script>
window.__ERR__=[];window.__DONE__=false;window.__DONE_AT__=0;window.__ACT2_SEEN__=false;window.__WARM_SEEN__=false;
window.addEventListener('error',function(e){window.__ERR__.push(String(e.message||e.error||'error'))});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;window.__ERR__.push('REJ: '+String(r&&r.stack||r))});
window.addEventListener('dsh-startup:done',function(){window.__DONE__=true;window.__DONE_AT__=Date.now()});
window.__STEP_LOG__=[];window.__STEP_LAST__='';
setInterval(function(){
  var n=document.querySelector('.dsu-status-zh');
  var s=n?String(n.textContent||'').replace(/\\u00a0/g,' ').replace(/\\s+/g,' ').trim():'';
  if(s&&s!==window.__STEP_LAST__){window.__STEP_LAST__=s;window.__STEP_LOG__.push({name:s,at:Date.now()})}
},16);
try{new MutationObserver(function(){
  if(document.getElementById('dsh-startup-act2'))window.__ACT2_SEEN__=true;
  if(document.getElementById('dsh-startup-root'))window.__WARM_SEEN__=true;
}).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}
</script>`
  ]
  const body = ['<div id="mock-app" style="position:fixed;inset:0;background:#f3f1eb"></div>']
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    if (row.kind === 'style') head.push('<style>' + String(row.text || '') + '</style>')
    else if (row.kind === 'html') {
      const target = String(row.placement || 'body') === 'head' ? head : body
      target.push(String(row.html || ''))
    } else if (row.kind === 'global' && row.name) {
      body.push('<script>window[' + JSON.stringify(String(row.name)) + ']=' + jsValue(row.value) + ';</script>')
    } else if (row.kind === 'script' && row.text) {
      body.push('<script>' + String(row.text).replace(/<\/script/gi, '<\\/script') + '</script>')
    } else if (row.kind === 'script-src' && row.src) {
      body.push('<script src="' + String(row.src).replace(/"/g, '&quot;') + '"></script>')
    }
  }
  return '<!doctype html><html lang="zh-CN"><head>' + head.join('\n') + '</head><body>' + body.join('\n') + '</body></html>'
}

function routeFor(pathname) {
  let exact = null
  let prefix = null
  for (const route of ROUTES) {
    if (route.kind === 'exact' && route.path === pathname) exact = route
    else if (route.kind === 'prefix' && (pathname === route.path || pathname.startsWith(route.path + '/'))) {
      if (!prefix || route.path.length > prefix.path.length) prefix = route
    }
  }
  return exact || prefix
}

const server = http.createServer((req, res) => {
  let pathname = '/'
  try { pathname = new URL(String(req.url || '/'), 'http://127.0.0.1').pathname } catch (e) { res.writeHead(400); res.end(); return }
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const html = buildPage()
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(html)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(String(err && err.message || err))
    }
    return
  }
  const route = routeFor(pathname)
  if (!route) { res.writeHead(404); res.end(); return }
  Promise.resolve(route.handler(req, res)).catch((err) => {
    try {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(String(err && err.message || err))
    } catch (e) { /* response 已断开 */ }
  })
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const PORT = server.address().port
const BASE = 'http://127.0.0.1:' + PORT

/* ── CDP ────────────────────────────────────────────────────────────────── */
const DEBUG_PORT = 9480 + Math.floor(Math.random() * 200)
const browser = spawn(BROWSER, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-extensions',
  '--disable-component-extensions-with-background-pages',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion,CalculateNativeWinOcclusionForRenderWidgetHost,IntensiveWakeUpThrottling',
  '--window-size=1280,720',
  '--remote-debugging-port=' + DEBUG_PORT,
  '--user-data-dir=' + PROFILE,
  'about:blank'
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let ws = null
let seq = 0
const pending = new Map()
const runtimeExceptions = []

async function connect() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + DEBUG_PORT + '/json')).json()
      const page = list.find((item) => item.type === 'page')
      if (page) return { url: page.webSocketDebuggerUrl, id: page.id }
    } catch (e) { /* 还没起来 */ }
    await sleep(250)
  }
  throw new Error('CDP 连不上')
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('CDP timeout: ' + method))
    }, 20000)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
const target = await connect()
ws = new WebSocket(target.url)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.method === 'Runtime.exceptionThrown') {
    const detail = msg.params.exceptionDetails || {}
    const ex = detail.exception || {}
    const text = String(ex.description || detail.text || ex.value || 'unknown')
    /* 临时 profile 仍可能被 Edge 组件扩展注入；扩展异常不属于插件页面。 */
    if (!text.includes('chrome-extension://')) runtimeExceptions.push(text)
  }
  if (msg.id && pending.has(msg.id)) {
    const item = pending.get(msg.id)
    pending.delete(msg.id)
    clearTimeout(item.timer)
    if (msg.error) item.reject(new Error(msg.error.message || 'CDP error'))
    else item.resolve(msg.result)
  }
})
await send('Runtime.enable')
await send('Page.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
try { await send('Emulation.setFocusEmulationEnabled', { enabled: true }) } catch (e) { /* 旧版浏览器没有 */ }
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(function(){
    var raw = window.requestAnimationFrame;
    window.__RAF_COUNT__ = 0;
    window.__RAF_ERR__ = [];
    window.requestAnimationFrame = function(cb) {
      return raw.call(window, function(ts) {
        window.__RAF_COUNT__++;
        try { cb(ts) } catch (e) { window.__RAF_ERR__.push(String(e && e.stack || e)); throw e }
      })
    }
  })()`
})

async function ev(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.text || 'evaluate failed'))
  return result.result ? result.result.value : undefined
}
async function wakePage() {
  try { await fetch('http://127.0.0.1:' + DEBUG_PORT + '/json/activate/' + target.id) } catch (e) { /* 旧版浏览器没有 */ }
  try { await send('Page.bringToFront') } catch (e) { /* 旧版浏览器没有 */ }
  try { await send('Page.setWebLifecycleState', { state: 'active' }) } catch (e) { /* 旧版浏览器没有 */ }
}
async function screenshot(file) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  const target = path.join(OUT_DIR, file)
  fs.writeFileSync(target, Buffer.from(result.data, 'base64'))
  console.log('  SHOT  ' + target)
  return target
}
async function openPage() {
  await wakePage()
  await send('Page.navigate', { url: BASE + '/?t=' + Date.now() })
  for (let i = 0; i < 80; i++) {
    try {
      if (await ev('document.readyState === "complete" && !!document.getElementById("dsh-startup-root")')) return
    } catch (e) { /* 导航中 */ }
    await sleep(100)
  }
  throw new Error('启动页面没有就绪')
}
async function waitDone(timeoutMs) {
  const start = Date.now()
  let act2Seen = false
  let lastWake = 0
  while (Date.now() - start < timeoutMs) {
    let state = null
    try {
      state = JSON.parse(await ev(`JSON.stringify({
        done:!!window.__DONE__,
        act2:!!document.getElementById("dsh-startup-act2"),
        root:!!document.getElementById("dsh-startup-root"),
        visibility:document.visibilityState,
        raf:window.__RAF_COUNT__||0
      })`))
    } catch (e) { /* 页面内还在跑 */ }
    if (state) {
      act2Seen = act2Seen || state.act2 === true
      if (state.done !== true && state.visibility === 'hidden' && Date.now() - lastWake > 800) {
        lastWake = Date.now()
        await wakePage()
      }
      if (state.done === true) {
        await sleep(120)
        state = JSON.parse(await ev(`JSON.stringify({
          done:!!window.__DONE__,
          act2:!!document.getElementById("dsh-startup-act2"),
          root:!!document.getElementById("dsh-startup-root"),
          err:window.__ERR__||[],
          raf:window.__RAF_COUNT__||0,
          rafErr:window.__RAF_ERR__||[],
          visibility:document.visibilityState,
          duration:(window.__DSH_STARTUP_API__&&window.__DSH_STARTUP_API__.duration)?window.__DSH_STARTUP_API__.duration():null,
          ovOpacity:(function(){var n=document.getElementById("dsh-startup-act2");return n?getComputedStyle(n).opacity:null})()
        })`))
        return state
      }
    }
    await sleep(100)
  }
  return JSON.parse(await ev(`JSON.stringify({
    done:!!window.__DONE__,
    act2:!!document.getElementById("dsh-startup-act2"),
    root:!!document.getElementById("dsh-startup-root"),
    err:window.__ERR__||[],
    raf:window.__RAF_COUNT__||0,
    rafErr:window.__RAF_ERR__||[],
    visibility:document.visibilityState,
    duration:(window.__DSH_STARTUP_API__&&window.__DSH_STARTUP_API__.duration)?window.__DSH_STARTUP_API__.duration():null,
    ovOpacity:(function(){var n=document.getElementById("dsh-startup-act2");return n?getComputedStyle(n).opacity:null})()
  })`))
}
async function waitAct2(timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await ev('!!document.getElementById("dsh-startup-act2")')) return true
    await sleep(100)
  }
  return false
}
async function characterLayer() {
  const raw = await ev(`(()=>{const n=document.querySelector('#dsh-startup-act2 .dsu-tl-layer[data-layer="character-slot"]');if(!n)return JSON.stringify(null);const s=getComputedStyle(n);return JSON.stringify({bg:s.backgroundImage,opacity:s.opacity})})()`)
  try { return JSON.parse(raw) } catch (e) { return null }
}
async function postJson(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  })
  return { status: res.status, json: await res.json() }
}
async function getConfig() {
  const res = await fetch(BASE + '/dsh-startup/config', { cache: 'no-store' })
  return res.json()
}

try {
  const cfg0 = await getConfig()
  console.log('\n[1] 默认启动：暖白单幕，无第二幕')
  check('默认第一幕是 archive-warm', cfg0 && cfg0.config && cfg0.config.template === 'archive-warm', cfg0 && cfg0.config && cfg0.config.template)
  check('默认第二幕为空', cfg0 && cfg0.config && cfg0.config.act2 === '', JSON.stringify(cfg0 && cfg0.config && cfg0.config.act2))
  await openPage()
  check('注入行里有第一幕模板', await ev('!!window.__DSH_STARTUP_TEMPLATE__ && window.__DSH_STARTUP_TEMPLATE__.id==="archive-warm"'))
  check('注入行里没有第二幕模板', await ev('typeof window.__DSH_STARTUP_TEMPLATE2__ === "undefined"'))
  let p1Ready = false
  for (let i = 0; i < 140; i++) {
    p1Ready = !!(await ev(`(function(){
      var t=document.querySelector('.dsu-status-zh');
      var b=document.querySelector('.dsu-btn');
      return !!t&&/需要访问许可/.test(String(t.textContent||''))&&!!b&&!b.hidden&&getComputedStyle(b).display!=='none';
    })()`))
    if (p1Ready) break
    await sleep(100)
  }
  check('P1 暖白画面出现', p1Ready)
  await sleep(800)
  const frameA = await send('Page.captureScreenshot', { format: 'png' })
  await sleep(350)
  const warmShot = await screenshot('01-default-warm-white.png')
  const frameB = await send('Page.captureScreenshot', { format: 'png' })
  check('暖白序列在运动（两帧不同）', frameA.data !== frameB.data)
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  const defaultState = await waitDone(22000)
  check('默认启动没有出现 #dsh-startup-act2', defaultState.act2 === false && (await ev('window.__ACT2_SEEN__===false')))
  check('默认启动结束后根节点被移除', defaultState.root === false)
  check('默认启动触发 done 事件', defaultState.done === true)
  check('默认启动无 JS 异常', (defaultState.err || []).length === 0, JSON.stringify(defaultState.err || []).slice(0, 240))
  const stepLog = JSON.parse(await ev('JSON.stringify(window.__STEP_LOG__||[])'))
  const stepAt = {}
  for (const item of stepLog) if (item && item.name && !stepAt[item.name]) stepAt[item.name] = item.at
  const automaticSpans = [
    stepAt['开始读取权限'] - stepAt['接收访问需求'],
    stepAt['读取完毕 · 核验通过'] - stepAt['开始读取权限'],
  ]
  const doneAt = Number(await ev('window.__DONE_AT__||0'))
  const p5Span = stepAt['读取完毕 · 核验通过'] ? doneAt - stepAt['读取完毕 · 核验通过'] : 0
  check('P3/P4/P5 每幕实际显示至少 1 秒',
    automaticSpans.every((ms) => Number.isFinite(ms) && ms >= 950) && p5Span >= 950,
    JSON.stringify({ p3: automaticSpans[0], p4: automaticSpans[1], p5: p5Span }))
  /* 后续场景需要自动走完第一幕，避免每次都等按键。 */
  const autoCfg = await postJson('/dsh-startup/config', { patch: { requireInteraction: false } })
  check('后续视觉场景切回自动播放', autoCfg.status === 200 && autoCfg.json && autoCfg.json.ok === true)

  console.log('\n[2] 恢复内置占位：第二幕占位线稿可见')
  const reset = await postJson('/dsh-startup/character/reset', {})
  check('POST character/reset 成功', reset.status === 200 && reset.json && reset.json.ok === true, String(reset.status) + ' ' + (reset.json && reset.json.error || ''))
  check('reset 后第二幕选中 xtds-character-reveal', reset.json && reset.json.config && reset.json.config.act2 === 'xtds-character-reveal', reset.json && reset.json.config && reset.json.config.act2)
  await openPage()
  check('注入行里有第二幕模板', await ev('!!window.__DSH_STARTUP_TEMPLATE2__ && window.__DSH_STARTUP_TEMPLATE2__.id==="xtds-character-reveal"'))
  const act2Placeholder = await waitAct2(26000)
  check('第一幕结束后进入第二幕', act2Placeholder)
  for (let i = 0; i < 30; i++) {
    if (await ev('(function(){var n=document.getElementById("dsh-startup-act2");return !!n&&parseFloat(getComputedStyle(n).opacity)>=0.99})()')) break
    await sleep(100)
  }
  await sleep(1500)
  const placeholderLayer = await characterLayer()
  check('占位角色图层可见', !!placeholderLayer && parseFloat(placeholderLayer.opacity || '0') > 0, placeholderLayer && JSON.stringify(placeholderLayer))
  check('占位角色使用 character-slot.svg', !!placeholderLayer && String(placeholderLayer.bg).includes('character-slot.svg'), placeholderLayer && placeholderLayer.bg)
  await screenshot('02-character-placeholder.png')
  const placeholderDone = await waitDone(18000)
  check('占位模式最终移除启动根节点', placeholderDone.root === false, JSON.stringify(placeholderDone).slice(0, 400))
  check('占位模式触发 done 事件', placeholderDone.done === true, JSON.stringify(placeholderDone).slice(0, 400))
  check('占位模式无 JS 异常', (placeholderDone.err || []).length === 0, JSON.stringify(placeholderDone.err || []).slice(0, 240))

  console.log('\n[3] 导入测试 PNG：自定义形象可见')
  const testPng = makeTestPng()
  const importedRes = await fetch(BASE + '/dsh-startup/character/import?name=visual-test.png', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: testPng
  })
  const imported = await importedRes.json()
  check('导入测试 PNG 成功', importedRes.status === 200 && imported && imported.ok === true, String(importedRes.status) + ' ' + (imported && imported.error || ''))
  check('生成了本机用户模板', fs.existsSync(path.join(USER_TEMPLATE_ROOT, 'template.json')))
  const assetNames = (() => {
    try { return fs.readdirSync(path.join(USER_TEMPLATE_ROOT, 'assets')) } catch (e) { return [] }
  })()
  check('测试图片已写入临时 DSH_HOME', assetNames.length === 1 && assetNames[0].endsWith('.png'), assetNames.join(','))
  await openPage()
  const act2Imported = await waitAct2(26000)
  check('导入后进入第二幕', act2Imported)
  await wakePage()
  for (let i = 0; i < 30; i++) {
    if (await ev('(function(){var n=document.getElementById("dsh-startup-act2");return !!n&&parseFloat(getComputedStyle(n).opacity)>=0.99})()')) break
    await sleep(100)
  }
  await sleep(1500)
  const importedLayer = await characterLayer()
  check('自定义形象图层可见', !!importedLayer && parseFloat(importedLayer.opacity || '0') > 0, importedLayer && JSON.stringify(importedLayer))
  check('自定义形象 URL 指向导入文件', !!importedLayer && !!assetNames[0] && String(importedLayer.bg).includes(assetNames[0]), importedLayer && importedLayer.bg)
  await screenshot('03-character-imported-test.png')
  const importedDone = await waitDone(18000)
  check('自定义形象模式安全结束', importedDone.root === false && importedDone.done === true, JSON.stringify(importedDone).slice(0, 400))
  check('自定义形象模式无 JS 异常', (importedDone.err || []).length === 0, JSON.stringify(importedDone.err || []).slice(0, 240))

  console.log('\n[4] 删除导入图片：回退占位，不黑屏')
  for (const name of assetNames) {
    try { fs.unlinkSync(path.join(USER_TEMPLATE_ROOT, 'assets', name)) } catch (e) { /* 已删 */ }
  }
  check('测试图片已从临时 DSH_HOME 删除', assetNames.every((name) => !fs.existsSync(path.join(USER_TEMPLATE_ROOT, 'assets', name))))
  await send('Network.clearBrowserCache')
  await openPage()
  const act2Missing = await waitAct2(26000)
  check('缺图时仍进入第二幕', act2Missing)
  check('引擎保留 fallbackSrc', await ev('!!(window.__DSH_STARTUP_TEMPLATE2__.layers||[]).find(function(L){return L&&L.id==="character-slot"&&L.fallbackSrc})'))
  let fallbackProbe = false
  for (let i = 0; i < 60; i++) {
    fallbackProbe = !!(await ev('!!document.querySelector(\'#dsh-startup-act2 .dsu-tl-layer[data-layer="character-slot"][data-image-fallback]\')'))
    if (fallbackProbe) break
    await sleep(50)
  }
  check('角色图层带 fallback 探测属性', fallbackProbe)
  await wakePage()
  let fallbackLayer = null
  for (let i = 0; i < 40; i++) {
    fallbackLayer = await characterLayer()
    if (fallbackLayer && String(fallbackLayer.bg).includes('character-slot.svg')) break
    await sleep(100)
  }
  check('缺图后自动回退 character-slot.svg', !!fallbackLayer && String(fallbackLayer.bg).includes('character-slot.svg'), fallbackLayer && fallbackLayer.bg)
  await sleep(700)
  await screenshot('04-character-missing-fallback.png')
  const missingDone = await waitDone(18000)
  check('缺图时动画仍安全结束', missingDone.root === false && missingDone.done === true, JSON.stringify(missingDone).slice(0, 400))
  check('缺图时没有黑屏/未处理异常', (missingDone.err || []).length === 0, JSON.stringify(missingDone.err || []).slice(0, 240))

  console.log('\n[5] 浏览器运行时异常')
  check('CDP 未捕获到 JS 异常', runtimeExceptions.length === 0, runtimeExceptions.join(' | ').slice(0, 500))
  check('暖白证据截图已生成', fs.existsSync(warmShot))

  console.log('\n视觉验收结果：' + pass + ' 通过 / ' + fail + ' 失败')
  if (fail) process.exitCode = 1
} catch (err) {
  console.error('\n视觉验收执行失败：' + String(err && err.stack || err))
  process.exitCode = 1
} finally {
  try { ws && ws.close() } catch (e) {}
  try { browser.kill() } catch (e) {}
  await new Promise((resolve) => server.close(resolve))
  await sleep(250)
  try {
    const diagFile = path.join(HOME, 'boot-suite-diag.log')
    if (fs.existsSync(diagFile)) {
      const lines = fs.readFileSync(diagFile, 'utf8').trim().split(/\r?\n/)
      console.log('\n诊断日志（末尾 30 行）：\n' + lines.slice(-30).join('\n'))
    }
  } catch (e) { /* 诊断不是验收条件 */ }
  if (args['keep-home']) {
    console.log('\n保留临时 DSH_HOME: ' + HOME)
  } else {
    try { fs.rmSync(HOME, { recursive: true, force: true }) } catch (e) {}
  }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch (e) {}
}
