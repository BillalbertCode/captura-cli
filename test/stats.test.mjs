// F7: libro de uso (uso.jsonl), `captura-cli stats` y la lectura de un transcrito de Claude Code.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { leerTranscrito } from '../dist/stats.js'
import { appZZ, sitio } from './sitio.mjs'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const recetas = fileURLToPath(new URL('./paridad/fixtures/recetas/', import.meta.url))
const raiz = join(tmpdir(), 'captura-cli-pruebas', `stats-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa'), ws = join(raiz, 'ws'), proy = join(raiz, 'proy')
const env = { ...process.env, CAPTURA_HOME: casa, CAPTURA_ZZ_USUARIO: 'A1', CAPTURA_ZZ_CLAVE: 'c' }
let s, libro

const correr = (args, cwd = ws, extra = {}) => new Promise((ok) => {
  const p = spawn(process.execPath, [cli, ...args], { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d })
  p.stderr.on('data', (d) => { err += d })
  const t = setTimeout(() => p.kill(), 120000)
  p.on('close', (code) => { clearTimeout(t); ok({ code, out, err }) })
})
const lineas = () => readFileSync(libro, 'utf8').trim().split('\n').map((l) => JSON.parse(l))

before(async () => {
  for (const d of [casa, ws, join(proy, 'escenarios')]) mkdirSync(d, { recursive: true })
  s = await sitio()
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ apps: { zz: appZZ(s.url) }, rutas: { recetas } }))
  const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'si'], { cwd: ws, env, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const nombre = readFileSync(join(casa, 'workspaces', spawnSync('node', ['-e', 'console.log(require("fs").readdirSync(process.argv[1])[0])', join(casa, 'workspaces')], { encoding: 'utf8' }).stdout.trim(), 'workspace.json'), 'utf8')
  libro = join(casa, 'workspaces', JSON.parse(nombre).nombre, 'uso.jsonl')
})
after(() => s?.cerrar())

test('uso.jsonl: una línea por comando con caracteres, tokens estimados, tiempo y código; hook y stats no se miden', async () => {
  const r = await correr(['recetas', 'zz'])
  assert.equal(r.code, 0, r.err)
  await correr(['validar', 'no-existe'])
  await correr(['stats'])
  const ls = lineas()
  // init no se mide: corre antes de que exista el workspace (y su libro).
  assert.deepEqual(ls.map((l) => [l.comando, l.codigo]), [['recetas', 0], ['validar', 2]])
  const rec = ls[0]
  assert.equal(rec.salida.caracteres, r.out.length + r.err.length)
  assert.equal(rec.salida.tokens, Math.ceil(rec.salida.caracteres / 4))
  assert.equal(typeof rec.ms, 'number')
  assert.match(rec.fecha, /^\d{4}-\d{2}-\d{2}T/)
})

test('uso.jsonl: una corrida cuenta recetas (ya estaba / ejecutada / rota), candidatas, casos, capturas e ids', async () => {
  writeFileSync(join(proy, 'escenarios', 'e.json'), JSON.stringify({
    version: 1, id: 'PRUEBA-ST', rol: 'zz',
    casos: [
      { nombre: 'a', pasos: [{ receta: 'abrir-bandeja' }, { receta: 'abrir-bandeja' }, { llenar: { en: { placeholder: 'Documento' }, valor: '1' } }, { marcar: { en: { rol: 'heading', nombre: 'Bandeja' }, etiqueta: 'x' } }, { foto: { descripcion: 'f', leyenda: 'l' } }] },
      { nombre: 'b', pasos: [{ receta: 'rota' }] },
    ],
  }))
  const r = await correr(['run', 'e', '--sin-sesion'])
  assert.equal(r.code, 1, r.out + r.err) // el caso b falla por la receta rota
  const l = lineas().at(-1)
  assert.equal(l.comando, 'run')
  assert.deepEqual(l.recetas, { yaEstaba: 1, ejecutada: 1, rota: 1, creadas: 0, candidatas: 1 })
  assert.deepEqual(l.casos, { ok: 1, falla: 1 })
  assert.equal(l.capturas, 1)
  assert.deepEqual(l.ids, ['PRUEBA-ST'])
})

test('stats: resumen por comando, recetas, casos y espacio; --json; --todos; --desde', async () => {
  let r = await correr(['stats'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^stats .+: \d+ corrida\(s\), [\d.k]+ tokens estimados de salida$/m)
  assert.match(r.out, /^run\s+1\s+/m)
  assert.match(r.out, /^recetas: usadas 2 \(ya estaban 1, ejecutadas 1\) · rotas 1 · creadas 0 · tramos candidatos 1$/m)
  assert.match(r.out, /^casos: 1 OK, 1 FALLA · capturas 1 · respuestas 5xx 0$/m)
  assert.match(r.out, /^espacio: capturas .+ \(1 ids\) · sesiones .+ · caché .+ · temporales .+$/m)
  r = await correr(['stats', '--json'])
  const j = JSON.parse(r.out)
  assert.equal(j.porComando.run.corridas, 1)
  assert.equal(j.casos.falla, 1)
  r = await correr(['stats', '--todos'], raiz)
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^stats todos \(1 workspace\(s\)\): \d+ corrida\(s\)/m)
  assert.match((await correr(['stats', '--desde', '1d'])).out, /\(desde \d{4}-\d{2}-\d{2}\)/)
  assert.equal((await correr(['stats', '--desde', 'ayer'])).code, 1)
})

test('estadisticas no: no se escribe nada', async () => {
  const casa2 = join(raiz, 'casa2'), ws2 = join(raiz, 'ws2')
  mkdirSync(ws2, { recursive: true })
  const e2 = { ...env, CAPTURA_HOME: casa2 }
  spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'no'], { cwd: ws2, env: e2, timeout: 60000 })
  spawnSync(process.execPath, [cli, 'recetas', 'zz'], { cwd: ws2, env: e2, timeout: 60000 })
  const r = spawnSync(process.execPath, [cli, 'stats'], { cwd: ws2, env: e2, encoding: 'utf8', timeout: 60000 })
  assert.match(r.stdout, /: 0 corrida\(s\)/)
  assert.match(r.stdout, /el registro de estadísticas está apagado: captura-cli config estadisticas si/)
})

test('transcrito: tokens reales (una vez por requestId) y resultados de captura-cli (sin rutas ni heredocs)', async () => {
  const a = (requestId, contenido, usage) => ({ type: 'assistant', requestId, message: { id: requestId, usage, content: contenido } })
  const uso = { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 }
  const res = (id, texto) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: texto }] }] } })
  const tu = (id, command) => ({ type: 'tool_use', id, name: 'Bash', input: { command } })
  const L = [
    a('r1', [{ type: 'text', text: 'hola' }], uso),
    a('r1', [tu('t1', 'cd /x/captura-cli && npm test')], uso), // mismo requestId: no se cuenta dos veces
    res('t1', 'x'.repeat(400)),
    a('r2', [tu('t2', 'timeout 300 captura-cli run flujo --sin-sesion')], uso),
    res('t2', 'y'.repeat(800)),
    a('r3', [tu('t3', "git commit -F - <<'EOF'\nfeat: x\n\n  captura-cli run ahora valida\nEOF")], uso),
    res('t3', 'z'.repeat(40)),
    a('r4', [tu('t4', 'timeout 60 node script.mjs')], uso),
    res('t4', 'captura: C:/salidas/T-1/step01-a.png\n' + 'w'.repeat(100)),
  ]
  const f = join(raiz, 'transcrito.jsonl')
  writeFileSync(f, L.map((x) => JSON.stringify(x)).join('\n') + '\n{roto\n')
  const t = leerTranscrito(f)
  assert.equal(t.respuestas, 4)
  assert.deepEqual(t.tokens, { entrada: 40, cacheCreacion: 400, cacheLectura: 4000, salida: 200, total: 4640 })
  assert.equal(t.herramientas, 4)
  assert.equal(t.captura.llamadas, 2)
  assert.equal(t.captura.tokens, 200 + Math.ceil(137 / 4))
  assert.deepEqual(t.captura.comandos.map((c) => c.comando), ['timeout 300 captura-cli run flujo --sin-sesion', 'timeout 60 node script.mjs'])
  const r = await correr(['stats', '--transcrito', f], raiz)
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^tokens reales \(4 respuestas\): entrada 40 · caché escrita 400 · caché leída 4\.0k · salida 200 · total 4\.6k$/m)
  assert.match(r.out, /^captura-cli: 2 llamadas; sus resultados ≈ 235 tokens \(\d+\.\d% de lo que devolvieron las herramientas\)$/m)
  assert.ok(!existsSync(join(raiz, 'uso.jsonl')))
})
