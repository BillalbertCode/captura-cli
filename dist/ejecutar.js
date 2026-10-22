import { patronDe } from './escenario.js';
import { esperarHabilitado, esperarToast, abrirSelectHasta } from './esperas.js';
import { estado } from './estado.js';
import { detectarErrores, diagnostico, esperarExito, esperarTexto, explorar } from './explorar.js';
import { foto } from './fotos.js';
import { cambio, caso } from './informe.js';
import { limpiar, marcar } from './marcas.js';
import { receta } from './recetas.js';
import { CODIGOS } from './salida.js';
import { api, sesion } from './sesion.js';
export function localizar(page, s) {
    const base = s.dentro ? localizar(page, s.dentro) : page;
    const exact = s.exacto ?? false;
    const t = (x) => patronDe(x);
    let l;
    if (s.rol !== undefined)
        l = base.getByRole(s.rol, s.nombre !== undefined ? { name: t(s.nombre), exact } : {});
    else if (s.etiqueta !== undefined)
        l = base.getByLabel(t(s.etiqueta), { exact });
    else if (s.placeholder !== undefined)
        l = base.getByPlaceholder(t(s.placeholder), { exact });
    else if (s.texto !== undefined)
        l = base.getByText(t(s.texto), { exact });
    else if (s.testid !== undefined)
        l = base.getByTestId(s.testid);
    else
        l = base.locator(s.css ?? '');
    return s.n !== undefined ? l.nth(s.n) : l.first();
}
/** Descripción corta de un selector para los mensajes. */
const desc = (s) => {
    const k = ['rol', 'etiqueta', 'placeholder', 'texto', 'testid', 'css'].find((x) => s[x] !== undefined) ?? 'css';
    return `${k}="${s[k]}"${s.nombre ? ` nombre="${s.nombre}"` : ''}${s.dentro ? ` dentro de ${desc(s.dentro)}` : ''}`;
};
async function ejecutarPaso(page, p, ultimaFoto) {
    const base = estado(page).app?.baseUrl ?? '';
    if ('ir' in p) {
        await page.goto(/^https?:/.test(p.ir) ? p.ir : base + p.ir, { waitUntil: 'domcontentloaded' });
        return;
    }
    if ('click' in p) {
        await localizar(page, p.click.en).click();
        return;
    }
    if ('llenar' in p) {
        await localizar(page, p.llenar.en).fill(p.llenar.valor);
        return;
    }
    if ('elegir' in p) {
        const l = localizar(page, p.elegir.en);
        const nativo = await l.evaluate((el) => el.tagName === 'SELECT');
        if (nativo)
            await l.selectOption({ label: p.elegir.opcion });
        else
            await (await abrirSelectHasta(l, patronDe(p.elegir.opcion))).click();
        return;
    }
    if ('esperar' in p) {
        const v = p.esperar;
        await esperarTexto(page, patronDe(typeof v === 'string' ? v : v.texto), typeof v === 'string' ? undefined : v.ms);
        return;
    }
    if ('esperarExito' in p) {
        const v = p.esperarExito;
        if (typeof v === 'string')
            await esperarExito(page, patronDe(v));
        else
            await esperarExito(page, patronDe(v.texto), { ...(v.ms ? { ms: v.ms } : {}), ...(v.dentro ? { dentro: localizar(page, v.dentro) } : {}) });
        return;
    }
    if ('esperarToast' in p) {
        const v = p.esperarToast;
        if (typeof v === 'string')
            await esperarToast(page, patronDe(v));
        else
            await esperarToast(page, patronDe(v.texto), { ...(v.ms ? { ms: v.ms } : {}), ...(v.foto ? { foto: v.foto } : {}), ...(v.leyenda ? { leyenda: v.leyenda } : {}) });
        return;
    }
    if ('esperarHabilitado' in p) {
        await esperarHabilitado(localizar(page, p.esperarHabilitado.en), p.esperarHabilitado.ms);
        return;
    }
    if ('comprobar' in p) {
        const c = p.comprobar;
        const l = localizar(page, c.en);
        if (c.visible !== undefined) {
            const vis = await l.isVisible();
            if (vis !== c.visible)
                throw new Error(`comprobar ${desc(c.en)}: se esperaba ${c.visible ? 'visible' : 'no visible'} y está ${vis ? 'visible' : 'no visible'}`);
        }
        if (c.texto !== undefined) {
            const t = (await l.innerText({ timeout: 5000 })).replace(/\s+/g, ' ').trim();
            const pat = patronDe(c.texto);
            if (!(typeof pat === 'string' ? t.includes(pat) : pat.test(t)))
                throw new Error(`comprobar ${desc(c.en)}: se esperaba el texto "${c.texto}" y dice "${t.slice(0, 120)}"`);
        }
        if (c.habilitado !== undefined) {
            const h = await l.isEnabled({ timeout: 5000 });
            if (h !== c.habilitado)
                throw new Error(`comprobar ${desc(c.en)}: se esperaba ${c.habilitado ? 'habilitado' : 'deshabilitado'} y está ${h ? 'habilitado' : 'deshabilitado'}`);
        }
        return;
    }
    if ('marcar' in p) {
        const m = p.marcar;
        await marcar(page, localizar(page, m.en), m.etiqueta, { ...(m.lado ? { lado: m.lado } : {}), ...(m.numero !== undefined ? { numero: m.numero } : {}) });
        return;
    }
    if ('limpiar' in p) {
        await limpiar(page);
        return;
    }
    if ('foto' in p) {
        const f = p.foto;
        ultimaFoto.ruta = await foto(page, f.descripcion, { leyenda: f.leyenda, ...(f.sinMarca ? { sinMarca: f.sinMarca } : {}), ...(f.completa ? { completa: true } : {}) });
        return;
    }
    if ('cambio' in p) {
        cambio(page, { que: p.cambio.que, ...(p.cambio.revertir !== undefined ? { revertir: p.cambio.revertir } : {}), revertido: p.cambio.revertido ?? false });
        return;
    }
    if ('api' in p) {
        const a = p.api;
        const r = await api(page, a.metodo, a.ruta, a.cuerpo);
        if (a.status !== undefined && r.status !== a.status)
            throw new Error(`api ${a.metodo.toUpperCase()} ${a.ruta}: se esperaba ${a.status} y respondió ${r.status} ${r.texto.slice(0, 160)}`);
        return;
    }
    if ('receta' in p) {
        const v = p.receta;
        await receta(page, typeof v === 'string' ? v : v.id, typeof v === 'string' ? {} : v.args ?? {});
        return;
    }
    if ('explorar' in p) {
        await explorar(page, p.explorar === true ? {} : p.explorar);
        return;
    }
}
const tipoDe = (p) => Object.keys(p)[0] ?? '?';
/** Ejecuta el escenario. Devuelve el código de salida (0, 1 si algún caso falló, o 5 si faltó declarar recetas). */
export async function ejecutarEscenario(esc, o = {}) {
    const { page, cerrar } = await sesion(esc.rol, {
        ticket: esc.id,
        ...(esc.app ? { app: esc.app } : {}),
        ...(o.browser ? { browser: o.browser } : {}),
        ...(o.headless !== undefined ? { headless: o.headless } : {}),
        ...(o.viewport ? { viewport: o.viewport } : {}),
        ...(o.maxMs ? { maxMs: o.maxMs } : {}),
        ...(o.reutilizar !== undefined ? { reutilizar: o.reutilizar } : {}),
    });
    let fallas = 0;
    for (const [i, c] of esc.casos.entries()) {
        console.log(`--- caso ${i + 1}/${esc.casos.length}: ${c.nombre}`);
        const ultimaFoto = {};
        let error = '';
        for (const [j, p] of c.pasos.entries()) {
            const e = estado(page);
            const previos5xx = e.errores5xx.length;
            const donde = `casos[${i}].pasos[${j}] (${tipoDe(p)})`;
            e.pasoEscenario = donde;
            try {
                await ejecutarPaso(page, p, ultimaFoto);
            }
            catch (err) {
                error = `${donde}: ${String(err.message || err).split('\n')[0].slice(0, 300)}`;
                // Si el servidor respondió 5xx durante este paso, probablemente es la causa: se dice en el mismo mensaje.
                const r5 = e.errores5xx.slice(previos5xx);
                if (r5.length)
                    error += ` [el servidor respondió ${r5.map((x) => `${x.status} a ${x.metodo} ${x.url}`).slice(0, 3).join('; ')} durante este paso]`;
                break;
            }
        }
        if (error) {
            fallas++;
            console.log(`  ${error}`);
            await diagnostico(page, { max: 300 }).catch(() => { });
            const err = await detectarErrores(page).catch(() => []);
            err.forEach((l) => console.log(`  ! ${l}`));
            await limpiar(page).catch(() => { });
        }
        caso(page, {
            nombre: c.nombre,
            esperado: c.esperado ?? 'todos los pasos se cumplen',
            observado: error || 'todos los pasos se cumplieron',
            ok: !error,
            ...(ultimaFoto.ruta ? { captura: ultimaFoto.ruta } : {}),
        });
    }
    delete estado(page).pasoEscenario;
    await cerrar(esc.recetas ?? {});
    console.log(`resultado: ${esc.casos.length - fallas} de ${esc.casos.length} caso(s) OK${fallas ? `, ${fallas} FALLA` : ''}`);
    if (fallas)
        return CODIGOS.ERROR;
    return typeof process.exitCode === 'number' ? process.exitCode : CODIGOS.OK;
}
