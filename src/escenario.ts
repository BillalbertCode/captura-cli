// Escenario: un flujo pedido sin escribir código. El agente escribe JSON, el motor lo valida ENTERO antes de abrir el
// navegador y cada error dice el campo exacto y la forma correcta. El escenario nunca ejecuta código suelto: lo que
// no se puede expresar con estos pasos va en una receta (JavaScript del proyecto).
// Referencia: docs/escenarios.md. Esquema: schema/escenario.schema.json.

/** Dónde actuar. Exactamente uno de rol | etiqueta | placeholder | texto | testid | css. */
export interface Selector {
  rol?: string
  nombre?: string
  etiqueta?: string
  placeholder?: string
  texto?: string
  testid?: string
  css?: string
  /** Coincidencia exacta del texto (por defecto false; un texto "/…/i" es una expresión regular). */
  exacto?: boolean
  /** Índice cuando hay varios (por defecto el primero). */
  n?: number
  /** Buscar dentro de otro elemento (p. ej. un panel que no es role=dialog). */
  dentro?: Selector
}

export type Paso =
  | { ir: string }
  | { click: { en: Selector } }
  | { llenar: { en: Selector; valor: string } }
  | { elegir: { en: Selector; opcion: string } }
  | { esperar: string | { texto: string; ms?: number } }
  | { esperarExito: string | { texto: string; ms?: number; dentro?: Selector } }
  | { esperarToast: string | { texto: string; ms?: number; foto?: string; leyenda?: string } }
  | { esperarHabilitado: { en: Selector; ms?: number } }
  | { comprobar: { en: Selector; visible?: boolean; texto?: string; habilitado?: boolean } }
  | { marcar: { en: Selector; etiqueta: string; lado?: 'abajo' | 'arriba' | 'izq' | 'der' | 'dentro'; numero?: number } }
  | { limpiar: true }
  | { foto: { descripcion: string; leyenda: string; sinMarca?: string; completa?: boolean } }
  | { cambio: { que: string; revertir?: string; revertido?: boolean } }
  | { api: { metodo: string; ruta: string; cuerpo?: unknown; status?: number } }
  | { receta: string | { id: string; args?: Record<string, unknown> } }
  | { explorar: true | { max?: number; completo?: boolean; errores?: boolean } }

export interface CasoEscenario {
  nombre: string
  esperado?: string
  pasos: Paso[]
}

export interface Escenario {
  version: 1
  id: string
  app?: string
  /** Con qué rol entrar. Solo hace falta si la app tiene login. */
  rol?: string
  /** Declaración de recetas al cerrar (igual que cerrar({ creadas } | { ninguna })). */
  recetas?: { creadas?: string[]; ninguna?: string }
  casos: CasoEscenario[]
}

const LADOS = ['abajo', 'arriba', 'izq', 'der', 'dentro']
const CLAVES_SELECTOR = ['rol', 'etiqueta', 'placeholder', 'texto', 'testid', 'css'] as const
const METODOS = ['get', 'post', 'put', 'patch', 'delete']

/** Forma correcta de cada paso, para los mensajes de error. */
export const FORMAS: Record<string, string> = {
  ir: '{ "ir": "/ruta" }',
  click: '{ "click": { "en": { "rol": "button", "nombre": "Guardar" } } }',
  llenar: '{ "llenar": { "en": { "etiqueta": "Correo" }, "valor": "a@b.c" } }',
  elegir: '{ "elegir": { "en": { "etiqueta": "Resultado" }, "opcion": "Entregada" } }',
  esperar: '{ "esperar": "Texto visible" }',
  esperarExito: '{ "esperarExito": "Guardado con éxito" }',
  esperarToast: '{ "esperarToast": { "texto": "Guardado", "foto": "aviso-guardado" } }',
  esperarHabilitado: '{ "esperarHabilitado": { "en": { "rol": "button", "nombre": "Continuar" } } }',
  comprobar: '{ "comprobar": { "en": { "rol": "button", "nombre": "Guardar" }, "habilitado": false } }',
  marcar: '{ "marcar": { "en": { "rol": "button", "nombre": "Guardar" }, "etiqueta": "Queda habilitado" } }',
  limpiar: '{ "limpiar": true }',
  foto: '{ "foto": { "descripcion": "formulario-listo", "leyenda": "El formulario listo para guardar" } }',
  cambio: '{ "cambio": { "que": "Se creó el registro X", "revertir": "borrarlo desde la lista" } }',
  api: '{ "api": { "metodo": "get", "ruta": "/items/1", "status": 200 } }',
  receta: '{ "receta": "abrir-bandeja" }  o  { "receta": { "id": "elegir-fecha", "args": { "dia": 3 } } }',
  explorar: '{ "explorar": true }  o  { "explorar": { "errores": true } }',
}
export const TIPOS_PASO = Object.keys(FORMAS)

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const texto = (x: unknown): x is string => typeof x === 'string' && x.trim() !== ''

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length]![b.length]!
}
const parecida = (k: string, opciones: readonly string[]): string | undefined =>
  opciones.find((o) => distancia(o.toLowerCase(), k.toLowerCase()) <= 2)

