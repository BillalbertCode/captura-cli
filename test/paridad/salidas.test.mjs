// Archivos de salida: stepNN-<desc>.png (viewport, leyenda y marca dentro de la imagen), casos.json, informe.md,
// publicar/ y recetas-candidatas.md. Las salidas son acumulativas por id: las pruebas no dependen de corridas previas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { correr, esPng, falta, leerJson, pixeles, impl } from './lib.mjs'

const ID = impl.id(1)
let r
test('flujo completo', async () => {
  r = await correr('exito.mjs', { args: ['ninguna'] })
  assert.equal(r.code, 0, r.err)
})

test('captura: nombre stepNN-<slug>.png, PNG del viewport 1366x900', async () => {
  assert.equal(r.capturas.length, 1)
  const png = r.capturas[0]
  assert.match(basename(png), /^step\d{2}-bandeja-llena\.png$/)
  assert.ok(esPng(png))
  const { ancho, alto } = await pixeles(png, [])
  assert.deepEqual([ancho, alto], [1366, 900])
})

test('casos.json: casos, cambios, fotos con marcas y recetas', () => {
  const dir = dirname(r.informe)
  const j = leerJson(join(dir, 'casos.json'))
  const login = j.casos.filter((c) => c.nombre === 'login con campos numero/clave')
  assert.equal(login.length, 1, 'un caso con el mismo nombre reemplaza al anterior')
  assert.equal(login[0].ok, true)
  const api = j.casos.find((c) => c.nombre === 'api con la sesión')
  assert.match(api.captura, /^\.\/step\d{2}-bandeja-llena\.png$/)
  assert.ok(j.cambios.some((c) => c.que === 'nada real: dato de prueba' && c.revertido === true))
  const foto = j.fotos.find((f) => f.ruta === `./${basename(r.capturas[0])}`)
  assert.ok(foto, 'la foto de esta corrida está registrada')
  assert.equal(foto.leyenda, 'La bandeja con los filtros llenos')
  assert.equal(foto.marcada, true)
  assert.equal(foto.sinMarca, '')
  assert.equal(foto.marcas[0].texto, 'Bandeja con filtros')
  assert.equal(foto.marcas[0].zona, 'Bandeja')
  for (const k of ['x', 'y', 'w', 'h']) assert.equal(typeof foto.marcas[0][k], 'number')
  assert.ok(j.recetas.usadas.includes('abrir-bandeja@v1 (ejecutada)'))
  assert.ok(j.recetas.ninguna.includes('tramo de prueba, no se repite'))
})

test('informe.md: encabezado, tablas y recetas', () => {
  const md = readFileSync(r.informe, 'utf8')
  assert.equal(md.split('\n')[0], `# ${ID}: verificación en navegador`)
  assert.match(md, /^Actualizado: \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m)
  assert.ok(md.includes('| Caso | Esperado | Observado | Resultado | Captura |\n|---|---|---|---|---|'))
  assert.ok(md.includes('| login con campos numero/clave | 12345678 | 12345678 | OK |  |'))
  assert.ok(md.includes('## Cambios hechos en los datos\n\n| Qué | Cómo revertir | Revertido |'))
  assert.ok(md.includes('| nada real: dato de prueba | no aplica | sí |'))
  assert.ok(md.includes('## Capturas (a subir desde `publicar/`)\n\n| Paso | Leyenda | Marca | Archivo |'))
  assert.match(md, /^\| \d+ \| La bandeja con los filtros llenos \| roja \| \.\/step\d{2}-bandeja-llena\.png \|$/m)
  assert.ok(md.includes('## Recetas\n\n- Usadas: abrir-bandeja@v1 (ejecutada)'))
  assert.match(r.out, /^informe: .+informe\.md \(\d+ casos, \d+ capturas\)$/m)
})

test('publicar/: copia de las capturas registradas', () => {
  const pub = join(dirname(r.informe), 'publicar', basename(r.capturas[0]))
  assert.ok(esPng(pub), pub)
})

test('manifest.json: lo mismo que informe.md para máquinas, con sha256 de cada captura', { skip: falta('manifest') }, () => {
  const dir = dirname(r.informe)
  const m = leerJson(join(dir, 'manifest.json'))
  const casos = leerJson(join(dir, 'casos.json'))
  assert.equal(m.version, 1)
  assert.equal(m.herramienta.nombre, 'captura-cli')
  assert.equal(m.id, ID)
  assert.match(m.actualizado, /^\d{4}-\d{2}-\d{2}T/)
  assert.deepEqual(m.resumen, {
    casos: casos.casos.length, ok: casos.casos.filter((c) => c.ok).length, falla: casos.casos.filter((c) => !c.ok).length,
    capturas: casos.fotos.length, sinRegistrar: 0, recetasPendientes: casos.recetas.pendiente, errores5xx: 0,
  })
  assert.deepEqual(m.casos.map((c) => c.nombre), casos.casos.map((c) => c.nombre))
  const nombre = basename(r.capturas[0])
  const cap = m.capturas.find((c) => c.archivo === `./${nombre}`)
  assert.ok(cap, 'la captura de esta corrida está en el manifest')
  assert.equal(cap.publicar, `publicar/${nombre}`)
  assert.equal(cap.leyenda, 'La bandeja con los filtros llenos')
  assert.equal(cap.marcada, true)
  assert.equal(cap.sha256, createHash('sha256').update(readFileSync(r.capturas[0])).digest('hex'))
  assert.ok(esPng(join(dir, cap.publicar)))
  assert.deepEqual(m.archivos, { informe: 'informe.md', casos: 'casos.json', publicar: 'publicar/', recetasCandidatas: 'recetas-candidatas.md' })
})

