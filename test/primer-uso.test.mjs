// Primer uso de un workspace: con una persona al teclado, cualquier comando ofrece configurarlo y sigue; sin teclado
// (un agente) sale con 6 y las preguntas. Las respuestas se pasan por tubería con CAPTURA_INTERACTIVO=1.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const raiz = join(tmpdir(), 'captura-cli-pruebas', `primer-${process.pid}-${Date.now()}`)
let n = 0
const nuevo = () => {
  const d = join(raiz, `c${++n}`)
  const o = { casa: join(d, 'casa'), ws: join(d, 'ws') }
  for (const x of Object.values(o)) mkdirSync(x, { recursive: true })
  return o
}
const correr = ({ casa, ws }, args, { entrada, extra = {} } = {}) => new Promise((ok) => {
  const p = spawn(process.execPath, [cli, ...args], { cwd: ws, env: { ...process.env, CAPTURA_HOME: casa, ...extra }, stdio: [entrada === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d })
  p.stderr.on('data', (d) => { err += d })
  if (entrada !== undefined) { p.stdin.on('error', () => {}); p.stdin.end(entrada) }
  const t = setTimeout(() => p.kill(), 60000)
  p.on('close', (code) => { clearTimeout(t); ok({ code, out, err }) })
})
const SI = { CAPTURA_INTERACTIVO: '1' }
const registros = (casa) => (existsSync(join(casa, 'workspaces')) ? readdirSync(join(casa, 'workspaces')) : [])
const leer = (f) => JSON.parse(readFileSync(f, 'utf8'))

test('primer uso: un comando cualquiera ofrece configurar, registra con lo propuesto y sigue; la segunda vez no pregunta', async () => {
  const a = nuevo()
  let r = await correr(a, ['config'], { entrada: 'S\n\n\n\n\n', extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(r.out.includes('Esta carpeta no está configurada en captura-cli:'), r.out)
  assert.ok(r.out.includes('¿Configurarla ahora? [S/n]:'))
  assert.ok(r.out.includes('Primera vez en esta máquina.'))
  assert.match(r.out, /^workspace registrado: .+$/m)
  assert.match(r.out, /^workspace: .+ws$/m, 'después de registrar, el comando sigue y muestra la config')
  assert.deepEqual(leer(join(a.casa, 'config.json')), { salidasBasePreguntada: true })
  assert.equal(registros(a.casa).length, 1)
  r = await correr(a, ['config'], { entrada: '', extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(!r.out.includes('no está configurada'), 'ya registrado: no pregunta')
  assert.ok(!r.out.includes('Primera vez'))
})

test('respuestas propias: carpeta base, salidas, proyecto y estadísticas; el segundo workspace usa la base y no repite la pregunta de máquina', async () => {
  const a = nuevo()
  const base = join(raiz, 'base'), salidas = join(raiz, 'salidas-propias'), proyecto = join(raiz, 'proyecto-propio')
  let r = await correr(a, ['config'], { entrada: `si\n${base}\n${salidas}\n${proyecto}\nno\n`, extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.deepEqual(leer(join(a.casa, 'config.json')), { salidasBase: resolve(base), salidasBasePreguntada: true })
  const reg = leer(join(a.casa, 'workspaces', registros(a.casa)[0], 'workspace.json'))
  assert.equal(reg.salidas, resolve(salidas))
  assert.equal(reg.proyecto, resolve(proyecto))
  assert.equal(reg.estadisticas, false)
  assert.ok(existsSync(join(proyecto, 'captura.config.json')))
  // Otro workspace en la misma máquina: ya no pregunta la base, y propone una carpeta dentro de ella.
  const b = { casa: a.casa, ws: join(raiz, 'otro-ws') }
  mkdirSync(b.ws, { recursive: true })
  r = await correr(b, ['config'], { entrada: 'S\n\n\n\n', extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(!r.out.includes('Primera vez en esta máquina'))
  assert.ok(r.out.includes(`Salidas de este workspace (capturas e informes; aparte de la carpeta del proyecto) — Enter = ${join(resolve(base), registros(a.casa).find((x) => x.startsWith('otro-ws')))}`), r.out)
  const reg2 = leer(join(a.casa, 'workspaces', registros(a.casa).find((x) => x.startsWith('otro-ws')), 'workspace.json'))
  assert.ok(reg2.salidas.startsWith(resolve(base)))
  assert.equal(reg2.estadisticas, true)
})

test('decir que no, cancelar o cerrar la entrada: sale con 6 y las preguntas, y no se registra nada', async () => {
  for (const entrada of ['n\n', '', 'S\n\n']) { // la última se corta a mitad: no hay con qué completar
    const a = nuevo()
    const r = await correr(a, ['recetas'], { entrada, extra: SI })
    assert.equal(r.code, 6, `entrada ${JSON.stringify(entrada)}: ${r.out}${r.err}`)
    assert.match(r.err, /^WORKSPACE_NUEVO: .+ no está registrado en /m)
    assert.deepEqual(registros(a.casa), [], `entrada ${JSON.stringify(entrada)}: no debió registrar`)
  }
})

test('sin teclado (un agente) o con CAPTURA_INTERACTIVO=0: no pregunta, sale con 6 y las preguntas, como siempre', async () => {
  let a = nuevo()
  let r = await correr(a, ['config'])
  assert.equal(r.code, 6)
  assert.ok(!r.out.includes('¿Configurarla ahora?'))
  assert.match(r.err, /captura-cli init --yes --salidas global/)
  a = nuevo()
  r = await correr(a, ['config'], { entrada: 'S\n\n\n\n\n', extra: { CAPTURA_INTERACTIVO: '0' } })
  assert.equal(r.code, 6)
  assert.deepEqual(registros(a.casa), [])
})

test('init sin --yes en una terminal: pregunta sin repetir «¿configurarla ahora?»', async () => {
  const a = nuevo()
  const r = await correr(a, ['init'], { entrada: '\n\n\n\n', extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(!r.out.includes('¿Configurarla ahora?'))
  assert.equal(registros(a.casa).length, 1)
  assert.equal((await correr(nuevo(), ['init'], { extra: SI })).code, 6, 'sin respuestas: no registra')
})

test('captura-cli script también lo ofrece y después corre el script', async () => {
  const a = nuevo()
  const f = join(raiz, 'marcador.mjs')
  writeFileSync(f, "console.log('marcador', process.argv.slice(2).join(','))")
  const r = await correr(a, ['script', f, 'uno', 'dos'], { entrada: 'S\n\n\n\n\n', extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^workspace registrado: /m)
  assert.match(r.out, /^marcador uno,dos$/m)
})

test('doctor y los hooks no preguntan nunca (solo informan)', async () => {
  const a = nuevo()
  let r = await correr(a, ['doctor'], { entrada: 'S\n\n\n\n\n', extra: SI })
  assert.ok(!r.out.includes('¿Configurarla ahora?'), r.out)
  assert.match(r.out, /^AVISO workspace .+ sin registrar/m)
  assert.ok(r.out.includes('captura-cli init'), r.out)
  r = await correr(a, ['hook', 'inicio'], { entrada: JSON.stringify({ cwd: a.ws }), extra: SI })
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(!r.out.includes('¿Configurarla ahora?'))
  assert.match(r.out, /workspace sin registrar/)
  assert.deepEqual(registros(a.casa), [])
})

test('config salidas-base fija la base y evita preguntarla después', async () => {
  const a = nuevo()
  const base = join(raiz, 'base-fija')
  const r = await correr(a, ['config', 'salidas-base', base])
  assert.equal(r.code, 0, r.out + r.err)
  assert.deepEqual(leer(join(a.casa, 'config.json')), { salidasBase: resolve(base), salidasBasePreguntada: true })
  const s = await correr(a, ['config'], { entrada: 'S\n\n\n\n', extra: SI })
  assert.equal(s.code, 0, s.out + s.err)
  assert.ok(!s.out.includes('Primera vez en esta máquina'))
})

test('init resume dónde quedó cada cosa y avisa si las capturas NO van a la carpeta del proyecto', async () => {
  const a = nuevo()
  spawnSync('git', ['init', '-q'], { cwd: a.ws, timeout: 30000 })
  const proyecto = join(a.ws, 'captura')
  let r = await correr(a, ['init', '--yes', '--salidas', 'global', '--proyecto', proyecto])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^salidas \(capturas e informes\): .+captures$/m)
  assert.ok(r.out.includes(`proyecto (config, adaptadores, recetas): ${resolve(proyecto)}`), r.out)
  assert.ok(r.out.includes(`las capturas NO van a la carpeta del proyecto sino a las salidas; para guardarlas dentro de ella: captura-cli config salidas "${join(resolve(proyecto), 'capturas')}"`), r.out)
  // Con las salidas dentro del proyecto no hay nada que avisar.
  r = await correr(a, ['config', 'salidas', join(proyecto, 'capturas')])
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(!r.out.includes('NO van'), r.out)
  assert.ok(readFileSync(join(a.ws, '.git', 'info', 'exclude'), 'utf8').includes('/captura/capturas/'), 'salidas dentro del repo: excluidas por .git/info/exclude')
})
