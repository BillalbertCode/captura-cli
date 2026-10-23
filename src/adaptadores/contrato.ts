// Contrato de adaptadores, versión 1. Un adaptador es un módulo cuyo `default` es una FÁBRICA:
//   export default { contrato: 1, tipo: 'credenciales', crear(opciones, contexto) { return { resolver(rol, app) {…} } } }
// El núcleo valida la fábrica (contrato y tipo) y la instancia (métodos obligatorios) antes de usarla.

export const CONTRATO = 1

export type TipoAdaptador = 'credenciales' | 'identificador' | 'entorno' | 'publicacion' | 'correo'
export const TIPOS: readonly TipoAdaptador[] = ['credenciales', 'identificador', 'entorno', 'publicacion', 'correo']

/** Lo que el núcleo le pasa a cada fábrica. Rutas absolutas. */
export interface ContextoAdaptador {
  /** Raíz del workspace (repo que se prueba). */
  readonly raiz: string
  /** Carpeta del config del proyecto, o la raíz si no hay config. Base de las rutas relativas. */
  readonly base: string
  /** Slot de esta corrida (aísla corridas simultáneas). */
  readonly slot: number
  /** Carpeta propia del slot en el almacén (sesiones, caché, servicios, tmp). */
  readonly dirSlot: string
}

export interface Credenciales {
  usuario: string
  clave: string
  /** Para logins con el documento partido: primera letra del usuario (o vacío). */
  letra: string
  /** Usuario sin la letra inicial ni el guion. */
  numero: string
}
export interface CredencialesFaltantes {
  /** Variables exactas a definir, en orden. */
  faltan: string[]
  /** Dónde definirlas (archivo o descripción), para el mensaje FALTAN_CREDENCIALES. */
  donde: string
}
export interface AdaptadorCredenciales {
  /** Síncrono: credenciales(rol) es síncrona en la API. */
  resolver(rol: string, app?: string): Credenciales | CredencialesFaltantes
}

export interface AdaptadorIdentificador {
  /** null si el id es válido; si no, el mensaje de error. */
  validar(id: string): string | null
  /** Nombre de la carpeta de salida para ese id. */
  carpeta(id: string): string
}

export interface AppConfig {
  baseUrl: string
  /** Ruta de la pantalla de login. Sin ella la app no tiene login: sesion() solo la abre. */
  login?: string
  campoUsuario?: string
  campoClave?: string
  campos?: Array<{ selector: string; valor: 'usuario' | 'clave' | 'letra' | 'numero' }>
  boton?: string
  postLogin?: string
  inicio?: string
  cookieSesion?: string | null
  apiBase?: string
  [extra: string]: unknown
}

export interface ResultadoEntorno {
  ok: boolean
  /** Texto para el agente (una línea por servicio). */
  salida: string
}
export interface AdaptadorEntorno {
  /** URL base de la app para el slot (p. ej. otro bloque de puertos). */
  url(app: string, cfg: AppConfig, slot: number): string
  levantar?(app: string, opciones: { slot: number; args: string[] }): Promise<ResultadoEntorno>
  estado?(opciones: { slot: number }): Promise<ResultadoEntorno>
  /** Solo cierra lo del slot propio. */
  parar?(app: string | undefined, opciones: { slot: number }): Promise<ResultadoEntorno>
}

export interface AdaptadorPublicacion {
  /** Sube lo que dejó la herramienta. `carpeta` es la carpeta del id; `publicar/` está dentro. */
  publicar(carpeta: string, id: string): Promise<void>
}

export interface Correo {
  id: string
  asunto: string
  para: string[]
  fecha: string
  adjuntos: Array<{ nombre: string; tipo: string; bytes: number }>
}
export interface CriterioCorreo {
  buscar?: string
  destinatario?: string
  asunto?: string
}
export interface AdaptadorCorreo {
  buscar(criterio: CriterioCorreo): Promise<Correo[]>
  url(): string | undefined
}

export interface Adaptadores {
  credenciales: AdaptadorCredenciales
  identificador: AdaptadorIdentificador
  entorno: AdaptadorEntorno
  publicacion: AdaptadorPublicacion
  correo?: AdaptadorCorreo
}

export interface Fabrica<T extends TipoAdaptador = TipoAdaptador> {
  contrato: number
  tipo: T
  crear(opciones: Record<string, unknown>, contexto: ContextoAdaptador): Adaptadores[T] | AdaptadorCorreo
}

const METODOS: Record<TipoAdaptador, { obligatorios: string[]; opcionales: string[] }> = {
  credenciales: { obligatorios: ['resolver'], opcionales: [] },
  identificador: { obligatorios: ['validar', 'carpeta'], opcionales: [] },
  entorno: { obligatorios: ['url'], opcionales: ['levantar', 'estado', 'parar'] },
  publicacion: { obligatorios: ['publicar'], opcionales: [] },
  correo: { obligatorios: ['buscar', 'url'], opcionales: [] },
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null

/** Valida la fábrica exportada por un módulo. Devuelve la lista de problemas (vacía si está bien). */
export function validarFabrica(x: unknown, tipo: TipoAdaptador): string[] {
  if (!esObjeto(x)) return ['el módulo no exporta por defecto un objeto { contrato, tipo, crear }']
  const p: string[] = []
  if (x['contrato'] !== CONTRATO) {
    p.push(x['contrato'] === undefined
      ? `falta "contrato: ${CONTRATO}"`
      : `declara contrato ${String(x['contrato'])} y esta versión de captura-cli usa el ${CONTRATO}; ver docs/adaptadores.md («Versiones del contrato»)`)
  }
  if (x['tipo'] !== tipo) p.push(`declara tipo "${String(x['tipo'])}" y se usa como "${tipo}"`)
  if (typeof x['crear'] !== 'function') p.push('falta la función crear(opciones, contexto)')
  return p
}

/** Valida la instancia que devolvió crear(). */
export function validarInstancia(x: unknown, tipo: TipoAdaptador): string[] {
  if (!esObjeto(x)) return ['crear() no devolvió un objeto']
  const { obligatorios, opcionales } = METODOS[tipo]
  const p = obligatorios.filter((m) => typeof x[m] !== 'function').map((m) => `falta el método ${m}()`)
  for (const m of opcionales) if (x[m] !== undefined && typeof x[m] !== 'function') p.push(`${m} debe ser una función`)
  return p
}

/**
 * Un adaptador que necesita configuración que falta lanza un error con este nombre; el núcleo sale con
 * FALTAN_CREDENCIALES (código 3) y su mensaje. No hace falta importar nada:
 *   throw Object.assign(new Error('definir MI_URL'), { name: 'FaltaConfiguracion' })
 */
export const FALTA_CONFIGURACION = 'FaltaConfiguracion'
export const esFaltaConfiguracion = (e: unknown): e is Error => e instanceof Error && e.name === FALTA_CONFIGURACION

export const sonFaltantes =(c: Credenciales | CredencialesFaltantes): c is CredencialesFaltantes => 'faltan' in c
