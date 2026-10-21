// explorar(): listado completo, luego solo el diff en la misma ruta. esperarExito(): solo dentro de avisos/diálogos.
import { C, id } from './_comun.mjs'
const { page, cerrar } = await C.abrir({ ticket: id(8), maxMs: 60000 })
await page.setContent(`<html><body>
<h1>Bandeja</h1><h2>Filtros</h2>
<input placeholder="Buscar documento"><input name="rif">
<button>Guardar</button><button data-testid="btn-x" disabled>Exportar</button><a href="/x">Ir a inicio</a>
<div id="area"></div><div id="aviso"></div>
<p>El trámite fue registrado hace poco</p>
</body></html>`)
console.log('--- 1')
const e1 = await C.explorar(page)
console.log('--- 2')
const e2 = await C.explorar(page)
await page.evaluate(() => { document.getElementById('area').innerHTML = '<button>Nuevo</button>'; document.querySelector('button').remove() })
console.log('--- 3')
const e3 = await C.explorar(page)
console.log(`PRUEBA explorar ${e1.nuevas.length} ${e2.nuevas.length} ${e3.nuevas.length} ${e3.quitadas.length}`)
await page.evaluate(() => setTimeout(() => { const a = document.getElementById('aviso'); a.setAttribute('role', 'status'); a.textContent = 'Registrado con éxito' }, 300))
console.log(`PRUEBA exito=${await C.esperarExito(page, 'Registrado con éxito')}`)
try { await C.esperarExito(page, /registrado hace poco/i, { ms: 1500 }); console.log('ERROR_ESPERADO_NO_OCURRIO exito suelto') } catch { console.log('ok rechaza exito suelto') }
const d = await C.diagnostico(page, { max: 50 })
console.log(`PRUEBA diagnostico botones=${d.botones.length} texto=${d.texto.length}`)
await cerrar()
