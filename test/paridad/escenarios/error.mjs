// Error no atrapado (foto sin leyenda): código 1 con el texto exacto, navegador cerrado.
import { C, id } from './_comun.mjs'
const { page } = await C.abrir({ ticket: id(5), maxMs: 60000 })
await page.setContent('<button>Guardar</button>')
await C.foto(page, 'sin-leyenda')
console.log('ERROR_ESPERADO_NO_OCURRIO')
