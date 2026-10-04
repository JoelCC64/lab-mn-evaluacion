# Modelo de datos

Ajuste del modelo sugerido en el §4 del plan. Rige desde la Fase 1.

## Qué se guarda y qué se calcula

| Qué | Dónde vive | Notas |
|---|---|---|
| Cursos, calendario, feriados, esquemas de nota, rúbricas, etiquetas, preguntas | `/config` (viaja con la app) | Nunca en el código ni en la base de datos. Se valida con `npm run config`. |
| Eventos (una actividad de un curso) | **Se calculan** desde la configuración (`src/nucleo/calendario.js`) | Id estable `PARALELO:CÓDIGO`: `GR2QB:P1`, `GR1AA:TC1`, `GR2QB:INTRO`, `GR2QB:PLIC`. Solo se guardan sus cambios manuales (`cambios_evento`). |
| Estudiantes | Base local (IndexedDB) | Se leen del Excel del semestre. |
| Todo lo registrado en clase o fuera de ella | Base local (IndexedDB, con Dexie) | Una base por semestre: `lab-mn-2026B`. |
| Notas | **Se calculan** con el motor (`src/nucleo/motor.js`) | Nunca se guardan notas derivadas; así un cambio (un pase corregido, un ajuste) se refleja en todo. |

Cambios respecto al §4:
- **Eventos calculados.** Antes eran una tabla `events`; así no hay que mantenerla sincronizada con el calendario. Los cambios manuales de estado van en `cambios_evento`.
- **Cursos en la configuración.** Antes eran una tabla `courses`.
- **Nombre completo en un solo campo.** `apellidos` y `nombres` desaparecen por la decisión de Joel de no separarlos.
- **Control oral en una fila por estudiante y evento,** con la lista de puntajes de las preguntas (hasta 3).
- **Pase cerrado.** Se agregó la tabla `pases` para saber si el pase del evento se cerró.

## Tablas

Claves entre corchetes: compuestas. Todas las tablas de registro llevan `fecha` (ISO, momento del último cambio).

| Tabla | Clave | Campos | Para qué | En el plan (§4) |
|---|---|---|---|---|
| `estudiantes` | `id` (= código único) | `codigo`, `nombre` (apellidos y nombres, sin separar), `curso`, `estado` (`nomina` · `pendiente` · `baja`), `grupo_excel`, `observacion_excel` (solo lectura), `numero` (N° en el Excel), `actualizado` | Lista de cada curso | `students` |
| `grupos_evento` | `[evento+estudiante]` | `grupo` (texto, o `null` = sin grupo) | Grupos del evento (ver abajo) | `event_groups` |
| `asistencia` | `[evento+estudiante]` | `estado` (`presente` · `no_vino` · `salio` · `se_retiro_antes`), `motivo`, `observacion` | Pase final por grupo, observaciones por estudiante y faltas anotadas antes del pase (no ingresa, salió) | `attendance` |
| `pases` | `evento` | `cerrado`, `cerrado_en` | Pase cerrado: sin pase cerrado no se calculan notas | (nuevo) |
| `revisiones_grupo` | `[evento+grupo]` | `verificado` (integrantes revisados), `trabajo_firmado`, `penalizacion_total`, `motivo_penalizacion` | Cierre del trabajo de cada grupo | `group_checks` |
| `puntajes` | `[evento+grupo+aspecto]` | `valor` | Un puntaje por grupo, evento y aspecto o criterio (formato largo) | `group_scores` |
| `etiquetas` | `[evento+grupo+etiqueta]` | | Etiquetas rápidas marcadas a un grupo | `tags_applied` |
| `notas` | `[evento+unidad+unidad_id]` | `unidad` (`grupo` · `estudiante`), `texto` | Nota del profesor, escrita o dictada | `notes` |
| `controles` | `[evento+estudiante]` | `estado` (`sorteado` · `respondio` · `no_esta` · `salio`), `puntajes` (lista 0/1/2, Clásica), `aprobado` (SQI), `orden`, `manual` | Control oral | `oral_control` |
| `revision_preparatorio` | `evento` | `revisada` | «Revisión hecha: todos cumplieron» | `prep_review` |
| `novedades_preparatorio` | `[evento+estudiante]` | `nivel` (1 incompleto · 0 no lo hizo · `null` en SQI), `no_ingresa`, `observacion` | Solo las excepciones de la revisión en la puerta | `prep_novedades` |
| `ajustes` | `[evento+estudiante]` | `valor` (0–1), `motivo` (obligatorio) | Ajuste individual explícito de la nota del evento | `overrides` |
| `retroalimentaciones` | `[evento+grupo]` | `dada` | Retroalimentación de la práctica anterior dada en el taller (`evento` = el taller; `grupo` = el de la práctica). Desde la versión 2 de la base (Fase 4) | (nuevo) |
| `trabajos_casa` | `[evento+unidad+unidad_id]` | `unidad` (`grupo` · `estudiante`, según `unidad_calificacion` del TC), `unidad_id` (número de grupo o código), `entregado`, `puntajes` (`{ pregunta: puntos }`), `etiquetas` (ids de la configuración) | TC de SQI pregunta por pregunta. `entregado: false` vale 0 y conserva los puntajes por si fue un toque equivocado. Desde la versión 3 de la base (Fase 5) | `homework` |
| `cambios_evento` | `evento` | `estado` (`sin_clase` · `normal`), `motivo` | Cambios manuales del calendario (clase suspendida, semana 1 sin clase) | `events.estado` |
| `importaciones` | autoincremental | `tipo` (`excel_semestre` · `asistencia_semana1` · `respaldo`), `archivo`, `resumen` (solo conteos) | Historial de lecturas del Excel y de restauraciones | (nuevo) |
| `meta` | `clave` | `valor` | Datos sueltos: último respaldo, versión del modelo | (nuevo) |

