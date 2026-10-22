// F5: adaptadores propios desde la carpeta del proyecto (los cinco tipos), plantillas de `adaptador nuevo`,
// mensajes del contrato y `captura-cli entorno`. Un flujo real con `run` usa todos los adaptadores propios a la vez.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appZZ, sitio } from './sitio.mjs'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const recetas = fileURLToPath(new URL('./paridad/fixtures/recetas/', import.meta.url))
const raiz = join(tmpdir(), 'captura-cli-pruebas', `ad-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa'), ws = join(raiz, 'ws'), proy = join(raiz, 'proy'), ad = join(proy, 'adaptadores')
const publicado = join(raiz, 'publicado.txt')
// Credenciales con nombres propios del "proyecto" de prueba: E2E_<ROL>_IDENTIFIER / _PASSWORD.
const env = { ...process.env, CAPTURA_HOME: casa, E2E_ZZ_IDENTIFIER: 'A12345678', E2E_ZZ_PASSWORD: 'clave' }
let s

const correr = (args, extra = {}, ms = 120000) => new Promise((ok) => {
  const p = spawn(process.execPath, [cli, ...args], { cwd: ws, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d })
  p.stderr.on('data', (d) => { err += d })
  const t = setTimeout(() => p.kill(), ms)
  p.on('close', (code) => { clearTimeout(t); ok({ code, out, err }) })
})
const config = (adaptadores, extra = {}) => writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ apps: { zz: appZZ(s.url) }, rutas: { recetas }, adaptadores, ...extra }))

// Adaptadores propios mínimos, escritos como los escribiría un proyecto (solo con docs/adaptadores.md).
const ADAPTADORES = {
  'credenciales.mjs': `export default { contrato: 1, tipo: 'credenciales', crear(o) {
    const n = (r) => r.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    return { resolver(rol) {
      const vu = o.prefijo + n(rol) + '_IDENTIFIER', vc = o.prefijo + n(rol) + '_PASSWORD'
      const u = process.env[vu], c = process.env[vc]
      if (!u || !c) return { faltan: [...(u ? [] : [vu]), ...(c ? [] : [vc])], donde: 'el .env del proyecto de prueba' }
      return { usuario: u, clave: c, letra: u[0], numero: u.slice(1) }
    } }
  } }`,
  'id.mjs': `export default { contrato: 1, tipo: 'identificador', crear() { return {
    validar: (id) => (/^TAREA-\\d+$/i.test(id) ? null : 'id requerido, formato TAREA-NN'),
    carpeta: (id) => 'tarea_' + id.split('-')[1],
  } } }`,
  'entorno.mjs': `export default { contrato: 1, tipo: 'entorno', crear(o, ctx) { return {
    url: (app, cfg) => cfg.baseUrl,
    async estado({ slot }) { return { ok: true, salida: 'propio: slot ' + slot + ' sin servicios; dirSlot ' + (ctx.dirSlot ? 'ok' : 'falta') } },
    async levantar(app) { throw Object.assign(new Error('definir SERVICIOS_DIR'), { name: 'FaltaConfiguracion' }) },
  } } }`,
  'publicar.mjs': `import { readFileSync, appendFileSync } from 'node:fs'
  import { join } from 'node:path'
  export default { contrato: 1, tipo: 'publicacion', crear(o) { return {
    async publicar(carpeta, id) {
      const m = JSON.parse(readFileSync(join(carpeta, 'manifest.json'), 'utf8'))
      appendFileSync(o.destino, id + ' ' + m.capturas.map((c) => c.publicar + ':' + c.sha256.slice(0, 8)).join(',') + '\\n')
    },
  } } }`,
  'correo.mjs': `export default { contrato: 1, tipo: 'correo', crear() { return { url: () => undefined, async buscar() { return [] } } } }`,
  'contrato2.mjs': `export default { contrato: 2, tipo: 'correo', crear() { return {} } }`,
  'sin-metodo.mjs': `export default { contrato: 1, tipo: 'correo', crear() { return { url() {} } } }`,
}
const propios = {
  credenciales: { usa: './adaptadores/credenciales.mjs', prefijo: 'E2E_' },
  identificador: './adaptadores/id.mjs',
  entorno: './adaptadores/entorno.mjs',
  publicacion: { usa: './adaptadores/publicar.mjs', destino: publicado },
  correo: './adaptadores/correo.mjs',
}

before(async () => {
  for (const d of [casa, ws, ad]) mkdirSync(d, { recursive: true })
  for (const [n, c] of Object.entries(ADAPTADORES)) writeFileSync(join(ad, n), c)
  s = await sitio()
  config(propios)
  const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'no'], { cwd: ws, env, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})
after(() => s?.cerrar())

test('verificar: los cinco adaptadores propios cumplen el contrato', async () => {
  const r = await correr(['adaptadores', 'verificar'])
  assert.equal(r.code, 0, r.out + r.err)
  for (const l of ['credenciales: ok (./adaptadores/credenciales.mjs)', 'identificador: ok (./adaptadores/id.mjs)', 'entorno: ok (./adaptadores/entorno.mjs)', 'publicacion: ok (./adaptadores/publicar.mjs)', 'correo: ok (./adaptadores/correo.mjs)']) assert.ok(r.out.includes(l), l)
})

test('run con todos los adaptadores propios: credenciales, id con carpeta propia y publicación con el manifest', async () => {
  const esc = join(proy, 'escenarios', 'propios.json')
  mkdirSync(join(proy, 'escenarios'), { recursive: true })
  writeFileSync(esc, JSON.stringify({
    version: 1, id: 'TAREA-7', rol: 'zz', recetas: { ninguna: 'prueba' },
    casos: [{ nombre: 'bandeja', pasos: [{ receta: 'abrir-bandeja' }, { marcar: { en: { rol: 'heading', nombre: 'Bandeja' }, etiqueta: 'Bandeja' } }, { foto: { descripcion: 'bandeja', leyenda: 'La bandeja' } }] }],
  }))
  const r = await correr(['run', 'propios', '--sin-sesion'])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^informe: .+[\\/]tarea_7[\\/]informe\.md/m)
  assert.match(readFileSync(publicado, 'utf8'), /^TAREA-7 publicar\/step\d{2}-bandeja\.png:[0-9a-f]{8}$/m)
  // El id que no cumple el adaptador propio: código 2 con su mensaje, sin abrir el navegador.
  const v = await correr(['validar', esc, '--id', 'X-1'], {}, 30000)
  assert.equal(v.code, 2)
  assert.match(v.err, /- id: id requerido, formato TAREA-NN/)
})

test('credenciales propias que faltan: FALTAN_CREDENCIALES con las variables y el "donde" del adaptador', async () => {
  const r = await correr(['explorar', '/home', '--rol', 'zz', '--sin-sesion'], { E2E_ZZ_PASSWORD: '' })
  assert.equal(r.code, 3, r.out + r.err)
  assert.match(r.err, /^FALTAN_CREDENCIALES: zz -> definir E2E_ZZ_PASSWORD en el \.env del proyecto de prueba, o pedírselas al usuario$/m)
})

test('entorno: estado del adaptador propio; levantar con FaltaConfiguracion sale con 3; sin el método, dice cuál falta', async () => {
  let r = await correr(['entorno', 'estado', '--slot', '2'], {}, 30000)
  assert.equal(r.code, 0, r.out + r.err)
  assert.ok(r.out.includes('propio: slot 2 sin servicios; dirSlot ok'), r.out)
  assert.match(r.out, /^entorno estado: ok \(slot 2\)$/m)
  r = await correr(['entorno', 'levantar', 'zz'], {}, 30000)
  assert.equal(r.code, 3)
  assert.match(r.err, /^FALTAN_CREDENCIALES: entorno -> definir SERVICIOS_DIR$/m)
  r = await correr(['entorno', 'parar'], {}, 30000)
  assert.equal(r.code, 1)
  assert.match(r.err, /entorno parar: el adaptador de entorno no implementa parar\(\)/)
})

test('contrato: versión distinta y método faltante, con el mensaje que ve el autor', async () => {
  config({ ...propios, correo: './adaptadores/contrato2.mjs' })
  let r = await correr(['adaptadores', 'verificar'], {}, 30000)
  assert.equal(r.code, 1)
  assert.match(r.out + r.err, /ADAPTADOR_INVALIDO: correo \(\.\/adaptadores\/contrato2\.mjs\): declara contrato 2 y esta versión de captura-cli usa el 1; ver docs\/adaptadores\.md/)
  config({ ...propios, correo: './adaptadores/sin-metodo.mjs' })
  r = await correr(['adaptadores', 'verificar'], {}, 30000)
  assert.match(r.out + r.err, /ADAPTADOR_INVALIDO: correo \(\.\/adaptadores\/sin-metodo\.mjs\): falta el método buscar\(\)/)
  config({ ...propios, correo: './adaptadores/no-existe.mjs' })
  r = await correr(['adaptadores', 'verificar'], {}, 30000)
  assert.match(r.out + r.err, /ADAPTADOR_INVALIDO: correo: no se pudo cargar .+no-existe\.mjs/)
  config(propios)
})

test('adaptador nuevo: plantilla por tipo que verificar acepta tal cual; no sobrescribe', async () => {
  const dir = join(raiz, 'plantillas')
  for (const t of ['credenciales', 'identificador', 'entorno', 'publicacion', 'correo']) {
    const f = join(dir, `${t}.mjs`)
    const r = await correr(['adaptador', 'nuevo', t, '--en', f], {}, 30000)
    assert.equal(r.code, 0, r.out + r.err)
    assert.ok(existsSync(f))
    assert.match(r.out, new RegExp(`"adaptadores": \\{ "${t}": \\{ "usa": ".+${t}\\.mjs" \\} \\}`))
  }
  config({ credenciales: join(dir, 'credenciales.mjs'), identificador: join(dir, 'identificador.mjs'), entorno: join(dir, 'entorno.mjs'), publicacion: join(dir, 'publicacion.mjs'), correo: join(dir, 'correo.mjs') })
  const v = await correr(['adaptadores', 'verificar'], {}, 30000)
  assert.equal(v.code, 0, v.out + v.err)
  const e = await correr(['entorno', 'estado'], {}, 30000)
  assert.equal(e.code, 0, e.out + e.err)
  const otra = await correr(['adaptador', 'nuevo', 'correo', '--en', join(dir, 'correo.mjs')], {}, 30000)
  assert.equal(otra.code, 1)
  assert.match(otra.err, /ya existe; no se sobrescribe/)
  assert.equal((await correr(['adaptador', 'nuevo', 'jira'], {}, 30000)).code, 1)
  config(propios)
})
