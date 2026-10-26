// Credenciales, apps, login con sesión guardada y API con la sesión del navegador.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sonFaltantes } from './adaptadores/contrato.js';
import { ctx, hayContexto } from './contexto.js';
import { estado, fijarApp, registrar5xx } from './estado.js';
import { slug } from './fotos.js';
import { abrir } from './navegador.js';
import { listarRecetas } from './recetas.js';
import { CODIGOS, salir } from './salida.js';
/** Apps del config (un script puede registrar otra en memoria: apps.mia = {...}). */
export const apps = {};
// Si falta algo sale con código 3 y dice exactamente qué variables definir; nunca adivina.
export function credenciales(rol) {
    const r = ctx().adaptadores.credenciales.resolver(rol);
    if (sonFaltantes(r))
        return salir(`FALTAN_CREDENCIALES: ${rol} -> definir ${r.faltan.join(', ')} en ${r.donde}, o pedírselas al usuario`, CODIGOS.FALTAN_CREDENCIALES);
    return r;
}
// Login de una app. `campos` ([{selector, valor: usuario|letra|numero|clave}]) permite logins con el documento
// partido; sin `campos` se usan campoUsuario/campoClave.
async function iniciar(page, a, c) {
    if (!a.login || !a.boton || !a.postLogin)
        throw new Error('iniciar(): con login hacen falta login, boton y postLogin en la app');
    await page.goto(a.baseUrl + a.login, { waitUntil: 'domcontentloaded' });
    const campos = a.campos || [{ selector: a.campoUsuario ?? '', valor: 'usuario' }, { selector: a.campoClave ?? '', valor: 'clave' }];
    for (const f of campos)
        await page.locator(f.selector).fill(c[f.valor]);
    await page.getByRole('button', { name: a.boton }).click();
    await page.waitForURL(a.postLogin, { timeout: 45000 });
}
let cargadas = false;
/** Las apps del config se cargan una vez (al importar la API o en el primer uso desde el CLI); las de memoria se suman. */
export function cargarApps() {
    if (cargadas || !hayContexto())
        return;
    cargadas = true;
    for (const [n, a] of Object.entries(ctx().cfg.apps))
        if (!(n in apps))
            apps[n] = a;
}
function elegirApp(app) {
    cargarApps();
    const nombres = Object.keys(apps);
    if (app) {
        if (!apps[app])
            throw new Error(`app desconocida: ${app} (${nombres.join(', ') || 'ninguna declarada en captura.config.json'})`);
        return app;
    }
    if (nombres.length === 1)
        return nombres[0];
    throw new Error(`sesion(): falta { app } (${nombres.join(', ') || 'ninguna declarada en captura.config.json'})`);
}
async function abrirSinLogin(rol, nombre, a, opts) {
    const r = await abrir(opts);
    fijarApp(r.page, a, nombre);
    const e = estado(r.page);
    e.grabar = false; // abrir la app no es parte de ninguna receta
    const destino = a.baseUrl + (a.inicio || '/');
    try {
        await r.page.goto(destino, { waitUntil: 'domcontentloaded' });
    }
    catch (err) {
        await r.cerrar({ ninguna: 'no se pudo abrir la app' }).catch(() => { });
        throw new Error(`sesion(): no se pudo abrir ${destino} (${String(err.message).split('\n')[0]}). ¿Está levantada la app? Ver: captura-cli entorno estado`);
    }
    await r.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { });
    e.grabar = true;
    e.ultimoPaso = `sesion ${nombre} (sin login)`;
    console.log(`sesion: ${nombre} no tiene login; abierta en ${a.inicio || '/'}${rol ? ` (el rol "${rol}" no se usa)` : ''}`);
    console.log(`recetas disponibles de ${nombre} (usar receta(page, id) antes de escribir pasos):`);
    await listarRecetas(nombre);
    return r;
}
// Sesión guardada por app+rol en el almacén del slot (storageState). Se reutiliza si tiene menos de `sesionMin`
// minutos (config, 15 por defecto) y la app no redirige al login; si no, login normal y se vuelve a guardar.
// `reutilizar: false` fuerza login. Cada llamada abre su propio navegador: una sesión por script.
// La URL de la app la da el adaptador de entorno según el slot (CAPTURA_SLOT).
// Una app SIN login (sin `login` en su config) solo se abre en su `inicio`: no hacen falta rol ni credenciales
// (se puede pasar null) y no hay sesión que guardar.
export async function sesion(rol, { app, reutilizar = true, ...opts }) {
    const c = ctx();
    const nombre = elegirApp(app);
    const cfgApp = apps[nombre];
    const a = { ...cfgApp, baseUrl: c.adaptadores.entorno.url(nombre, cfgApp, c.slot) };
    if (!a.login)
        return abrirSinLogin(rol, nombre, a, opts);
    if (!rol)
        throw new Error(`sesion(): la app ${nombre} tiene login; falta el rol, p. ej. sesion('<rol>', { app: '${nombre}' })`);
    const cr = credenciales(rol);
    const f = join(c.rutas.sesiones, `${nombre}-${slug(rol)}.json`);
    const vigente = reutilizar && existsSync(f) && Date.now() - statSync(f).mtimeMs < c.cfg.sesionMin * 60000;
    const r = await abrir({ ...opts, ...(vigente ? { storageState: f } : {}) });
    fijarApp(r.page, a, nombre);
    const e = estado(r.page);
    e.grabar = false; // el login no es parte de ninguna receta
    let ok = false;
    if (vigente) {
        await r.page.goto(a.baseUrl + (a.inicio || '/'), { waitUntil: 'domcontentloaded' });
        await r.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { });
        const campo = (a.campos?.[0]?.selector ?? a.campoUsuario) || '';
        ok = !/sign-in|login/i.test(new URL(r.page.url()).pathname) && (!campo || (await r.page.locator(campo).count()) === 0);
        console.log(ok ? `sesion: reutiliza la guardada de ${rol}@${nombre}` : `sesion: la guardada de ${rol}@${nombre} ya no sirve; login normal`);
    }
    if (!ok) {
        await r.page.context().clearCookies();
        await iniciar(r.page, a, cr);
        mkdirSync(dirname(f), { recursive: true });
        await r.page.context().storageState({ path: f });
    }
    e.grabar = true;
    e.ultimoPaso = `sesion ${rol}@${nombre}`;
    // Catálogo a la vista en cada captura: lo que ya es receta se usa, no se reexplora.
    console.log(`recetas disponibles de ${nombre} (usar receta(page, id) antes de escribir pasos):`);
    await listarRecetas(nombre);
    return r;
}
// ---------- API con la sesión del navegador ----------
// Prueba que el backend también rechaza/acepta lo que la pantalla esconde o permite. La petición sale del contexto
// del navegador (mismas cookies). Si la app declara `cookieSesion`, además se manda esa cookie como Bearer (apps que
// pasan el token por cabecera a través de un proxy).
export async function api(page, metodo, ruta, cuerpo) {
    const e = estado(page);
    const a = e.app;
    if (!a)
        throw new Error('api(): abrir con sesion() para conocer la app');
    const headers = {};
    if (a.cookieSesion) {
        let token;
        for (let i = 0; i < 20 && !token; i++) {
            token = (await page.context().cookies()).find((c) => c.name === a.cookieSesion)?.value;
            if (!token)
                await page.waitForTimeout(250);
        }
        if (!token)
            throw new Error(`api(): no hay cookie de sesión "${a.cookieSesion}" (¿terminó el login?)`);
        headers['Authorization'] = `Bearer ${token}`;
    }
    const url = a.baseUrl + (a.apiBase ?? '') + ruta;
    e.ultimoPaso = `api ${metodo.toUpperCase()} ${ruta}`;
    const r = await page.request.fetch(url, { method: metodo.toUpperCase(), headers, ...(cuerpo !== undefined ? { data: cuerpo } : {}) });
    // page.request no pasa por los eventos de la página: el 5xx se anota aquí.
    if (r.status() >= 500)
        registrar5xx(page, metodo.toUpperCase(), url, r.status());
    const texto = (await r.text()).slice(0, 500);
    if ((r.status() === 401 || r.status() === 403) && !a.cookieSesion && (await page.context().cookies(a.baseUrl)).length === 0) {
        throw new Error(`api(): ${r.status()} y el navegador no tiene ninguna cookie de ${new URL(a.baseUrl).origin} (¿terminó el login?). Si la app pasa el token en una cabecera, declarar apps.<app>.cookieSesion con el nombre de la cookie que lo guarda`);
    }
    console.log(`api ${metodo.toUpperCase()} ${ruta} -> ${r.status()} ${texto.slice(0, 160)}`);
    return { status: r.status(), texto };
}
