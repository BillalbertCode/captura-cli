// Tope global: abrir({ maxMs }) cierra el navegador y sale con código 4.
import { C, id } from './_comun.mjs'
const { page } = await C.abrir({ ticket: id(4), maxMs: 3000 })
await page.setContent('<h1>esperando</h1>')
await new Promise((r) => setTimeout(r, 30000))
console.log('ERROR_ESPERADO_NO_OCURRIO')
