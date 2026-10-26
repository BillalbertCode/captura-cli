/** Estimación de tokens de un texto (≈ 4 caracteres por token; el transcrito da los reales). */
export declare const tokensEstimados: (caracteres: number) => number;
export interface Contadores {
    recetas: {
        yaEstaba: number;
        ejecutada: number;
        rota: number;
        creadas: number;
        candidatas: number;
    };
    casos: {
        ok: number;
        falla: number;
    };
    capturas: number;
    errores5xx: number;
    ids: string[];
}
/** Empieza a medir este proceso. Una sola vez; los comandos internos (hook, stats) no se miden. */
export declare function iniciarLibro(comando: string, script?: string): void;
/** Suma a los contadores de esta corrida (si se está midiendo). */
export declare function contar(f: (c: Contadores) => void): void;
/** Para la API: el nombre del script que la importó. */
export declare const nombreScript: () => string;
