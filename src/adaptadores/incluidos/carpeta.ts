// builtin:carpeta — publicar es dejar todo en <id>/publicar/ (ya lo hace el cierre); no sube nada a ningún lado.
import type { AdaptadorPublicacion, Fabrica } from '../contrato.js'

const fabrica: Fabrica<'publicacion'> = {
  contrato: 1,
  tipo: 'publicacion',
  crear(): AdaptadorPublicacion {
    return { publicar: async () => {} }
  },
}
export default fabrica
