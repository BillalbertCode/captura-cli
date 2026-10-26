export interface ResultadoHook {
    salida: string;
    codigo: number;
}
/** Glob simple a expresión regular: `**` cruza carpetas, `*` y `?` no. */
export declare function globARegex(glob: string): RegExp;
/** Archivos del repo cambiados en el turno: sin commitear (mtime) y en commits de las últimas `horas` (hora del commit). */
export declare function cambiosRecientes(raiz: string, horas: number): Map<string, number>;
interface Evidencia {
    id: string;
    cuando: number;
    capturas: number;
    pendiente: boolean;
}
/** La evidencia más reciente del workspace: el manifest.json más nuevo de la carpeta de salidas. */
export declare function ultimaEvidencia(salidas: string): Evidencia | null;
export declare function hookCierre(entrada: string): Promise<ResultadoHook>;
/** inicio (evento SessionStart): una línea de contexto para el agente; nunca falla. */
export declare function hookInicio(entrada: string): Promise<ResultadoHook>;
export {};
