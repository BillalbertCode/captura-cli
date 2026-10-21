// CAPTURA_CANAL=msedge|chrome usa el navegador instalado en vez del de Playwright.
import { C, id } from './_comun.mjs'
const { page, cerrar } = await C.abrir({ ticket: id(11), maxMs: 60000 })
console.log(`PRUEBA ua=${await page.evaluate(() => navigator.userAgent)}`)
await cerrar()
