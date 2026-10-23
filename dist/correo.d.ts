import './iniciar.js';
import { type Correo, type CriterioCorreo } from './adaptadores/contrato.js';
export declare function mailpit(criterio?: CriterioCorreo): Promise<Correo[]>;
export declare const urlMailpit: () => string | undefined;
