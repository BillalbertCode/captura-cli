// Marca sobre un elemento al fondo de una página larga: tras un scroll arriba, foto() la vuelve a ubicar en el
// viewport. Marca sobre un elemento quitado del DOM: foto() falla con texto.
import { C, id, rechaza, conCredenciales, sitio, registrarApp } from './_comun.mjs'
const s = await sitio()
registrarApp(s.url)
conCredenciales('zz')
const { page, cerrar } = await C.sesion('zz', { ticket: id(7), app: 'zz', reutilizar: false })
await C.marcar(page, page.locator('#fondo'), 'botón al fondo', { lado: 'der' })
await page.evaluate(() => window.scrollTo(0, 0))
await C.foto(page, 'marca-reubicada', { leyenda: 'El botón del fondo, aunque hubo scroll' })
await C.limpiar(page)
await C.marcar(page, page.locator('#fondo'), 'x')
await page.evaluate(() => document.getElementById('fondo').remove())
await rechaza('marca sin elemento', () => C.foto(page, 'rota', { leyenda: 'no debería' }))
await C.limpiar(page)
C.caso(page, { nombre: 'marcas', esperado: 'ok', observado: 'ok', ok: true })
await cerrar({ ninguna: 'prueba de marcas' })
await s.cerrar()
