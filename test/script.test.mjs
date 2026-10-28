// 1.0.1: `captura-cli script` (el import corto funciona con la herramienta instalada en global) y, junto con las apps
// sin login, el flujo exacto de un proyecto sin autenticación: workspace + app sin login + script con la API.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sitio } from './sitio.mjs'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
// Todo fuera de este repo: dentro, `import 'captura-cli'` se resolvería por la autorreferencia del paquete y no
// probaría nada, y git resolvería la carpeta como el workspace captura-cli.
const raiz = join(tmpdir(), 'captura-cli-pruebas', `script-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa'), ws = join(raiz, 'ws'), proy = join(raiz, 'proy'), scripts = join(raiz, 'scripts')
const env = { ...process.env, CAPTURA_HOME: casa }
let s

const correr = (args, { cwd = ws, extra = {}, ms = 120000 } = {}) => new Promise((ok) => {
  const p = spawn(process.execPath, [cli, ...args], { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d })
  p.stderr.on('data', (d) => { err += d })
  const t = setTimeout(() => p.kill(), ms)
  p.on('close', (code) => { clearTimeout(t); ok({ code, out, err }) })
})
const script = (nombre, codigo) => { const f = join(scripts, nombre); writeFileSync(f, codigo); return f }

before(async () => {
  for (const d of [casa, ws, proy, scripts]) mkdirSync(d, { recursive: true })
  s = await sitio()
  // Un proyecto sin autenticación: la app no declara login.
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ apps: { pub: { baseUrl: s.url, inicio: '/publico' } } }))
  const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'si'], { cwd: ws, env, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})
after(() => s?.cerrar())

test('el import corto de captura-cli (y sus subrutas) funciona con `captura-cli script`; los argumentos llegan al script', async () => {
  const f = script('a.mjs', `import { credenciales, caso } from 'captura-cli'
import * as correo from 'captura-cli/correo'
import { CONTRATO } from 'captura-cli/adaptadores'
console.log(JSON.stringify({ args: process.argv.slice(2), arg1: process.argv[1].endsWith('a.mjs'), api: typeof credenciales + typeof caso, correo: typeof correo.mailpit, contrato: CONTRATO }))`)
  const r = await correr(['script', f, 'uno', '--dos', 'tres'])
  assert.equal(r.code, 0, r.out + r.err)
  assert.deepEqual(JSON.parse(r.out.trim().split('\n').at(-1)), { args: ['uno', '--dos', 'tres'], arg1: true, api: 'functionfunction', correo: 'function', contrato: 1 })
})

test('el código de salida y el mensaje de la herramienta se conservan (3 FALTAN_CREDENCIALES, process.exitCode, error del script)', async () => {
  let r = await correr(['script', script('b.mjs', `import { credenciales } from 'captura-cli'\ncredenciales('rol sin datos')`)])
  assert.equal(r.code, 3, r.out + r.err)
  assert.match(r.err, /^FALTAN_CREDENCIALES: rol sin datos -> definir CAPTURA_ROL_SIN_DATOS_USUARIO, CAPTURA_ROL_SIN_DATOS_CLAVE en \.env, o pedírselas al usuario$/m)
  r = await correr(['script', script('c.mjs', 'process.exitCode = 5')])
  assert.equal(r.code, 5)
  r = await correr(['script', script('d.mjs', "throw new Error('boom')")])
  assert.equal(r.code, 1)
  assert.match(r.err, /^ERROR: Error: boom$/m)
})

test('opciones propias antes del archivo (--slot) y argumentos del script después; archivo inexistente y opción desconocida', async () => {
  const f = script('e.mjs', "console.log(JSON.stringify({ slot: process.env.CAPTURA_SLOT, args: process.argv.slice(2) }))")
  let r = await correr(['script', '--slot', '3', f, '--slot', '9'])
  assert.equal(r.code, 0, r.err)
  assert.deepEqual(JSON.parse(r.out.trim()), { slot: '3', args: ['--slot', '9'] })
  r = await correr(['script', join(scripts, 'no-existe.mjs')])
  assert.equal(r.code, 1)
  assert.match(r.err, /^script: no existe .+no-existe\.mjs$/m)
  r = await correr(['script', '--foo', f])
  assert.equal(r.code, 1)
  assert.match(r.err, /script: opción desconocida --foo antes del archivo \(válidas: --slot, --canal, --out, --config, --limpiar\)/)
  assert.equal((await correr(['script'])).code, 1)
})

test('si el proyecto tiene su propia copia de captura-cli, esa gana', async () => {
  const proyecto = join(raiz, 'con-copia')
  mkdirSync(join(proyecto, 'node_modules', 'captura-cli'), { recursive: true })
  writeFileSync(join(proyecto, 'node_modules', 'captura-cli', 'package.json'), JSON.stringify({ name: 'captura-cli', version: '0.0.0-local', type: 'module', exports: { '.': './i.js' } }))
  writeFileSync(join(proyecto, 'node_modules', 'captura-cli', 'i.js'), "export const marca = 'copia del proyecto'")
  const f = join(proyecto, 'f.mjs')
  writeFileSync(f, "import { marca } from 'captura-cli'\nconsole.log(marca)")
  const r = await correr(['script', f], { cwd: proyecto })
  assert.equal(r.code, 0, r.out + r.err)
  assert.equal(r.out.trim(), 'copia del proyecto')
})

test('proyecto sin autenticación de punta a punta: app sin login + script con la API; el libro de uso anota el script', async () => {
  const f = script('g.mjs', `import { sesion, marcar, foto, limpiar, caso } from 'captura-cli'
const { page, cerrar } = await sesion(null, { ticket: 'PRUEBA-SL' })
await page.getByRole('button', { name: 'Contar' }).click()
await marcar(page, page.locator('#n'), 'Cuenta 1')
await foto(page, 'contador', { leyenda: 'El contador sube a 1' })
await limpiar(page)
caso(page, { nombre: 'contador', esperado: '1', observado: await page.locator('#n').innerText(), ok: true })
await cerrar({ ninguna: 'prueba' })`)
  const r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^sesion: pub no tiene login; abierta en \/publico$/m)
  assert.match(r.out, /^captura: .+step01-contador\.png$/m)
  const informe = r.out.match(/^informe: (.+informe\.md)/m)[1]
  assert.match(readFileSync(informe, 'utf8'), /^\| contador \| 1 \| 1 \| OK \|/m)
  assert.ok(readFileSync(join(informe, '..', 'manifest.json'), 'utf8').includes('"sha256"'))
  const libro = readFileSync(join(casa, 'workspaces', readdirSync(join(casa, 'workspaces'))[0], 'uso.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const u = libro.at(-1)
  assert.equal(u.comando, 'script')
  assert.equal(u.script, 'g.mjs')
  assert.equal(u.capturas, 1)
})
