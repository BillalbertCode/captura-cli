export interface Chequeo {
    estado: 'ok' | 'FALTA' | 'AVISO';
    que: string;
    arreglo?: string;
}
export declare function revisar({ instalar }?: {
    instalar?: boolean;
}): Promise<Chequeo[]>;
export declare const formatearChequeos: (cs: Chequeo[]) => string;
