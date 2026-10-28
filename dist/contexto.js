// Contexto de una corrida: workspace, config, slot, rutas y adaptadores. Se resuelve una vez al importar la API
// (sin salir del proceso); la primera función que lo necesita sale con el código que corresponda si algo falta.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AdaptadorInvalido, cargarAdaptadores } from './adaptadores/cargar.js';
import { dentroDe, dirWorkspace, excluirDeGit, guardarRegistro, leerRegistro, raizWorkspace } from './almacen.js';
import { ConfigInvalida, leerConfig } from './config.js';
import { CODIGOS, alSalir, salir } from './salida.js';
import { mensajeWorkspaceNuevo } from './workspace.js';
let actual = null;
let problema = null;
const vivo = (pid) => { try {
    process.kill(pid, 0);
    return true;
}
catch {
    return false;
} };
/** Slot de la corrida: CAPTURA_SLOT=N o auto (el primero sin otra corrida viva). Por defecto 0. */
function resolverSlot(dirWs) {
    const v = (process.env['CAPTURA_SLOT'] ?? '').trim();
    if (v === '')
        return 0;
    if (/^\d{1,2}$/.test(v))
        return Number(v);
    if (v !== 'auto')
        throw new ConfigInvalida(`SLOT_INVALIDO: CAPTURA_SLOT="${v}" (usar un número de 0 a 99 o auto)`);
    for (let n = 0; n < 100; n++) {
        const f = join(dirWs, 'slots', String(n), 'ocupado.json');
        let pid = 0;
        try {
            pid = JSON.parse(readFileSync(f, 'utf8')).pid;
        }
        catch { /* libre */ }
        if (pid && pid !== process.pid && vivo(pid))
            continue;
        mkdirSync(join(dirWs, 'slots', String(n)), { recursive: true });
        writeFileSync(f, JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }) + '\n');
        alSalir(() => {
            try {
                if (JSON.parse(readFileSync(f, 'utf8')).pid === process.pid)
                    rmSync(f);
            }
            catch { /* ya no está */ }
        });
        process.env['CAPTURA_SLOT'] = String(n);
        return n;
    }
    throw new ConfigInvalida('SLOT_INVALIDO: no hay slot libre (0-99)');
}
export async function preparar(cwd = process.cwd()) {
    if (actual)
        return; // ya está: el CLI y la API la piden (una sola vez por proceso)
    actual = null;
    problema = null;
    const raiz = raizWorkspace(cwd);
    const registro = leerRegistro(raiz);
    if (!registro) {
        problema = { mensaje: mensajeWorkspaceNuevo(raiz), codigo: CODIGOS.WORKSPACE_NUEVO };
        return;
    }
    const dirWs = dirWorkspace(raiz);
    try {
        const configArchivo = process.env['CAPTURA_CONFIG'] ? resolve(process.env['CAPTURA_CONFIG']) : join(registro.proyecto, 'captura.config.json');
        const { cfg, base: baseCfg } = leerConfig(configArchivo);
        const base = baseCfg ?? raiz;
        const slot = resolverSlot(dirWs);
        const dirSlot = join(dirWs, 'slots', String(slot));
        const rel = (p) => resolve(base, p);
        const rutas = {
            salidas: process.env['CAPTURA_OUT'] ? resolve(process.env['CAPTURA_OUT']) : cfg.rutas.salidas ? rel(cfg.rutas.salidas) : registro.salidas,
            recetas: process.env['CAPTURA_RECETAS'] ? resolve(process.env['CAPTURA_RECETAS']) : cfg.rutas.recetas ? rel(cfg.rutas.recetas) : join(registro.proyecto, 'recetas'),
            helpers: cfg.rutas.helpers ? rel(cfg.rutas.helpers) : join(registro.proyecto, 'helpers'),
            escenarios: cfg.rutas.escenarios ? rel(cfg.rutas.escenarios) : join(registro.proyecto, 'escenarios'),
            estadoRecetas: join(dirWs, 'recetas-estado.json'),
            sesiones: cfg.rutas.sesiones ? join(rel(cfg.rutas.sesiones), 'slots', String(slot)) : join(dirSlot, 'sesiones'),
            servicios: join(dirSlot, 'servicios.json'),
            cache: join(dirSlot, 'cache'),
        };
        // Salidas y sesiones elegidas dentro de un repo: se excluyen por .git/info/exclude (el .gitignore no se toca).
        for (const [que, ruta] of [['salidas', rutas.salidas], ['sesiones', rutas.sesiones]]) {
            const linea = excluirDeGit(ruta);
            if (linea)
                console.error(`AVISO: ${que} dentro de un repo git: agregado "${linea}" a .git/info/exclude${que === 'sesiones' ? ' (las sesiones guardadas tienen cookies de usuarios reales)' : ''}`);
        }
        const adaptadores = await cargarAdaptadores(cfg, { raiz, base, slot, dirSlot });
        actual = {
            raiz, dirWs, registro, configArchivo: existsSync(configArchivo) ? configArchivo : null, base, cfg, slot, dirSlot, rutas, adaptadores,
            corrida: `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')}-${process.pid}`,
        };
        guardarRegistro(raiz, { ...registro, ultimoUso: new Date().toISOString() });
    }
    catch (e) {
        if (e instanceof ConfigInvalida || e instanceof AdaptadorInvalido) {
            problema = { mensaje: e.message, codigo: CODIGOS.ERROR };
            return;
        }
        throw e;
    }
}
/** El contexto listo; si el workspace no está registrado o la config es inválida, sale con su código. */
export function ctx() {
    if (actual)
        return actual;
    if (problema)
        return salir(problema.mensaje, problema.codigo);
    return salir('ERROR: contexto sin preparar', CODIGOS.ERROR);
}
/** true si el contexto está listo (sin salir). */
export const hayContexto = () => actual !== null;
let tmp = null;
/** Carpeta temporal de la corrida dentro del slot; se borra al terminar, aunque falle. */
export function carpetaTemporal() {
    if (tmp)
        return tmp;
    const c = ctx();
    const raizTmp = join(c.dirSlot, 'tmp');
    const dir = join(raizTmp, c.corrida);
    mkdirSync(dir, { recursive: true });
    tmp = dir;
    alSalir(() => {
        // Solo la carpeta de esta corrida, construida aquí y comprobada dentro del almacén: nunca una ruta ajena.
        if (dentroDe(raizTmp, dir) && dir !== raizTmp)
            rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}
