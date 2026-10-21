// API de código de captura-cli: las 22 funciones del núcleo (contrato en test/paridad/exportaciones.json).
// El correo no es del núcleo: `import { mailpit } from 'captura-cli/correo'`.
import './iniciar.js'

export { abrir } from './navegador.js'
export { apps, credenciales, sesion, api } from './sesion.js'
export { foto, paso } from './fotos.js'
export { marcar, limpiar } from './marcas.js'
export { caso, cambio, configuracion } from './informe.js'
export { declararRecetas, listarRecetas, receta } from './recetas.js'
export { diagnostico, explorar, esperarExito, esperarTexto } from './explorar.js'
export { abrirSelectHasta, esperarHabilitado, esperarToast } from './esperas.js'
