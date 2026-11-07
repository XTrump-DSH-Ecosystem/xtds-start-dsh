#!/usr/bin/env node
/* 动效回归检查（借自 motion-web 的"自动化验证"思路）
 *
 * 不靠人眼看：起一个 headless Chrome，按真实时间跑一遍开机动画，断言四件事
 *   1) 没有 JS 异常
 *   2) 画面真的在动（两帧截图字节不同，静止即失败）
 *   3) 分幕文案确实换过（至少 3 种不同状态行）
 *   4) 结束时根节点被移除、done 事件触发（收得干净）
 *
 * 用法：node tools/motion-check.mjs [--template=archive-warm] [--speed=3] [--chrome=路径]
 * 退出码：0 全过 / 1 有失败 / 2 环境不可用（没 Chrome 等）
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=')
  return i === -1 ? [a.slice(2), '1'] : [a.slice(2, i), a.slice(i + 1)]
}))
const TEMPLATE = args.template || 'archive-warm'
const SPEED = Number(args.speed || 3)
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
  return candidates[0] || ''
}
const CHROME = pickBrowser(args.chrome)
const PORT = await new Promise((resolve, reject) => {
  const srv = net.createServer()
  srv.once('error', reject)
  srv.listen(0, '127.0.0.1', () => {
    const port = srv.address().port
    srv.close(() => resolve(port))
  })
})

const tplPath = path.join(ROOT, 'templates', TEMPLATE, 'template.json')
if (!fs.existsSync(tplPath)) { console.error('模板不存在: ' + tplPath); process.exit(2) }
if (!CHROME || !fs.existsSync(CHROME)) {
  console.error('找不到 Chrome / Edge（用 --chrome= 指定可执行文件路径）')
  process.exit(2)
}
const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'))
const libUrl = 'file:///' + path.join(ROOT, 'lib').replace(/\\/g, '/').replace(/ /g, '%20')
const tmp = path.join(os.tmpdir(), 'dsh-motion-' + Date.now() + '.html')
fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${libUrl}/splash.css">
<style>body{margin:0;background:#000}#dsh-startup-root{position:fixed;inset:0}</style></head><body>
<div id="dsh-startup-root" class="dsu-root dsu-boot"></div><script>
window.__DSH_STARTUP__={enabled:true,mode:'always',theme:'light',speed:${SPEED},requireInteraction:false,allowSkip:true,sound:false,voice:false,identity:'MOTION CHECK',identityId:'0000',accessLevel:'1'}
window.__DSH_STARTUP_TEMPLATE__=${JSON.stringify(tpl)}
window.__ERR__=[];window.__DONE__=false
/* 在页面脚本里就开始取样：CDP 侧注入可能落在导航前的旧文档上，会随导航丢失。 */
window.__TEXT_SEEN__=[]
setInterval(function(){var n=document.querySelector('.dsu-status-zh');var t=n?String(n.textContent||'').trim():'';if(t&&window.__TEXT_SEEN__[window.__TEXT_SEEN__.length-1]!==t)window.__TEXT_SEEN__.push(t)},40)
window.addEventListener('error',e=>window.__ERR__.push(String(e.message)))
window.addEventListener('unhandledrejection',e=>{var r=e.reason;window.__ERR__.push('REJ: '+String(r&&r.stack||r))})
window.addEventListener('dsh-startup:done',()=>{window.__DONE__=true})
</script><script src="${libUrl}/splash.js"></script></body></html>`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profileDir = path.join(os.tmpdir(), 'dsh-motion-profile-' + Date.now())
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--disable-extensions', '--disable-component-extensions-with-background-pages',
  '--allow-file-access-from-files', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profileDir, 'about:blank'],
  { stdio: 'ignore' })

let ws, seq = 0
const pending = new Map()
const events = []
function rejectPending(err) {
  for (const { reject } of pending.values()) reject(err)
  pending.clear()
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('CDP 连接不可用: ' + method))
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('CDP 超时: ' + method))
    }, 15000)
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value) },
      reject: (err) => { clearTimeout(timer); reject(err) }
    })
    try {
      ws.send(JSON.stringify({ id, method, params }))
    } catch (err) {
      clearTimeout(timer)
      pending.delete(id)
      reject(err)
    }
  })
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    for (const host of ['127.0.0.1', '[::1]']) {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 1500)
      try {
        const res = await fetch('http://' + host + ':' + PORT + '/json', { signal: ac.signal })
        const list = await res.json()
        const page = list.find((t) => t.type === 'page' && /^about:blank/.test(String(t.url || ''))) ||
          list.find((t) => t.type === 'page')
        if (page) return page.webSocketDebuggerUrl
      } catch (e) { /* 还没起来，换地址或下一轮 */ } finally {
        clearTimeout(timer)
      }
    }
    await sleep(250)
  }
  throw new Error('CDP 连不上')
}

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   [' + detail + ']' : ''))
}

(async () => {
  const watchdog = setTimeout(() => {
    console.error('motion-check 超时：强制退出，避免测试悬死')
    try { chrome.kill() } catch (e) { /* noop */ }
    process.exit(2)
  }, 60000)
  const url = await connect()
  ws = new WebSocket(url)
  await new Promise((r) => ws.addEventListener('open', r))
  ws.addEventListener('close', () => rejectPending(new Error('CDP 连接已关闭')))
  ws.addEventListener('error', () => rejectPending(new Error('CDP 连接出错')))
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {}
      const ex = d.exception || {}
      events.push('EXC: ' + String(ex.description || d.text || ex.value || 'unknown'))
    }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) p.reject(new Error(m.error.message || 'CDP 调用失败'))
      else p.resolve(m.result)
    }
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/').replace(/ /g, '%20') })

  const shot = async () => (await send('Page.captureScreenshot', { format: 'png' })).data
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value
  /* 页面内高频记录状态行：speed=3 时每幕只有几百毫秒，CDP 往返采样会漏掉。
     取样器已经在被测页面的 splash.js 之前启动，这里只等它稳定。
     断言仍是“必须出现 >=3 种不同文案”，没有降低标准。 */
  await sleep(80)

  /* 采样点要早：不少模板 1 秒内就把入场演完了，晚采样会误判"没动" */
  await sleep(420)
  const a = await shot()
  const lineA = await ev('(document.querySelector(".dsu-status-zh")||{}).textContent || ""')
  const snapA = await ev('[...document.querySelectorAll(".dsu-tl-layer")].map(function(n){var s=getComputedStyle(n);return s.opacity+"|"+s.transform}).join(";")')
  await sleep(900)
  const b = await shot()
  check('画面在动（两帧不同）', a !== b)

  /* 模型不同，断言不同：
     - 分幕模板（steps[]）：状态行文案必须换过 ≥3 种
     - 时间线模板（layers[]）：图层必须真的在建、且同一图层两时刻的透明度不同 */
  const isTimeline = Array.isArray(tpl.layers) && tpl.layers.length > 0
  let stepsSeen = null
  if (isTimeline) {
    const layers = await ev('document.querySelectorAll(".dsu-tl-layer").length')
    check('时间线图层建出来了', Number(layers) >= 2, String(layers) + ' 层')
    const s2 = await ev('[...document.querySelectorAll(".dsu-tl-layer")].map(function(n){var s=getComputedStyle(n);return s.opacity+"|"+s.transform}).join(";")')
    check('图层状态随时间变化', snapA !== s2, (snapA === s2 ? '两帧完全相同' : '已变化'))
    /* 时间线按 duration 跑：这里只做粗等，真正收尾下面用轮询等 */
  } else {
    /* 取样器在页面里持续记录；等收尾后再取，避免 speed=1 时只看到开场两行。 */
    stepsSeen = [lineA]
  }

  /* 收尾用轮询等，别赌固定 sleep：不同模型的时长/收尾节奏差很多 */
  const deadline = Date.now() + (isTimeline ? (Number(tpl.duration || 6000) + 6000) : 12000)
  while (Date.now() < deadline) {
    const gone = await ev('!document.getElementById("dsh-startup-root")')
    if (gone) break
    await sleep(250)
  }
  if (stepsSeen) {
    const sampledRaw = await ev('JSON.stringify(window.__TEXT_SEEN__||[])')
    let sampled = []
    try { sampled = JSON.parse(sampledRaw || '[]') } catch (e) { sampled = [] }
    const seen = new Set(stepsSeen.concat(sampled).map((s) => String(s || '').trim()))
    seen.delete('')
    check('分幕文案确实换过（>=3 种）', seen.size >= 3, [...seen].slice(0, 5).join(' / '))
  }
  const state = JSON.parse(await ev('JSON.stringify({root: !!document.getElementById("dsh-startup-root"), done: !!window.__DONE__, err: window.__ERR__})'))
  check('结束时根节点被移除', state.root === false)
  check('done 事件触发', state.done === true)
  check('无 JS 异常', state.err.length === 0 && events.length === 0, JSON.stringify(state.err.concat(events)).slice(0, 160))

  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log('模板 ' + TEMPLATE + ' · speed ' + SPEED + ' → ' + (failed.length ? failed.length + ' 项失败' : '全部通过'))
  clearTimeout(watchdog)
  ws.close()
  chrome.kill()
  try { fs.unlinkSync(tmp) } catch (e) { /* noop */ }
  await sleep(300)
  try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch (e) { /* noop */ }
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error('motion-check 出错: ' + (e && e.message))
  try { chrome.kill() } catch (e2) { /* noop */ }
  process.exit(2)
})
