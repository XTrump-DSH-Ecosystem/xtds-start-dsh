#!/usr/bin/env node
/* P1/P2 交互与视觉回归：真实浏览器、真实 splash.js/css、临时目录。
 *
 * 检查：
 *   1) P1 仍显示“授予访问权限”，但页面上没有 Enter/Space/点击提示；
 *   2) 按 Enter 能继续（P1 触发条件未被移除）；
 *   3) P2 没有“确认身份”按钮，身份卡显示身份名称/编号/权限等级；
 *   4) P2 自动停留约 2 秒，并触发一次电视方格花屏；
 *   5) P1 刚出现就被点击时，P2 在扫描线真实结束 +100ms 左右出现；
 *   6) 启动根节点最终移除、done 事件触发、无 JS 异常。
 *
 * 证据写入 docs/evidence/05-p1-no-hint.png、06-p2-tv-glitch.png、
 * 07-p2-identity-card.png。
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'docs', 'evidence')
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'xtds-p2-home-'))
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'xtds-p2-profile-'))
process.env.DSH_HOME = HOME
fs.mkdirSync(OUT_DIR, { recursive: true })

function pickBrowser() {
  const candidates = [
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
    try { fs.accessSync(file, fs.constants.X_OK); return file } catch (e) { /* next */ }
  }
  return ''
}

const BROWSER = pickBrowser()
if (!BROWSER) {
  console.error('找不到 Chrome / Edge；可用 CHROME_PATH 指定可执行文件。')
  process.exit(2)
}

const PORT = await new Promise((resolve, reject) => {
  const srv = net.createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const port = srv.address().port
    srv.close(() => resolve(port))
  })
})