class Errores {
  readonly lista: string[] = []
  add(ruta: string, msg: string): void { this.lista.push(`${ruta}: ${msg}`) }
  claves(o: Record<string, unknown>, validas: readonly string[], ruta: string): void {
    for (const k of Object.keys(o)) {
      if (validas.includes(k)) continue
      const p = parecida(k, validas)
      this.add(`${ruta}.${k}`, p ? `clave desconocida; ¿quisiste decir "${p}"?` : `clave desconocida; válidas: ${validas.join(', ')}`)
    }
  }
}

function validarSelector(s: unknown, ruta: string, e: Errores): void {
  const forma = 'forma: { "rol": "button", "nombre": "Guardar" } | { "etiqueta": … } | { "placeholder": … } | { "texto": … } | { "testid": … } | { "css": … }'
  if (!esObjeto(s)) { e.add(ruta, `debe ser un selector; ${forma}`); return }
  e.claves(s, [...CLAVES_SELECTOR, 'nombre', 'exacto', 'n', 'dentro'], ruta)
  const usadas = CLAVES_SELECTOR.filter((k) => s[k] !== undefined)
  if (usadas.length !== 1) e.add(ruta, usadas.length ? `usa ${usadas.join(' y ')}: exactamente uno de ${CLAVES_SELECTOR.join(', ')}` : `falta cómo encontrarlo; ${forma}`)
  for (const k of usadas) if (!texto(s[k])) e.add(`${ruta}.${k}`, 'debe ser un texto no vacío')
  if (s['nombre'] !== undefined && (s['rol'] === undefined || !texto(s['nombre']))) e.add(`${ruta}.nombre`, 'solo con "rol", y debe ser un texto')
  if (s['exacto'] !== undefined && typeof s['exacto'] !== 'boolean') e.add(`${ruta}.exacto`, 'true o false')
  if (s['n'] !== undefined && !(Number.isInteger(s['n']) && (s['n'] as number) >= 0)) e.add(`${ruta}.n`, 'un índice entero desde 0')
  if (s['dentro'] !== undefined) validarSelector(s['dentro'], `${ruta}.dentro`, e)
}

function textoOObjeto(v: unknown, ruta: string, e: Errores, extra: readonly string[], forma: string): void {
  if (texto(v)) return
  if (!esObjeto(v) || !texto(v['texto'])) { e.add(ruta, `un texto o { "texto": …${extra.length ? `, ${extra.join(', ')}` : ''} }; forma: ${forma}`); return }
  e.claves(v, ['texto', ...extra], ruta)
  if (v['ms'] !== undefined && !(typeof v['ms'] === 'number' && v['ms'] > 0)) e.add(`${ruta}.ms`, 'milisegundos (número positivo)')
}

