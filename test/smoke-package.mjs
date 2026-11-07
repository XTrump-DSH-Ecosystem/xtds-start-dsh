#!/usr/bin/env node
/* XTDS fork package smoke test.
 *
 * The upstream package used to ship many whale / big-fish / 550C templates.
 * This fork intentionally ships only the warm-white opening and the empty
 * character-reveal slot. Keep this test strict so removed content cannot
 * silently return through a merge or a copied release directory.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
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
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel))
}

console.log('\n[1] package identity and release shape')
const pkgBuf = fs.readFileSync(path.join(ROOT, 'package.json'))
check('package.json has no UTF-8 BOM', !(pkgBuf.length >= 3 && pkgBuf[0] === 0xEF && pkgBuf[1] === 0xBB && pkgBuf[2] === 0xBF))
const pkg = JSON.parse(pkgBuf.toString('utf8'))
check('package name = xtds-start-dsh', pkg.name === 'xtds-start-dsh', pkg.name)
check('package version is present', /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(String(pkg.version || '')), pkg.version)
check('package is private (never publish to npm)', pkg.private === true, String(pkg.private))
check('license = MIT', pkg.license === 'MIT', pkg.license)
check('repository/homepage do not point at upstream', pkg.repository === undefined && pkg.homepage === undefined,
  JSON.stringify({ repository: pkg.repository, homepage: pkg.homepage }))
check('package description marks XTDS custom build', /XTDS/.test(String(pkg.description || '')), pkg.description)
check('package author credits upstream', /沈宏宏/.test(String(pkg.author || '')) && /LeeRolling/.test(String(pkg.author || '')), pkg.author)
check('DSH bundle patch is declared', pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml', JSON.stringify(pkg.dsh))

const required = [
  'lib/index.js',
  'lib/host-startup.js',
  'lib/host-wallpaper.js',
  'lib/splash.js',
  'lib/client.js',
  'lib/security.js',
  'lib/assets/default-background.jpg',
  'lib/assets/voices/manifest.json',
  'templates/archive-warm/template.json',
  'templates/xtds-character-reveal/template.json',
  'templates/xtds-character-reveal/assets/character-slot.svg',
  'templates/xtds-character-reveal/NOTICE.md',
  'config/dsh-startup-identity.example.json',
  'tools/install.ps1',
  'tools/update-apply.ps1',
  'tools/rollback-version.ps1',
  'tools/build-release.mjs',
  'docs/evidence/01-default-warm-white.png',
  'docs/evidence/02-character-placeholder.png',
  'docs/evidence/03-character-imported-test.png',
  'docs/evidence/04-character-missing-fallback.png',
  'LICENSE',
  'CREDITS.md'
]
for (const rel of required) check('required file: ' + rel, exists(rel))

console.log('\n[2] module / bundle identity')
const patch = read('cordis.patch.yml')
const indexJs = read('lib/index.js')
const clientJs = read('lib/client.js')
check('cordis.patch.yml inserts xtds-start-dsh', /id:\s*xtds-start-dsh/.test(patch) && /name:\s*xtds-start-dsh/.test(patch))
check('lib/index.js exports matching plugin name', /const name = 'xtds-start-dsh'/.test(indexJs) && /name, inject, apply/.test(indexJs))
check('lib/client.js registers matching module id', /id:\s*'xtds-start-dsh'/.test(clientJs), '')
check('no active loader id dsh-boot-suite', !/id:\s*'dsh-boot-suite'/.test(indexJs) && !/id:\s*'dsh-boot-suite'/.test(clientJs))

console.log('\n[3] only the two intended templates ship')
const tplRoot = path.join(ROOT, 'templates')
const templateIds = fs.readdirSync(tplRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(tplRoot, d.name, 'template.json')))
  .map((d) => d.name)
  .sort()
check('exactly two bundled templates', templateIds.join(',') === 'archive-warm,xtds-character-reveal', templateIds.join(','))
const warm = JSON.parse(read('templates/archive-warm/template.json'))
const slot = JSON.parse(read('templates/xtds-character-reveal/template.json'))
check('archive-warm credits 沈宏宏 and LeeRolling', /沈宏宏/.test(String(warm.author)) && /LeeRolling/.test(String(warm.adaptedBy)),
  JSON.stringify({ author: warm.author, adaptedBy: warm.adaptedBy }))
check('archive-warm keeps upstream homepage as attribution', /github\.com\/LeeRolling\/dsh-boot-suite/.test(String(warm.homepage)), warm.homepage)
check('character slot is an optional dark reveal template', slot.theme && slot.theme.mode === 'dark' && slot.id === 'xtds-character-reveal')
check('character slot contains an image layer named character-slot',
  (slot.layers || []).some((l) => l && l.id === 'character-slot' && l.type === 'image' && l.src === 'character-slot.svg'))
check('character slot keeps the reveal effect stack',
  ['scanline', 'crt', 'glitch', 'hud', 'bloom', 'vignette'].every((type) => (slot.effects || []).some((e) => e && e.type === type)),
  (slot.effects || []).map((e) => e.type).join(','))

console.log('\n[4] removed upstream content stays removed')
const removed = [
  'templates/whale-girl-scan',
  'templates/whale-girl-scan-4k',
  'templates/whale-girl-scan-4k-h264',
  'templates/bigfish-v5-act2',
  'templates/division-bigfish-codex',
  'templates/550c-homage',
  'templates/deep-sonar',
  'templates/dsh-intro-act2',
  'templates/dsh-intro-full',
  'lib/assets/builtin-background-snowgirl.png'
]
for (const rel of removed) check('removed: ' + rel, !exists(rel))
check('default wallpaper is the XTDS warm-white asset',
  fs.statSync(path.join(ROOT, 'lib/assets/default-background.jpg')).size > 20000)
const wallpaper = read('lib/host-wallpaper.js')
check('wallpaper exposes only one built-in image', /XTDS 暖白档案/.test(wallpaper) && !/snowgirl/i.test(wallpaper))

console.log('\n[5] update channel is fail-closed')
const host = read('lib/host-startup.js')
check('updater requires XTDS_UPDATE_REPO', /process\.env\.XTDS_UPDATE_REPO/.test(host))
check('updater has no upstream fallback repository', !/UPDATE_REPO\s*=\s*['"]LeeRolling\//.test(host))
check('updater only accepts xtds-start-dsh-win*.zip', /xtds-start-dsh-win/.test(host) && /xtds-start-dsh-win/.test(read('install-online.ps1')))
check('template store requires DSH_STORE_URL', /process\.env\.DSH_STORE_URL/.test(host))
check('template store has no upstream fallback URL', !/STORE_INDEX_URL\s*=\s*['"]https?:\/\//.test(host))
const installOnline = read('install-online.ps1')
check('online installer requires an explicit -Repo', /param\([^)]*\[string\]\$Repo\s*=\s*\$env:XTDS_UPDATE_REPO/s.test(installOnline) && /if \(-not \$repo\)/.test(installOnline))
const installOnlineCode = installOnline
  .replace(/<#[\s\S]*?#>/g, '')
  .replace(/^[ \t]*#.*$/gm, '')
check('online installer executable code does not hard-code the upstream repo', !/LeeRolling\/dsh-boot-suite/i.test(installOnlineCode))
check('online installer builds release URLs from the explicit $repo value',
  installOnlineCode.includes("$zipUrl = 'https://github.com/' + $repo") &&
  installOnlineCode.includes("$sumUrl = 'https://github.com/' + $repo"))
check('online installer uses .NET SHA-256 instead of a module-dependent cmdlet',
  /System\.Security\.Cryptography\.SHA256/.test(installOnlineCode) && !/Get-FileHash/.test(installOnlineCode))

console.log('\n[6] install / rollback safety markers')
const install = read('tools/install.ps1')
for (const needle of ['xtds-start-dsh', 'xtds-boot-suite', 'dsh-boot-suite', 'dsh-startup-screen', 'dsh-chat-wallpaper', 'rollback-version.ps1', 'Test-InstalledOk', '安装后校验失败', '命令行的退出码是 0', 'DSH_BOOT_SUITE_ROLLBACK']) {
  check('install.ps1 contains: ' + needle, install.includes(needle))
}
check('emergency uninstall keeps the old package name for cleanup',
  read('tools/emergency-uninstall.ps1').includes("'xtds-boot-suite'"))
const rollback = read('tools/rollback-version.ps1')
for (const needle of ['TargetPkg', 'CheckOnly', 'DSH_BOOT_SUITE_ROLLBACK', '回滚日志']) {
  check('rollback-version.ps1 contains: ' + needle, rollback.includes(needle))
}
const build = read('tools/build-release.mjs')
for (const needle of ['xtds-start-dsh-win.zip', 'xtds-start-dsh.tgz', 'SHA256SUMS.txt']) {
  check('build-release.mjs produces: ' + needle, build.includes(needle))
}

console.log('\n[7] attribution / license')
const license = read('LICENSE')
check('LICENSE keeps 沈宏宏 copyright', /Copyright \(c\) 2026 沈宏宏/.test(license), license.split(/\r?\n/)[2])
const credits = read('CREDITS.md')
check('CREDITS links upstream source', /github\.com\/LeeRolling\/dsh-boot-suite/.test(credits))
check('CREDITS credits 沈宏宏', /沈宏宏/.test(credits))
check('CREDITS documents XTDS modifications', /XTDS/.test(credits))
check('character NOTICE says it ships no ready-made character', /不包含任何现成角色/.test(read('templates/xtds-character-reveal/NOTICE.md')))

console.log('\n[7b] identity example keeps the public defaults')
const identityExample = JSON.parse(read('config/dsh-startup-identity.example.json'))
check('identity example name = JOYCE MOORE', identityExample.identity === 'JOYCE MOORE', identityExample.identity)
check('identity example id = 0087', identityExample.identityId === '0087', identityExample.identityId)
check('identity example level = 3', identityExample.accessLevel === '3', identityExample.accessLevel)

console.log('\n[8] offline preview follows the same default')
const previewSandbox = { window: {} }
vm.runInNewContext(read('preview/archive-warm.js'), previewSandbox, { timeout: 1000 })
check('preview archive-warm snapshot matches the real template',
  JSON.stringify(previewSandbox.window.__DSH_STARTUP_TEMPLATE__) === JSON.stringify(warm))
const previewIndex = read('preview/index.html')
const previewDemo = read('preview/demo.html')
check('preview index loads archive-warm before splash.js',
  previewIndex.includes('<script src="archive-warm.js"></script>') &&
  previewIndex.indexOf('archive-warm.js') < previewIndex.indexOf('../lib/splash.js'))
check('preview demo loads archive-warm before splash.js',
  previewDemo.includes('<script src="archive-warm.js"></script>') &&
  previewDemo.indexOf('archive-warm.js') < previewDemo.indexOf('../lib/splash.js'))
check('both preview pages default to archive-warm + empty act2',
  /template:\s*'archive-warm'/.test(previewIndex) && /act2:\s*''/.test(previewIndex) &&
  /template:\s*'archive-warm'/.test(previewDemo) && /act2:\s*''/.test(previewDemo))
check('both preview pages keep the public identity defaults',
  /identity:\s*'JOYCE MOORE'/.test(previewIndex) && /identityId:\s*'0087'/.test(previewIndex) &&
  /identity:\s*'JOYCE MOORE'/.test(previewDemo) && /identityId:\s*'0087'/.test(previewDemo))
check('preview settings expose the custom-character controls',
  previewIndex.includes('导入自定义形象') && previewIndex.includes('恢复内置占位') &&
  /只在已安装 DSH/.test(previewIndex))
check('package files include both preview pages and the template snapshot',
  pkg.files.includes('preview/index.html') &&
  pkg.files.includes('preview/demo.html') &&
  pkg.files.includes('preview/archive-warm.js') &&
  pkg.files.includes('config') &&
  pkg.files.includes('docs/evidence'))

console.log('\n============================')
console.log('  通过 ' + pass + ' / 失败 ' + fail)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
