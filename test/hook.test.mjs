// F6: hooks del plugin a través del puente plugin/scripts/hook.mjs (como los llama Claude Code), contra dist/cli.js.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globARegex } from '../dist/hook.js'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const puente = fileURLToPath(new URL('../plugin/scripts/hook.mjs', import.meta.url))
const raiz = join(tmpdir(), 'captura-cli-pruebas', `hook-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa'), ws = join(raiz, 'repo'), proy = join(raiz, 'proy'), salidas = join(proy, 'salidas')
const env = { ...process.env, CAPTURA_HOME: casa, CAPTURA_CLI: cli }

const git = (...a) => spawnSync('git', a, { cwd: ws, encoding: 'utf8', timeout: 30000 })
const config = (evidencia) => writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ rutas: { salidas: './salidas' }, evidencia }))
const hook = (evento, entrada = {}) => {
  const r = spawnSync(process.execPath, [puente, evento], { input: JSON.stringify({ cwd: ws, ...entrada }), env, encoding: 'utf8', timeout: 60000 })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}
const bloqueo = (r) => { assert.equal(r.code, 0, r.err); assert.ok(r.out, 'debía bloquear'); const j = JSON.parse(r.out); assert.equal(j.decision, 'block'); return j.reason }
const evidencia = (id, resumen, hace = 0) => {
  const d = join(salidas, id)
  mkdirSync(d, { recursive: true })
  const f = join(d, 'manifest.json')
  writeFileSync(f, JSON.stringify({ version: 1, id, resumen }))
  const t = (Date.now() - hace) / 1000
  utimesSync(f, t, t)
}

before(() => {
  for (const d of [casa, ws, salidas]) mkdirSync(d, { recursive: true })
  git('init', '-q')
  git('config', 'user.email', 'prueba@ejemplo.invalid')
  git('config', 'user.name', 'prueba')
  writeFileSync(join(ws, 'README.md'), 'x')
  git('add', '.')
  git('commit', '-qm', 'inicio')
  config({ hook: true })
  const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'no'], { cwd: ws, env, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})

test('globARegex: ** cruza carpetas, * no', () => {
  assert.ok(globARegex('**/*.tsx').test('App.tsx'))
  assert.ok(globARegex('**/*.tsx').test('src/ui/App.tsx'))
  assert.ok(!globARegex('src/*.tsx').test('src/ui/App.tsx'))
  assert.ok(!globARegex('**/*.tsx').test('src/App.ts'))
})

test('inicio: una línea de contexto con la versión y el estado del workspace', () => {
  const r = hook('inicio')
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^captura-cli \d+\.\d+\.\d+ disponible \(workspace registrado; salidas en .+; el hook de cierre exige evidencia si se toca la interfaz\)\. Para verificar en el navegador o dejar evidencia, usar la skill captura\.$/)
  const otro = spawnSync(process.execPath, [puente, 'inicio'], { input: JSON.stringify({ cwd: join(raiz, 'casa') }), env: { ...env, CAPTURA_HOME: join(raiz, 'otra-casa') }, encoding: 'utf8', timeout: 60000 })
  assert.match(otro.stdout, /workspace sin registrar: la primera llamada saldrá con WORKSPACE_NUEVO \(6\)/)
})

test('cierre: sin cambios de interfaz deja terminar', () => {
  writeFileSync(join(ws, 'servidor.ts'), 'x')
  assert.equal(hook('cierre').out, '')
})

test('cierre: interfaz tocada sin evidencia pide dejarla (y nombra los archivos); una sola vez por turno', () => {
  mkdirSync(join(ws, 'src'), { recursive: true })
  writeFileSync(join(ws, 'src', 'App.tsx'), 'x')
  const reason = bloqueo(hook('cierre'))
  assert.match(reason, /^captura-cli: en este turno se tocó la interfaz \(src\/App\.tsx\) y no hay evidencia posterior al último cambio\./)
  assert.match(reason, /"SIN_EVIDENCIA: <motivo>"/)
  assert.equal(hook('cierre', { stop_hook_active: true }).out, '', 'no insiste en el mismo turno')
  assert.equal(hook('cierre', { last_assistant_message: 'Listo.\nSIN_EVIDENCIA: solo cambió un comentario' }).out, '')
})

test('cierre: evidencia posterior completa deja terminar; sin capturas o INCOMPLETA, no', () => {
  evidencia('T-1', { capturas: 0, recetasPendientes: false })
  assert.match(bloqueo(hook('cierre')), /la evidencia más reciente \(T-1\) no tiene capturas/)
  evidencia('T-2', { capturas: 2, recetasPendientes: true })
  assert.match(bloqueo(hook('cierre')), /la evidencia más reciente \(T-2\) quedó INCOMPLETA/)
  evidencia('T-3', { capturas: 2, recetasPendientes: false })
  assert.equal(hook('cierre').out, '')
  // Evidencia vieja (anterior al cambio) no cuenta.
  evidencia('T-3', { capturas: 2, recetasPendientes: false }, 3600 * 1000)
  evidencia('T-2', { capturas: 2, recetasPendientes: true }, 3600 * 1000)
  evidencia('T-1', { capturas: 0, recetasPendientes: false }, 3600 * 1000)
  assert.match(bloqueo(hook('cierre')), /no hay evidencia posterior al último cambio/)
})

test('cierre: también cuenta un cambio de interfaz ya commiteado en el turno; patrones propios', () => {
  git('add', '.')
  git('commit', '-qm', 'ui')
  assert.match(bloqueo(hook('cierre')), /src\/App\.tsx/)
  config({ hook: true, patrones: ['web/**/*.html'] })
  assert.equal(hook('cierre').out, '', 'App.tsx ya no entra en los patrones')
  config({ hook: true })
})

test('cierre: apagado por defecto (sin "evidencia.hook") y en un workspace sin registrar', () => {
  config({})
  assert.equal(hook('cierre').out, '')
  config({ hook: true })
  const r = spawnSync(process.execPath, [puente, 'cierre'], { input: JSON.stringify({ cwd: ws }), env: { ...env, CAPTURA_HOME: join(raiz, 'vacia') }, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0)
  assert.equal(r.stdout.trim(), '')
})

test('sin captura-cli instalado: el inicio dice cómo instalarlo; el cierre no hace nada; los dos salen con 0', () => {
  // PATH solo con carpetas del sistema (sin el comando global) y sin CAPTURA_CLI.
  const sistema = process.platform === 'win32' ? join(process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32') : '/usr/bin:/bin'
  const sinCli = { SYSTEMROOT: process.env.SYSTEMROOT ?? '', COMSPEC: process.env.COMSPEC ?? '', PATH: sistema, CAPTURA_HOME: casa }
  for (const [evento, esperado] of [['inicio', /^captura-cli no está instalado: la skill captura lo necesita\. Instalar con: npm i -g --install-links github:BillalbertCode\/captura-cli#v\d+\.\d+\.\d+$/], ['cierre', /^$/]]) {
    const r = spawnSync(process.execPath, [puente, evento], { input: JSON.stringify({ cwd: ws }), env: sinCli, encoding: 'utf8', timeout: 60000 })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout.trim(), esperado)
  }
})

test('cierre: entrada rota o vacía no bloquea ni falla', () => {
  for (const input of ['', 'no es json']) {
    const r = spawnSync(process.execPath, [puente, 'cierre'], { input, env, encoding: 'utf8', timeout: 60000 })
    assert.equal(r.status, 0)
    assert.equal(r.stdout.trim(), '')
  }
})
