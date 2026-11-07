#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const PACKAGE_FILE = path.join(ROOT, 'package.json')
const PKG = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'))
const NAME = String(PKG.name)
const VERSION = String(PKG.version)
const DEFAULT_PORT = 43110

if (NAME !== 'xtds-start-dsh' || VERSION !== '0.1.0') {
  throw new Error(`本机商城只用于 xtds-start-dsh@0.1.0；当前是 ${NAME}@${VERSION}`)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function tarballCandidates(explicit) {
  const candidates = []
  if (explicit) candidates.push(path.resolve(explicit))
  if (process.env.XTDS_LOCAL_TARBALL) candidates.push(path.resolve(process.env.XTDS_LOCAL_TARBALL))
  candidates.push(
    path.join(ROOT, '03-发布包', `${NAME}.tgz`),
    path.join(ROOT, '03-发布包', `${NAME}-${VERSION}.tgz`),
    path.join(ROOT, '.local-market', `${NAME}-${VERSION}.tgz`),
    path.join(ROOT, 'dist', `${NAME}-${VERSION}.tgz`),
  )
  return [...new Set(candidates)]
}

function runNpmPack() {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xtds-local-market-'))
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, [
    'pack',
    '--pack-destination',
    cacheDir,
    '--ignore-scripts',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  })
  if (result.status !== 0) {
    try { fs.rmSync(cacheDir, { recursive: true, force: true }) } catch {}
    throw new Error(`npm pack 失败：${String(result.stderr || result.stdout || '').trim().slice(0, 800)}`)
  }
  const file = fs.readdirSync(cacheDir).find((entry) => entry.endsWith('.tgz'))
  if (!file) {
    try { fs.rmSync(cacheDir, { recursive: true, force: true }) } catch {}
    throw new Error('npm pack 没有生成 .tgz')
  }
  return {
    path: path.join(cacheDir, file),
    cleanup: () => fs.rmSync(cacheDir, { recursive: true, force: true }),
  }
}

function resolveTarball(explicit) {
  const candidates = tarballCandidates(explicit)
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile() && fs.statSync(candidate).size > 0) {
        const head = fs.readFileSync(candidate).subarray(0, 2)
        if (head[0] !== 0x1f || head[1] !== 0x8b) {
          throw new Error(`不是 gzip 包：${candidate}`)
        }
        return { path: candidate, cleanup: null }
      }
    } catch (error) {
      if (candidate === explicit || candidate === process.env.XTDS_LOCAL_TARBALL) throw error
    }
  }
  if (explicit) throw new Error(`找不到指定的发布包：${path.resolve(explicit)}`)
  return runNpmPack()
}

function makeMetadata() {
  return {
    format: 1,
    title: {
      zh: 'XTDS 本机插件商城',
      en: 'XTDS Local Plugin Market',
    },
    description: {
      zh: '仅供本机试用的 XTDS 暖白启动动画索引。它是本地服务，不会上传到公共商店。',
      en: 'A local-only index for trying the XTDS warm archive boot animation. It is not a public store.',
    },
    metadata: {
      categories: {
        startup: {
          title: { zh: '启动动画', en: 'Startup animation' },
        },
      },
      labels: {},
      sortKeys: {},
    },
    plugins: [{
      name: NAME,
      title: {
        zh: 'XTDS 暖白启动动画',
        en: 'XTDS Warm Archive Boot',
      },
      description: {
        zh: '默认只播放暖白档案序章，默认不出现黑暗角色揭示；保留可替换形象的第二幕引擎。XTDS 定制 fork，暖白视觉原作沈宏宏 @6shenhonghong9，上游维护 LeeRolling。',
        en: 'Plays only the warm archive opening by default, with the character-reveal engine retained and replaceable. XTDS fork; warm visual by Shen Honghong, upstream maintained by LeeRolling.',
      },
      author: 'XTDS（基于沈宏宏 @6shenhonghong9、LeeRolling 的上游项目）',
      metadata: {
        category: 'startup',
        keywords: ['xtds', 'startup', 'archive-warm', 'splash'],
        labels: [],
        sortKeys: {},
      },
      versions: [{
        version: VERSION,
        publishTimestamp: Math.floor(Date.now() / 1000),
        source: {
          type: 'npm',
          registry: '',
        },
        engines: {},
      }],
    }],
  }
}