test('recetas-candidatas.md: tramo con selectores pegables y clave enmascarada', () => {
  assert.ok(r.candidatas && existsSync(r.candidatas))
  const md = readFileSync(r.candidatas, 'utf8')
  assert.equal(md.split('\n')[0], `# Recetas candidatas de ${ID} (borrador generado de lo que hizo el script)`)
  assert.match(md, /^## Tramo 1 → step\d{2}-bandeja-llena \(ruta \/bandeja\)$/m)
  assert.ok(md.includes("'tramo-1': { version: 1, descripcion: 'La bandeja con los filtros llenos', vistoEn: '" + ID + "',"))
  assert.ok(md.includes("verificar: async (page) => new URL(page.url()).pathname === '/bandeja' && await page.getByText('Bandeja con filtros').first().isVisible(),"))
  for (const l of [
    '    // usó la receta abrir-bandeja',
    "    await page.getByPlaceholder('Documento').fill('12345678')",
    "    await page.locator('#tipo').selectOption({ label: 'Dos' })",
    "    await page.getByPlaceholder('Clave').fill('<clave>') // parametrizar: args",
    "    await page.getByRole('button', { name: 'Buscar' }).click()",
  ]) assert.ok(md.includes(l + '\n'), `falta la línea: ${l}`)
  assert.match(r.out, /^recetas candidatas: .+recetas-candidatas\.md \(1 tramo\(s\) sin receta; borrador para revisar, no copiar a ciegas\)$/m)
})

let f
test('reglas de foto(): leyenda, marca, sinMarca, toast, configuracion, PNG suelto', async () => {
  f = await correr('foto.mjs')
  assert.equal(f.code, 0, f.err)
  assert.ok(f.out.includes('ok rechaza sin leyenda: foto("x"): falta { leyenda } — toda captura lleva leyenda'))
  assert.ok(f.out.includes("ok rechaza sin marca: foto(\"x\"): no hay marca roja activa — usar marcar() antes (o { sinMarca: 'motivo' } si el usuario lo pidió)"))
  assert.ok(f.out.includes('ok rechaza sinMarca booleano: foto("x"): sinMarca exige un motivo (texto); solo si el usuario pidió una captura sin marca'))
  assert.doesNotMatch(f.out, /ERROR_ESPERADO_NO_OCURRIO/)
  assert.match(f.out, /^captura: .+step02-pantalla-completa\.png \(sin marca: el usuario la pidió así\)$/m)
  assert.match(f.out, /^ {2}marca 1 "botón guardar" en \(60,90\) 65x21 dentro del viewport; contenido: "Guardar"$/m)
  assert.match(f.out, /^ {2}marca 1 "Guardado correcto" en \(\d+,\d+\) \d+x\d+ dentro del viewport; contenido: "Guardado correcto"$/m)
  assert.match(f.out, /^cambio: habilitar parametro X \| revertir: invertir los mismos pasos desde el panel$/m)
  assert.ok(f.err.includes('AVISO: configuracion "habilitar parametro X" pidió reversion:true pero no se llamó revertido()'))
  assert.ok(f.err.includes('AVISO: 1 captura(s) sin leyenda ni marca registrada (no pasaron por foto()): ./step99-suelta.png — no suben a publicar/'))
  const dir = dirname(f.informe)
  assert.ok(f.capturas.some((c) => /config-habilitar-parametro-x[\\/]step01-antes\.png$/.test(c)))
  const pub = join(dir, 'publicar')
  for (const n of ['step01-boton-guardar.png', 'step02-pantalla-completa.png', 'step03-toast.png', 'config-habilitar-parametro-x__step01-antes.png']) assert.ok(esPng(join(pub, n)), n)
  assert.ok(!existsSync(join(pub, 'step99-suelta.png')))
  const md = readFileSync(f.informe, 'utf8')
  assert.ok(md.includes('| 2 | Vista general pedida sin marca | sin marca (el usuario la pidió así) | ./step02-pantalla-completa.png |'))
  assert.ok(md.includes('## Capturas sin registrar (no se suben)\n\n- ./step99-suelta.png'))
})

test('leyenda y marca roja están DENTRO de la imagen', async () => {
  const png = f.capturas.find((c) => c.endsWith('step01-boton-guardar.png'))
  // franja de leyenda arriba (rgba(17,24,39,.92)); borde rojo #e11d1d a 8 px de la caja (60,90) 65x21, 3 px de grosor
  const { valores: [franja, borde, fuera] } = await pixeles(png, [{ x: 4, y: 4 }, { x: 53, y: 100 }, { x: 300, y: 600 }])
  assert.ok(franja[0] < 60 && franja[1] < 70 && franja[2] < 80, `franja: ${franja}`)
  assert.ok(borde[0] > 180 && borde[1] < 90 && borde[2] < 90, `borde: ${borde}`)
  assert.ok(fuera[0] > 230 && fuera[1] > 230 && fuera[2] > 230, `fondo: ${fuera}`)
  const { valores: [sinFranja] } = await pixeles(f.capturas.find((c) => c.endsWith('step02-pantalla-completa.png')), [{ x: 4, y: 4 }])
  assert.ok(sinFranja[0] < 60, 'la captura sin marca también lleva leyenda')
})
