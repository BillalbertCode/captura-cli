// Comportamiento de las funciones del núcleo: sesión, marcas, exploración, recetas, esperas y variables CAPTURA_*.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { correr, falta, impl } from './lib.mjs'

test('sesion: guarda, reutiliza y cae a login si la guardada ya no sirve', async () => {
  const r = await correr('sesion.mjs')
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /PRUEBA url1=\/home[\s\S]*sesion: reutiliza la guardada de zz@zz[\s\S]*PRUEBA url2=\/home[\s\S]*sesion: la guardada de zz@zz ya no sirve; login normal[\s\S]*PRUEBA url3=\/home/)
  assert.match(r.out, /^recetas disponibles de zz \(usar receta\(page, id\) antes de escribir pasos\):$/m)
})

test('marcar: se reubica tras un scroll y falla con texto si el elemento ya no está', async () => {
  const r = await correr('marcas.mjs')
  assert.equal(r.code, 0, r.err)
  const m = r.out.match(/^ {2}marca 1 "botón al fondo" en \((\d+),(\d+)\) (\d+)x(\d+) dentro del viewport; contenido: "Guardar al fondo"$/m)
  assert.ok(m, r.out)
  const y = Number(m[2]), h = Number(m[4])
  assert.ok(y >= 0 && y + h <= 900, `y=${y}`)
  assert.ok(r.out.includes('ok rechaza marca sin elemento: marca "x": el elemento ya no está en la página; volver a marcar'))
})

test('explorar: completo, luego solo el diff; esperarExito estricto; diagnostico', async () => {
  const r = await correr('explorar.mjs')
  assert.equal(r.code, 0, r.err)
  for (const l of [
    'explorar blank | títulos: Bandeja ; Filtros',
    '  textbox "Buscar documento"  input[placeholder="Buscar documento"]',
    '  textbox "rif"  [name="rif"]',
    "  button \"Guardar\"  getByRole('button',{name:'Guardar'})",
    '  button(deshab.) "Exportar"  [data-testid="btn-x"]',
    "  link \"Ir a inicio\"  getByRole('link',{name:'Ir a inicio'})",
    'explorar blank | títulos: Bandeja ; Filtros | cambios desde la anterior',
    '  = sin cambios',
    "  + button \"Nuevo\"  getByRole('button',{name:'Nuevo'})",
    "  - button \"Guardar\"  getByRole('button',{name:'Guardar'})",
    'PRUEBA explorar 5 0 1 1',
    'PRUEBA exito=Registrado con éxito',
    'ok rechaza exito suelto',
    'diagnostico: url=about:blank',
    '  botones=Exportar | Nuevo',
    'PRUEBA diagnostico botones=2 texto=50',
  ]) assert.ok(r.out.split(/\r?\n/).includes(l), `falta la línea: ${l}`)
})

test('recetas: ejecutada, ya estaba, rota, inexistente; comun + app; estado en el catálogo', async () => {
  const r = await correr('recetas.mjs')
  assert.equal(r.code, 0, r.err)
  for (const l of [
    'PRUEBA ids=abrir-bandeja,de-comun,rota,solo-comun',
    'receta abrir-bandeja@v1: ejecutada',
    'receta abrir-bandeja@v1: ya estaba',
    'receta de-comun@v3: ejecutada',
    'solo-comun@v1 [sin uso] Solo existe en comun.mjs',
    'recetas usadas: abrir-bandeja@v1 (ejecutada), abrir-bandeja@v1 (ya estaba), de-comun@v3 (ejecutada)',
  ]) assert.ok(r.out.split(/\r?\n/).includes(l), `falta la línea: ${l}`)
  assert.match(r.out, /^ok rechaza receta rota: receta "rota"@v2 falló al ejecutar: .+Corregirla en .*zz\.mjs y subir su version$/m)
  assert.match(r.out, /^ok rechaza receta inexistente: receta "no-existe" no existe para zz\. Existentes: /m)
  const despues = r.out.split('--- catalogo despues')[1]
  assert.match(despues, /^abrir-bandeja@v1 \[ok\] Abre la bandeja desde el inicio$/m)
  assert.match(despues, /^rota@v2 \[rota\] Receta con selector viejo$/m)
})

test('esperas: esperarTexto, abrirSelectHasta', async () => {
  const r = await correr('esperas.mjs')
  assert.equal(r.code, 0, r.err)
  assert.ok(r.out.includes('PRUEBA opcion=Opción tardía'))
})

// La referencia tiene un defecto: `locator.isEnabled()` es una promesa (siempre verdadera) y esperarHabilitado
// vuelve sin esperar. La paridad aquí es con la intención documentada («espera a que se habilite»).
test('esperas: esperarHabilitado espera a que el botón se habilite', { skip: (impl.defectos || []).includes('esperarHabilitado-no-espera') && 'defecto conocido de la referencia' }, async () => {
  const r = await correr('esperas.mjs')
  assert.equal(r.code, 0, r.err)
  assert.ok(r.out.includes('PRUEBA habilitado=true'), r.out)
})

const msedge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/microsoft-edge'].some((p) => existsSync(p))
test('CAPTURA_CANAL=msedge usa el navegador instalado', { skip: falta('canal') || (!msedge && 'msedge no está instalado') }, async () => {
  const r = await correr('canal.mjs', { env: { CAPTURA_CANAL: 'msedge' } })
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /PRUEBA ua=.* Edg\//)
})

test('CAPTURA_SLOT=1 apunta la app al bloque de puertos +100', { skip: falta('slot-por-puertos') }, async () => {
  const r = await correr('slot.mjs', { env: { CAPTURA_SLOT: '1' } })
  assert.equal(r.code, 0, r.err)
  const m = r.out.match(/PRUEBA puerto=(\d+) base=(\d+)/)
  assert.equal(Number(m[1]), Number(m[2]) + 100)
})

test('api: sin cookieSesion usa la sesión del navegador; sin ninguna cookie, falla diciendo qué configurar', { skip: falta('api-sin-cookie') }, async () => {
  const r = await correr('api.mjs')
  assert.equal(r.code, 0, r.err)
  assert.ok(r.out.includes('PRUEBA status=200 via=cookie'), r.out)
  assert.match(r.out, /^ok rechaza api sin sesion: api\(\): 401 y el navegador no tiene ninguna cookie de http:\/\/localhost:\d+ \(¿terminó el login\?\)\. Si la app pasa el token en una cabecera, declarar apps\.<app>\.cookieSesion/m)
})

test('7: PAGINA_COLGADA cierra el navegador y dice dónde y tras qué paso', { skip: falta('pagina-colgada') }, async () => {
  const r = await correr('colgada.mjs', { ms: 60000 })
  assert.equal(r.code, 7, r.out + r.err)
  assert.match(r.err, /^PAGINA_COLGADA: la página se colgó en .+ tras .+; reintentá o corré con CAPTURA_CANAL=msedge$/m)
  assert.ok(r.ms < 30000, `tardó ${r.ms} ms`)
  assert.doesNotMatch(r.out, /ERROR_ESPERADO_NO_OCURRIO/)
})