El motor de notas ya sabe leer `recuperaciones` y `plic` si existen; sus pantallas y tablas llegan en la Fase 6.

**Versiones de la base** (`VERSION_BASE` en `src/db.js`). Una versión nueva solo agrega tablas o índices; Dexie actualiza la base del dispositivo al abrirla, sin perder datos. Una prueba lo comprueba.
- 1: Fases 1 a 3.
- 2: Fase 4, con la tabla `retroalimentaciones`.
- 3: Fase 5, con la tabla `trabajos_casa`.

Fases siguientes: `plic` y `recuperaciones` (Fase 6).

**Lo último que se escribió en el Excel** (`excel_writes` en el §4) no va en la base: va en la hoja oculta «_app» del propio Excel (ver `docs/excel.md`). Así viaja con el archivo y no se pierde cuando la Mac importa un respaldo del iPhone, que reemplaza toda la base.

**Datos solo de este dispositivo** (base aparte `lab-mn-2026B-local`, que no va en el respaldo):
- La carpeta del Excel elegida en Chrome.
- El último respaldo importado.
- El registro de escrituras en el Excel (solo conteos).

## Reglas del modelo

- **Todo se enlaza por el código único.** El nombre solo se muestra y se exporta; quitarlo más adelante no rompe nada.
- **Nunca se guardan correos.** El lector del Excel no lee la columna de correo. Una prueba automática recorre toda la base y comprueba que ningún valor contenga «@».
- **Guardado inmediato:** cada toque escribe su fila. No hay botón «guardar».
- **Faltas registradas antes del pase.** «No ingresa» (preparatorio) y «salió» (control) se escriben en `asistencia` en el momento. El pase final las muestra ya marcadas.
- **Pase completo al cerrar.** Mientras el pase está abierto, en `asistencia` solo hay excepciones («no vino», «se retiró antes», «no ingresa», «salió») y observaciones. Al cerrar el pase, la app escribe una fila por estudiante:
  - Quien está en un grupo y no tiene falta queda presente.
  - Quien no quedó en ningún grupo queda como «no vino», con el motivo «sin grupo al cerrar el pase»; la app lo confirma antes.
  Así, un estudiante agregado después, por ejemplo por un cambio de nómina, no recibe notas de un evento al que no consta que asistió: queda «no consta en el pase» hasta que Joel lo registre.

**Grupos de un evento:**
- Si el evento tiene instantánea en `grupos_evento`, se usa esa.
- Si no, se toma la del evento anterior más cercano del curso que la tenga.
- Si no hay ninguna, se usan los grupos del Excel (`grupo_excel`).

La instantánea se crea la primera vez que se registra algo de grupo en el evento: un puntaje, el pase de un grupo o un cambio de grupo. Desde ahí las notas de ese evento ya no cambian si después se mueven estudiantes en otro evento. Un cambio de grupo pasa a los eventos siguientes que aún no tienen instantánea.

**Trabajos en casa:**
- Usan los grupos y la asistencia de su práctica (`evento.practica`). Calificar un TC no crea instantánea de grupos: si en la práctica se mueve a alguien, el TC lo sigue.
- La nota del TC (por grupo) se copia a los integrantes que estuvieron en la práctica; quien faltó tiene 0.
- La nota del profesor del TC va en `notas`, con la misma unidad que el TC.

## Respaldo del día (archivo Excel) · desde la versión 0.6.0

El respaldo es **un solo archivo Excel** (`respaldo-lab-mn-2026B-AAAA-MM-DD-HHMM.xlsx`) para subir a Drive cada día:
- **Para leer:**
  - «Léeme», con lo registrado ese día.
  - Una hoja por curso con las mismas columnas que la app escribe en el Excel del semestre.
  - «Asistencia (app)» y «Detalle (app)».
- **Para restaurar:** la hoja muy oculta `_respaldo` guarda el respaldo completo, que es el mismo JSON de abajo. Va partido en celdas de hasta 30 000 caracteres; los emojis y U+FFFE/U+FFFF se guardan como escapes de JSON.

«Restaurar un respaldo…» acepta este Excel y también el JSON de las versiones anteriores. Una prueba comprueba que el Excel guarda exactamente los mismos datos que el JSON.

La app avisa en Inicio cuando hay registros sin respaldar:
- Cada escritura en la base anota la hora en el dispositivo, con un middleware de Dexie (`abrirBase(nombre, { alCambiar })`).
- Exportar el respaldo anota la hora del respaldo.
- Restaurar también la anota, porque los datos quedan iguales a un archivo de respaldo.

## Respaldo (formato JSON)

```json
{
  "formato": "lab-mn-respaldo",
  "version": 1,
  "semestre": "2026B",
  "creado": "2026-10-05T11:02:00.000Z",
  "app": "0.6.0",
  "config": "4dd857fec9e1",
  "tablas": { "estudiantes": [ … ], "asistencia": [ … ], … }
}
```

- Contiene todas las tablas y es el archivo que pasa del iPhone a la Mac.
- Restaurar **reemplaza todo** lo del dispositivo, previa confirmación.
- Un respaldo de una versión anterior de la app (sin alguna tabla nueva) se puede restaurar: la tabla que falta queda vacía. Uno de una versión más nueva, con tablas que esta versión no conoce, se rechaza.
- Nombre del archivo: `respaldo-lab-mn-2026B-AAAA-MM-DD-HHMM.json`.
- Tiene datos de estudiantes: el `.gitignore` impide que entre al repositorio.
