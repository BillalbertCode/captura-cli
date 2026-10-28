import type { AppConfig } from './adaptadores/contrato.js';
export type RefAdaptador = string | ({
    usa: string;
} & Record<string, unknown>);
export type Extra = 'correo';
export declare const EXTRAS: readonly Extra[];
export interface Config {
    viewport: {
        width: number;
        height: number;
    };
    sesionMin: number;
    apps: Record<string, AppConfig>;
    id: {
        patron: string;
        mayusculas: boolean;
    };
    credenciales: {
        archivo: string;
        prefijo: string;
        alias: Record<string, string>;
    };
    rutas: {
        salidas?: string;
        recetas?: string;
        helpers?: string;
        escenarios?: string;
        sesiones?: string;
    };
    adaptadores: Partial<Record<'credenciales' | 'identificador' | 'entorno' | 'publicacion' | 'correo', RefAdaptador>>;
    extras: Extra[];
    /** Comandos de solo lectura que deben pasar antes de abrir la app (VPN, base, servicios). */
    precondiciones: string[];
    /** Hook de cierre del plugin: exige evidencia si en el turno se tocó la interfaz. Apagado por defecto. */
    evidencia: {
        hook: boolean;
        patrones: string[];
        horas: number;
    };
}
export declare const DEFECTO: Config;
export declare class ConfigInvalida extends Error {
}
/** Mezcla el JSON del proyecto sobre los valores por defecto, validando la forma de cada clave. */
export declare function normalizar(crudo: unknown, archivo: string): Config;
/** Lee el config si existe; sin archivo, los valores por defecto. `base` es la carpeta para resolver rutas. */
export declare function leerConfig(archivo: string | null): {
    cfg: Config;
    base: string | null;
};
