import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const root = process.cwd();
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-release-'));
const out = path.join(root, '03-发布包', 'xtds-start-dsh-win.zip');
const privateIdentityFile = path.join(root, 'config', 'dsh-startup-identity.json');
if (fs.existsSync(privateIdentityFile)) {
  throw new Error('检测到仓库内的真实身份文件，拒绝打包：' + privateIdentityFile +
    '；请把它移到本机 ~/.dsh/dsh-startup-identity.json');
}
/* docs：维护、研究和视觉证据资料，不属于插件运行必需，发布包不打包 */
const skip = new Set(['.git', 'node_modules', '08-备份', 'code-motion', 'docs', '02-文档', '03-发布包', 'backups']);
function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    if (e.name.endsWith('.zip') || e.name.endsWith('.tgz')) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copy(s, d); else fs.copyFileSync(s, d);
  }
}
function validatePackageJson(file, label) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    throw new Error(label + ' 的 package.json 带 UTF-8 BOM，DSH 会拒绝加载');
  }
  const pkg = JSON.parse(buf.toString('utf8'));
  if (!pkg.version) throw new Error(label + ' 的 package.json 缺少 version');
  return pkg;
}
function psQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}
function runPowerShell(script) {
  /* Windows PowerShell 5.1 若继承 PowerShell 7 的 PSModulePath，可能加载错版本的
     Microsoft.PowerShell.Archive。这里改用 .NET 内置 ZipFile，不依赖该模块。 */
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
}
copy(root, stage);
/* README 引用了 4 张验收截图；整个 docs/ 太大，不随安装包分发，只带 evidence。 */
const evidenceDir = path.join(root, 'docs', 'evidence')
if (fs.existsSync(evidenceDir)) {
  const targetEvidence = path.join(stage, 'docs', 'evidence')
  fs.mkdirSync(targetEvidence, { recursive: true })
  fs.cpSync(evidenceDir, targetEvidence, { recursive: true })
}
const pkg = validatePackageJson(path.join(stage, 'package.json'), '源目录');
for (const f of ['lib/index.js', 'lib/splash.js', 'lib/client.js', 'lib/assets/default-background.jpg', 'templates', '安装.cmd', 'tools/install.ps1', 'tools/update-apply.ps1']) {
  if (!fs.existsSync(path.join(stage, f))) throw new Error('发布包缺少 ' + f);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(out)) fs.renameSync(out, out.replace(/\.zip$/, '') + '-bak-' + Date.now() + '.zip');
runPowerShell(
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
  '[IO.Compression.ZipFile]::CreateFromDirectory(' + psQuote(stage) + ', ' + psQuote(out) +
  ', [IO.Compression.CompressionLevel]::Optimal, $false)'
);
const verify = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-verify-'));
runPowerShell(
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
  '[IO.Compression.ZipFile]::ExtractToDirectory(' + psQuote(out) + ', ' + psQuote(verify) + ')'
);
const vpkg = validatePackageJson(path.join(verify, 'package.json'), 'zip 内');
if (vpkg.version !== pkg.version) throw new Error('zip 内版本 ' + vpkg.version + ' 与源目录 ' + pkg.version + ' 不一致');
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(verify, { recursive: true, force: true });

/* 每次发版必须带 xtds-start-dsh.tgz ——
   自有发布渠道的安装链接固定指向 latest/download/xtds-start-dsh.tgz，
   少了它市场里的“安装”按钮就会指向旧版。所以打包脚本自己产，不靠手打。 */
const outDir = path.dirname(out);
const tgz = path.join(outDir, 'xtds-start-dsh.tgz');
/* 对称性保护：zip 会跳过 02-文档/03-发布包/备份，而 npm pack 只按 package.json files 打包。
   若 lib/tools/test/templates 里夹带了 zip/tgz，两产物会不对称；发布前直接失败。 */
for (const relDir of ['lib', 'tools', 'test', 'templates']) {
  const absDir = path.join(root, relDir);
  if (!fs.existsSync(absDir)) continue;
  const stack = [absDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (/\.(zip|tgz)$/i.test(ent.name)) throw new Error('打包内容里夹带了归档文件（会导致 zip/tgz 不对称）：' + p);
    }
  }
}
if (fs.existsSync(tgz)) fs.renameSync(tgz, tgz.replace(/\.tgz$/, '-bak-' + Date.now() + '.tgz'));
/* Node 24 在 Windows 上不允许直接 spawn .cmd（CVE 修复），所以直接找 npm-cli.js
   用当前 node 执行；找不到才退回 shell 调 npm。 */
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
let packOut;
if (fs.existsSync(npmCli)) {
  packOut = execFileSync(process.execPath, [npmCli, 'pack', '--silent', '--pack-destination', outDir], { cwd: root, encoding: 'utf8' }).trim();
} else {
  packOut = execSync('npm pack --silent --pack-destination "' + outDir + '"', { cwd: root, encoding: 'utf8' }).trim();
}
const packName = packOut.split(/\r?\n/).filter(Boolean).pop();
const packed = path.join(outDir, packName);
if (!fs.existsSync(packed)) throw new Error('npm pack 没有产出 tgz: ' + packName);
fs.renameSync(packed, tgz);
const tbuf = fs.readFileSync(tgz);
if (tbuf.length < 3 || tbuf[0] !== 0x1f || tbuf[1] !== 0x8b) throw new Error('xtds-start-dsh.tgz 不是合法的 gzip');
if (tbuf.length < 1024) throw new Error('xtds-start-dsh.tgz 太小（' + tbuf.length + ' B），疑似打包不完整');
console.log('TGZ OK version=' + vpkg.version + ' size=' + tbuf.length + ' bytes -> ' + tgz);
const sha = (p) => execFileSync(process.execPath, ['-e', "const c=require('node:crypto'),f=require('node:fs');const b=f.readFileSync(process.argv[1]);process.stdout.write(c.createHash('sha256').update(b).digest('hex'))", p], { encoding: 'utf8' }).trim()
const sumFile = path.join(outDir, 'SHA256SUMS.txt')
const sumLines = [sha(out) + '  ' + path.basename(out), sha(tgz) + '  ' + path.basename(tgz)].join('\n') + '\n'
fs.writeFileSync(sumFile, sumLines, 'utf8')
console.log('SHA256SUMS OK -> ' + sumFile)
console.log(sumLines.trim())
console.log('RELEASE OK version=' + vpkg.version + ' size=' + fs.statSync(out).size + ' bytes -> ' + out);
