---
name: captura
description: >
  Verifica en el navegador lo que hizo el agente y deja evidencia revisable: capturas del viewport con leyenda y
  marca roja dentro de la imagen, informe.md y manifest.json por id, y pruebas de punta a punta bajo pedido con
  escenarios en JSON. Usa el comando captura-cli. Activar con "sacá capturas", "probalo en el navegador",
  "verificá en pantalla", "dejá evidencia", "prueba de punta a punta" o /captura <id>.
---

# Captura: evidencia y pruebas en el navegador

Comprueba que **la lógica de la tarea funciona en pantalla** y deja evidencia que una persona revisa en minutos. Es
una comprobación puntual (un escenario o un script descartable), no una suite e2e del proyecto, salvo que el usuario
lo pida.

**Barato en tokens:** el éxito se afirma por texto de la página, status HTTP y consultas de solo lectura, **no
mirando imágenes**. Un PNG se abre solo si un caso falla o para validar dónde cayó una marca.

## Reglas que no se rompen

1. **Toda captura lleva leyenda y marca roja.** `foto` exige leyenda y una marca activa; sin marca solo con
   `sinMarca: 'motivo'`, y solo si el usuario la pidió así.
2. **Se sube solo `publicar/`.** Nunca la carpeta cruda; un PNG que no pasó por `foto` no se publica.
3. **No se abren imágenes** salvo que un caso falle: cada marca se describe en texto (posición y contenido).
4. **Credenciales:** si sale `FALTAN_CREDENCIALES` (código 3), pedirle al usuario esas variables exactas y decir
   qué rol hace falta y por qué. Nunca adivinar ni cambiar el rol de nadie.
5. **Escribir datos solo por la UI o la API de la app**, nunca SQL directo; decirlo y esperar el sí del usuario
   antes; anotar cada escritura (`cambio`) y revertir lo reversible.
6. **Nada queda colgado:** todo comando con `timeout`, sin lectores de stdin ni heredocs a intérpretes, en primer
   plano. La herramienta cierra el navegador al fallar, al superar el tope (código 4) o si la página se cuelga (7).
7. **Éxito estricto:** confirmar con `esperarExito` (dentro de avisos y diálogos, texto exacto), nunca con un texto
   suelto de la página.
8. **Esperar por contenido o URL, nunca por tiempo fijo.**
9. **Recetas:** lo ya probado se reutiliza; al cerrar se declaran las creadas o por qué ninguna (si no, código 5).
10. **Servicios ajenos no se tocan:** solo se levanta y se para lo del slot propio.
11. **Las capturas no se commitean** ni se citan en comunicados; para un MR se nombra la ruta o el usuario las adjunta.
12. **Si el hook de cierre pide evidencia** (el turno tocó la interfaz), dejarla; si de verdad no aplica (el cambio
    no se ve en pantalla), terminar la respuesta con una línea `SIN_EVIDENCIA: <motivo>`. Nunca usarla para saltarse
    una verificación que sí corresponde.

## Flujo

1. **Id** de la tarea (de la rama o del MR; si no hay, preguntar). Si sale `WORKSPACE_NUEVO` (código 6), hacerle al
   usuario las preguntas que imprime y ejecutar el `captura-cli init --yes …` que propone (un agente no tiene
   teclado: la herramienta solo le pregunta por sí misma a una persona en una terminal).
2. **Servicios:** `captura-cli entorno estado`; si falta algo, `captura-cli entorno levantar <app>` (ver
   [references/entorno.md](references/entorno.md)). Se dejan arriba al terminar.
3. **Precondiciones** de solo lectura: qué rol, qué datos de prueba, en qué estado. Si falta algo que no se debe
   inventar, parar y pedirlo con el mensaje exacto. ¿La prueba exige cambiar un parámetro, menú o permiso? Ver
   [references/datos.md](references/datos.md).
4. **Recetas:** `captura-cli recetas <app>`. Si el tramo ya es receta, se usa y no se explora.
5. **Explorar con texto:** `captura-cli explorar /ruta --id <id> --rol <rol> [--errores]` (lo interactivo con selectores; con
   `--errores`, campos inválidos y mensajes). El `--id` es el mismo de la tarea: si el proyecto exige un formato de id
   (lo fija `id.patron` en el config), sin id la herramienta lo pide (`--id <id>` o `CAPTURA_ID=<id>`). En una app sin login no hace
   falta `--rol`. Recién con selectores firmes, el escenario o el script.
6. **Capturar y registrar casos:** un escenario (`captura-cli validar` y `run`, ver
   [references/escenarios.md](references/escenarios.md)) o un script con la API
   ([references/api.md](references/api.md)), siempre con `captura-cli script <archivo>` y no con `node` (con la
   herramienta instalada en global, `node` no encuentra el paquete). Una `foto` por momento que importe, no por clic.
   Al repetir la misma tarea, `--limpiar` (en `script` y `run`): si no, quedan las capturas de la corrida anterior y los
   `stepNN` se duplican.
7. **Verificar el efecto** de cada escritura con una consulta de solo lectura.
8. **Reportar:** la tabla de casos de `informe.md`, la carpeta `publicar/` (lo único que se sube) y qué datos quedaron
   cambiados. Nombrar los servicios que quedaron arriba.

## Códigos de salida

| Código | Qué hacer |
|---|---|
| 0 | Reportar |
| 1 | Leer la línea del error; con un caso FALLA, leer el paso, el `diagnostico` y los `!` de errores visibles |
| 2 | Corregir el escenario en los campos que lista (sin abrir el navegador) |
| 3 | Pedir al usuario las variables o la configuración nombradas |
| 4 | El tope se superó: buscar qué espera nunca se cumplió; no reintentar a ciegas |
| 5 | Registrar las recetas que se repetirán o declarar `ninguna` con el motivo |
| 6 | Preguntar al usuario y ejecutar `captura-cli init --yes …` |
| 7 | La página se colgó: reintentar o `--canal msedge` |

Un `AVISO_5XX` es un error de la app o de su entorno (ver su log), no de la prueba: decirlo así en el reporte.

## Referencias

- [references/api.md](references/api.md): la API de código para scripts (sesión, marcas, fotos, informe, esperas, API, correo).
- [references/escenarios.md](references/escenarios.md): escenarios en JSON, pasos y selectores.
- [references/recetas.md](references/recetas.md): recetas, cuándo registrarlas y el cierre obligatorio.
- [references/datos.md](references/datos.md): escribir datos y configurar como admin.
- [references/entorno.md](references/entorno.md): servicios, slots y procesos.
- [references/errores.md](references/errores.md): errores que ya costaron tiempo.
