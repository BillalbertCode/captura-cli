export declare const CODIGOS: {
    readonly OK: 0;
    readonly ERROR: 1;
    readonly ESCENARIO_INVALIDO: 2;
    readonly FALTAN_CREDENCIALES: 3;
    readonly TIMEOUT_GLOBAL: 4;
    readonly RECETAS_SIN_DECLARAR: 5;
    readonly WORKSPACE_NUEVO: 6;
    readonly PAGINA_COLGADA: 7;
};
type Cierre = () => void;
/** Registra algo que debe cerrarse si el proceso termina (navegadores, carpeta temporal). Devuelve el des-registro. */
export declare function alSalir(fn: Cierre): () => void;
export declare function cerrarTodo(): void;
/** Imprime el mensaje en stderr, cierra todo y termina con el código. */
export declare function salir(mensaje: string, codigo: number): never;
export {};
