import type { Locator, Page } from 'playwright';
import type { AppConfig } from './adaptadores/contrato.js';
export interface Caso {
    nombre: string;
    esperado: string;
    observado: string;
    ok: boolean;
    captura?: string;
}
export interface Cambio {
    que: string;
    revertir?: string;
    revertido?: boolean;
}
export interface DetalleMarca {
    texto: string;
    x: number;
    y: number;
    w: number;
    h: number;
    zona: string;
}
export interface Foto {
    ruta: string;
    paso: number;
    leyenda: string;
    marcada: boolean;
    sinMarca: string;
    marcas: DetalleMarca[];
}
export type Lado = 'abajo' | 'arriba' | 'izq' | 'der' | 'dentro';
export interface Marca {
    locator: Locator;
    texto: string;
    lado: Lado;
    numero: number | undefined;
}
export type Accion = {
    t: 'click';
    sel: string;
} | {
    t: 'fill';
    sel: string;
    valor: string;
} | {
    t: 'select';
    sel: string;
    valor: string;
} | {
    t: 'ir';
    url: string;
} | {
    t: 'receta';
    id: string;
};
export interface Tramo {
    foto: string;
    leyenda?: string;
    url: string;
    marca?: string;
    acciones: Accion[];
}
export interface RecetaUsada {
    id: string;
    version: number;
    modo: 'ya estaba' | 'ejecutada';
}
export interface Declaracion {
    creadas?: string[];
    ninguna?: string;
}
export interface ResumenRecetas {
    usadas: string[];
    creadas: string[];
    ninguna: string;
    pendiente: boolean;
}
export interface Estado {
    id: string;
    dir: string;
    base: string;
    casos: Caso[];
    cambios: Cambio[];
    fotos: Foto[];
    marcas: Marca[];
    grabar: boolean;
    acciones: Accion[];
    tramos: Tramo[];
    recetasUsadas: RecetaUsada[];
    declaracion?: Declaracion;
    recetasResumen?: ResumenRecetas;
    app?: AppConfig;
    appNombre?: string;
    explorado?: {
        ruta: string;
        lineas: Set<string>;
    };
    /** Última acción, para el mensaje de PAGINA_COLGADA y los avisos de 5xx. */
    ultimoPaso: string;
    /** Paso del escenario en curso (`casos[i].pasos[j] (tipo)`): manda sobre ultimoPaso en los avisos. */
    pasoEscenario?: string;
    /** Respuestas 5xx del servidor durante la corrida (para el aviso, el informe y el manifest). */
    errores5xx: Error5xx[];
}
export interface Error5xx {
    metodo: string;
    url: string;
    status: number;
    paso: string;
}
/** Dónde estaba la corrida, para los mensajes: el paso del escenario o la última acción de la API. */
export declare const pasoActual: (page: Page) => string;
/**
 * Una respuesta 5xx del servidor de la app (p. ej. la base sin conexiones): se anota y se avisa con URL, status y
 * paso, una vez por petición y status, para no confundirla con un selector roto. No hace fallar nada por sí sola.
 */
export declare function registrar5xx(page: Page, metodo: string, urlCompleta: string, status: number): void;
export declare function estado(page: Page): Estado;
export declare function crearEstado(page: Page, e: Estado): void;
/**
 * Las recetas de los proyectos leen `page.__app` (p. ej. page.__app.baseUrl): se mantiene visible en la página.
 */
export declare function fijarApp(page: Page, app: AppConfig, nombre: string): void;
