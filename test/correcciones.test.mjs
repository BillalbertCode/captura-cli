// Correcciones que salieron de usar la 1.1.2 en una tarea real (SUT-647): api() sin recorte, --limpiar y el aviso de
// publicar/, el id de `explorar`, el libro de uso que cuenta cada invocación, las precondiciones y la salud del entorno.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sinConversionMsys } from '../dist/msys.js'
import { sitio } from './sitio.mjs'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
// Todo fuera de este repo: dentro, `import 'captura-cli'` se resolvería por la autorreferencia del paquete.
const raiz = join(tmpdir(), 'captura-cli-pruebas', `correcciones-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa')
const ws = join(raiz, 'ws'), ws2 = join(raiz, 'ws2'), ws3 = join(raiz, 'ws3')
const proy = join(raiz, 'proy'), proy2 = join(raiz, 'proy2'), proy3 = join(raiz, 'proy3')
const scripts = join(raiz, 'scripts')
const env = { ...process.env, CAPTURA_HOME: casa }
let s

const correr = (args, cwd = ws, extra = {}) => new Promise((ok) => {
  const p = spawn(process.execPath, [cli, ...args], { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d })
  p.stderr.on('data', (d) => { err += d })
  const t = setTimeout(() => p.kill(), 120000)
  p.on('close', (code) => { clearTimeout(t); ok({ code, out, err }) })
})
const script = (nombre, codigo) => { const f = join(scripts, nombre); writeFileSync(f, codigo); return f }
const registrar = (cwd, proyecto) => {
  const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proyecto, '--estadisticas', 'si'], { cwd, env, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
}
const lineas = (proyecto) => {
  const dir = readdirSync(join(casa, 'workspaces')).find((n) => {
    try { return JSON.parse(readFileSync(join(casa, 'workspaces', n, 'workspace.json'), 'utf8')).proyecto === proyecto } catch { return false }
  })
  assert.ok(dir, `no está el workspace de ${proyecto}`)
  const f = join(casa, 'workspaces', dir, 'uso.jsonl')
  return existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
}

before(async () => {
  for (const d of [casa, ws, ws2, ws3, proy, proy2, proy3, scripts]) mkdirSync(d, { recursive: true })
  s = await sitio()
  // ws: una app sin login (para api, --limpiar y el libro de uso).
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ apps: { pub: { baseUrl: s.url, inicio: '/publico' } } }))
  // ws2: el id tiene formato de tarea y hay una app caída (para `explorar` y la salud del entorno).
  writeFileSync(join(proy2, 'captura.config.json'), JSON.stringify({
    id: { patron: '^SUT-\\d+$' },
    apps: { pub: { baseUrl: s.url, inicio: '/publico' }, muerto: { baseUrl: 'http://127.0.0.1:9', inicio: '/' } },
    adaptadores: { entorno: { usa: 'builtin:comando', comandos: { estado: 'echo servicios arriba' } } },
  }))
  // ws3: una precondición que falla (como una VPN que no está).
  writeFileSync(join(proy3, 'falla.cjs'), 'process.exit(3)\n')
  writeFileSync(join(proy3, 'captura.config.json'), JSON.stringify({
    apps: { pub: { baseUrl: s.url, inicio: '/publico' } },
    precondiciones: [`node "${join(proy3, 'falla.cjs')}"`],
  }))
  registrar(ws, proy)
  registrar(ws2, proy2)
  registrar(ws3, proy3)
})
after(() => s?.cerrar())

test('api(): el texto completo y el JSON parseado; el log es lo único que se recorta', async () => {
  const f = script('api.mjs', `import { sesion, api } from 'captura-cli'
const { page, cerrar } = await sesion(null, { ticket: 'PRUEBA-API' })
const r = await api(page, 'get', '/api/largo')
console.log('RESULTADO ' + JSON.stringify({ largo: r.texto.length, items: r.json.items.length }))
await cerrar({ ninguna: 'prueba' })`)
  const r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  const m = r.out.match(/^RESULTADO (.+)$/m)
  assert.ok(m, r.out)
  const j = JSON.parse(m[1])
  assert.ok(j.largo > 2000, `el texto llegó recortado: ${j.largo} caracteres`)
  assert.equal(j.items, 50)
  const log = r.out.match(/^api GET \/api\/largo -> 200 (.+)$/m)
  assert.ok(log, 'la línea del log no está')
  assert.ok(log[1].length <= 160, 'el log se recorta a 160 caracteres')
})

test('abrirSelectHasta: el patrón de react-select (getByLabel -> foco -> ArrowDown -> role=option) funciona con el control fuera de la vista', async () => {
  const f = script('select.mjs', `import { sesion, abrirSelectHasta } from 'captura-cli'
const { page, cerrar } = await sesion(null, { ticket: 'PRUEBA-SELECT' })
await page.goto('${s.url}/react-select')
const op = await abrirSelectHasta(page.getByLabel('Estado', { exact: true }), 'Aprobado')
await op.click()
console.log('RESULTADO ' + JSON.stringify({ valor: await page.locator('#valor').innerText() }))
await cerrar({ ninguna: 'prueba' })`)
  const r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  const m = r.out.match(/^RESULTADO (.+)$/m)
  assert.ok(m, r.out)
  assert.deepEqual(JSON.parse(m[1]), { valor: 'Aprobado' })
})

test('--limpiar: la corrida empieza de cero (sin las capturas ni el publicar/ de la anterior)', async () => {
  const f = script('limpiar.mjs', `import { sesion, marcar, foto, limpiar } from 'captura-cli'
const { page, cerrar } = await sesion(null, { ticket: 'PRUEBA-LIM' })
await marcar(page, page.locator('#n'), 'contador')
await foto(page, 'contador', { leyenda: 'El contador' })
await limpiar(page)
await cerrar({ ninguna: 'prueba' })`)
  const pngs = (carpeta) => readdirSync(carpeta).filter((n) => /^step\d+-.*\.png$/.test(n)).sort()
  let r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  const carpeta = dirname(r.out.match(/^captura: (.+step\d+-contador\.png)$/m)[1])
  assert.deepEqual(pngs(carpeta), ['step01-contador.png'])
  // Sin --limpiar la numeración sigue (step01, step02, …): la corrida anterior sigue ahí.
  r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  assert.deepEqual(pngs(carpeta), ['step01-contador.png', 'step02-contador.png'])
  // Con --limpiar se vacía la carpeta y la numeración vuelve a empezar.
  r = await correr(['script', '--limpiar', f])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^limpieza: \d+ cosa\(s\) de la corrida anterior en /m)
  assert.deepEqual(pngs(carpeta), ['step01-contador.png'])
})

test('publicar/ con un PNG que no está en el manifest: avisa (se subiría igual)', async () => {
  const f = script('limpiar.mjs', `import { sesion, marcar, foto, limpiar } from 'captura-cli'
const { page, cerrar } = await sesion(null, { ticket: 'PRUEBA-PUB' })
await marcar(page, page.locator('#n'), 'contador')
await foto(page, 'contador', { leyenda: 'El contador' })
await limpiar(page)
await cerrar({ ninguna: 'prueba' })`)
  let r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  const carpeta = dirname(r.out.match(/^captura: (.+step\d+-contador\.png)$/m)[1])
  // Como lo que se sube es publicar/, un PNG que no está en el manifest se sube sin que nadie lo haya revisado.
  writeFileSync(join(carpeta, 'publicar', 'step99-vieja.png'), 'png')
  r = await correr(['script', f])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.err, /AVISO: publicar\/ tiene 1 captura\(s\) de corridas anteriores que no están en el manifest\.json: step99-vieja\.png/)
})

test('explorar: el id va con --id, con CAPTURA_ID o como argumento; sin id, el error dice cómo pasarlo', async () => {
  let r = await correr(['explorar', '/publico', '--app', 'pub'], ws2)
  assert.equal(r.code, 1)
  assert.match(r.err, /explorar: falta el id \(formato \^SUT-\\d\+\$\): pasalo con --id <id> o CAPTURA_ID=<id>/)
  r = await correr(['explorar', '/publico', '--app', 'pub', '--id', 'SUT-647'], ws2)
  assert.equal(r.code, 0, r.out + r.err)
  r = await correr(['explorar', 'SUT-648', '/publico', '--app', 'pub'], ws2)
  assert.equal(r.code, 0, r.out + r.err)
  r = await correr(['explorar', '/publico', '--app', 'pub'], ws2, { CAPTURA_ID: 'SUT-649' })
  assert.equal(r.code, 0, r.out + r.err)
})

test('entorno estado: comprueba que cada app responda y avisa de la que no', async () => {
  const r = await correr(['entorno', 'estado'], ws2)
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^salud:$/m)
  assert.match(r.out, /^ {2}pub: .+ -> responde \(HTTP 200\)$/m)
  assert.match(r.out, /^ {2}muerto: .+ -> NO RESPONDE \(/m)
  assert.match(r.err, /AVISO: 1 app\(s\) no responden: puede ser la VPN o un servicio caído/)
})

test('precondiciones: si un comando falla, la sesión no abre y dice cuál', async () => {
  const f = script('pre.mjs', `import { sesion } from 'captura-cli'
const { page, cerrar } = await sesion(null, { ticket: 'PRUEBA-PRE' })
await cerrar({ ninguna: 'prueba' })`)
  const r = await correr(['script', f], ws3)
  assert.equal(r.code, 1, r.out + r.err)
  assert.match(r.err, /precondiciones: falló «.+falla\.cjs"» \(código 3\)/)
})

test('stats: --id acota a una tarea y el informe separa las corridas por id', async () => {
  const r = await correr(['stats', '--id', 'PRUEBA-API'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^stats .+ · PRUEBA-API: \d+ corrida\(s\)/m)
  assert.match(r.out, /^por tarea: PRUEBA-API: \d+ corrida\(s\)$/m)
  const j = JSON.parse((await correr(['stats', '--json'])).out)
  assert.ok(j.porId['PRUEBA-API'] >= 1, JSON.stringify(j.porId))
})

test('el libro de uso cuenta cada invocación de script, aunque falle antes de abrir el navegador', async () => {
  const antes = lineas(proy).length
  const r = await correr(['script', script('falla.mjs', "throw new Error('boom')")])
  assert.equal(r.code, 1)
  const l = lineas(proy)
  assert.equal(l.length, antes + 1)
  assert.equal(l.at(-1).comando, 'script')
  assert.equal(l.at(-1).script, 'falla.mjs')
  assert.equal(l.at(-1).codigo, 1)
})

test('sinConversionMsys: deshace la conversión de Git Bash (EXEPATH en .../Git/bin o en .../Git/usr/bin/bash)', () => {
  assert.equal(sinConversionMsys('C:/Program Files/Git/home', { MSYSTEM: 'MINGW64', EXEPATH: 'C:\\Program Files\\Git\\bin' }, 'win32'), '/home')
  assert.equal(sinConversionMsys('C:/Program Files/Git/home', { MSYSTEM: 'MINGW64', EXEPATH: 'C:\\Program Files\\Git\\usr\\bin\\bash' }, 'win32'), '/home')
  assert.equal(sinConversionMsys('/home', { MSYSTEM: 'MINGW64', EXEPATH: 'C:\\Program Files\\Git\\bin' }, 'win32'), '/home')
})
