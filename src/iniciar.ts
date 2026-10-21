// Se evalúa una sola vez, al importar la API: resuelve el contexto y carga las apps del config.
import { preparar } from './contexto.js'
import { cargarApps } from './sesion.js'

await preparar()
cargarApps()
