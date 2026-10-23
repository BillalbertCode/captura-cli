export declare const DIAS_CACHE = 14;
export interface Grupo {
    nombre: string;
    motivo: string;
    archivos: Array<{
        ruta: string;
        bytes: number;
    }>;
    carpetas: string[];
}
export interface OpcionesLimpiar {
    dirWs: string;
    salidas: string;
    antesDias?: number;
    ahora?: number;
    corridaActual?: string;
}
/** Arma el listado de lo que se borraría, por grupo. No toca nada. */
export declare function planificar(o: OpcionesLimpiar): {
    grupos: Grupo[];
    avisos: string[];
};
/** Borra el listado: cada archivo comprobado dentro del almacén; después, las carpetas que quedaron vacías. */
export declare function aplicar(dirWs: string, grupos: Grupo[]): {
    borrados: number;
    bytes: number;
    errores: string[];
};
/** Vence la caché de un slot (más de 14 días). La usa `entorno levantar` para que la caché caduque sola. */
export declare function expirarCache(dirWs: string, dirSlot: string, ahora?: number): {
    borrados: number;
    bytes: number;
};
export declare function formatearPlan(grupos: Grupo[], avisos: string[], aplicado: boolean): string;
