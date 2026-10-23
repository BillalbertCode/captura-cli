import { type Fabrica } from '../contrato.js';
export declare class CorreoSinConfigurar extends Error {
    readonly variable: string;
    constructor(variable: string);
}
declare const fabrica: Fabrica<'correo'>;
export default fabrica;
