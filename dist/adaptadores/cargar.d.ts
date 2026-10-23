import type { Config, RefAdaptador } from '../config.js';
import { type Adaptadores, type ContextoAdaptador, type TipoAdaptador } from './contrato.js';
export declare const INCLUIDOS: Record<string, unknown>;
export declare class AdaptadorInvalido extends Error {
}
export declare function cargarUno(tipo: TipoAdaptador, ref: RefAdaptador, cfg: Config, ctx: ContextoAdaptador): Promise<unknown>;
export declare function cargarAdaptadores(cfg: Config, ctx: ContextoAdaptador): Promise<Adaptadores>;
