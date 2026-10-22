const avisados5xx = new WeakMap();
/** Dónde estaba la corrida, para los mensajes: el paso del escenario o la última acción de la API. */
export const pasoActual = (page) => {
    const e = estado(page);
    return e.pasoEscenario || e.ultimoPaso || 'abrir la página';
};
/**
 * Una respuesta 5xx del servidor de la app (p. ej. la base sin conexiones): se anota y se avisa con URL, status y
 * paso, una vez por petición y status, para no confundirla con un selector roto. No hace fallar nada por sí sola.
 */
export function registrar5xx(page, metodo, urlCompleta, status) {
    const e = estado(page);
    const url = urlCompleta.split('?')[0] ?? urlCompleta;
    const paso = pasoActual(page);
    e.errores5xx.push({ metodo, url, status, paso });
    const vistos = avisados5xx.get(page) ?? new Set();
    avisados5xx.set(page, vistos);
    const clave = `${metodo} ${url} ${status}`;
    if (vistos.has(clave) || vistos.size >= 10)
        return;
    vistos.add(clave);
    console.error(`AVISO_5XX: el servidor respondió ${status} a ${metodo} ${url} durante ${paso}; es un error de la app o de su entorno (ver su log), no de la herramienta`);
}
const estados = new WeakMap();
export function estado(page) {
    const e = estados.get(page);
    if (!e)
        throw new Error('la página no se abrió con abrir() o sesion() de captura-cli');
    return e;
}
export function crearEstado(page, e) {
    estados.set(page, e);
}
/**
 * Las recetas de los proyectos leen `page.__app` (p. ej. page.__app.baseUrl): se mantiene visible en la página.
 */
export function fijarApp(page, app, nombre) {
    const e = estado(page);
    e.app = app;
    e.appNombre = nombre;
    Object.defineProperty(page, '__app', { value: app, configurable: true, enumerable: false, writable: true });
}
