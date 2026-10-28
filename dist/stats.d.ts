import { type Contadores } from './uso.js';
export interface LineaUso extends Contadores {
    fecha: string;
    comando: string;
    script?: string;
    ms: number;
    codigo: number;
    salida: {
        caracteres: number;
        tokens: number;
    };
}
export declare function leerLibro(archivo: string, desde?: number): LineaUso[];
export interface Resumen {
    corridas: number;
    porComando: Record<string, {
        corridas: number;
        tokens: number;
        ms: number;
        codigos: Record<string, number>;
    }>;
    tokens: number;
    recetas: Contadores['recetas'];
    casos: Contadores['casos'];
    capturas: number;
    errores5xx: number;
    /** Corridas por id de tarea: separa lo del workspace de lo de una tarea concreta. */
    porId: Record<string, number>;
}
/** Solo las líneas de una tarea: cada corrida sabe con qué id se abrió (aunque el script fallara). */
export declare function deId(lineas: LineaUso[], id: string): LineaUso[];
export declare function resumir(lineas: LineaUso[]): Resumen;
export declare function formatear(nombre: string, r: Resumen, desde: string): string;
/** Tamaño total y cantidad de archivos de una carpeta (sin seguir enlaces). */
export declare function tamano(dir: string): {
    bytes: number;
    archivos: number;
};
/** Espacio por tipo: capturas, sesiones, caché y temporales (sumando todos los slots). */
export declare function espacio(salidas: string, dirWs: string): string;
export interface ResumenTranscrito {
    respuestas: number;
    tokens: {
        entrada: number;
        cacheCreacion: number;
        cacheLectura: number;
        salida: number;
        total: number;
    };
    herramientas: number;
    resultadosTokens: number;
    captura: {
        llamadas: number;
        tokens: number;
        comandos: Array<{
            comando: string;
            llamadas: number;
            tokens: number;
        }>;
    };
}
/** Lee un transcrito .jsonl de Claude Code. Los tokens reales vienen de `usage` (una vez por requestId). */
export declare function leerTranscrito(archivo: string): ResumenTranscrito;
export declare function formatearTranscrito(archivo: string, r: ResumenTranscrito): string;
