// captura.config.json del proyecto. Toda clave es opcional y su valor por defecto es neutro: ningún prefijo,
// patrón ni nombre de un proyecto concreto. Lo propio de cada proyecto lo declara su config y sus adaptadores.
// Una clave desconocida es un error con la corrección sugerida (un typo no se ignora en silencio).
// Referencia completa: docs/configuracion.md. Esquema para el editor: schema/captura.config.schema.json.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export const EXTRAS = ['correo'];
export const DEFECTO = {
    viewport: { width: 1366, height: 900 },
    sesionMin: 15,
    apps: {},
    id: { patron: '^[A-Za-z0-9._-]+$', mayusculas: true },
    credenciales: { archivo: '.env', prefijo: 'CAPTURA_', alias: {} },
    rutas: {},
    adaptadores: {},
    extras: [],
    evidencia: { hook: false, patrones: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte', '**/*.html', '**/*.css', '**/*.scss'], horas: 12 },
};
export class ConfigInvalida extends Error {
}
const CLAVES_RAIZ = ['$schema', 'viewport', 'sesionMin', 'apps', 'id', 'credenciales', 'rutas', 'adaptadores', 'extras', 'evidencia'];
const CLAVES = {
    evidencia: ['hook', 'patrones', 'horas'],
    viewport: ['width', 'height'],
    id: ['patron', 'mayusculas'],
    credenciales: ['archivo', 'prefijo', 'alias'],
    rutas: ['salidas', 'recetas', 'helpers', 'escenarios', 'sesiones'],
    adaptadores: ['credenciales', 'identificador', 'entorno', 'publicacion', 'correo'],
};
/** Claves de la herramienta original o errores comunes: qué usar en su lugar. */
const SUGERENCIAS = {
    salida: 'usar "rutas": { "salidas": "…" } (o dejarlo vacío: el almacén global del workspace)',
    playwrightDesde: 'quitarla: Playwright viene incluido en captura-cli',
    ticket: 'el id se pasa al abrir (abrir({ ticket }) o --id); el formato va en "id": { "patron": "…" }',
    slot: 'el slot se elige por corrida: CAPTURA_SLOT=N|auto o --slot',
    stack: 'va dentro de la configuración del adaptador de entorno ("adaptadores": { "entorno": { "usa": …, … } })',
    recetas: 'usar "rutas": { "recetas": "…" }',
};
const CLAVES_APP = ['baseUrl', 'login', 'campoUsuario', 'campoClave', 'campos', 'boton', 'postLogin', 'inicio', 'cookieSesion', 'apiBase'];
const VALORES_CAMPO = ['usuario', 'clave', 'letra', 'numero'];
const esObjeto = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const texto = (x) => typeof x === 'string' && x.trim() !== '';
function exigir(cond, archivo, clave, forma) {
    if (!cond)
        throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: "${clave}" debe ser ${forma}`);
}
/** Distancia de edición (para sugerir la clave correcta ante un typo). */
function distancia(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++)
        d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return d[a.length][b.length];
}
function sinDesconocidas(o, validas, archivo, prefijo) {
    for (const k of Object.keys(o)) {
        if (validas.includes(k))
            continue;
        const ruta = prefijo ? `${prefijo}.${k}` : k;
        const sug = (!prefijo && SUGERENCIAS[k]) || (() => {
            const cerca = validas.filter((v) => distancia(v.toLowerCase(), k.toLowerCase()) <= 2);
            return cerca.length ? `¿quisiste decir "${prefijo ? `${prefijo}.` : ''}${cerca[0]}"?` : `claves válidas: ${validas.join(', ')}`;
        })();
        throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: clave desconocida "${ruta}": ${sug}`);
    }
}
function validarApp(n, a, archivo) {
    const p = `apps.${n}`;
    exigir(esObjeto(a), archivo, p, 'un objeto { baseUrl, login, boton, postLogin, … } (solo { baseUrl } si la app no tiene login)');
    exigir(typeof a['baseUrl'] === 'string' && /^https?:\/\/[^/]+/.test(a['baseUrl']), archivo, `${p}.baseUrl`, 'una URL http(s)://host[:puerto]');
    // Con `login` (la ruta de la pantalla de login) hacen falta boton, postLogin y los campos; sin él la app no tiene
    // login y esas claves no tienen sentido (probablemente falta `login`).
    const tieneLogin = a['login'] !== undefined;
    if (tieneLogin) {
        for (const k of ['login', 'boton', 'postLogin'])
            exigir(texto(a[k]), archivo, `${p}.${k}`, 'un texto no vacío');
    }
    else {
        for (const k of ['boton', 'postLogin', 'campos', 'campoUsuario', 'campoClave']) {
            if (a[k] !== undefined)
                throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: "${p}.${k}" solo tiene sentido con "${p}.login" (la ruta de la pantalla de login): declararlo, o quitar "${p}.${k}" si la app no tiene login`);
        }
    }
    for (const k of ['campoUsuario', 'campoClave', 'inicio', 'apiBase'])
        exigir(a[k] === undefined || typeof a[k] === 'string', archivo, `${p}.${k}`, 'un texto');
    exigir(a['cookieSesion'] === undefined || a['cookieSesion'] === null || typeof a['cookieSesion'] === 'string', archivo, `${p}.cookieSesion`, 'el nombre de una cookie o null');
    if (!tieneLogin) {
        // sin login no hay campos que validar
    }
    else if (a['campos'] !== undefined) {
        const cs = a['campos'];
        exigir(Array.isArray(cs) && cs.length > 0, archivo, `${p}.campos`, 'una lista [{ "selector": "…", "valor": "usuario|clave|letra|numero" }]');
        cs.forEach((c, i) => {
            exigir(esObjeto(c) && typeof c['selector'] === 'string' && VALORES_CAMPO.includes(String(c['valor'])), archivo, `${p}.campos[${i}]`, `{ "selector": "…", "valor": ${VALORES_CAMPO.join('|')} }`);
        });
    }
    else {
        exigir(typeof a['campoUsuario'] === 'string' && typeof a['campoClave'] === 'string', archivo, `${p}.campoUsuario/campoClave`, 'selectores de texto (o declarar "campos")');
    }
    // Claves extra (p. ej. datos para un adaptador propio) se permiten dentro de una app; se avisan para detectar typos.
    for (const k of Object.keys(a)) {
        if (CLAVES_APP.includes(k))
            continue;
        const cerca = CLAVES_APP.find((v) => distancia(v.toLowerCase(), k.toLowerCase()) <= 2);
        if (cerca)
            throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: clave desconocida "${p}.${k}": ¿quisiste decir "${p}.${cerca}"?`);
    }
    return a;
}
/** Mezcla el JSON del proyecto sobre los valores por defecto, validando la forma de cada clave. */
export function normalizar(crudo, archivo) {
    exigir(esObjeto(crudo), archivo, '(raíz)', 'un objeto');
    const c = crudo;
    sinDesconocidas(c, CLAVES_RAIZ, archivo, '');
    for (const [k, validas] of Object.entries(CLAVES))
        if (esObjeto(c[k]))
            sinDesconocidas(c[k], validas, archivo, k);
    const v = c['viewport'] ?? DEFECTO.viewport;
    exigir(esObjeto(v) && Number.isInteger(v['width']) && Number.isInteger(v['height']) && v['width'] > 0 && v['height'] > 0, archivo, 'viewport', '{ "width": n, "height": n } (enteros positivos)');
    const sesionMin = c['sesionMin'] ?? DEFECTO.sesionMin;
    exigir(typeof sesionMin === 'number' && sesionMin >= 0, archivo, 'sesionMin', 'un número de minutos (0 = no reutilizar)');
    const appsCrudo = c['apps'] ?? {};
    exigir(esObjeto(appsCrudo), archivo, 'apps', 'un objeto { nombre: { baseUrl, login, … } }');
    const apps = {};
    for (const [n, a] of Object.entries(appsCrudo))
        apps[n] = validarApp(n, a, archivo);
    const id = c['id'] ?? {};
    exigir(esObjeto(id), archivo, 'id', '{ "patron": "regex", "mayusculas": bool }');
    const patron = id['patron'] ?? DEFECTO.id.patron;
    exigir(typeof patron === 'string', archivo, 'id.patron', 'una expresión regular en texto');
    try {
        new RegExp(patron);
    }
    catch {
        exigir(false, archivo, 'id.patron', 'una expresión regular válida');
    }
    const mayusculas = id['mayusculas'] ?? DEFECTO.id.mayusculas;
    exigir(typeof mayusculas === 'boolean', archivo, 'id.mayusculas', 'true o false');
    const cr = c['credenciales'] ?? {};
    exigir(esObjeto(cr), archivo, 'credenciales', '{ "archivo", "prefijo", "alias" }');
    for (const k of ['archivo', 'prefijo'])
        exigir(cr[k] === undefined || typeof cr[k] === 'string', archivo, `credenciales.${k}`, 'un texto');
    const alias = cr['alias'] ?? {};
    exigir(esObjeto(alias) && Object.values(alias).every((x) => typeof x === 'string' && /^[A-Z0-9_]+$/.test(x)), archivo, 'credenciales.alias', '{ "rol": "NOMBRE" } (NOMBRE en mayúsculas, dígitos o _)');
    const rutas = c['rutas'] ?? {};
    exigir(esObjeto(rutas) && Object.values(rutas).every((x) => typeof x === 'string' && x !== ''), archivo, 'rutas', '{ "recetas": "ruta", … } (textos no vacíos)');
    const ad = c['adaptadores'] ?? {};
    exigir(esObjeto(ad), archivo, 'adaptadores', '{ "tipo": "builtin:nombre" | "./ruta.mjs" | { "usa": … } }');
    for (const [t, r] of Object.entries(ad)) {
        exigir(typeof r === 'string' || (esObjeto(r) && typeof r['usa'] === 'string'), archivo, `adaptadores.${t}`, '"builtin:nombre", "./ruta.mjs" o { "usa": … }');
    }
    const extras = c['extras'] ?? [];
    exigir(Array.isArray(extras) && extras.every((x) => EXTRAS.includes(x)), archivo, 'extras', `una lista con: ${EXTRAS.join(', ')}`);
    const ev = c['evidencia'] ?? {};
    exigir(esObjeto(ev), archivo, 'evidencia', '{ "hook": bool, "patrones": ["**/*.tsx", …], "horas": n }');
    const hook = ev['hook'] ?? DEFECTO.evidencia.hook;
    exigir(typeof hook === 'boolean', archivo, 'evidencia.hook', 'true o false');
    const patrones = ev['patrones'] ?? DEFECTO.evidencia.patrones;
    exigir(Array.isArray(patrones) && patrones.length > 0 && patrones.every(texto), archivo, 'evidencia.patrones', 'una lista de globs (p. ej. "src/**/*.tsx")');
    const horas = ev['horas'] ?? DEFECTO.evidencia.horas;
    exigir(typeof horas === 'number' && horas > 0, archivo, 'evidencia.horas', 'horas hacia atrás para los commits del turno (número positivo)');
    return {
        viewport: { width: v['width'], height: v['height'] },
        sesionMin,
        apps,
        id: { patron, mayusculas },
        credenciales: {
            archivo: typeof cr['archivo'] === 'string' ? cr['archivo'] : DEFECTO.credenciales.archivo,
            prefijo: typeof cr['prefijo'] === 'string' ? cr['prefijo'] : DEFECTO.credenciales.prefijo,
            alias: alias,
        },
        rutas: rutas,
        adaptadores: ad,
        extras: [...new Set(extras)],
        evidencia: { hook, patrones: patrones, horas },
    };
}
/** Lee el config si existe; sin archivo, los valores por defecto. `base` es la carpeta para resolver rutas. */
export function leerConfig(archivo) {
    if (!archivo || !existsSync(archivo))
        return { cfg: normalizar({}, '(sin config)'), base: null };
    let crudo;
    try {
        crudo = JSON.parse(readFileSync(archivo, 'utf8').replace(/^﻿/, ''));
    }
    catch (e) {
        throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: no es JSON válido (${e.message})`);
    }
    return { cfg: normalizar(crudo, archivo), base: dirname(resolve(archivo)) };
}
