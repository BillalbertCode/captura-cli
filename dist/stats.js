// `captura-cli stats`: resume el libro de uso (uso.jsonl) de un workspace o de todos, el espacio que ocupa cada parte
// del almacén y, con --transcrito, los tokens REALES de una sesión de Claude Code y cuánto de lo leído vino de
// captura-cli. La reducción de tokens se decide con estos números, no a ojo.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tokensEstimados } from './uso.js';
export function leerLibro(archivo, desde = 0) {
    if (!existsSync(archivo))
        return [];
    const out = [];
    for (const l of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
        if (!l.trim())
            continue;
        try {
            const x = JSON.parse(l);
            if (Date.parse(x.fecha) >= desde)
                out.push(x);
        }
        catch { /* línea rota: se ignora */ }
    }
    return out;
}
const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const mb = (b) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GB` : b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
/** Solo las líneas de una tarea: cada corrida sabe con qué id se abrió (aunque el script fallara). */
export function deId(lineas, id) {
    return lineas.filter((l) => (l.ids ?? []).includes(id));
}
export function resumir(lineas) {
    const r = { corridas: lineas.length, porComando: {}, tokens: 0, recetas: { yaEstaba: 0, ejecutada: 0, rota: 0, creadas: 0, candidatas: 0 }, casos: { ok: 0, falla: 0 }, capturas: 0, errores5xx: 0, porId: {} };
    for (const l of lineas) {
        const c = (r.porComando[l.comando || '(sin comando)'] ??= { corridas: 0, tokens: 0, ms: 0, codigos: {} });
        c.corridas++;
        c.tokens += l.salida?.tokens ?? 0;
        c.ms += l.ms ?? 0;
        c.codigos[String(l.codigo)] = (c.codigos[String(l.codigo)] ?? 0) + 1;
        r.tokens += l.salida?.tokens ?? 0;
        for (const x of Object.keys(r.recetas))
            r.recetas[x] += l.recetas?.[x] ?? 0;
        r.casos.ok += l.casos?.ok ?? 0;
        r.casos.falla += l.casos?.falla ?? 0;
        r.capturas += l.capturas ?? 0;
        r.errores5xx += l.errores5xx ?? 0;
        for (const id of l.ids ?? [])
            r.porId[id] = (r.porId[id] ?? 0) + 1;
    }
    return r;
}
export function formatear(nombre, r, desde) {
    const L = [`stats ${nombre}${desde ? ` (desde ${desde})` : ''}: ${r.corridas} corrida(s), ${k(r.tokens)} tokens estimados de salida`];
    if (!r.corridas)
        return L.join('\n');
    L.push('comando                corridas  tokens  prom.  tiempo prom.  códigos');
    const filas = Object.entries(r.porComando).sort((a, b) => b[1].tokens - a[1].tokens);
    for (const [n, c] of filas) {
        const cod = Object.entries(c.codigos).map(([x, y]) => `${x}:${y}`).join(' ');
        L.push(`${n.padEnd(22).slice(0, 22)} ${String(c.corridas).padStart(8)}  ${k(c.tokens).padStart(6)}  ${k(Math.round(c.tokens / c.corridas)).padStart(5)}  ${`${(c.ms / c.corridas / 1000).toFixed(1)} s`.padStart(12)}  ${cod}`);
    }
    const rc = r.recetas;
    L.push(`recetas: usadas ${rc.yaEstaba + rc.ejecutada} (ya estaban ${rc.yaEstaba}, ejecutadas ${rc.ejecutada}) · rotas ${rc.rota} · creadas ${rc.creadas} · tramos candidatos ${rc.candidatas}`);
    L.push(`casos: ${r.casos.ok} OK, ${r.casos.falla} FALLA · capturas ${r.capturas} · respuestas 5xx ${r.errores5xx}`);
    const ids = Object.entries(r.porId).sort((a, b) => b[1] - a[1]);
    if (ids.length)
        L.push(`por tarea: ${ids.map(([id, n]) => `${id}: ${n} corrida(s)`).join(' · ')}`);
    return L.join('\n');
}
/** Tamaño total y cantidad de archivos de una carpeta (sin seguir enlaces). */
export function tamano(dir) {
    let bytes = 0, archivos = 0;
    if (!existsSync(dir))
        return { bytes, archivos };
    const pila = [dir];
    while (pila.length) {
        const d = pila.pop();
        let entradas;
        try {
            entradas = readdirSync(d, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entradas) {
            const f = join(d, e.name);
            if (e.isDirectory())
                pila.push(f);
            else if (e.isFile()) {
                try {
                    bytes += statSync(f).size;
                    archivos++;
                }
                catch { /* desapareció */ }
            }
        }
    }
    return { bytes, archivos };
}
/** Espacio por tipo: capturas, sesiones, caché y temporales (sumando todos los slots). */
export function espacio(salidas, dirWs) {
    const slots = join(dirWs, 'slots');
    const sumar = (sub) => {
        const t = { bytes: 0, archivos: 0 };
        if (!existsSync(slots))
            return t;
        for (const s of readdirSync(slots)) {
            const x = tamano(join(slots, s, sub));
            t.bytes += x.bytes;
            t.archivos += x.archivos;
        }
        return t;
    };
    const ids = existsSync(salidas) ? readdirSync(salidas, { withFileTypes: true }).filter((d) => d.isDirectory()).length : 0;
    const cap = tamano(salidas), ses = sumar('sesiones'), cache = sumar('cache'), tmp = sumar('tmp');
    return `espacio: capturas ${mb(cap.bytes)} (${ids} ids) · sesiones ${mb(ses.bytes)} · caché ${mb(cache.bytes)} · temporales ${mb(tmp.bytes)} (${tmp.archivos} archivos)`;
}
const MARCAS = /^(captura: |informe: |recetas disponibles de |explorar \/|diagnostico: |FALTAN_CREDENCIALES|TIMEOUT_GLOBAL|PAGINA_COLGADA|WORKSPACE_NUEVO|ESCENARIO_INVALIDO|AVISO_5XX|resultado: \d+ de \d+ caso)/m;
// Un tramo del comando que EMPIEZA por captura-cli (admite variables, timeout y npx delante); una ruta o un texto
// que solo lo nombra no cuenta.
const INVOCACION_TRAMO = /^(\w+=\S*\s+)*(timeout\s+\d+\s+)?(npx\s+(--yes\s+)?)?captura-cli(\.cmd)?(\s|$)/;
// El cuerpo de un heredoc (p. ej. un mensaje de commit) es texto, no comandos: se quita antes de partir en tramos.
const sinHeredocs = (cmd) => cmd.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, '');
const tramos = (cmd) => sinHeredocs(cmd).split(/&&|;|\|\||\||\n/).map((x) => x.trim()).filter(Boolean);
const INVOCACION = { test: (cmd) => tramos(cmd).some((t) => INVOCACION_TRAMO.test(t)) };
/** El tramo del comando que importa: el que llama a captura-cli o a node (sin el `cd …` ni las variables delante). */
const etiqueta = (cmd) => {
    const ts = tramos(cmd);
    const t = ts.find((x) => INVOCACION_TRAMO.test(x)) ?? ts.find((x) => /(^|\s)node\s/.test(x)) ?? ts[0] ?? cmd;
    return t.replace(/\s+/g, ' ').slice(0, 70);
};
const textoDe = (c) => typeof c === 'string' ? c
    : Array.isArray(c) ? c.map((b) => (typeof b === 'string' ? b : b.text ?? '')).join('') : '';
/** Lee un transcrito .jsonl de Claude Code. Los tokens reales vienen de `usage` (una vez por requestId). */
export function leerTranscrito(archivo) {
    const usos = new Map();
    const llamadas = new Map();
    const r = { respuestas: 0, tokens: { entrada: 0, cacheCreacion: 0, cacheLectura: 0, salida: 0, total: 0 }, herramientas: 0, resultadosTokens: 0, captura: { llamadas: 0, tokens: 0, comandos: [] } };
    const porComando = new Map();
    for (const l of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
        if (!l.trim())
            continue;
        let o;
        try {
            o = JSON.parse(l);
        }
        catch {
            continue;
        }
        const contenido = Array.isArray(o.message?.content) ? o.message.content : [];
        if (o.type === 'assistant') {
            const clave = o.requestId ?? o.message?.id;
            if (clave && o.message?.usage)
                usos.set(clave, o.message.usage);
            for (const b of contenido) {
                if (b.type !== 'tool_use' || !b.id)
                    continue;
                r.herramientas++;
                const cmd = typeof b.input?.['command'] === 'string' ? b.input['command'] : '';
                llamadas.set(b.id, { nombre: b.name ?? '', comando: cmd });
            }
        }
        else if (o.type === 'user') {
            for (const b of contenido) {
                if (b.type !== 'tool_result' || !b.tool_use_id)
                    continue;
                const t = textoDe(b.content);
                const tok = tokensEstimados(t.length);
                r.resultadosTokens += tok;
                const ll = llamadas.get(b.tool_use_id);
                // Una invocación real del comando (no una ruta que contenga "captura-cli") o una salida con sus marcas.
                const deCaptura = INVOCACION.test(ll?.comando ?? '') || MARCAS.test(t);
                if (!deCaptura)
                    continue;
                r.captura.llamadas++;
                r.captura.tokens += tok;
                const nombre = etiqueta(ll?.comando || ll?.nombre || '?');
                const p = porComando.get(nombre) ?? { llamadas: 0, tokens: 0 };
                p.llamadas++;
                p.tokens += tok;
                porComando.set(nombre, p);
            }
        }
    }
    for (const u of usos.values()) {
        r.respuestas++;
        r.tokens.entrada += u['input_tokens'] ?? 0;
        r.tokens.cacheCreacion += u['cache_creation_input_tokens'] ?? 0;
        r.tokens.cacheLectura += u['cache_read_input_tokens'] ?? 0;
        r.tokens.salida += u['output_tokens'] ?? 0;
    }
    r.tokens.total = r.tokens.entrada + r.tokens.cacheCreacion + r.tokens.cacheLectura + r.tokens.salida;
    r.captura.comandos = [...porComando].map(([comando, v]) => ({ comando, ...v })).sort((a, b) => b.tokens - a.tokens).slice(0, 10);
    return r;
}
export function formatearTranscrito(archivo, r) {
    const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '0%');
    const L = [
        `transcrito ${archivo}`,
        `tokens reales (${r.respuestas} respuestas): entrada ${k(r.tokens.entrada)} · caché escrita ${k(r.tokens.cacheCreacion)} · caché leída ${k(r.tokens.cacheLectura)} · salida ${k(r.tokens.salida)} · total ${k(r.tokens.total)}`,
        `herramientas: ${r.herramientas} llamadas; sus resultados ≈ ${k(r.resultadosTokens)} tokens`,
        `captura-cli: ${r.captura.llamadas} llamadas; sus resultados ≈ ${k(r.captura.tokens)} tokens (${pct(r.captura.tokens, r.resultadosTokens)} de lo que devolvieron las herramientas)`,
    ];
    if (r.captura.comandos.length) {
        L.push('más caras:');
        for (const c of r.captura.comandos)
            L.push(`  ${k(c.tokens).padStart(6)}  ${String(c.llamadas).padStart(3)}×  ${c.comando}`);
    }
    L.push('Nota: los tokens de cada resultado son estimados (≈4 caracteres por token); el total de la sesión es real.');
    return L.join('\n');
}
