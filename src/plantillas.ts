// Plantillas de `captura-cli adaptador nuevo <tipo>`: un adaptador mínimo que ya cumple el contrato y que
// `captura-cli adaptadores verificar` acepta tal cual. JavaScript plano (.mjs): corre sin compilar.
import type { TipoAdaptador } from './adaptadores/contrato.js'

const cabecera = (tipo: TipoAdaptador, que: string): string => `// Adaptador de ${tipo} (contrato 1): ${que}
// Guía: https://github.com/BillalbertCode/captura-cli/blob/main/docs/adaptadores.md
// Se declara en captura.config.json: "adaptadores": { "${tipo}": { "usa": "./adaptadores/${tipo}.mjs", ...opciones } }
// Comprobar: captura-cli adaptadores verificar
`

export const PLANTILLAS: Record<TipoAdaptador, string> = {
  credenciales: `${cabecera('credenciales', 'usuario y clave de cada rol.')}
// resolver() es SÍNCRONO. Si falta algo, devolver { faltan, donde }: la herramienta sale con FALTAN_CREDENCIALES
// (código 3) y nombra esas variables. Nunca adivinar ni pedir por teclado.
export default {
  contrato: 1,
  tipo: 'credenciales',
  crear(opciones, contexto) {
    const prefijo = opciones.prefijo ?? 'MI_PROYECTO_'
    const nombre = (rol) => rol.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    return {
      resolver(rol, app) {
        const R = nombre(rol)
        const vu = \`\${prefijo}\${R}_USUARIO\`, vc = \`\${prefijo}\${R}_CLAVE\`
        const usuario = process.env[vu], clave = process.env[vc]
        if (!usuario || !clave) return { faltan: [...(usuario ? [] : [vu]), ...(clave ? [] : [vc])], donde: 'las variables de entorno' }
        // letra/numero: solo si el login parte el usuario en dos campos (p. ej. A-12345).
        return { usuario, clave, letra: usuario.match(/^[A-Za-z]/)?.[0] ?? '', numero: usuario.replace(/^[A-Za-z]-?/, '') }
      },
    }
  },
}
`,
  identificador: `${cabecera('identificador', 'formato del id de cada corrida y nombre de su carpeta.')}
export default {
  contrato: 1,
  tipo: 'identificador',
  crear(opciones) {
    const patron = new RegExp(opciones.patron ?? '^TAREA-\\\\d+$', 'i')
    return {
      // null si es válido; si no, el mensaje que verá el agente.
      validar: (id) => (patron.test(id ?? '') ? null : \`id requerido, formato \${patron.source} (recibido: "\${id ?? ''}")\`),
      carpeta: (id) => id.toUpperCase(),
    }
  },
}
`,
  entorno: `${cabecera('entorno', 'levantar, ver y parar los servicios de la app, y la URL de cada slot.')}
// Un slot es un número que aísla una corrida de otra (varios agentes a la vez). La herramienta solo pasa el número;
// qué significa (puertos, otra base, otra caché) lo decide este adaptador. parar() cierra SOLO lo del slot propio.
// contexto.dirSlot es la carpeta del slot en el almacén: ahí se puede guardar el registro de lo que se levantó.
export default {
  contrato: 1,
  tipo: 'entorno',
  crear(opciones, contexto) {
    const paso = opciones.puertoPorSlot ?? 100
    return {
      url(app, cfg, slot) {
        if (!slot) return cfg.baseUrl
        const u = new URL(cfg.baseUrl)
        u.port = String(Number(u.port || 80) + paso * slot)
        return u.origin
      },
      // Opcionales: si faltan, \`captura-cli entorno <comando>\` dice que este adaptador no lo implementa.
      async levantar(app, { slot, args }) { return { ok: true, salida: \`(nada que levantar para \${app} en el slot \${slot})\` } },
      async estado({ slot }) { return { ok: true, salida: \`slot \${slot}: sin servicios registrados\` } },
      async parar(app, { slot }) { return { ok: true, salida: \`slot \${slot}: nada que parar\` } },
    }
  },
}
`,
  publicacion: `${cabecera('publicacion', 'subir lo que dejó la herramienta (publicar/, informe.md, manifest.json).')}
// Se llama al cerrar, después de escribir el informe. Un error aquí no cambia el código de salida: se avisa.
// manifest.json trae cada captura con su ruta en publicar/ y su sha256.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export default {
  contrato: 1,
  tipo: 'publicacion',
  crear(opciones) {
    return {
      async publicar(carpeta, id) {
        const m = JSON.parse(readFileSync(join(carpeta, 'manifest.json'), 'utf8'))
        for (const c of m.capturas) console.log(\`publicar \${id}: \${join(carpeta, c.publicar)} (\${c.leyenda})\`)
      },
    }
  },
}
`,
  correo: `${cabecera('correo', 'leer correos de prueba (solo lectura).')}
// Si falta configuración, lanzar un error con name 'FaltaConfiguracion': la herramienta sale con código 3.
export default {
  contrato: 1,
  tipo: 'correo',
  crear(opciones) {
    const url = () => opciones.url ?? process.env.MI_CORREO_URL
    return {
      url,
      async buscar({ buscar, destinatario, asunto }) {
        if (!url()) throw Object.assign(new Error('definir MI_CORREO_URL o adaptadores.correo.url'), { name: 'FaltaConfiguracion' })
        return [] // [{ id, asunto, para: [], fecha, adjuntos: [{ nombre, tipo, bytes }] }]
      },
    }
  },
}
`,
}
