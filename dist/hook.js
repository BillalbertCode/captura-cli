// Hooks del plugin de Claude Code. Viven en el CLI (`captura-cli hook cierre|inicio`) para probarse como cualquier
// comando; el plugin solo los declara. Nunca bloquean por un error propio: ante cualquier duda, dejan terminar.
//
// cierre (evento Stop): si el workspace activó "evidencia": { "hook": true } y en el turno se tocaron archivos de
// interfaz sin evidencia posterior (manifest.json con capturas y recetas declaradas), le pide al agente que la deje
// o que diga por qué no aplica con una línea "SIN_EVIDENCIA: motivo". Solo una vez por turno (stop_hook_active).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ctx, hayContexto, preparar } from './contexto.js';
import { VERSION } from './version.js';
const nada = { salida: '', codigo: 0 };
/** Glob simple a expresión regular: `**` cruza carpetas, `*` y `?` no. */
export function globARegex(glob) {
    let r = '';
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === '*' && glob[i + 1] === '*') {
            if (glob[i + 2] === '/') {
                r += '(?:.*/)?';
                i += 2;
            }
            else {
                r += '.*';
                i++;
            }
        }
        else if (ch === '*')
            r += '[^/]*';
        else if (ch === '?')
            r += '[^/]';
        else
            r += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${r}$`, 'i');
}
function git(cwd, args) {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    return r.status === 0 ? r.stdout : '';
}
/** Archivos del repo cambiados en el turno: sin commitear (mtime) y en commits de las últimas `horas` (hora del commit). */
export function cambiosRecientes(raiz, horas) {
    const out = new Map();
    for (const l of git(raiz, ['status', '--porcelain', '-uall']).split(/\r?\n/)) {
        if (l.length < 4 || l.startsWith(' D') || l.startsWith('D '))
            continue;
        const ruta = l.slice(3).replace(/^.* -> /, '').replace(/^"(.*)"$/, '$1');
        try {
            out.set(ruta, statSync(join(raiz, ruta)).mtimeMs);
        }
        catch { /* borrado */ }
    }
    let cuando = 0;
    for (const l of git(raiz, ['log', `--since=${horas}.hours`, '--name-only', '--pretty=format:@%ct']).split(/\r?\n/)) {
        if (l.startsWith('@'))
            cuando = Number(l.slice(1)) * 1000;
        else if (l.trim() && !out.has(l.trim()))
            out.set(l.trim(), cuando);
    }
    return out;
}
/** La evidencia más reciente del workspace: el manifest.json más nuevo de la carpeta de salidas. */
export function ultimaEvidencia(salidas) {
    if (!existsSync(salidas))
        return null;
    let mejor = null;
    for (const d of readdirSync(salidas, { withFileTypes: true })) {
        if (!d.isDirectory())
            continue;
        const f = join(salidas, d.name, 'manifest.json');
        if (!existsSync(f))
            continue;
        const cuando = statSync(f).mtimeMs;
        if (mejor && mejor.cuando >= cuando)
            continue;
        try {
            const m = JSON.parse(readFileSync(f, 'utf8'));
            mejor = { id: m.id ?? d.name, cuando, capturas: m.resumen?.capturas ?? 0, pendiente: m.resumen?.recetasPendientes ?? false };
        }
        catch { /* manifest roto: no cuenta */ }
    }
    return mejor;
}
export async function hookCierre(entrada) {
    let e = {};
    try {
        e = JSON.parse(entrada || '{}');
    }
    catch {
        return nada;
    }
    if (e.stop_hook_active)
        return nada; // ya se pidió una vez en este turno: no insistir
    if (/SIN_EVIDENCIA:\s*\S/.test(e.last_assistant_message ?? ''))
        return nada;
    await preparar(e.cwd || process.env['CLAUDE_PROJECT_DIR'] || process.cwd());
    if (!hayContexto())
        return nada; // workspace sin registrar o config inválida: el hook no opina
    const c = ctx();
    if (!c.cfg.evidencia.hook)
        return nada;
    const patrones = c.cfg.evidencia.patrones.map(globARegex);
    const ui = [...cambiosRecientes(c.raiz, c.cfg.evidencia.horas)].filter(([f]) => patrones.some((p) => p.test(f)));
    if (!ui.length)
        return nada;
    const ultimoCambio = Math.max(...ui.map(([, t]) => t));
    const ev = ultimaEvidencia(c.rutas.salidas);
    const archivos = ui.map(([f]) => f).slice(0, 5).join(', ') + (ui.length > 5 ? ` y ${ui.length - 5} más` : '');
    let falta = '';
    if (!ev || ev.cuando < ultimoCambio)
        falta = 'no hay evidencia posterior al último cambio';
    else if (!ev.capturas)
        falta = `la evidencia más reciente (${ev.id}) no tiene capturas`;
    else if (ev.pendiente)
        falta = `la evidencia más reciente (${ev.id}) quedó INCOMPLETA: faltó declarar las recetas`;
    if (!falta)
        return nada;
    const reason = `captura-cli: en este turno se tocó la interfaz (${archivos}) y ${falta}. ` +
        'Verificalo en el navegador y dejá la evidencia (captura-cli run <escenario>, o un script con foto() y cerrar(); ver la skill captura), ' +
        'o, si no aplica (por ejemplo, el cambio no se ve en pantalla), terminá tu respuesta con una línea "SIN_EVIDENCIA: <motivo>".';
    return { salida: JSON.stringify({ decision: 'block', reason }), codigo: 0 };
}
/** inicio (evento SessionStart): una línea de contexto para el agente; nunca falla. */
export async function hookInicio(entrada) {
    let cwd = process.env['CLAUDE_PROJECT_DIR'] || process.cwd();
    try {
        cwd = JSON.parse(entrada || '{}').cwd || cwd;
    }
    catch { /* sin entrada */ }
    await preparar(cwd);
    const estado = hayContexto()
        ? `workspace registrado; salidas en ${ctx().rutas.salidas}${ctx().cfg.evidencia.hook ? '; el hook de cierre exige evidencia si se toca la interfaz' : ''}`
        : 'workspace sin registrar: la primera llamada saldrá con WORKSPACE_NUEVO (6) y las preguntas para el usuario';
    return { salida: `captura-cli ${VERSION} disponible (${estado}). Para verificar en el navegador o dejar evidencia, usar la skill captura.`, codigo: 0 };
}
