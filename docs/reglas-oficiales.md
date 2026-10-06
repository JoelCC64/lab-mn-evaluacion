# Reglas oficiales y decisiones (resumen del §1 del plan, con su fuente)

Abreviaturas de las fuentes:
- **LE-VF:** Lineamientos estudiantes VF (Clásica).
- **LE-SQI:** Lineamientos estudiantes SQI.
- **LP:** Lineamientos profesores VF.
- **Intro-T / Intro-SQI:** presentaciones 2026B de introducción.
- **Plan:** Planificación 2026B, hoja de estudiantes A.
- **Joel:** decisiones del 1 al 3 de octubre de 2026.

Si llega un documento oficial nuevo que contradiga algo de aquí, se pregunta a Joel antes de cambiar la app.

## Antes de la clase

| Regla | Fuente | En la app |
|---|---|---|
| Guía y coloquio se publican el miércoles anterior a las 13:00; el coloquio cierra a las 23:55 del día anterior y se aprueba con 100 % (máx. 5 intentos) | LE-VF, LE-SQI | Fuera de la app |
| Requisitos de ingreso en ambas metodologías: coloquio al 100 % y trabajo preparatorio | LE-VF, LE-SQI; Joel | `config/trabajo-preparatorio.json` |
| El preparatorio se califica solo en Clásica (escala 0/1/2; solo se verifica que hicieron el resumen) | Joel | `califica.TRAD = true`, `califica.SQI = false` |
| Revisión en la puerta: todos cumplen por defecto y solo se anotan novedades; la nota (2) se calcula al cerrar el pase; quien falta, 0; sin revisión, pendiente | Joel (3-oct) | Pantalla «Puerta»; motor |

## Asistencia

| Regla | Fuente | En la app |
|---|---|---|
| Tolerancia de 10 minutos (30 solo en la semana 2 para matrícula extraordinaria) | LE-VF, LE-SQI | `config/asistencia.json` (informativo) |
| El pase se hace al final de la clase, grupo por grupo, al revisar y firmar el trabajo | Joel | Pantalla del grupo |
| Quien falta pierde todas las calificaciones de esa actividad: no vino, no fue admitido o salió tras el control; incluye el preparatorio y, en SQI, el TC de esa práctica | LE-VF §3; LE-SQI §6–9; Joel | Motor: elegibilidad |
| Excepciones: recuperación por falta justificada y feriado | LE-VF §13–14; LE-SQI §14–15 | Motor y pantallas de recuperación (Fase 6) |

## Control oral

| Regla | Fuente | En la app |
|---|---|---|
| Al inicio, preguntas sobre la guía y el coloquio a 3 o 4 estudiantes al azar | LP §18; Joel | `config/control-oral.json`; pantalla «Control» |
| Todos con al menos un control por bimestre, entre prácticas y talleres | Joel | Indicador de cobertura |
| Con nota solo en Clásica (0/1/2 por pregunta, hasta 3 preguntas); en SQI, aprobado o no | Joel | Motor |
| Si el estudiante no está preparado, el profesor le pide que salga: pierde la actividad | LP §18 | «Salió» = falta. **Por defecto** cuenta como control con nota 0 (`salio.cuenta_como_control`) |

## Prácticas

| Regla | Fuente | En la app |
|---|---|---|
| Clásica: diseño 20 %, toma de datos 30 % y análisis 50 % dentro de 3.5 (B1) o 3.0 (B2) | LE-VF | `config/esquemas/TRAD_B*.json` |
| Clásica: escala 0–4 por sección; el análisis es una sola sección; todas las prácticas pesan igual | Joel | `config/actividades/P1-TRAD.json` |
| SQI: aspectos objetivos 0–3 y discusión 0–2 (desde el 6-oct-2026; los lineamientos usan 2/1/0 y 1/0, más cerrados); comunicación y colaboración no se usa (decisión del profesor); qué aspectos aplican depende de la práctica | LE-SQI; Intro-SQI; decisión del profesor | `config/sqi/` |
| SQI: nota = puntos / máximo de los aspectos aplicables; luego ponderación interna y valor del componente | LE-SQI (confirmado) | Motor |
| Notas de práctica grupales, replicadas a cada integrante presente | LE-VF, LE-SQI | Motor: replicación |
| Si el grupo no desmonta y guarda el equipo, puede recibir 0 en la práctica (a criterio del profesor) | LE-VF §1; LP §15 | Botón «Penalización total» con motivo |

## Talleres (Fase 4)

| Regla | Fuente | En la app |
|---|---|---|
| 50 % asistencia y permanencia (individual) + 50 % evaluación integral (grupal) | LP §19; Intro | `config/actividades/T1.json` |
| No hace falta terminar el taller en clase | Intro | `exige_terminar_taller: false` |
| Al inicio, retroalimentación corta de la práctica anterior | LP §19 | Fase 4 |
| Todos los talleres pesan igual | LE-VF, LE-SQI | Esquemas |

