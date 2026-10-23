// Contrato de adaptadores, versión 1. Un adaptador es un módulo cuyo `default` es una FÁBRICA:
//   export default { contrato: 1, tipo: 'credenciales', crear(opciones, contexto) { return { resolver(rol, app) {…} } } }
// El núcleo valida la fábrica (contrato y tipo) y la instancia (métodos obligatorios) antes de usarla.
export const CONTRATO = 1;
export const TIPOS = ['credenciales', 'identificador', 'entorno', 'publicacion', 'correo'];
const METODOS = {
    credenciales: { obligatorios: ['resolver'], opcionales: [] },
    identificador: { obligatorios: ['validar', 'carpeta'], opcionales: [] },
    entorno: { obligatorios: ['url'], opcionales: ['levantar', 'estado', 'parar'] },
    publicacion: { obligatorios: ['publicar'], opcionales: [] },
    correo: { obligatorios: ['buscar', 'url'], opcionales: [] },
};
const esObjeto = (x) => typeof x === 'object' && x !== null;
/** Valida la fábrica exportada por un módulo. Devuelve la lista de problemas (vacía si está bien). */
export function validarFabrica(x, tipo) {
    if (!esObjeto(x))
        return ['el módulo no exporta por defecto un objeto { contrato, tipo, crear }'];
    const p = [];
    if (x['contrato'] !== CONTRATO) {
        p.push(x['contrato'] === undefined
            ? `falta "contrato: ${CONTRATO}"`
            : `declara contrato ${String(x['contrato'])} y esta versión de captura-cli usa el ${CONTRATO}; ver docs/adaptadores.md («Versiones del contrato»)`);
    }
    if (x['tipo'] !== tipo)
        p.push(`declara tipo "${String(x['tipo'])}" y se usa como "${tipo}"`);
    if (typeof x['crear'] !== 'function')
        p.push('falta la función crear(opciones, contexto)');
    return p;
}
/** Valida la instancia que devolvió crear(). */
export function validarInstancia(x, tipo) {
    if (!esObjeto(x))
        return ['crear() no devolvió un objeto'];
    const { obligatorios, opcionales } = METODOS[tipo];
    const p = obligatorios.filter((m) => typeof x[m] !== 'function').map((m) => `falta el método ${m}()`);
    for (const m of opcionales)
        if (x[m] !== undefined && typeof x[m] !== 'function')
            p.push(`${m} debe ser una función`);
    return p;
}
/**
 * Un adaptador que necesita configuración que falta lanza un error con este nombre; el núcleo sale con
 * FALTAN_CREDENCIALES (código 3) y su mensaje. No hace falta importar nada:
 *   throw Object.assign(new Error('definir MI_URL'), { name: 'FaltaConfiguracion' })
 */
export const FALTA_CONFIGURACION = 'FaltaConfiguracion';
export const esFaltaConfiguracion = (e) => e instanceof Error && e.name === FALTA_CONFIGURACION;
export const sonFaltantes = (c) => 'faltan' in c;
