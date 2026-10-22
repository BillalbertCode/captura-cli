import { type Registro } from './almacen.js';
/** Esquema de captura.config.json para el editor (autocompletado y validación). */
export declare const ESQUEMA = "https://raw.githubusercontent.com/BillalbertCode/captura-cli/main/schema/captura.config.schema.json";
export declare function mensajeWorkspaceNuevo(raiz: string): string;
export interface OpcionesInit {
    salidas: string;
    proyecto?: string;
    estadisticas?: boolean;
}
/** Registra el workspace. Devuelve el registro y avisos para imprimir (exclusiones de git agregadas). */
export declare function registrar(raiz: string, o: OpcionesInit): {
    registro: Registro;
    avisos: string[];
};