function validarPaso(p: unknown, ruta: string, e: Errores): void {
  if (!esObjeto(p)) { e.add(ruta, `cada paso es un objeto con una sola clave; p. ej. ${FORMAS['click']}`); return }
  const ks = Object.keys(p)
  if (ks.length !== 1) { e.add(ruta, `un paso tiene una sola clave (tiene ${ks.length ? ks.join(', ') : 'ninguna'}); pasos válidos: ${TIPOS_PASO.join(', ')}`); return }
  const tipo = ks[0]!
  const v = p[tipo]
  const r = `${ruta}.${tipo}`
  if (!TIPOS_PASO.includes(tipo)) {
    const sug = parecida(tipo, TIPOS_PASO)
    e.add(ruta, `paso desconocido "${tipo}"${sug ? `; ¿quisiste decir "${sug}"? forma: ${FORMAS[sug]}` : `; pasos válidos: ${TIPOS_PASO.join(', ')}`}`)
    return
  }
  const forma = FORMAS[tipo]!
  const obj = (validas: readonly string[]): boolean => {
    if (!esObjeto(v)) { e.add(r, `debe ser un objeto; forma: ${forma}`); return false }
    e.claves(v, validas, r)
    return true
  }
  const conEn = (validas: readonly string[]): Record<string, unknown> | null => {
    if (!obj(['en', ...validas])) return null
    const o = v as Record<string, unknown>
    if (o['en'] === undefined) e.add(`${r}.en`, `falta; forma: ${forma}`); else validarSelector(o['en'], `${r}.en`, e)
    return o
  }
  switch (tipo) {
    case 'ir': if (!texto(v) || !/^(\/|https?:\/\/)/.test(v)) e.add(r, `una ruta que empiece con / o una URL; forma: ${forma}`); break
    case 'click': conEn([]); break
    case 'llenar': { const o = conEn(['valor']); if (o && typeof o['valor'] !== 'string') e.add(`${r}.valor`, 'un texto (puede ser vacío)'); break }
    case 'elegir': { const o = conEn(['opcion']); if (o && !texto(o['opcion'])) e.add(`${r}.opcion`, 'el texto de la opción'); break }
    case 'esperar': textoOObjeto(v, r, e, ['ms'], forma); break
    case 'esperarExito': {
      textoOObjeto(v, r, e, ['ms', 'dentro'], forma)
      if (esObjeto(v) && v['dentro'] !== undefined) validarSelector(v['dentro'], `${r}.dentro`, e)
      break
    }
    case 'esperarToast': {
      textoOObjeto(v, r, e, ['ms', 'foto', 'leyenda'], forma)
      if (esObjeto(v)) for (const k of ['foto', 'leyenda']) if (v[k] !== undefined && !texto(v[k])) e.add(`${r}.${k}`, 'un texto')
      break
    }
    case 'esperarHabilitado': { const o = conEn(['ms']); if (o?.['ms'] !== undefined && !(typeof o['ms'] === 'number' && o['ms'] > 0)) e.add(`${r}.ms`, 'milisegundos'); break }
    case 'comprobar': {
      const o = conEn(['visible', 'texto', 'habilitado'])
      if (!o) break
      if (o['visible'] === undefined && o['texto'] === undefined && o['habilitado'] === undefined) e.add(r, `qué comprobar: "visible", "texto" o "habilitado"; forma: ${forma}`)
      for (const k of ['visible', 'habilitado']) if (o[k] !== undefined && typeof o[k] !== 'boolean') e.add(`${r}.${k}`, 'true o false')
      if (o['texto'] !== undefined && !texto(o['texto'])) e.add(`${r}.texto`, 'un texto')
      break
    }
    case 'marcar': {
      const o = conEn(['etiqueta', 'lado', 'numero'])
      if (!o) break
      if (!texto(o['etiqueta'])) e.add(`${r}.etiqueta`, 'falta: qué señala la marca (texto)')
      if (o['lado'] !== undefined && !LADOS.includes(String(o['lado']))) e.add(`${r}.lado`, LADOS.join(' | '))
      if (o['numero'] !== undefined && !Number.isInteger(o['numero'])) e.add(`${r}.numero`, 'un entero')
      break
    }
    case 'limpiar': if (v !== true) e.add(r, `debe ser true; forma: ${forma}`); break
    case 'foto': {
      if (!obj(['descripcion', 'leyenda', 'sinMarca', 'completa'])) break
      const o = v as Record<string, unknown>
      if (!texto(o['descripcion'])) e.add(`${r}.descripcion`, 'falta: nombre corto del archivo (texto)')
      if (!texto(o['leyenda'])) e.add(`${r}.leyenda`, 'falta: toda captura lleva leyenda (qué se ve y por qué importa)')
      if (o['sinMarca'] !== undefined && !texto(o['sinMarca'])) e.add(`${r}.sinMarca`, 'el motivo (texto), solo si el usuario pidió la captura sin marca')
      if (o['completa'] !== undefined && typeof o['completa'] !== 'boolean') e.add(`${r}.completa`, 'true o false')
      break
    }
    case 'cambio': {
      if (!obj(['que', 'revertir', 'revertido'])) break
      const o = v as Record<string, unknown>
      if (!texto(o['que'])) e.add(`${r}.que`, 'falta: qué dato se escribió')
      if (o['revertir'] !== undefined && typeof o['revertir'] !== 'string') e.add(`${r}.revertir`, 'un texto')
      if (o['revertido'] !== undefined && typeof o['revertido'] !== 'boolean') e.add(`${r}.revertido`, 'true o false')
      break
    }
    case 'api': {
      if (!obj(['metodo', 'ruta', 'cuerpo', 'status'])) break
      const o = v as Record<string, unknown>
      if (!METODOS.includes(String(o['metodo']).toLowerCase())) e.add(`${r}.metodo`, METODOS.join(' | '))
      if (!texto(o['ruta']) || !String(o['ruta']).startsWith('/')) e.add(`${r}.ruta`, 'una ruta que empiece con / (relativa a apiBase)')
      if (o['status'] !== undefined && !(Number.isInteger(o['status']) && (o['status'] as number) >= 100 && (o['status'] as number) <= 599)) e.add(`${r}.status`, 'un código HTTP')
      break
    }
    case 'receta': {
      if (texto(v)) break
      if (!obj(['id', 'args'])) break
      const o = v as Record<string, unknown>
      if (!texto(o['id'])) e.add(`${r}.id`, 'el id de la receta')
      if (o['args'] !== undefined && !esObjeto(o['args'])) e.add(`${r}.args`, 'un objeto')
      break
    }
    case 'explorar': {
      if (v === true) break
      if (!obj(['max', 'completo', 'errores'])) break
      break
    }
  }
}

