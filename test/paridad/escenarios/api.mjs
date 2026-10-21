// api() en una app sin cookieSesion: usa la sesión del navegador (cookies). Sin ninguna cookie, falla con un mensaje
// que dice qué configurar.
import { C, id, rechaza, conCredenciales, sitio, registrarApp } from './_comun.mjs'
const s = await sitio()
registrarApp(s.url)
C.apps.zz.cookieSesion = null
conCredenciales('zz')
const { page, cerrar } = await C.sesion('zz', { ticket: id(13), app: 'zz', reutilizar: false })
const r = await C.api(page, 'get', '/eco')
console.log(`PRUEBA status=${r.status} via=${JSON.parse(r.texto).via}`)
await page.context().clearCookies()
await rechaza('api sin sesion', () => C.api(page, 'get', '/eco'))
await cerrar()
await s.cerrar()
