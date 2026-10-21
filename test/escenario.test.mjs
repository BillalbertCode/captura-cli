// F3: escenario en JSON, `captura-cli validar`, `run` y `explorar` contra el sitio local.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validarEscenario } from '../dist/escenario.js'
import { appZZ, sitio } from './sitio.mjs'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const recetas = fileURLToPath(new URL('./paridad/fixtures/recetas/', import.meta.url))
// Fuera de este repo: dentro, git resolvería la carpeta como el workspace captura-cli.
const raiz = join(tmpdir(), 'captura-cli-pruebas', `esc-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa'), ws = join(raiz, 'ws'), proy = join(raiz, 'proy'), escs = join(proy, 'escenarios')
const env = { ...process.env, CAPTURA_HOME: casa, CAPTURA_ZZ_USUARIO: 'A12345678', CAPTURA_ZZ_CLAVE: 'clave' }
let s

// Asíncrono: el sitio corre en este proceso y tiene que poder responder mientras el CLI trabaja.
const correr = (args, ms = 120000) => new Promise((ok) => {
  const p = spawn(process.execPath, [cli, ...args], { cwd: ws, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = ''
  p.stdout.on('data', (d) => { out += d })
  p.stderr.on('data', (d) => { err += d })
  const t = setTimeout(() => p.kill(), ms)
  p.on('close', (code) => { clearTimeout(t); ok({ code, out, err }) })
})
const escribir = (nombre, esc) => { const f = join(escs, nombre); writeFileSync(f, JSON.stringify(esc, null, 2)); return f }
const tamPng = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)] }

const casosOk = [
  {
    nombre: 'bandeja con filtros', esperado: 'filtros llenos y Buscar habilitado',
    pasos: [
      { receta: 'abrir-bandeja' },
      { llenar: { en: { placeholder: 'Documento' }, valor: '12345678' } },
      { elegir: { en: { css: '#tipo' }, opcion: 'Dos' } },
      { comprobar: { en: { rol: 'button', nombre: 'Buscar' }, habilitado: true, visible: true } },
      { marcar: { en: { rol: 'heading', nombre: 'Bandeja' }, etiqueta: 'Bandeja con filtros' } },
      { foto: { descripcion: 'bandeja', leyenda: 'La bandeja con los filtros llenos' } },
      { limpiar: true },
    ],
  },
  {
    nombre: 'formulario con panel', esperado: 'aviso de éxito con el nombre',
    pasos: [
      { ir: '/form' },
      { llenar: { en: { etiqueta: 'Nombre' }, valor: 'Ana' } },
      { click: { en: { rol: 'button', nombre: 'Enviar', dentro: { css: 'section.panel' } } } },
      { esperarExito: '/Enviado con éxito: Ana/' },
      { marcar: { en: { texto: '/Enviado con éxito/' }, etiqueta: 'Aviso de éxito', lado: 'der' } },
      { foto: { descripcion: 'enviado', leyenda: 'El aviso confirma el envío' } },
      { limpiar: true },
      { api: { metodo: 'get', ruta: '/eco', status: 200 } },
      { cambio: { que: 'se envió el formulario de prueba', revertir: 'no aplica', revertido: true } },
    ],
  },
  {
    nombre: 'esperas por estado',
    pasos: [
      { ir: '/esperas' },
      { esperar: 'Esperas' },
      { esperarHabilitado: { en: { css: '#lento' }, ms: 5000 } },
      { elegir: { en: { css: '#combo' }, opcion: 'Opción tardía' } },
    ],
  },
]

before(async () => {
  for (const d of [casa, ws, escs]) mkdirSync(d, { recursive: true })
  s = await sitio()
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ apps: { zz: appZZ(s.url) }, rutas: { recetas } }))
  const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'no'], { cwd: ws, env, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })
  assert.equal(r.status, 0, r.stdout + r.stderr)
})
after(() => s?.cerrar())

test('validarEscenario: todos los errores, con ruta, sugerencia y forma correcta', () => {
  const r = validarEscenario({
    version: 2, rol: '', recetas: { ningun: 'x' },
    casos: [
      { nombre: 'a', pasos: [{ volar: {} }, { clik: { en: { rol: 'button' } } }, { click: { en: { rol: 'button', css: 'x' } } }, { foto: { descripcion: 'f' } }] },
      { nombre: 'a', pasos: [] },
    ],
  })
  assert.equal(r.ok, false)
  const e = r.errores.join('\n')
  for (const x of [
    'version: debe ser 1',
    'id: falta: nombre de la carpeta de salida (o pasar --id)',
    'rol: falta: con qué rol entrar (o pasar --rol)',
    'recetas.ningun: clave desconocida; ¿quisiste decir "ninguna"?',
    'casos[0].pasos[0]: paso desconocido "volar"; pasos válidos: ir, click,',
    'casos[0].pasos[1]: paso desconocido "clik"; ¿quisiste decir "click"? forma: { "click": { "en": { "rol": "button", "nombre": "Guardar" } } }',
    'casos[0].pasos[2].click.en: usa rol y css: exactamente uno de',
    'casos[0].pasos[3].foto.leyenda: falta: toda captura lleva leyenda',
    'casos[1].nombre: repetido ("a")',
    'casos[1].pasos: una lista con al menos un paso',
  ]) assert.ok(e.includes(x), `falta el error: ${x}\n--- errores:\n${e}`)
  assert.equal(validarEscenario({ version: 1, id: 'x', rol: 'zz', casos: casosOk }).ok, true)
})

test('validar (CLI): inválido sale con 2 sin abrir el navegador; válido con 0', async () => {
  const malo = escribir('malo.json', { version: 1, id: 'x', rol: 'zz', casos: [{ nombre: 'c', pasos: [{ volar: {} }] }] })
  let r = await correr(['validar', malo], 30000)
  assert.equal(r.code, 2, r.out + r.err)
  assert.match(r.err, /^ESCENARIO_INVALIDO: .+malo\.json\n {2}- casos\[0\]\.pasos\[0\]: paso desconocido "volar"/m)
  r = await correr(['validar', escribir('bueno.json', { version: 1, id: 'PRUEBA-ESC', rol: 'zz', casos: casosOk })], 30000)
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^escenario válido: 3 caso\(s\), 20 paso\(s\)$/m)
  r = await correr(['validar', 'no-existe'], 30000)
  assert.equal(r.code, 2)
  assert.match(r.err, /ESCENARIO_INVALIDO: no existe "no-existe" \(ni en .+escenarios\)/)
})

test('validar (CLI) con el workspace: app, id y recetas del catálogo', async () => {
  const r = await correr(['validar', escribir('mal-ctx.json', { version: 1, id: 'con espacio', rol: 'zz', app: 'otra', casos: [{ nombre: 'c', pasos: [{ receta: 'no-esta' }] }] })], 30000)
  assert.equal(r.code, 2, r.out + r.err)
  assert.match(r.err, /- app: "otra" no está en captura\.config\.json \(zz\)/)
  assert.match(r.err, /- id: id requerido, formato/)
  const r2 = await correr(['validar', escribir('receta-falta.json', { version: 1, id: 'x', rol: 'zz', casos: [{ nombre: 'c', pasos: [{ receta: 'no-esta' }] }] })], 30000)
  assert.match(r2.err, /- recetas usadas que no existen para zz: no-esta \(catálogo: captura-cli recetas zz\)/)
})

test('run: tres casos OK, informe y capturas; por nombre desde la carpeta de escenarios', async () => {
  escribir('flujo.json', { version: 1, id: 'PRUEBA-ESC', rol: 'zz', recetas: { ninguna: 'escenario de prueba' }, casos: casosOk })
  const r = await correr(['run', 'flujo', '--sin-sesion'])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^resultado: 3 de 3 caso\(s\) OK$/m)
  assert.match(r.out, /^receta abrir-bandeja@v1: (ejecutada|ya estaba)$/m)
  const informe = r.out.match(/^informe: (.+informe\.md)/m)[1]
  const md = readFileSync(informe, 'utf8')
  assert.equal(md.split('\n')[0], '# PRUEBA-ESC: verificación en navegador')
  assert.match(md, /^\| bandeja con filtros \| filtros llenos y Buscar habilitado \| todos los pasos se cumplieron \| OK \| \.\/step\d{2}-bandeja\.png \|$/m)
  assert.match(md, /^\| formulario con panel \| aviso de éxito con el nombre \| todos los pasos se cumplieron \| OK \| \.\/step\d{2}-enviado\.png \|$/m)
  assert.match(md, /^\| esperas por estado \| todos los pasos se cumplen \| todos los pasos se cumplieron \| OK \|  \|$/m)
  assert.ok(md.includes('| se envió el formulario de prueba | no aplica | sí |'))
  assert.match(r.out, /^api GET \/eco -> 200 /m)
})

test('run: un caso que falla deja FALLA con el paso exacto, diagnóstico, y sigue con el siguiente (sale con 1)', async () => {
  const f = escribir('falla.json', {
    version: 1, id: 'PRUEBA-FALLA', rol: 'zz', recetas: { ninguna: 'prueba' },
    casos: [
      { nombre: 'botón deshabilitado', pasos: [{ receta: 'abrir-bandeja' }, { comprobar: { en: { rol: 'button', nombre: 'Buscar' }, habilitado: false } }] },
      { nombre: 'sigue después', pasos: [{ ir: '/home' }, { esperar: 'Inicio' }] },
    ],
  })
  const r = await correr(['run', f, '--sin-sesion'])
  assert.equal(r.code, 1, r.out + r.err)
  assert.match(r.out, /^ {2}casos\[0\]\.pasos\[1\] \(comprobar\): comprobar rol="button" nombre="Buscar": se esperaba deshabilitado y está habilitado$/m)
  assert.match(r.out, /^diagnostico: url=http:\/\/localhost:\d+\/bandeja$/m)
  assert.match(r.out, /^FALLA botón deshabilitado \| esperado: todos los pasos se cumplen \| observado: casos\[0\]\.pasos\[1\]/m)
  assert.match(r.out, /^OK sigue después$/m)
  assert.match(r.out, /^resultado: 1 de 2 caso\(s\) OK, 1 FALLA$/m)
})

test('run: sin declarar recetas tras pasos propios sale con 5 (igual que cerrar())', async () => {
  const f = escribir('sin-declarar.json', { version: 1, id: 'PRUEBA-5', rol: 'zz', casos: [{ nombre: 'c', pasos: [{ ir: '/bandeja' }, { llenar: { en: { placeholder: 'Documento' }, valor: '1' } }] }] })
  const r = await correr(['run', f, '--sin-sesion'])
  assert.equal(r.code, 5, r.out + r.err)
  assert.match(r.err, /^ERROR recetas: 1 tramo\(s\) hechos sin receta/m)
})

test('run: --id, --out y --viewport mandan sobre el escenario y el config', async () => {
  const out = join(raiz, 'salidas-propias')
  const f = escribir('vp.json', { version: 1, id: 'IGNORADO', rol: 'zz', recetas: { ninguna: 'prueba' }, casos: [casosOk[0]] })
  const r = await correr(['run', f, '--id', 'PRUEBA-VP', '--out', out, '--viewport', '800x600', '--sin-sesion'])
  assert.equal(r.code, 0, r.out + r.err)
  const png = r.out.match(/^captura: (.+\.png)/m)[1]
  assert.ok(png.startsWith(join(out, 'PRUEBA-VP')), png)
  assert.deepEqual(tamPng(png), [800, 600])
  assert.equal((await correr(['run', f, '--viewport', '800por600'], 30000)).code, 1)
})

test('F4: un 5xx del servidor se avisa con URL, status y paso, entra al mensaje de la falla, al informe y al manifest', async () => {
  const f = escribir('5xx.json', {
    version: 1, id: 'PRUEBA-5XX', rol: 'zz', recetas: { ninguna: 'prueba' },
    casos: [{ nombre: 'reportes', pasos: [{ ir: '/roto' }, { esperar: { texto: 'Datos listos', ms: 2000 } }] }],
  })
  const r = await correr(['run', f, '--sin-sesion'])
  assert.equal(r.code, 1, r.out + r.err)
  // La página pide los datos 300 ms después de cargar: el 503 llega mientras se espera el texto (pasos[1]).
  assert.match(r.err, /^AVISO_5XX: el servidor respondió 503 a GET http:\/\/localhost:\d+\/api\/falla durante casos\[0\]\.pasos\[1\] \(esperar\); es un error de la app o de su entorno/m)
  assert.match(r.err, /^AVISO_5XX: 1 respuesta\(s\) 5xx del servidor en esta corrida/m)
  assert.match(r.out, /^ {2}casos\[0\]\.pasos\[1\] \(esperar\): .+ \[el servidor respondió 503 a GET http:\/\/localhost:\d+\/api\/falla durante este paso\]$/m)
  const informe = r.out.match(/^informe: (.+informe\.md)/m)[1]
  assert.match(readFileSync(informe, 'utf8'), /## Errores del servidor \(última corrida\)[\s\S]*\| 503 \| GET http:\/\/localhost:\d+\/api\/falla \| casos\[0\]\.pasos\[1\] \(esperar\) \|/)
  const m = JSON.parse(readFileSync(join(informe, '..', 'manifest.json'), 'utf8'))
  assert.equal(m.resumen.errores5xx, 1)
  assert.equal(m.errores5xx[0].status, 503)
})

test('F4: el 5xx que ocurre en el paso que falla se cita en el mismo mensaje', async () => {
  const f = escribir('5xx-paso.json', {
    version: 1, id: 'PRUEBA-5XX2', rol: 'zz', recetas: { ninguna: 'prueba' },
    casos: [{ nombre: 'reportes', pasos: [{ api: { metodo: 'get', ruta: '/falla', status: 200 } }] }],
  })
  const r = await correr(['run', f, '--sin-sesion'])
  assert.equal(r.code, 1, r.out + r.err)
  assert.match(r.out, /casos\[0\]\.pasos\[0\] \(api\): api GET \/falla: se esperaba 200 y respondió 503 .*\[el servidor respondió 503 a GET http:\/\/localhost:\d+\/api\/falla durante este paso\]/)
})

test('F4: explorar con errores muestra la validación silenciosa (campo inválido y mensaje), también al fallar un paso', async () => {
  const f = escribir('errores.json', {
    version: 1, id: 'PRUEBA-ERR', rol: 'zz', recetas: { ninguna: 'prueba' },
    casos: [
      { nombre: 'rif corto', pasos: [{ ir: '/form2' }, { llenar: { en: { etiqueta: 'RIF' }, valor: '12345678' } }, { click: { en: { rol: 'button', nombre: 'Consultar' } } }, { explorar: { errores: true } }] },
      { nombre: 'consulta que no llega', pasos: [{ click: { en: { rol: 'button', nombre: 'Consultar' } } }, { esperarExito: { texto: 'Consultado', ms: 1000 } }] },
    ],
  })
  const r = await correr(['run', f, '--sin-sesion'])
  assert.equal(r.code, 1, r.out + r.err)
  assert.match(r.out, /^errores: 2$/m)
  assert.ok(r.out.includes('  ! campo "RIF" (patrón ^[0-9]{9}$): 9 dígitos'), r.out)
  assert.ok(r.out.includes('  ! mensaje: "El RIF debe tener 9 dígitos"'), r.out)
  // Al fallar el segundo caso, los errores visibles salen junto al diagnóstico.
  const tras = r.out.split('casos[1].pasos[1] (esperarExito)')[1] ?? ''
  assert.ok(tras.includes('  ! campo "RIF"'), r.out)
  const sinErrores = await correr(['explorar', '/form2', '--rol', 'zz', '--errores', '--sin-sesion'])
  assert.equal(sinErrores.code, 0, sinErrores.err)
  assert.match(sinErrores.out, /^errores: ninguno visible$/m)
})

test('explorar (CLI): lista lo interactivo de la ruta con selectores, sin dejar recetas candidatas', async () => {
  const r = await correr(['explorar', '/bandeja', '--rol', 'zz', '--sin-sesion'])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^explorar \/bandeja \| títulos: Bandeja$/m)
  assert.ok(r.out.includes('  textbox "Documento"  input[placeholder="Documento"]'), r.out)
  assert.ok(r.out.includes("  button \"Buscar\"  getByRole('button',{name:'Buscar'})"), r.out)
  assert.doesNotMatch(r.out, /recetas candidatas:/)
  assert.equal((await correr(['explorar', '/bandeja'], 30000)).code, 1)
})