const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', 'archive-warm', 'template.json'), 'utf8'))
const libUrl = 'file:///' + path.join(ROOT, 'lib').replace(/\\/g, '/').replace(/ /g, '%20')
const pageFile = path.join(os.tmpdir(), 'xtds-p2-' + Date.now() + '.html')
const pageUrl = 'file:///' + pageFile.replace(/\\/g, '/').replace(/ /g, '%20')
fs.writeFileSync(pageFile, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${libUrl}/splash.css">
<style>body{margin:0;background:#000}#dsh-startup-root{position:fixed;inset:0}</style></head><body>
<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>
<script>
window.__DSH_STARTUP__={enabled:true,mode:'always',theme:'light',speed:1,requireInteraction:true,allowSkip:false,sound:false,voice:false,identity:'JOYCE MOORE',identityId:'0087',accessLevel:'3',template:'archive-warm',act2:''}
window.__DSH_STARTUP_TEMPLATE__=${JSON.stringify(tpl)}
window.__ERR__=[];window.__DONE__=false;window.__REC__={p1At:0,p1Text:'',p1Hint:false,p1Visible:false,scanSeen:false,scanStartAt:0,scanEndAt:0,clickAt:0,p2At:0,p2LeftAt:0,p2Card:'',p2BtnHidden:null,p2Hint:false,glitchCount:0,glitchAt:0}
window.addEventListener('error',function(e){window.__ERR__.push(String(e.message||e.error||'error'))})
window.addEventListener('unhandledrejection',function(e){var r=e.reason;window.__ERR__.push('REJ: '+String(r&&r.stack||r))})
window.addEventListener('dsh-startup:done',function(){window.__DONE__=true})
function __p2Status(){var n=document.querySelector('.dsu-status-zh');return n?String(n.textContent||'').trim():''}
setInterval(function(){
  var root=document.getElementById('dsh-startup-root')
  if(!root)return
  var status=__p2Status()
  var btn=root.querySelector('.dsu-btn')
  var card=root.querySelector('.dsu-card')
  var hint=root.querySelector('.dsu-hint')
  var scan=root.querySelector('.dsu-scanline')
  if(scan&&!window.__REC__.scanSeen&&scan.classList&&scan.classList.contains('dsu-go')){
    window.__REC__.scanSeen=true
    window.__REC__.scanStartAt=Date.now()
    scan.addEventListener('animationend',function(ev){
      if(!ev.animationName||ev.animationName==='dsu-scan')window.__REC__.scanEndAt=Date.now()
    },{once:true})
  }
  if(!window.__REC__.p1At&&status==='需要访问许可'&&btn&&!btn.hidden){
    var bs=getComputedStyle(btn)
    window.__REC__.p1At=Date.now()
    window.__REC__.p1Text=String(btn.textContent||'').trim()
    window.__REC__.p1Hint=!!hint||/按\\s*Enter|Space|点击按钮继续/.test(String(root.innerText||''))
    window.__REC__.p1Visible=bs.display!=='none'&&bs.visibility!=='hidden'&&parseFloat(bs.opacity||'1')>0
  }
  if(status==='身份资料确认'&&card&&!card.hidden){
    if(!window.__REC__.p2At){
      window.__REC__.p2At=Date.now()
      window.__REC__.p2Card=String(card.innerText||'').replace(/\\s+/g,' ').trim()
      window.__REC__.p2BtnHidden=!!(btn&&btn.hidden)
      window.__REC__.p2Hint=!!hint||/按\\s*Enter|Space|点击按钮继续/.test(String(root.innerText||''))
    }
    if(root.querySelector('.dsu-tvglitch.dsu-go')){
      window.__REC__.glitchCount=window.__DSH_TV_GLITCH_COUNT__||window.__REC__.glitchCount||0
      window.__REC__.glitchAt=window.__DSH_TV_GLITCH_AT__||window.__REC__.glitchAt
    }
  }
  if(window.__REC__.p2At&&!window.__REC__.p2LeftAt&&status==='接收访问需求')window.__REC__.p2LeftAt=Date.now()
},16)
</script><script src="${libUrl}/splash.js"></script></body></html>`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--disable-extensions', '--disable-component-extensions-with-background-pages',
  '--allow-file-access-from-files', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE, 'about:blank'
], { stdio: 'ignore' })

let ws = null
let seq = 0
const pending = new Map()
const runtimeExceptions = []

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('CDP 连接不可用: ' + method))
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('CDP 超时: ' + method))
    }, 15000)
    pending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v) },
      reject: (e) => { clearTimeout(timer); reject(e) }
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    for (const host of ['127.0.0.1', '[::1]']) {
      try {
        const res = await fetch('http://' + host + ':' + PORT + '/json')
        const list = await res.json()
        const page = list.find((t) => t.type === 'page')
        if (page) return page.webSocketDebuggerUrl
      } catch (e) { /* 还没起来 */ }
    }
    await sleep(250)
  }
  throw new Error('CDP 连不上')
}

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

async function ev(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(String(result.exceptionDetails.text || 'evaluate failed'))
  return result.result ? result.result.value : undefined
}

async function wake() {
  try { await fetch('http://127.0.0.1:' + PORT + '/json/activate/' + targetId) } catch (e) { /* noop */ }
  try { await send('Page.bringToFront') } catch (e) { /* noop */ }
  try { await send('Page.setWebLifecycleState', { state: 'active' }) } catch (e) { /* noop */ }
}

async function shot(file) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  const target = path.join(OUT_DIR, file)
  fs.writeFileSync(target, Buffer.from(result.data, 'base64'))
  console.log('  SHOT  ' + target)
  return target
}

async function waitUntil(expr, timeoutMs, everyMs = 30) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if (await ev(expr)) return true
    } catch (e) { /* 页面导航/重播中 */ }
    await sleep(everyMs)
  }
  return false
}

let targetId = ''
try {
  const wsUrl = await connect()
  ws = new WebSocket(wsUrl)
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
      if (!text.includes('chrome-extension://')) runtimeExceptions.push(text)
    }
    if (msg.id && pending.has(msg.id)) {
      const item = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) item.reject(new Error(msg.error.message || 'CDP error'))
      else item.resolve(msg.result)
    }
  })
  const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json()
  targetId = (list.find((t) => t.type === 'page') || {}).id || ''
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  try { await send('Emulation.setFocusEmulationEnabled', { enabled: true }) } catch (e) { /* 旧版浏览器没有 */ }
  await wake()
  await send('Page.navigate', { url: pageUrl })

  console.log('\n[1] P1：按钮保留，提示移除')
  check('P1 出现并可点击', await waitUntil('!!window.__REC__ && window.__REC__.p1At > 0', 18000), '等待 P1')
  await wake()
  const p1 = JSON.parse(await ev('JSON.stringify(window.__REC__)'))
  check('P1 按钮文案仍是“授予访问权限 / GRANT ACCESS”', /授予访问权限/.test(p1.p1Text) && /GRANT ACCESS/.test(p1.p1Text), p1.p1Text)
  check('P1 按钮可见', p1.p1Visible === true && p1.p1At > 0)
  check('P1 不再显示 Enter/Space/点击提示', p1.p1Hint === false, String(p1.p1Hint))
  check('DOM 中不存在 .dsu-hint', (await ev('!document.querySelector(".dsu-hint")')) === true)
  /* 按钮一出现就点，专门验证早期点击不会丢，也不会拖到语音播完。 */
  await ev('window.__REC__.clickAt=Date.now()')
  await wake()
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  const clickAt = Number(await ev('window.__REC__.clickAt'))
  check('P1 出现后立即点击（<800ms），用于覆盖早期点击场景', clickAt > p1.p1At && clickAt - p1.p1At < 800, (clickAt - p1.p1At) + 'ms')
  /* 点击已在 22ms 左右被接收；等到按钮淡入完成再截证据，避免截到半透明帧。 */
  await sleep(700)
  const p1Shot = await shot('05-p1-no-hint.png')
  /* README 的默认暖白截图也同步成当前 P1，避免继续展示旧提示/旧确认按钮。 */
  fs.copyFileSync(p1Shot, path.join(OUT_DIR, '01-default-warm-white.png'))
  console.log('  SHOT  ' + path.join(OUT_DIR, '01-default-warm-white.png'))

  console.log('\n[2] P2：无按钮、身份卡、自动停留')
  check('按 Enter 后进入 P2', await waitUntil('!!window.__REC__ && window.__REC__.p2At > 0', 12000))
  check('扫描线结束事件已记录', await waitUntil('!!window.__REC__ && window.__REC__.scanEndAt > 0', 4000))
  const switchInfo = JSON.parse(await ev('JSON.stringify(window.__REC__)'))
  const switchDelay = switchInfo.p2At - switchInfo.scanEndAt
  check('早期点击确实发生在扫描线结束前', switchInfo.clickAt > 0 && switchInfo.clickAt < switchInfo.scanEndAt,
    JSON.stringify({ clickAt: switchInfo.clickAt, scanEndAt: switchInfo.scanEndAt }))
  check('P2 在扫描线结束 +100ms 左右切页（不额外等语音/520ms）',
    Number.isFinite(switchDelay) && switchDelay >= 60 && switchDelay <= 400, switchDelay + 'ms')
  const glitchSeen = await waitUntil('!!window.__REC__ && window.__REC__.glitchCount > 0', 2500, 20)
  const glitchShot = glitchSeen ? await shot('06-p2-tv-glitch.png') : ''
  await sleep(480)
  const p2 = JSON.parse(await ev('JSON.stringify(window.__REC__)'))
  check('P2 没有显示“确认身份”按钮', p2.p2BtnHidden === true && (await ev('(function(){var b=document.querySelector(".dsu-btn");return !!b&&b.hidden})()')))
  check('P2 身份卡仍显示名称/编号/权限等级',
    /JOYCE MOORE/.test(p2.p2Card) && /0087/.test(p2.p2Card) && /(^|\s)3(\s|$)/.test(p2.p2Card), p2.p2Card)
  check('P2 不再显示 Enter/Space/点击提示', p2.p2Hint === false && (await ev('!document.querySelector(".dsu-hint")')))
  check('P2 入场触发一次电视方格花屏', glitchSeen && p2.glitchCount >= 1, JSON.stringify({ glitchSeen, count: p2.glitchCount }))
  const p2Shot = await shot('07-p2-identity-card.png')

  check('P2 自动离开（无需再按键）', await waitUntil('!!window.__REC__ && window.__REC__.p2LeftAt > 0', 6000))
  const timing = JSON.parse(await ev('JSON.stringify(window.__REC__)'))
  const stayMs = timing.p2LeftAt - timing.p2At
  check('P2 身份卡停留约 2 秒（含 320ms 淡出，1.8–2.8s）', stayMs >= 1800 && stayMs <= 2800, stayMs + 'ms')

  console.log('\n[3] 收尾与证据')
  check('最终触发 done 并移除根节点',
    await waitUntil('window.__DONE__===true && !document.getElementById("dsh-startup-root")', 18000))
  check('没有未处理的 JS 异常', runtimeExceptions.length === 0, runtimeExceptions.join(' | ').slice(0, 300))
  check('P1 证据截图存在', !!p1Shot && fs.existsSync(p1Shot))
  check('P2 电视花屏证据截图存在', !!glitchShot && fs.existsSync(glitchShot))
  check('P2 身份卡证据截图存在', !!p2Shot && fs.existsSync(p2Shot))

  console.log('\n[4] 扫描线结束后点击：不再额外等 320ms')
  await send('Page.navigate', { url: pageUrl })
  check('重载后 P1 再次出现', await waitUntil('!!window.__REC__ && window.__REC__.clickAt === 0 && window.__REC__.p2At === 0 && window.__REC__.p1At > 0', 18000))
  check('重载后扫描线完成', await waitUntil('!!window.__REC__ && window.__REC__.scanEndAt > 0', 8000))
  await ev('window.__REC__.clickAt=Date.now()')
  await wake()
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
  check('扫描线结束后点击可进入 P2', await waitUntil('!!window.__REC__ && window.__REC__.p2At > 0', 4000))
  const late = JSON.parse(await ev('JSON.stringify(window.__REC__)'))
  const lateDelay = late.p2At - late.clickAt
  check('点击发生在扫描线结束后', late.clickAt >= late.scanEndAt, JSON.stringify({ clickAt: late.clickAt, scanEndAt: late.scanEndAt }))
  check('扫描线结束后点击，P2 在 300ms 内出现', Number.isFinite(lateDelay) && lateDelay >= 0 && lateDelay <= 300, lateDelay + 'ms')
  check('延迟点击场景无新增 JS 异常', runtimeExceptions.length === 0, runtimeExceptions.join(' | ').slice(0, 300))
  await ev('window.__DSH_STARTUP_API__ && window.__DSH_STARTUP_API__.finish()')

  console.log('\nP1/P2 验收结果：' + pass + ' 通过 / ' + fail + ' 失败')
  if (fail) process.exitCode = 1
} catch (err) {
  console.error('\nP1/P2 验收执行失败：' + String(err && err.stack || err))
  process.exitCode = 1
} finally {
  try { ws && ws.close() } catch (e) {}
  try { browser.kill() } catch (e) {}
  await sleep(250)
  try { fs.rmSync(HOME, { recursive: true, force: true }) } catch (e) {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch (e) {}
  try { fs.rmSync(pageFile, { force: true }) } catch (e) {}
}
