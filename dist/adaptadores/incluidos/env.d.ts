import type { Fabrica } from '../contrato.js';
export declare const normalizarRol: (rol: string) => string;
export declare function leerDotenv(archivo: string): Record<string, string>;
declare const fabrica: Fabrica<'credenciales'>;
export default fabrica;