function makeLanding(indexUrl) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>XTDS 本机插件商城</title>
  <style>
    :root { color-scheme: light; --paper: #f2eadc; --ink: #2d251d; --muted: #75685a; --line: #d8c9b5; --accent: #8f4f2a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.65 "Segoe UI", "Microsoft YaHei", sans-serif; }
    main { max-width: 760px; margin: 0 auto; padding: 56px 24px 72px; }
    .eyebrow { letter-spacing: .18em; color: var(--muted); font: 12px/1.4 Consolas, monospace; text-transform: uppercase; }
    h1 { margin: 12px 0 6px; font: 600 38px/1.15 Georgia, "Songti SC", serif; letter-spacing: .01em; }
    .lede { margin: 0 0 30px; color: var(--muted); }
    .panel { background: #fbf7ef; border: 1px solid var(--line); border-radius: 14px; padding: 22px; box-shadow: 0 10px 35px rgba(73, 52, 33, .07); }
    .url { display: flex; gap: 10px; align-items: stretch; margin: 14px 0 8px; }
    code { flex: 1; min-width: 0; overflow-wrap: anywhere; padding: 13px 14px; border: 1px solid var(--line); border-radius: 9px; background: #fffdf8; color: #5b3921; font: 13px/1.5 Consolas, monospace; }
    button { border: 0; border-radius: 9px; padding: 0 18px; background: var(--accent); color: #fff; font: 600 14px/1 "Segoe UI", sans-serif; cursor: pointer; }
    button:hover { background: #733b1e; }
    ol { padding-left: 24px; }
    li { margin: 10px 0; }
    .hint { margin-top: 18px; padding: 12px 14px; border-left: 3px solid var(--accent); background: #f7efe3; color: #5f4a37; font-size: 14px; }
    .foot { margin-top: 26px; color: var(--muted); font-size: 13px; }
    .ok { color: #46633b; font-weight: 600; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">XTDS / LOCAL PLUGIN MARKET</div>
    <h1>本机插件商城已启动</h1>
    <p class="lede">这是只在你电脑上运行的插件索引，不是公开商店。安装期间不要关闭这个服务窗口。</p>
    <section class="panel">
      <div>把下面这个索引地址添加到 DeepSeek Harness：</div>
      <div class="url">
        <code id="index-url">${escapeHtml(indexUrl)}</code>
        <button type="button" id="copy">复制地址</button>
      </div>
      <div id="copy-status" class="ok" role="status"></div>
      <ol>
        <li>打开 <strong>DeepSeek Harness → 插件</strong>。</li>
        <li>第一次使用时，在 <strong>实验性插件</strong> 中启用 <strong>自定义插件索引</strong>。</li>
        <li>回到插件页，打开 <strong>发现</strong>，点 <strong>添加索引源</strong>（或工具栏的 <strong>管理索引源…</strong>），粘贴上面的地址。</li>
        <li>找到 <strong>XTDS 暖白启动动画</strong>，点 <strong>安装</strong>，按提示确认。</li>
      </ol>
      <div class="hint">如果没看到“发现”标签：先启用“自定义插件索引”，然后回到插件页刷新。安装完成后可以关闭本窗口和本机商城服务。</div>
    </section>
    <p class="foot">暖白「技术档案」视觉与叙事原作：沈宏宏（@6shenhonghong9）。上游合并与维护：LeeRolling。XTDS 只做定制与工程整理，不主张原始视觉为 XTDS 原创。</p>
  </main>
  <script>
    const INDEX_URL = ${JSON.stringify(indexUrl)};
    const button = document.getElementById('copy');
    const status = document.getElementById('copy-status');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(INDEX_URL);
        status.textContent = '已复制，可以粘贴到 DSH 的索引源里。';
      } catch {
        const selection = document.createRange();
        selection.selectNodeContents(document.getElementById('index-url'));
        const range = window.getSelection();
        range.removeAllRanges();
        range.addRange(selection);
        status.textContent = '已选中地址，请按 Ctrl+C 复制。';
      }
    });
  </script>
</body>
</html>`
}

function send(res, status, body, type, extraHeaders = {}, head = false) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(String(body))
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  })
  res.end(head ? undefined : data)
}

function sendJson(res, status, value, head = false) {
  send(res, status, JSON.stringify(value, null, 2) + '\n', 'application/json; charset=utf-8', {}, head)
}

function sendText(res, status, value, head = false) {
  send(res, status, String(value) + '\n', 'text/plain; charset=utf-8', {}, head)
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [url], { detached: true, stdio: 'ignore' })
      child.unref()
    } else {
      const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
      child.unref()
    }
  } catch {}
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

function makePackument(baseUrl, integrity, shasum) {
  const manifest = {
    ...PKG,
    _id: `${NAME}@${VERSION}`,
    dist: {
      tarball: `${baseUrl}/${NAME}/-/${NAME}-${VERSION}.tgz`,
      integrity,
      shasum,
    },
  }
  const timestamp = new Date().toISOString()
  return {
    _id: NAME,
    name: NAME,
    'dist-tags': { latest: VERSION },
    versions: { [VERSION]: manifest },
    time: {
      created: timestamp,
      modified: timestamp,
      [VERSION]: timestamp,
    },
    description: PKG.description,
    license: PKG.license,
    private: true,
  }
}

function makeHandler(state) {
  return (req, res) => {
    const host = String(req.headers.host || '').toLowerCase()
    if (host !== `127.0.0.1:${state.port}` && host !== `localhost:${state.port}`) {
      sendJson(res, 403, { ok: false, error: '只接受本机访问' })
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: '只支持 GET / HEAD' })
      return
    }
    if (!req.url || req.url.length > 512) {
      sendJson(res, 414, { ok: false, error: '地址过长' })
      return
    }
    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname)
    } catch {
      sendJson(res, 400, { ok: false, error: '无法解析地址' })
      return
    }
    const head = req.method === 'HEAD'
    if (pathname === '/' || pathname === '/index.html') {
      send(res, 200, makeLanding(state.indexUrl), 'text/html; charset=utf-8', {
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      }, head)
      return
    }
    if (pathname === '/health') {
      sendJson(res, 200, { ok: true, name: NAME, version: VERSION }, head)
      return
    }
    if (pathname === '/index.json') {
      const index = makeMetadata()
      index.plugins[0].versions[0].source.registry = state.registryUrl
      sendJson(res, 200, index, head)
      return
    }
    if (pathname === `/${NAME}`) {
      sendJson(res, 200, makePackument(state.baseUrl, state.integrity, state.shasum), head)
      return
    }
    if (pathname === `/${NAME}/${VERSION}`) {
      const manifest = makePackument(state.baseUrl, state.integrity, state.shasum).versions[VERSION]
      sendJson(res, 200, manifest, head)
      return
    }
    if (pathname === `/${NAME}/-/${NAME}-${VERSION}.tgz`) {
      send(res, 200, state.tarball, 'application/octet-stream', {
        'Content-Disposition': `attachment; filename="${NAME}-${VERSION}.tgz"`,
      }, head)
      return
    }
    sendJson(res, 404, { ok: false, error: '没有这个本机商城资源' }, head)
  }
}

export async function startLocalMarket(options = {}) {
  const requestedPort = options.port === undefined ? DEFAULT_PORT : Number(options.port)
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error(`端口无效：${options.port}`)
  }
  const tarballSource = resolveTarball(options.tarball)
  const tarball = fs.readFileSync(tarballSource.path)
  const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64')
  const shasum = createHash('sha1').update(tarball).digest('hex')
  const state = {
    requestedPort,
    port: 0,
    baseUrl: '',
    registryUrl: '',
    indexUrl: '',
    landingUrl: '',
    tarball,
    tarballPath: tarballSource.path,
    integrity,
    shasum,
  }
  const server = http.createServer(makeHandler(state))
  const ports = requestedPort === 0
    ? [0]
    : [requestedPort, ...Array.from({ length: 10 }, (_, index) => requestedPort + index + 1), 0]
  let lastError = null
  for (const port of ports) {
    try {
      await listen(server, port)
      lastError = null
      break
    } catch (error) {
      lastError = error
      if (error && error.code === 'EADDRINUSE') continue
      if (tarballSource.cleanup) tarballSource.cleanup()
      throw error
    }
  }
  if (lastError) {
    if (tarballSource.cleanup) tarballSource.cleanup()
    throw lastError
  }
  const address = server.address()
  state.port = typeof address === 'object' && address ? address.port : 0
  state.baseUrl = `http://127.0.0.1:${state.port}`
  state.registryUrl = `${state.baseUrl}/`
  state.indexUrl = `${state.baseUrl}/index.json`
  state.landingUrl = `${state.baseUrl}/`
  if (options.openBrowser) openBrowser(state.landingUrl)
  return {
    ...state,
    server,
    tarballSize: tarball.length,
    async close() {
      if (server.listening) {
        await new Promise((resolve) => {
          server.close(resolve)
          server.closeAllConnections?.()
        })
      }
      if (tarballSource.cleanup) tarballSource.cleanup()
    },
  }
}

function parseArgs(argv) {
  const result = { port: DEFAULT_PORT, tarball: '', noOpen: false, help: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') result.help = true
    else if (arg === '--no-open') result.noOpen = true
    else if (arg === '--port') {
      result.port = Number(argv[++index])
    } else if (arg.startsWith('--port=')) {
      result.port = Number(arg.slice('--port='.length))
    } else if (arg === '--tarball') {
      result.tarball = argv[++index] || ''
    } else if (arg.startsWith('--tarball=')) {
      result.tarball = arg.slice('--tarball='.length)
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }
  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log('用法：node tools/local-market.mjs [--port 43110] [--tarball 路径] [--no-open]')
    return
  }
  const market = await startLocalMarket({
    port: args.port,
    tarball: args.tarball,
    openBrowser: !args.noOpen,
  })
  console.log('')
  console.log('============================================================')
  console.log('  XTDS 本机插件商城')
  console.log('============================================================')
  console.log('  索引地址：' + market.indexUrl)
  console.log('  发布包：  ' + market.tarballPath)
  console.log('  大小：    ' + (market.tarballSize / 1024 / 1024).toFixed(2) + ' MB')
  console.log('')
  console.log('  在 DeepSeek Harness 中：')
  console.log('  1. 插件 → 实验性插件 → 启用「自定义插件索引」')
  console.log('  2. 插件 → 发现 → 添加索引源（或工具栏「管理索引源…」）并粘贴地址')
  console.log('  3. 找到「XTDS 暖白启动动画」→ 安装')
  console.log('')
  console.log('  安装期间请保持本窗口开着。按 Ctrl+C 停止。')
  console.log('')
  const shutdown = async () => {
    await market.close()
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error('[x] 本机商城启动失败：' + (error && error.stack ? error.stack : error))
    process.exitCode = 1
  })
}
