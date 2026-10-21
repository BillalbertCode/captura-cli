# captura-cli

Herramienta de línea de comandos y API de código para agentes de IA que trabajan en una terminal. Deja evidencia
de lo que hizo el agente en el navegador, para que una persona la revise en minutos:

- capturas del viewport con una leyenda y una marca roja **dentro de la imagen**;
- `informe.md`, `casos.json` y `manifest.json` con los casos y su resultado;
- `publicar/`, la única carpeta que se sube a un MR o a un gestor de tareas;
- recetas: tramos de pantalla ya probados que se reutilizan, y borradores de las que faltan.

También corre pruebas de punta a punta bajo pedido a partir de un escenario en JSON.

> Estado: en construcción hacia la 1.0.0. Hoy el repo contiene el contrato (lista de exportaciones) y las pruebas
> de paridad; el núcleo llega en la fase siguiente.

## Instalación

No se publica en npm. Se instala desde GitHub, fijando una etiqueta:

```sh
npx --yes github:billalbertcode/captura-cli#v1.0.0 --help
npm i -g github:billalbertcode/captura-cli#v1.0.0
```

## Principios

- **Agnóstico.** El núcleo no sabe nada de ningún proyecto. Credenciales, formato de id, entorno, publicación y
  correo entran por adaptadores con contrato versionado; los que conocen un proyecto viven fuera de este repo.
- **El repo que se prueba queda limpio.** Las salidas van a `~/.captura-cli/workspaces/<nombre>-<hash>/`, salvo
  que el usuario elija otra ruta.
- **Pensado para agentes.** Códigos de salida estables y mensajes que dicen qué hacer:

| Código | Significa |
|---|---|
| 0 | Todo bien |
| 1 | Cualquier otro error, con el texto exacto |
| 2 | Escenario inválido |
| 3 | `FALTAN_CREDENCIALES`: nombra las variables exactas |
| 4 | `TIMEOUT_GLOBAL`: se superó el tope; navegador cerrado |
| 5 | Hubo tramos sin receta y no se declaró qué pasó |
| 6 | `WORKSPACE_NUEVO`: imprime las preguntas para registrar la carpeta |

## Desarrollo

```sh
npm install
npm run build
npm run test:paridad
```

Ver [test/paridad/README.md](test/paridad/README.md).

## Licencia

MIT
