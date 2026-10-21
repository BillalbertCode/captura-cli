// Se evalúa una sola vez, al importar la API: resuelve el contexto y carga las apps del config.
import { ctx, hayContexto, preparar } from './contexto.js'
import { apps } from './sesion.js'

await preparar()
if (hayContexto()) Object.assign(apps, ctx().cfg.apps)
