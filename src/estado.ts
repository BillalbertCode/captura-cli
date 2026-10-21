// Estado de cada página abierta con abrir()/sesion(): carpeta de salida, casos, fotos, marcas, grabación.
import type { Locator, Page } from 'playwright'
import type { AppConfig } from './adaptadores/contrato.js'

export interface Caso { nombre: string; esperado: string; observado: string; ok: boolean; captura?: string }
export interface Cambio { que: string; revertir?: string; revertido?: boolean }
export interface DetalleMarca { texto: string; x: number; y: number; w: number; h: number; zona: string }
export interface Foto { ruta: string; paso: number; leyenda: string; marcada: boolean; sinMarca: string; marcas: DetalleMarca[] }
export type Lado = 'abajo' | 'arriba' | 'izq' | 'der' | 'dentro'
export interface Marca { locator: Locator; texto: string; lado: Lado; numero: number | undefined }
export type Accion =
  | { t: 'click'; sel: string }
  | { t: 'fill'; sel: string; valor: string }
  | { t: 'select'; sel: string; valor: string }
  | { t: 'ir'; url: string }
  | { t: 'receta'; id: string }
export interface Tramo { foto: string; leyenda?: string; url: string; marca?: string; acciones: Accion[] }
export interface RecetaUsada { id: string; version: number; modo: 'ya estaba' | 'ejecutada' }
export interface Declaracion { creadas?: string[]; ninguna?: string }
export interface ResumenRecetas { usadas: string[]; creadas: string[]; ninguna: string; pendiente: boolean }

export interface Estado {
  id: string
  dir: string
  base: string
  casos: Caso[]
  cambios: Cambio[]
  fotos: Foto[]
  marcas: Marca[]
  grabar: boolean
  acciones: Accion[]
  tramos: Tramo[]
  recetasUsadas: RecetaUsada[]
  declaracion?: Declaracion
  recetasResumen?: ResumenRecetas
  app?: AppConfig
  appNombre?: string
  explorado?: { ruta: string; lineas: Set<string> }
  /** Última acción, para el mensaje de PAGINA_COLGADA. */
  ultimoPaso: string
}

const estados = new WeakMap<Page, Estado>()

export function estado(page: Page): Estado {
  const e = estados.get(page)
  if (!e) throw new Error('la página no se abrió con abrir() o sesion() de captura-cli')
  return e
}

export function crearEstado(page: Page, e: Estado): void {
  estados.set(page, e)
}

/**
 * Las recetas de los proyectos leen `page.__app` (p. ej. page.__app.baseUrl): se mantiene visible en la página.
 */
export function fijarApp(page: Page, app: AppConfig, nombre: string): void {
  const e = estado(page)
  e.app = app
  e.appNombre = nombre
  Object.defineProperty(page, '__app', { value: app, configurable: true, enumerable: false, writable: true })
}
