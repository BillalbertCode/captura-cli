// Resuelve y valida los adaptadores declarados en la config: "builtin:<nombre>", una ruta a un módulo propio, o
// { "usa": …, …opciones }. Lo que falta usa el incluido neutro de cada tipo.
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validarFabrica, validarInstancia, } from './contrato.js';
import carpeta from './incluidos/carpeta.js';
import comando from './incluidos/comando.js';
import env from './incluidos/env.js';
import mailpit from './incluidos/mailpit.js';
import patron from './incluidos/patron.js';
export const INCLUIDOS = { env, patron, comando, carpeta, mailpit };
const DEFECTO_POR_TIPO = {
    credenciales: 'builtin:env', identificador: 'builtin:patron', entorno: 'builtin:comando', publicacion: 'builtin:carpeta',
};
export class AdaptadorInvalido extends Error {
}
async function cargarFabrica(usa, base, tipo) {
    if (usa.startsWith('builtin:')) {
        const n = usa.slice('builtin:'.length);
        if (!(n in INCLUIDOS))
            throw new AdaptadorInvalido(`ADAPTADOR_INVALIDO: ${tipo}: "${usa}" no existe. Incluidos: ${Object.keys(INCLUIDOS).map((k) => `builtin:${k}`).join(', ')}`);
        return INCLUIDOS[n];
    }
    const ruta = isAbsolute(usa) ? usa : join(base, usa);
    try {
        return (await import(pathToFileURL(ruta).href)).default;
    }
    catch (e) {
        throw new AdaptadorInvalido(`ADAPTADOR_INVALIDO: ${tipo}: no se pudo cargar ${ruta}: ${e.message.split('\n')[0]}`);
    }
}
/** Opciones que la config da a los incluidos sin declararlas dentro del adaptador. */
function opcionesImplicitas(tipo, cfg) {
    if (tipo === 'credenciales')
        return { ...cfg.credenciales };
    if (tipo === 'identificador')
        return { ...cfg.id };
    return {};
}
export async function cargarUno(tipo, ref, cfg, ctx) {
    const usa = typeof ref === 'string' ? ref : ref.usa;
    const propias = typeof ref === 'string' ? {} : Object.fromEntries(Object.entries(ref).filter(([k]) => k !== 'usa'));
    const fab = await cargarFabrica(usa, ctx.base, tipo);
    const p1 = validarFabrica(fab, tipo);
    if (p1.length)
        throw new AdaptadorInvalido(`ADAPTADOR_INVALIDO: ${tipo} (${usa}): ${p1.join('; ')}`);
    const inst = fab.crear({ ...opcionesImplicitas(tipo, cfg), ...propias }, ctx);
    const p2 = validarInstancia(inst, tipo);
    if (p2.length)
        throw new AdaptadorInvalido(`ADAPTADOR_INVALIDO: ${tipo} (${usa}): ${p2.join('; ')}`);
    return inst;
}
export async function cargarAdaptadores(cfg, ctx) {
    const r = {};
    for (const tipo of Object.keys(DEFECTO_POR_TIPO)) {
        const inst = await cargarUno(tipo, cfg.adaptadores[tipo] ?? DEFECTO_POR_TIPO[tipo], cfg, ctx);
        Object.assign(r, { [tipo]: inst });
    }
    // El correo es opcional: se carga si se declara su adaptador, o con "extras": ["correo"] (incluido: mailpit).
    const correo = cfg.adaptadores.correo ?? (cfg.extras.includes('correo') ? 'builtin:mailpit' : undefined);
    if (correo)
        r.correo = (await cargarUno('correo', correo, cfg, ctx));
    return r;
}
