// Página que se cuelga (evento crash): navegador cerrado, línea accionable y código 7, sin esperar al tope global.
import { C, id, conCredenciales, sitio, registrarApp } from './_comun.mjs'
const s = await sitio()
registrarApp(s.url)
conCredenciales('zz')
const { page } = await C.sesion('zz', { ticket: id(14), app: 'zz', reutilizar: false, maxMs: 60000 })
await C.receta(page, 'abrir-bandeja')
await page.goto('chrome://crash').catch(() => {})
await page.waitForTimeout(20000)
console.log('ERROR_ESPERADO_NO_OCURRIO')
