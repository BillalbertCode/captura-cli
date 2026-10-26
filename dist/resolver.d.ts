interface ContextoResolucion {
    conditions: string[];
    importAttributes: Record<string, string>;
    parentURL?: string;
}
interface Resultado {
    url: string;
    format?: string;
    shortCircuit?: boolean;
}
type Siguiente = (especificador: string, contexto: ContextoResolucion) => Promise<Resultado>;
/** `raiz` es la carpeta del paquete instalado (la que tiene package.json y dist/). */
export declare function initialize(datos: {
    raiz: string;
}): void;
export declare function resolve(especificador: string, contexto: ContextoResolucion, siguiente: Siguiente): Promise<Resultado>;
export {};
