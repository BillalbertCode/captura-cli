// Reglas de foto(): leyenda y marca obligatorias, sinMarca con motivo, toast con foto, configuracion() en subcarpeta,
// PNG suelto avisado y fuera de publicar/.
import { writeFileSync } from 'node:fs'
import { C, id, rechaza } from './_comun.mjs'
const { page, cerrar } = await C.abrir({ ticket: id(6, true), maxMs: 90000 })
await page.setContent('<html><body style="margin:0"><header style="height:30px;background:#ddd">cabecera</header><button id="b" style="margin:60px">Guardar</button><div id="t"></div><script>setTimeout(()=>{document.getElementById("t").textContent="Guardado correcto"},300)</script></body></html>')
await rechaza('sin leyenda', () => C.foto(page, 'x'))
await rechaza('sin marca', () => C.foto(page, 'x', { leyenda: 'algo' }))
await rechaza('sinMarca booleano', () => C.foto(page, 'x', { leyenda: 'algo', sinMarca: true }))
await C.marcar(page, page.locator('#b'), 'botón guardar', { lado: 'der', numero: 1 })
const f1 = await C.paso(page, 'Botón Guardar', { leyenda: 'El botón Guardar está habilitado' })
await C.limpiar(page)
await C.foto(page, 'pantalla-completa', { leyenda: 'Vista general pedida sin marca', sinMarca: 'el usuario la pidió así' })
const t = await C.esperarToast(page, /Guardado correcto/, { foto: 'toast' })
const b = C.configuracion(page, { que: 'habilitar parametro X', reversion: true })
await C.marcar(page, page.locator('#b'), 'control del parámetro')
await C.foto(page, 'antes', { leyenda: 'Estado antes del cambio' })
await C.limpiar(page)
await b.fin()
writeFileSync(f1.replace(/step01-[^\\/]+\.png$/, 'step99-suelta.png'), 'x')
C.caso(page, { nombre: 'leyenda y marca', esperado: 'ok', observado: t, ok: true, captura: f1 })
await cerrar()