## Trabajos en casa SQI (Fase 5)

| Regla | Fuente | En la app |
|---|---|---|
| Sobre 10 con rúbrica oficial por pregunta (Tablas 4–9) | LE-SQI §10, §12 | `config/actividades/TC*-SQI.json` |
| Por grupo hasta nuevo aviso, registrados pregunta por pregunta | Joel | `unidad_calificacion: grupo` |
| Sin penalización por entrega tardía | Joel | `entrega_tardia: sin_penalizacion` |
| El TC6 no tiene nota (se evalúa en P7) | LE-SQI | `sin_nota: true` |
| Quien faltó a la práctica no recibe la nota del TC de su grupo | Joel | Motor (Fase 5) |
| «No entregó» = 0 | LE-SQI | Pantalla del TC (Fase 5) |

## Notas del bimestre

| Regla | Fuente | En la app |
|---|---|---|
| El laboratorio vale 6 de 20 en cada bimestre | LE-VF, LE-SQI | `total: 6` en los esquemas |
| Clásica: PyC 1.5 + diseño, datos y análisis 3.5/3.0 + talleres 1 + PLIC 0/0.5 | LE-VF | Esquemas TRAD |
| PyC = 40 % preparatorio + 60 % control; con varios controles, el promedio; sin control al cierre, solo preparatorios con observación | Joel; plan §9.2 | `config/planificacion-conocimiento.json` |
| SQI B1: prácticas 3 (20/30/50) + TC 2 (40/25/35) + talleres 1 | LE-SQI | Esquema SQI_B1 |
| SQI B2: prácticas 3 (20/20/20/40) + TC 1.5 (20/30/50) + talleres 1 + PLIC 0.5 | LE-SQI | Esquema SQI_B2 |
| El bimestre se asigna por actividad, no por fecha (P4 y T4 de la semana 9 cuentan en el 2.º) | LP, Tablas 3 y 4; Plan | Esquemas |
| Feriado: la actividad perdida no cuenta y se renormaliza; si el estudiante la recupera, cuenta para él | LE-SQI §15; LE-VF §14; Joel | Motor; calendario |
| PLIC: 0.5 si lo completa de forma individual, íntegra y reflexiva; 0 si no. Examen presencial controlado por un profesor, jueves 21-ene-2027, 11:00–13:00 | LE-VF, LE-SQI; LP §16; Joel | Fase 6 |
| Redondeo a 2 decimales (1.125 → 1.13) | Joel | `redondear()` |
| Joel no penaliza entregas tardías | Joel | — |

## Recuperaciones (Fase 6)

| Regla | Fuente |
|---|---|
| Falta justificada (Bienestar Estudiantil): pedir la recuperación dentro de 72 h y al menos 24 h antes de la sesión, con evidencia y coloquio al 100 % | LE-VF §13; LE-SQI §14 |
| Si no asiste a la recuperación programada: 0 | LE-VF; LE-SQI |
| El profesor que recibe la recuperación envía la nota al profesor del estudiante y al estudiante en 24 h | LP §10 |

En la app:
- **Estudiantes del curso que recuperan en otra sesión:** se registra la recuperación (solicitada, realizada con su nota o «no asistió» = 0). Mientras está solicitada, la nota queda pendiente. Si la realizó, el preparatorio de la sesión que faltó no entra en su promedio.
- **En un feriado,** recuperar es opcional: solo cuenta si la realizó.
- **Estudiantes de otros docentes que recuperan aquí:** se agregan al grupo con código y nombre, se califican con su grupo y la app arma el texto con la nota para su profesor. No van al Excel ni a coordinación.

## Calendario 2026B

| Regla | Fuente | En la app |
|---|---|---|
| 19 semanas: 28-sep-2026 al 5-feb-2027; cronogramas A y B por metodología | Intro-T, Intro-SQI | `config/cronogramas/` |
| Feriados: 9-oct; Integración Politécnica 13–16 oct (solo 07–09 y 14–16); 2 y 3 nov; 7 dic; 24 y 25 dic; receso 28-dic a 1-ene | Plan | `config/semestre-2026B.json` |
| Envío de notas a coordinación: 1-dic-2026 (B1) y 29-ene-2027 (B2) | Plan; LP §17 | `envio_notas` |
| Archivo para coordinación: APELLIDOS Y NOMBRES (una columna, decisión de Joel), NÚMERO ÚNICO, NOTA(/6), PROFESOR | LP §17; Joel | `formato_coordinacion` |

## Datos de los estudiantes

| Regla | Fuente | En la app |
|---|---|---|
| La nómina oficial es la fuente de verdad del código y del nombre | Joel | Se lee del Excel, ya corregido con la nómina |
| Quien no consta en la nómina queda pendiente hasta la lista final; se evalúa igual y se marca aparte | Joel | `estado: pendiente` |
| Se guardan códigos y nombres, nunca correos | Joel | Prueba automática |