/** Valida la estructura. Devuelve el escenario tipado o la lista de errores (todos, no solo el primero). */
export function validarEscenario(x: unknown): { ok: true; escenario: Escenario } | { ok: false; errores: string[] } {
  const e = new Errores()
  if (!esObjeto(x)) return { ok: false, errores: ['(raíz): un escenario es un objeto { "version": 1, "id", "rol" (si la app tiene login), "casos": [...] }'] }
  e.claves(x, ['$schema', 'version', 'id', 'app', 'rol', 'recetas', 'casos'], '(raíz)')
  if (x['version'] !== 1) e.add('version', 'debe ser 1')
  if (!texto(x['id'])) e.add('id', 'falta: nombre de la carpeta de salida (o pasar --id)')
  if (x['app'] !== undefined && !texto(x['app'])) e.add('app', 'el nombre de una app del config')
  if (x['rol'] !== undefined && !texto(x['rol'])) e.add('rol', 'debe ser un texto no vacío (con qué rol entrar); quitar "rol" si la app no tiene login')
  const rec = x['recetas']
  if (rec !== undefined) {
    if (!esObjeto(rec)) e.add('recetas', '{ "creadas": ["id"] } o { "ninguna": "motivo" }')
    else {
      e.claves(rec, ['creadas', 'ninguna'], 'recetas')
      if (rec['creadas'] !== undefined && !(Array.isArray(rec['creadas']) && rec['creadas'].every(texto))) e.add('recetas.creadas', 'una lista de ids')
      if (rec['ninguna'] !== undefined && !texto(rec['ninguna'])) e.add('recetas.ninguna', 'el motivo (texto)')
    }
  }
  const casos = x['casos']
  if (!Array.isArray(casos) || !casos.length) e.add('casos', 'una lista con al menos un caso { "nombre", "esperado", "pasos": [...] }')
  else {
    const nombres = new Set<string>()
    casos.forEach((c: unknown, i: number) => {
      const r = `casos[${i}]`
      if (!esObjeto(c)) { e.add(r, 'un objeto { "nombre", "esperado", "pasos": [...] }'); return }
      e.claves(c, ['nombre', 'esperado', 'pasos'], r)
      if (!texto(c['nombre'])) e.add(`${r}.nombre`, 'falta: nombre del caso (va al informe)')
      else if (nombres.has(c['nombre'])) e.add(`${r}.nombre`, `repetido ("${c['nombre']}"): en el informe uno reemplazaría al otro`)
      else nombres.add(c['nombre'])
      if (c['esperado'] !== undefined && typeof c['esperado'] !== 'string') e.add(`${r}.esperado`, 'un texto')
      const pasos = c['pasos']
      if (!Array.isArray(pasos) || !pasos.length) { e.add(`${r}.pasos`, 'una lista con al menos un paso'); return }
      pasos.forEach((p: unknown, j: number) => validarPaso(p, `${r}.pasos[${j}]`, e))
    })
  }
  return e.lista.length ? { ok: false, errores: e.lista } : { ok: true, escenario: x as unknown as Escenario }
}

/** Ids de receta que usa el escenario (para comprobar que existen antes de abrir el navegador). */
export const recetasDe = (esc: Escenario): string[] =>
  [...new Set(esc.casos.flatMap((c) => c.pasos.flatMap((p) => ('receta' in p ? [typeof p.receta === 'string' ? p.receta : p.receta.id] : []))))]

/** "/patron/flags" es una expresión regular; cualquier otro texto, literal. */
export function patronDe(s: string): string | RegExp {
  const m = s.match(/^\/(.+)\/([dgimsuvy]*)$/)
  return m ? new RegExp(m[1]!, m[2]) : s
}
