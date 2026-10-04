# Métricas (Fase 8)

El tablero agrega **solo lo registrado** en la app: pases, rúbricas, etiquetas, control oral, preparatorio y TC. Se abre desde **Inicio › Métricas** (todos los cursos) o desde cada curso (**Métricas del curso**).

## Cómo se elige qué ver

- **Cursos:** todos, una metodología (Clásica o SQI) o un curso.
- **Periodo:** 1.er bimestre, 2.º bimestre o semestre. Por defecto, el bimestre en curso.
- **Vista:**
  - **Para presentar** (la de inicio): solo datos agregados, sin nombres ni códigos. Es la única que se exporta.
  - **Profesor (con nombres):** agrega quién falta, quién está en riesgo y los grupos por revisar. No se proyecta ni se exporta.

## Secciones

| Sección | Qué muestra | Cómo se calcula |
|---|---|---|
| Resumen | Cursos, estudiantes, sesiones con pase, asistencia, notas de grupo, TC calificados, controles | Conteos del periodo |
| Antes de leer | Advertencias obligatorias (ver abajo) | Desde la configuración y los cursos del alcance |
| Asistencia por curso, grupo o sesión | Asistencia y permanencia | Asistencia = vinieron (presentes y quienes se retiraron antes) / registrados en el pase. Permanencia = se quedaron hasta el final / vinieron. Solo sesiones con el pase cerrado y estudiantes activos (ni bajas ni visitantes) |
| Asistencia por día y franja | Lo mismo, agrupado por día y franja horaria | Cada franja dice si solo tiene cursos de una metodología |
| Evolución entre eventos | Nota media y asistencia de cada actividad, en orden | Columnas: nota de grupo normalizada (0–100 %) en prácticas y talleres, y la de cada unidad en los TC. Línea: asistencia de la sesión. Cada metodología va en su propio gráfico |
| Rúbricas | Distribución de puntajes por criterio (Clásica), por aspecto (SQI) o de la evaluación integral (talleres), por actividad | Un grupo con penalización total cuenta en la nota media, pero no en la distribución. Los talleres se separan por metodología |
| Etiquetas más marcadas | Proporción de grupos evaluados que recibió cada etiqueta | Prácticas, talleres y TC; verde los aciertos y rojo los errores. Hasta `etiquetas_maximo` |
| TC | Entregas (calificados, no entregaron, por calificar) y promedio de cada pregunta, de la más baja a la más alta | Solo las unidades con alguien presente en la práctica |
| Control oral: cobertura | Estudiantes con al menos un control en el bimestre | Por curso; avisa cuántas sesiones quedan |
| Control oral: resultados | Clásica: respuestas 0/1/2 y puntaje medio. SQI: aprobados. Por concepto, cuando se registró | Ver «Conceptos del control» |
| Trabajo preparatorio (Clásica) | Por sesión: completo, incompleto, no lo hizo y faltó | El promedio, de quienes vinieron |
| Feriados y sesiones sin clase | Sesiones perdidas por curso, recuperaciones y sesiones que quedan para el control oral | «Control oral en 5 de 6 sesiones del B1» |
| Comparación entre cursos | Asistencia, prácticas, talleres, TC, cobertura del control y preparatorio, en % | En el teléfono la tabla omite la metodología y la franja |
| Comparación entre metodologías | Nota de grupo normalizada en **prácticas** y en **talleres** | Nunca la nota total. Siempre con la advertencia de abajo |
| Seguimiento | Conteos de estudiantes y grupos en riesgo | Ver «Riesgo» |

## Advertencias obligatorias

Salen de `config/metricas.json` y la lámina exportada siempre las lleva:
- **Muestras pequeñas:** «unos {n} estudiantes por curso». El número sale de los cursos del alcance.
- **Franjas:** se calcula con los cursos, no está fija. Este semestre dice que la franja 07:00–09:00 solo tiene cursos SQI y que las demás franjas solo tienen cursos de Clásica, así que una diferencia entre franjas puede deberse a la metodología. Solo aparece cuando el alcance tiene las dos metodologías.
- **Metodologías:** las rúbricas, los grupos, los horarios y las condiciones difieren. Es una descripción, no una comparación causal, y solo se comparan notas normalizadas de prácticas y talleres.

## Riesgo (vista del profesor)

Umbrales en `config/metricas.json › riesgo`. Son valores por defecto y se pueden cambiar.

| Quién | Cuándo | Valor por defecto |
|---|---|---|
| Estudiante | Faltas a prácticas o talleres del periodo | 2 o más |
| Estudiante | Rendimiento: lo proyectado sobre lo posible en los componentes con algo evaluado (como «proyectada» en Notas) | Menos del 60 %, desde 2 actividades con nota |
| Estudiante | Sin control oral cuando quedan pocas sesiones del bimestre (el mismo aviso de Notas) | `aviso_cierre_sesiones` de `control-oral.json` |
| Grupo | Promedio de su nota de grupo (por número de grupo) | Menos del 60 %, desde 2 actividades |
| Grupo | Penalización total | Una o más |

En la vista para presentar solo aparecen los conteos.

## Conceptos del control oral

Para ver los resultados del control por concepto, cada práctica o taller puede listar sus conceptos en `conceptos_control`:

```json
"conceptos_control": [
  { "id": "propagacion", "texto": "Propagación en h = g·t²/2" }
]
```

- En la pantalla del control, bajo cada pregunta (Clásica) o bajo «Aprobado / No aprobado» (SQI), aparece un selector **opcional** del concepto. No hace falta tocarlo para calificar.
- Se guarda en `controles.conceptos`, alineado con `puntajes`. Quitar una pregunta también quita su concepto.
- Las respuestas sin concepto se cuentan aparte («N respuestas sin concepto»).
- `npm run config` valida que los ids no se repitan.
- **Estado (4-oct-2026):** tienen conceptos P1 de Clásica y de SQI y T1. Las actividades nuevas (P2, T2, …) los traen con su configuración.

## Exportar

**Exportar para presentar** arma una lámina con las secciones de la vista para presentar:
- **Imagen (PNG):** una sola imagen larga, a doble resolución si cabe; el límite son 16 millones de píxeles, como en el iPhone.
- **PDF:** páginas A4, sin cortar una sección entre páginas. Cada página va como imagen JPEG a unos 220 ppp.

Los gráficos son SVG hechos por la app (`src/nucleo/graficos.js`), sin librerías. En la pantalla siguen el tema claro u oscuro; en la lámina van siempre en claro. En el iPhone, el archivo se prepara y después se comparte con un toque (hoja de compartir); en la Mac se descarga.

Una prueba automática genera el tablero con datos ficticios de varios eventos y comprueba:
- que la lámina tiene las advertencias;
- que no tiene ningún nombre ni código;
- que el PDF es válido.

## Clases ficticias (solo en la demostración)

En la demostración, **Datos › Clases ficticias** simula hasta la semana 5, el 1.er bimestre o todo el semestre. Llena asistencia, preparatorio, control oral (con conceptos), rúbricas, etiquetas y TC en todos los cursos.
- Usa un generador con semilla (`src/datos/simulacion.js`).
- No toca los eventos que ya tienen algo registrado a mano.
- Se niega a trabajar en la base real.
- Solo puntúa las actividades que ya tienen rúbrica (hoy P1, T1 y los TC). En las demás simula la asistencia, el preparatorio y el control.
