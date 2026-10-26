// Navegador. Nada queda vivo: todo navegador abierto se cierra si el script termina, falla, recibe una señal,
// supera `maxMs` (por defecto 5 min) o una página se cuelga. Un script colgado no deja Chrome corriendo horas.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as pw from 'playwright';
import { ctx } from './contexto.js';
import { crearEstado, estado, pasoActual, registrar5xx } from './estado.js';
import { grabarAcciones } from './grabacion.js';
import { escribirInforme } from './informe.js';
import { cerrarRecetas } from './recetas.js';
import { CODIGOS, alSalir, cerrarTodo, salir } from './salida.js';
import { contar } from './uso.js';
let vigilancia = false;
/** Página colgada (evento crash): manda sobre cualquier otro error que llegue después. */
let colgada = null;
const mensajeColgada = (url, paso) => `PAGINA_COLGADA: la página se colgó en ${url || '(sin URL)'} tras ${paso || 'abrirla'}; reintentá o corré con CAPTURA_CANAL=msedge`;
function vigilar(maxMs) {
    if (vigilancia)
        return;
    vigilancia = true;
    const fallo = (e) => (colgada ? salir(colgada, CODIGOS.PAGINA_COLGADA) : salir(`ERROR: ${e?.stack || String(e)}`, CODIGOS.ERROR));
    process.on('exit', cerrarTodo);
    process.on('SIGINT', () => salir('interrumpido', 130));
    process.on('SIGTERM', () => salir('terminado', 143));
    process.on('uncaughtException', fallo);
    process.on('unhandledRejection', fallo);
    setTimeout(() => salir(`TIMEOUT_GLOBAL: el script superó ${maxMs / 1000} s; navegador cerrado`, CODIGOS.TIMEOUT_GLOBAL), maxMs).unref();
}
export async function abrir({ ticket, browser = 'chromium', headless = true, viewport, subcarpeta = '', maxMs = 300000, storageState }) {
    const c = ctx();
    const problema = c.adaptadores.identificador.validar(ticket);
    if (problema)
        throw new Error(problema);
    vigilar(maxMs);
    // CAPTURA_CANAL=msedge|chrome usa el navegador instalado en vez del de Playwright
    // (sirve cuando el Chromium empaquetado se cae en una pantalla).
    const canal = process.env['CAPTURA_CANAL'];
    const b = await pw[browser].launch({ headless, ...(canal && browser === 'chromium' ? { channel: canal } : {}) });
    const soltar = alSalir(() => { void b.close().catch(() => { }); });
    const contexto = await b.newContext({ viewport: viewport ?? c.cfg.viewport, ...(storageState ? { storageState } : {}) });
    contexto.setDefaultTimeout(30000);
    contexto.setDefaultNavigationTimeout(45000);
    const page = await contexto.newPage();
    // El id va tal cual al informe, al manifest y a publicar(); la carpeta la decide el adaptador de identificador.
    const base = join(c.rutas.salidas, c.adaptadores.identificador.carpeta(ticket), subcarpeta);
    crearEstado(page, {
        id: ticket, dir: base, base, casos: [], cambios: [], fotos: [], marcas: [], grabar: true, acciones: [], tramos: [], recetasUsadas: [], ultimoPaso: '', errores5xx: [],
    });
    page.on('crash', () => {
        colgada = mensajeColgada(page.url(), pasoActual(page));
        salir(colgada, CODIGOS.PAGINA_COLGADA);
    });
    page.on('response', (r) => { if (r.status() >= 500)
        registrar5xx(page, r.request().method(), r.url(), r.status()); });
    mkdirSync(base, { recursive: true });
    await grabarAcciones(contexto, page);
    const cerrar = async (declaracion) => {
        try {
            await cerrarRecetas(page, declaracion);
        }
        catch (e) {
            console.error(`AVISO: no se pudo revisar las recetas: ${e.message}`);
        }
        const n5 = estado(page).errores5xx.length;
        if (n5)
            console.error(`AVISO_5XX: ${n5} respuesta(s) 5xx del servidor en esta corrida (detalle en informe.md y manifest.json)`);
        escribirInforme(page);
        try {
            await c.adaptadores.publicacion.publicar(base, ticket);
        }
        catch (e) {
            console.error(`AVISO: publicación: ${e.message}`);
        }
        const e = estado(page);
        contar((u) => {
            u.ids.push(ticket);
            u.casos.ok += e.casos.filter((x) => x.ok).length;
            u.casos.falla += e.casos.filter((x) => !x.ok).length;
            u.capturas += e.fotos.length;
            u.errores5xx += e.errores5xx.length;
        });
        soltar();
        await b.close();
    };
    return { page, cerrar };
}
