// Correo de solo lectura a través del adaptador de correo (opcional, fuera del núcleo).
//   import { mailpit, urlMailpit } from 'captura-cli/correo'
// Config: "adaptadores": { "correo": { "usa": "builtin:mailpit", "url": "http://host:8025" } } o "extras": ["correo"]
import './iniciar.js'
import { type Correo, type CriterioCorreo, esFaltaConfiguracion } from './adaptadores/contrato.js'
import { ctx } from './contexto.js'
import { CODIGOS, salir } from './salida.js'

export async function mailpit(criterio: CriterioCorreo = {}): Promise<Correo[]> {
  const c = ctx().adaptadores.correo
  if (!c) return salir('FALTAN_CREDENCIALES: mailpit -> declarar adaptadores.correo en captura.config.json (p. ej. { "usa": "builtin:mailpit", "url": "http://host:8025" }) o "extras": ["correo"]', CODIGOS.FALTAN_CREDENCIALES)
  try { return await c.buscar(criterio) } catch (e) {
    if (esFaltaConfiguracion(e)) return salir(`FALTAN_CREDENCIALES: correo -> ${e.message}`, CODIGOS.FALTAN_CREDENCIALES)
    throw e
  }
}

// Para capturar la interfaz del correo: abrir urlMailpit(), buscar, abrir el correo y marcar el adjunto con marcar().
export const urlMailpit = (): string | undefined => ctx().adaptadores.correo?.url()
