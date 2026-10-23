export declare const home: () => string;
/** Directorio git común (el de la copia principal aunque se esté en un worktree), o null fuera de git. */
export declare function gitComun(cwd: string): string | null;
/** Raíz del workspace: la copia principal del repo git, o la carpeta actual si no hay git. */
export declare function raizWorkspace(cwd?: string): string;
/** <nombre>-<hash6>: el hash de la ruta absoluta evita mezclar dos repos con el mismo nombre. */
export declare function idWorkspace(raiz: string): string;
export interface Registro {
    version: 1;
    origen: string;
    nombre: string;
    registrado: string;
    ultimoUso: string;
    /** Carpeta donde caen las capturas (una subcarpeta por id). */
    salidas: string;
    /** Carpeta del proyecto: captura.config.json, adaptadores/, recetas/, helpers/, escenarios/. */
    proyecto: string;
    estadisticas: boolean;
}
export interface ConfigUsuario {
    /** Ruta base por defecto para las salidas de cada workspace nuevo (se vuelve a preguntar en cada uno). */
    salidasBase?: string;
}
export declare const dirWorkspace: (raiz: string) => string;
export declare function leerRegistro(raiz: string): Registro | null;
export declare function guardarRegistro(raiz: string, r: Registro): void;
export declare function leerConfigUsuario(): ConfigUsuario;
export declare function guardarConfigUsuario(c: ConfigUsuario): void;
/** Valores que se proponen al registrar un workspace. */
export declare function propuesta(raiz: string): {
    salidasGlobal: string;
    proyecto: string;
    estadisticas: boolean;
};
export declare const dentroDe: (padre: string, hijo: string) => boolean;
/**
 * Si `ruta` cae dentro de un repo git, la agrega a .git/info/exclude (no toca el .gitignore versionado).
 * Devuelve la línea agregada, o null si no hizo falta.
 */
export declare function excluirDeGit(ruta: string): string | null;
