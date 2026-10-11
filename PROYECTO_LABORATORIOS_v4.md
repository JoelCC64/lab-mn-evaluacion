# Proyecto: App de evaluación y calificaciones para los laboratorios de Mecánica Newtoniana (v4: Clásica + SQI, semestre 2026B)

> Documento de instrucciones para Claude Code. Léelo completo al inicio de cada sesión y trabaja **una fase por sesión**. Al terminar cada fase, actualiza `PROGRESS.md` (qué se hizo, qué falta, decisiones tomadas).
>
> **Esta versión reemplaza a la v3.** Se rehízo con los documentos oficiales del semestre 2026B (§1.1), con lo aprendido en la semana 1 con los cursos reales y con las decisiones de Joel del 2 y 3 de octubre de 2026. La sección 1 recoge las reglas; lo que es propuesta o falta confirmar lo dice el texto. La sección 0 resume los cambios y el Anexo I los detalla con su fuente.

---

## 0. Qué cambia respecto a la v3

**Enfoque.** La app se usa en el aula, desde el iPhone, para tres cosas:
- Evaluar a cada grupo.
- Hacer el control oral.
- Al final de la clase, verificar grupo por grupo quién está (asistencia).

Fuera del aula registra los trabajos preparatorios y los trabajos en casa. Todo termina en el **Excel del semestre que ya existe** (`Cursos_Lab_MN_2026B.xlsx`): la app lee de ahí los estudiantes y los grupos, y escribe ahí la asistencia y las notas, sin tocar nada más del archivo. Así Joel no tiene que buscar grupo por grupo y estudiante por estudiante en un Excel de varias hojas.

1. **Requisitos de ingreso** (las dos metodologías): coloquio al 100 % y trabajo preparatorio (resumen del material, breve investigación, etc.). El preparatorio se califica solo en Clásica.
2. **Asistencia al final de la clase, por grupo.** La app muestra los integrantes de cada grupo y Joel marca a quien falta. **Quien falta pierde las notas de esa actividad**, incluido el trabajo en casa de esa práctica. Cada estudiante tiene además un campo de observaciones (por ejemplo, «está pero no trabaja»).
3. **Control oral aleatorio:** 3 o 4 estudiantes por sesión, en prácticas y talleres, de modo que **cada estudiante tenga al menos un control por bimestre**. Tiene nota solo en Clásica.
4. **Trabajos en casa (SQI):** rúbrica oficial por pregunta sobre 10 (Anexo G), calificados **por grupo** hasta nuevo aviso, registrados **pregunta por pregunta** y **sin penalización por entrega tardía**.
5. **Grupos:** vienen del Excel (se registraron con el QR en la semana 1). En Clásica pueden cambiar: Joel mueve a los estudiantes de grupo en la app, sin volver a usar el QR.
6. **El Excel no se regenera:** la app escribe solo en sus propias columnas y hojas, ubica a cada estudiante por su código y detecta si Joel editó a mano alguna de sus celdas.
7. **Calendario real:** cronogramas A y B de 19 semanas, feriados que hacen perder actividades con nota en 7 de los 10 cursos y fechas de envío de notas (Anexo H). La actividad perdida por feriado no cuenta.
8. **Talleres:** 3 en el 1.er bimestre y 4 en el 2.º. Nota = 50 % asistencia y permanencia (individual) + 50 % evaluación integral (grupal). Al inicio de cada taller se da una retroalimentación de la práctica anterior, construida con lo que la app registró.
9. **Notas de Clásica:**
   - Las prácticas se califican en tres secciones (diseño, toma de datos y análisis) con escala 0–4, y todas pesan igual.
   - Planificación y conocimiento = 40 % trabajo preparatorio + 60 % control oral.
   - Las notas se redondean a 2 decimales.
10. **PLIC:** examen presencial controlado por un profesor; vale 0.5 si el estudiante lo completa de forma válida y 0 si no.
11. **Datos:** se guardan códigos y nombres (sin separar apellidos y nombres), **no correos**.
12. **Orden de trabajo:** las Fases 0 a 6 cubren lo necesario para entregar la nota del 1.er bimestre el 1 de diciembre de 2026.

---

## 1. Contexto

Joel es técnico docente de los laboratorios de Mecánica Newtoniana en la Escuela Politécnica Nacional (Ecuador). En el semestre 2026B tiene **10 cursos** con 194 estudiantes en la nómina oficial: **8 con metodología Clásica y 2 con SQI** (Structured Quantitative Inquiry).

- En la semana 1, los estudiantes registraron su grupo de trabajo con un QR por paralelo (Google Form). Los grupos ya están en el Excel del semestre, corregidos con la nómina oficial.
- Desde la semana 2, la asistencia se verifica en la app al final de cada clase, grupo por grupo.
- Lo que falta es una herramienta para **evaluar en el aula desde el celular** y **guardar las calificaciones de cada evento** en el Excel sin buscar a cada estudiante a mano. Los eventos son prácticas, talleres, trabajos en casa, trabajos preparatorios, control oral y PLIC.

**La app evalúa y calcula. No decide.** Todas las decisiones de calificación las toma el profesor; la app guarda sus valoraciones, aplica las reglas oficiales y hace las cuentas.

El laboratorio vale el 30 % de la asignatura Mecánica Newtoniana: 6 de 20 puntos en cada bimestre.

### 1.1 Fuentes

Las reglas de esta sección salen de estas fuentes. Si llega un documento oficial nuevo que contradiga este archivo, pregunta al usuario antes de cambiar el comportamiento de la app.

| Fuente | Qué aporta |
|---|---|
| Lineamientos estudiantes VF | Reglas y calificación de Clásica |
| Lineamientos estudiantes SQI | Reglas y calificación de SQI; rúbricas de los trabajos en casa (Tablas 4–9) |
| Lineamientos profesores VF | Control oral, talleres, recuperaciones, PLIC, formato y fechas del archivo de notas |
| 2026B_Introducción_Lab_MN_T y 2026B_Introducción_Lab_MN_SQI (presentaciones) | Grupos, esquema de la clase, rúbrica de prácticas SQI, cronogramas A y B |
| Planificación 2026B (hoja de estudiantes A) | Feriados, semana de Integración Politécnica, fin de bimestre, fechas de notas |
| Guías P01 y T01, Guía P1 SQI, hoja del TC de P1 SQI, guía del instructor SQI (Unit 0) | Configuración de las primeras actividades y enfoque de SQI |
| Decisiones de Joel (1 al 3 de octubre de 2026) | Nómina como fuente de verdad, pendientes, requisitos, control oral, asistencia, TC por grupo, pesos y escalas de Clásica, datos que se guardan, Excel como destino de las notas |
| Excel del semestre `Cursos_Lab_MN_2026B.xlsx` (Anexo J) | Estudiantes y grupos (entrada); asistencia y notas (salida) |

### 1.2 Cursos y calendario

| Paralelo | Horario | Cronograma | Metodología | Estudiantes |
|---|---|---|---|---|
| GR2QB | Lun 09:00–11:00 | A | Clásica | 22 |
| GR9EB | Lun 11:00–13:00 | A | Clásica | 19 |
| GR3MB | Lun 14:00–16:00 | A | Clásica | 20 |
| GR1AA | Mar 07:00–09:00 | A | SQI | 20 |
| GR4EB | Mar 14:00–16:00 | A | Clásica | 18 |
| GR6CD | Mié 07:00–09:00 | B | SQI | 20 |
| GR7SA | Mié 14:00–16:00 | A | Clásica | 18 |
| GR7EB | Mié 16:00–18:00 | A | Clásica | 19 |
| GR3QA | Jue 09:00–11:00 | B | Clásica | 21 |
| GR1QA | Jue 14:00–16:00 | A | Clásica | 17 |

- En la nómina, Clásica figura con el código TRAD; en la configuración se usa ese código.
- Además hay 3 estudiantes **pendientes** (GR4EB, GR7EB y GR3QA): asisten, pero aún no constan en la nómina (probable matrícula extraordinaria).
- El semestre tiene 19 semanas, del 28 de septiembre de 2026 al 5 de febrero de 2027. Cada semana el curso va al laboratorio (prácticas) o al aula (talleres) según su cronograma A o B (Anexo H).
- **Bimestres:** el 1.er bimestre incluye P1–P3 y T1–T3 (y TC1–TC3 en SQI); el 2.º, P4–P7 y T4–T7 (y TC4, TC5 y TC7). **El bimestre se asigna por actividad, no por fecha:** P4 (cronograma A) y T4 (cronograma B) son de la semana 9, que en el calendario aún es del 1.er bimestre, pero cuentan en el 2.º.
- **Envío de notas a coordinación:** 1.er bimestre hasta el martes 1 de diciembre de 2026; 2.º bimestre hasta el viernes 29 de enero de 2027.

### 1.3 Flujo de datos

```
QR de cada paralelo (semana 1)
  → registro de grupos (Google Sheet, corregido con la nómina oficial)
  → Excel del semestre en la Mac (Cursos_Lab_MN_2026B.xlsx): estudiantes y grupos
  → el Excel pasa al iPhone (AirDrop); la app lee cursos, estudiantes y grupos
  → en clase (iPhone): control oral, evaluación por grupo y, al final, asistencia por grupo
  → fuera de clase (iPhone): trabajos preparatorios (Clásica) y trabajos en casa (SQI)
  → respaldo de la app: iPhone → Mac (AirDrop)
  → la app en la Mac (Chrome) escribe en el mismo Excel: asistencia, notas por evento,
    notas del bimestre y hojas para coordinación
```

- **iPhone:** es el único lugar donde se evalúa en la v1. Ahí la app trabaja sin conexión.
- **Mac:** la misma app, abierta en Chrome, importa el respaldo más reciente del iPhone y escribe en el Excel. Chrome permite guardar sobre el mismo archivo.
- **Una sola copia vigente del Excel, en la Mac.** Antes de que la app escriba, el Excel debe estar cerrado.
- **Cambios de nómina** (lista final de matrícula): se hacen en el Excel agregando o editando filas, nunca regenerándolo. El Excel vuelve a pasar al iPhone y la app los detecta al leerlo.
- **Cambios de grupo:** se hacen en la app, moviendo estudiantes. No hace falta volver a usar el QR.

### 1.4 Reglas comunes a las dos metodologías

**Antes de cada práctica o taller**
- La guía y el coloquio se publican en el aula virtual el miércoles de la semana anterior, a las 13:00.
- El coloquio está abierto los 3 días laborables previos y cierra a las 23:55 del día anterior. Se aprueba con **100 %** (máximo 5 intentos).
- Excepción: quien no pudo hacerlo por matrícula extraordinaria o por pérdida de credenciales lo rinde en clase, con justificación.
- **Requisitos de ingreso** (las dos metodologías): coloquio al 100 % y **trabajo preparatorio** (resumen del material, breve investigación, etc.).
  - En Clásica el preparatorio se califica.
  - En SQI no se califica, pero es obligatorio.
  - Los requisitos se verifican en la puerta: los estudiantes esperan afuera y Joel revisa uno por uno. Casi todos cumplen, así que en la app solo se anotan las novedades del preparatorio (Fase 2).
- Al inicio del semestre los estudiantes rinden la Prueba de Conocimiento de los lineamientos y firman el acta de Inducción de riesgos. Ambas quedan fuera de la app.

**Asistencia**
- Tolerancia de **10 minutos**; pasado ese tiempo ya no se ingresa. Solo en la semana 2, 30 minutos para estudiantes de matrícula extraordinaria.
- **Se registra en la app al final de la clase, grupo por grupo:** al revisar y firmar el trabajo de cada grupo, Joel verifica sus integrantes y marca a quien falta.
- **Quien falta pierde todas las calificaciones de esa actividad**, aunque su grupo tenga nota. Cuenta como falta no venir, no ser admitido o tener que salir tras el control. Incluye el trabajo preparatorio de esa sesión y, en SQI, el trabajo en casa de esa práctica.
- Las únicas excepciones son la recuperación por inasistencia justificada y el feriado.

**Control oral (control del coloquio)**
- Al inicio de la clase, el profesor hace preguntas orales sobre la guía y el coloquio a **3 o 4 estudiantes elegidos al azar**, según el tiempo disponible.
- Se hace en prácticas y en talleres, con la meta de que **cada estudiante tenga al menos un control por bimestre**. No hace falta preguntar a todos en cada sesión.
- En Clásica las respuestas tienen nota y cuentan en Planificación y conocimiento (§1.5). En SQI no tienen nota.
- Si el profesor considera que un estudiante no está preparado, le pide que salga: pierde las calificaciones de esa actividad.

**Durante la clase y al final**
- Esquema de la clase: lluvia de ideas y control del coloquio → ejecución → resultados. Después, en Clásica se hacen las tareas de análisis; en SQI, el análisis y la extensión (plantear o probar ideas nuevas).
- Cada grupo entrega un trabajo que el profesor revisa y firma al final. En ese momento se verifica la asistencia del grupo.
- **Prácticas:** un integrante por grupo llena el formulario de Registro de Equipos al inicio y al final (no tiene nota). Si el grupo no desmonta y guarda el equipo, puede recibir **0 en la práctica** (penalización total, a criterio del profesor).

**Talleres (ambas metodologías)**
- Nota del taller = **50 % asistencia** (permanencia y ejecución de las actividades; individual) + **50 % evaluación integral** (ejecución, tareas y preguntas u observaciones del docente; grupal).
- No hace falta que los estudiantes terminen el taller en clase: la nota no depende solo de las tareas.
- Si alguien está pero no trabaja, Joel lo anota en el campo de observaciones del estudiante. No hay descuento automático; si decide uno, lo registra como ajuste.
- En la primera parte del taller, el profesor da a cada grupo una **retroalimentación corta de la práctica anterior** mientras los demás siguen trabajando. Esa retroalimentación se arma con lo que la app registró en la práctica.
- Todos los talleres pesan igual dentro del bimestre. Los temas son los mismos en las dos metodologías (la guía del T1 es la misma).

**PLIC** (Inventario de Pensamiento Crítico en Laboratorios de Física)
- Solo en el 2.º bimestre: jueves 21 de enero de 2027, de 11:00 a 13:00 (Jueves Cultural), simultáneo para todos los cursos.
- Es un examen presencial controlado por un profesor.
- Vale **0.5/6** si el estudiante lo completa de forma individual, íntegra y reflexiva. Vale 0 si no participa, no lo termina o responde al azar. Joel marca en la app quién lo completó, según ese control.

**Inasistencia y recuperación**
- Para una inasistencia justificada (por Bienestar Estudiantil), el estudiante pide la recuperación dentro de las 72 h posteriores a la ausencia y al menos 24 h antes de la sesión de recuperación, con evidencia y coloquio al 100 %.
- Si no asiste a la recuperación ya programada, su nota es 0.
- El profesor que recibe la recuperación envía la nota al profesor del estudiante y al estudiante en las 24 h siguientes.
- **Feriados:** la actividad perdida no cuenta en la nota bimestral; la nota se ajusta a las actividades realizadas. Recuperarla es opcional; si el estudiante la recupera, cuenta para él.

**Notas**
- Los lineamientos permiten que cada docente penalice las entregas fuera de plazo. **Joel no aplica penalización.**
- El envío a coordinación es un Excel con las columnas NOMBRES, APELLIDOS, NÚMERO ÚNICO, NOTA(/6) y PROFESOR (fechas en §1.2). La app no separa apellidos y nombres (decisión de Joel).
- Las notas se redondean a 2 decimales.
- El profesor informa sus notas a los estudiantes durante el semestre; la semana 18 es de revisión de notas.

**Datos de los estudiantes (reglas de Joel)**
- La **nómina oficial** es la fuente de verdad del código y de los apellidos y nombres. El Excel del semestre ya viene corregido con ella.
- Quien no consta en la nómina (probable matrícula extraordinaria) queda **pendiente** hasta que llegue la lista final. Se evalúa igual, pero se marca aparte.

### 1.5 Esquema Clásica (TRAD, por bimestre, sobre 6)

| Componente | 1.er bim. | 2.º bim. | Tipo | Qué se evalúa |
|---|---|---|---|---|
| Planificación y conocimiento | 1.5 | 1.5 | Individual | Trabajo preparatorio, 40 % (requisito de ingreso; solo se verifica que hicieron el resumen) y control oral, 60 % (al menos uno por bimestre, en práctica o taller) |
| Diseño experimental, toma de datos y análisis | 3.5 | 3.0 | Grupal | En cada práctica: diseño 20 % (0.7 / 0.6), toma de datos 30 % (1.05 / 0.9) y análisis 50 % (1.75 / 1.5), cada sección con escala 0–4; todas las prácticas pesan igual |
| Talleres en clase | 1.0 | 1.0 | 50 % individual, 50 % grupal (§1.4) | T1–T3 / T4–T7, todos con el mismo peso |
| PLIC | 0 | 0.5 | Individual | 0.5 o 0 |

- **Grupos:** de 3 integrantes (a veces 4). Pueden cambiar de una sesión a otra: la app conserva los grupos y Joel mueve a los estudiantes cuando hace falta.
- **Prácticas:** P1 Errores en las medidas · P2 Velocidad media y MRUV · P3 Poleas y polipastos · P4 Segunda ley de Newton · P5 Trabajo y energía · P6 Impulso y momento lineal · P7 MAS. Las tareas de análisis de clase se hacen en el laboratorio y se entregan por grupo.
- **Decidido por Joel** (los documentos no lo fijan):
  - Escala 0–4 en cada sección; el análisis es una sola sección.
  - Todas las prácticas pesan igual.
  - Planificación y conocimiento: 40 % preparatorio y 60 % control oral.
- El test final es una autoevaluación opcional del aula virtual, sin nota. Queda fuera de la app.

### 1.6 Esquema SQI (por bimestre, sobre 6)

**1.er bimestre**

| Componente | Valor | Ponderación interna |
|---|---|---|
| Prácticas de laboratorio | 3/6 | P1 Introducción 20 % · P2 Introducción a la comprobación de modelos 30 % · P3 Comprobación de modelos y ética 50 % |
| Trabajos en casa (TC) | 2/6 | TC1 40 % · TC2 25 % · TC3 35 % |
| Talleres en clase | 1/6 | T1–T3, todos con el mismo valor |

**2.º bimestre**

| Componente | Valor | Ponderación interna |
|---|---|---|
| Prácticas de laboratorio | 3/6 | P4 Comprobación y ampliación de modelos 20 % · P5 ídem, parte 2, 20 % · P6 Proyecto, parte 1, 20 % · P7 Proyecto, parte 2, 40 % |
| Trabajos en casa (TC) | 1.5/6 | TC4 20 % · TC5 30 % · TC7 50 % (el TC6 no se califica) |
| Talleres en clase | 1/6 | T4–T7, todos con el mismo valor |
| PLIC | 0.5/6 | 0.5 o 0 |

**Rúbrica de cada práctica SQI (oficial).** Se evalúan *aspectos* con puntajes fijos; **qué aspectos aplican depende de la práctica**.

| Aspecto | Tipo | Puntaje |
|---|---|---|
| Respuestas, predicciones y planificación | Objetiva | 2 / 1 / 0 |
| Ejecución y registro de datos | Objetiva | 2 / 1 / 0 |
| Análisis, interpretación y conclusiones | Objetiva | 2 / 1 / 0 |
| Discusión y reflexión | Subjetiva | 1 / 0 |
| Comunicación y colaboración | Subjetiva | 1 / 0 |

| Práctica | Aspectos aplicables | Máx. |
|---|---|---|
| P1 | Respuestas/planificación; Ejecución/registro; Discusión | 5 |
| P2 | Respuestas/planificación; Ejecución/registro; Análisis; Discusión | 7 |
| P3 | Todos | 8 |
| P4 | Respuestas/planificación; Ejecución/registro; Análisis | 6 |
| P5 | Respuestas/planificación; Ejecución/registro; Análisis; Comunicación | 7 |
| P6 | Respuestas/planificación; Ejecución/registro; Análisis; Discusión; Comunicación | 8 |
| P7 | Análisis; Comunicación | 3 |

> **Cambio del profesor (6-oct-2026).** La escala oficial resultó muy cerrada: en la app, los aspectos objetivos van de 0 a 3 y la discusión de 0 a 2; comunicación y colaboración sigue 1/0. Máximos en la app: P1 8, P2 11, P3 12, P4 9, P5 10, P6 12, P7 4. Ver `config/sqi/`.

Cálculo (**confirmado por el usuario**): primero, nota de la práctica = `puntos obtenidos / máximo de los aspectos aplicables` (valor entre 0 y 1); después se aplican la ponderación interna y el valor del componente. Ejemplo del 1.er bimestre: P1 vale el 20 % de 3 puntos = 0.60, P2 = 0.90 y P3 = 1.50. Si un grupo obtiene 4 de 5 en P1 (0.8), aporta 0.8 × 0.60 = 0.48 puntos. Las notas de práctica son **grupales**.

**Trabajos en casa (TC).** Son tareas cortas después de cada práctica. Se resuelven a mano en el diario de laboratorio y se suben como PDF al aula virtual.
- Cada TC se califica **sobre 10 con la rúbrica oficial por pregunta**: puntaje completo, parcial o cero en cada pregunta (Anexo G). **Se registra pregunta por pregunta.**
- **Unidad: por grupo, hasta nuevo aviso** (la metodología aún está en prueba). La app lo deja configurable por TC.
- Quien faltó a la práctica no recibe la nota del TC de su grupo: pierde las notas de esa práctica.
- Sin penalización por entrega tardía (decisión de Joel).
- El TC6 es la preparación de la presentación grupal de P7: no tiene nota propia y se evalúa en P7, en el aspecto de comunicación y colaboración.

**Otras reglas de SQI**
- **Grupos:** de 3 integrantes (a veces 4), **fijos todo el semestre**, formados en la semana 1.
- **Requisitos:** coloquio al 100 % y trabajo preparatorio, sin nota (§1.4). El control oral tampoco tiene nota, pero también debe llegar a todos en el bimestre.
- Esquema de la clase: lluvia de ideas y control → ejecución → resultados y análisis → extensión.
- **Enfoque** (guía del instructor): el laboratorio no busca confirmar la teoría. Enseña a decidir qué datos son confiables, poner a prueba modelos e iterar el experimento. Esto orienta el tono del feedback (Fase 7).

---

## 2. Decisiones

### 2.1 Aprobadas por el usuario en la v3 (se mantienen)

- App **web para celular** (PWA), rápida, con botones grandes y pocos toques por registro.
- Registro en **formato largo** (una fila por estudiante o grupo, evento y componente, con fecha), para tener métricas comparables desde la primera práctica.
- **Motor de evaluación configurable:** esquemas de nota, rúbricas, escalas y aspectos aplicables viven en archivos de configuración, nunca en el código. Soporta la rúbrica Clásica (criterios con niveles y pesos) y la SQI (aspectos 2/1/0 y 1/0).
- **Etiquetas rápidas** por práctica o taller (10 a 14, positivas y negativas, ligadas a un aspecto o criterio).
- **Nota del profesor** por grupo, escrita o dictada con el **dictado nativo del teclado**. No se graba audio.
- **Notas grupales,** replicadas a cada integrante presente: prácticas y evaluación integral del taller (ambas metodologías) y TC (SQI). **Individuales:** asistencia y permanencia del taller, trabajo preparatorio y control oral (Clásica) y PLIC.
- **Métricas** desde la primera práctica, agregadas y sin nombres para reuniones.
- Cada práctica, taller o trabajo en casa se define en un **archivo de configuración (JSON)**. Cada semana se agrega uno sin tocar el código.

### 2.2 Decididas por Joel (2 y 3 de octubre de 2026)

- **Enfoque:** la app sirve para evaluar y guardar las calificaciones de cada evento.
- **Destino de las notas:** el Excel que ya existe. Se usa `Cursos_Lab_MN_2026B.xlsx`, que es el archivo del semestre; el de asistencia de la semana 1 es una foto de esa semana.
- **Asistencia:** se registra en la app al final de la clase, grupo por grupo.
- **Faltas:** quien falta a una práctica pierde las notas de esa práctica, incluido el TC de su grupo.
- **Requisitos de ingreso** en las dos metodologías: coloquio al 100 % y trabajo preparatorio. El preparatorio se califica solo en Clásica.
- **Control oral aleatorio:** 3 o 4 estudiantes por sesión según el tiempo, en prácticas y talleres; todos deben tener al menos un control por bimestre.
- **TC por grupo** hasta nuevo aviso, registrados **pregunta por pregunta**.
- **Feedback:** se construye con lo que la app registra (puntajes por aspecto, etiquetas, notas del profesor, respuestas del control y puntajes por pregunta de los TC).
- **Datos:** se guardan nombres y códigos, **no correos**. Más adelante se revisará si se pueden quitar los nombres. No se separan apellidos y nombres.
- **Grupos de Clásica:** pueden cambiar; se mueven en la app, sin volver a usar el QR.
- **Observaciones por estudiante** en cada evento (por ejemplo, «está pero no trabaja»). No cambian la nota por sí solas.
- **Clásica:**
  - Escala 0–4 por sección; el análisis es una sola sección; todas las prácticas pesan igual.
  - Planificación y conocimiento = 40 % preparatorio y 60 % control. Del preparatorio solo se verifica que hicieron el resumen, con escala 0/1/2.
- **Revisión del preparatorio en la puerta:** todos cumplen por defecto y solo se anotan las novedades; quien falta queda con 0.
- **Trabajos en casa sin penalización** por entrega tardía.
- **Redondeo** a 2 decimales.
- **PLIC:** examen presencial controlado por un profesor.

### 2.3 Derivadas de los documentos y del flujo actual

- **Navegación:** Curso → Evento evaluativo (la app propone la actividad de la semana según el cronograma) → Grupo, con una pestaña para lo individual.
- **Grupos por evento:** cada evento copia los grupos del anterior (o los del Excel, en el primero) y se pueden editar.
- **Escritura segura en el Excel:**
  - La app solo escribe en sus columnas y hojas (Anexo J).
  - Ubica a cada estudiante por su código, nunca por la posición de la fila.
  - Nunca regenera el archivo.
- **Bimestre por actividad,** no por fecha. **Feriados** y sesiones sin clase excluyen la actividad del curso.
- **Respaldo mínimo desde la Fase 1:** la app tendrá notas reales desde octubre, el teléfono se puede perder y el respaldo es además el camino del iPhone a la Mac.
- **Todo se enlaza por código único.** El nombre solo se muestra y se exporta, así se puede quitar después sin romper nada.

---

## 3. Fuera del alcance (rechazado o descartado)

- **Revisión automática de trabajos preparatorios o de trabajos en casa con IA.** Descartada. La app solo tiene casillas y campos de digitación manual.
- **Grabación de audio** de estudiantes o del profesor. Solo dictado nativo a texto.
- **Calificación automática por IA** de cualquier componente. La app no sugiere notas.
- **Envío de correos o feedback.** La app genera el texto; el profesor lo revisa y lo envía. La app no guarda correos.
- **Backend o servidor propio.** Los datos viven en los dispositivos del profesor.
- **Integración con el aula virtual o con Google.** Solo archivos.
- **Volver a registrar grupos con el QR.** Los grupos de la semana 1 vienen del Excel; después se cambian moviendo estudiantes en la app.
- **Separar apellidos y nombres.** No hace falta para lo importante de la app.
- **Verificar el coloquio.** Se verifica en la puerta, fuera de la app. Del preparatorio, la app solo anota las novedades de la revisión en la puerta.
- **Regenerar o reestructurar el Excel.** La app solo llena sus columnas y hojas.
- **Evaluar en dos dispositivos a la vez** (v1). Se evalúa en el iPhone; la Mac solo escribe el Excel.
- **Procesos de otras plataformas:** test final (Clásica), Prueba de Conocimiento de los lineamientos, formulario de Registro de Equipos, formularios de recuperación y de tutorías.

---

## 4. Requisitos técnicos y de privacidad

- **Offline-first** (Service Worker + almacenamiento local, por ejemplo IndexedDB). La app se instala en la pantalla de inicio del iPhone.
- **Mobile-first:** pruebas a unos 380 px de ancho; botones grandes, mínimos toques, sin recargas. También debe funcionar en Chrome en la Mac.
- **Excel:**
  - Leer en el iPhone y en la Mac.
  - Escribir en la Mac con una librería que **conserve el formato al guardar** (por ejemplo ExcelJS) y guardar sobre el mismo archivo con la API de acceso a archivos de Chrome.
  - Si la prueba de ida y vuelta (Fase 3) muestra que la librería altera el formato del Excel, la escritura la hace un script de Python (openpyxl) en la Mac, con las mismas reglas.
- **Sin dependencias de red para los datos.** Nada de enviar información de estudiantes a servicios externos.
- **Publicación:** sitio estático con HTTPS (por ejemplo GitHub Pages). El repositorio solo tiene código y datos ficticios.
- **Interfaz en español.**
- **Stack sugerido:** HTML + JavaScript (vanilla o una librería ligera), IndexedDB (por ejemplo con Dexie). Puedes proponer otra opción si la justificas brevemente.
- **Privacidad:**
  - Se guardan solo el código único y los apellidos y nombres. El Excel tiene una columna de correo; la app no la lee.
  - Los datos viven solo en los dispositivos de Joel; las vistas para reuniones no muestran nombres.
  - El Excel y los respaldos contienen datos de estudiantes: el usuario los guarda de forma segura y según la normativa de su universidad.
  - Los datos reales nunca entran al repositorio.

### Modelo de datos sugerido (ajústalo en la Fase 1 y documéntalo en `docs/modelo-datos.md`)

```
courses(id, paralelo, metodologia[TRAD|SQI], cronograma[A|B], dia, inicio, fin)
students(id, codigo_unico, apellidos_nombres, apellidos, nombres, course_id,
         estado[nomina|pendiente|baja], observacion_excel)          -- observacion_excel: solo lectura
activities(id, codigo, tipo[practica|taller|trabajo_casa|plic|sin_nota], metodologia, titulo, bimestre, config_ref)
events(id, course_id, activity_id, semana, fecha, estado[pendiente|realizado|feriado|sin_clase])
event_groups(event_id, grupo, student_id)                           -- copia del evento anterior o del Excel; editable
attendance(event_id, student_id, estado[presente|no_vino|salio|se_retiro_antes], motivo, observacion)  -- pase al final de la clase

-- evaluación
group_scores(event_id, grupo, aspecto_id, valor)
tags_applied(event_id, unidad[grupo|estudiante], unidad_id, tag_id)
notes(event_id, unidad, unidad_id, texto, fecha)
group_checks(event_id, grupo, trabajo_firmado, penalizacion_total, motivo)
oral_control(event_id, student_id, n_pregunta, puntaje, resultado[respondio|no_esta|salio])
prep_review(event_id, revisada, fecha)                              -- «revisión hecha: todos cumplieron»
prep_novedades(event_id, student_id, nivel[0|1], no_ingresa, observacion)  -- solo las excepciones
homework(activity_id, course_id, grupo, entregado, puntajes_por_pregunta, observacion)  -- TC (SQI)
plic(student_id, completo_valido)
recoveries(student_id, activity_id, motivo[feriado|justificada], estado[solicitada|realizada|no_asistio], nota)
overrides(student_id, event_id, valor, motivo)                      -- ajuste individual explícito

-- control del Excel y respaldos
excel_writes(fecha, archivo, celdas_de_la_app)                      -- lo último que escribió la app, para detectar ediciones a mano
backups(fecha, tipo, archivo)
```

### Motor de notas (cálculos centrales, con pruebas automáticas)

1. **Nota de actividad** (valor entre 0 y 1):
   - Práctica SQI: `suma(puntos de aspectos aplicables) / suma(máximos aplicables)`.
   - Práctica Clásica: `suma(peso_i × nivel_i / nivel_máx)` con diseño 0.20, datos 0.30 y análisis 0.50.
   - TC (SQI): `suma(puntos por pregunta) / 10`, sin penalización por atraso.
   - Taller: `0.5 × asistencia_permanencia (individual) + 0.5 × evaluación integral del grupo / máximo`.
   - Trabajo preparatorio (Clásica): `nivel / 2`. Con la revisión hecha, el nivel es 2 para quien está presente en el pase final sin novedad, el de la novedad (1 o 0) para quien la tiene y 0 para quien faltó. Sin revisión hecha, queda pendiente.
   - Control oral (Clásica): `suma(puntajes) / (2 × preguntas hechas)`.
2. **Elegibilidad** (según el pase de asistencia del evento):
   - Presente: recibe la nota de su grupo y sus notas individuales.
   - «No vino» o «salió»: 0 en todas las partes del evento. Si el evento es una práctica SQI, también 0 en el TC de esa práctica.
   - «Se retiró antes»:
     - En un taller, la asistencia y permanencia vale el valor parcial configurable (por defecto 0.5).
     - En una práctica conserva la nota del grupo, salvo que el profesor registre un ajuste.
   - Pase de asistencia aún sin hacer: evento pendiente; no se calculan notas.
   - Evento no realizado en su curso (feriado o sin clase): excluido.
   - Falta justificada: pendiente hasta la recuperación. Si recupera, recibe la nota de la recuperación; si no asiste a la recuperación programada, 0.
   - Estudiante pendiente de nómina: se calcula igual y se marca en el Excel.
3. **Replicación:**
   - La nota del grupo se copia a cada integrante presente en el pase de ese evento.
   - La nota del TC (por grupo) se copia a los integrantes que estuvieron presentes en la práctica.
   - La penalización total deja en 0 la práctica de ese grupo.
   - Se permite un ajuste individual explícito, siempre con motivo.
4. **Componente** = `suma(peso × nota) / suma(pesos de las actividades no excluidas) × valor del componente`.
   - Con pesos iguales, es el promedio de las actividades realizadas.
   - **Renormalización:** cuando un feriado excluye una actividad con peso propio (SQI), las demás conservan su proporción y el componente sigue valiendo lo mismo. Si un curso perdiera P2 (30 %), P1 y P3 pasarían a pesar 20/70 y 50/70 de los 3 puntos. Lo mismo para su TC. Este semestre no ocurre en los cursos SQI de Joel: GR1AA solo pierde el T2 y GR6CD no pierde nada.
5. **Control oral:** si un estudiante tiene más de un control en el bimestre, cuenta el promedio.
6. **Planificación y conocimiento (Clásica, individual):** `(0.40 × promedio de preparatorios + 0.60 × nota del control) × 1.5`.
   - Cuando se acerca el cierre del bimestre, la app avisa quién sigue sin control, para hacérselo en la siguiente sesión.
   - Si el bimestre se cierra sin control, la nota sale solo de sus preparatorios y queda una observación.
7. **PLIC:** 0.5 si lo completó de forma válida; 0 si no.
8. **Nota bimestral** = suma de los componentes del esquema del curso (Anexo A).
   - Mostrar la nota *acumulada sobre lo ya evaluado* y la nota final proyectada, sin mezclarlas.
   - Calcular con precisión completa y redondear a **2 decimales** al mostrar y al escribir en el Excel, con el redondeo usual (un 5 en la tercera cifra sube: 1.125 → 1.13).
9. **Bimestre por actividad,** según el esquema, nunca por fecha.
10. **Transparencia:** cada nota se puede desglosar en pantalla: qué entró, con qué peso, qué se excluyó y qué se ajustó (con el motivo).

Casos de prueba mínimos (en `tests/`):

| Caso | Resultado esperado |
|---|---|
| SQI P1, grupo con 4/5 | 0.8 × 0.60 = 0.48 puntos |
| TC1 del grupo con 1 + 2 + 1 + 0.5 + 1 + 1 + 1 + 1 = 8.5/10 | 0.85 × 0.80 = 0.68 puntos para cada integrante presente en P1 |
| Integrante que «no vino» a P1 en SQI | 0 en P1 y 0 en TC1, aunque su grupo tenga nota |
| Práctica Clásica con diseño 3/4, datos 4/4 y análisis 2/4 | 0.15 + 0.30 + 0.25 = 0.70 |
| Taller con asistencia completa y evaluación integral 1/2 | 0.5 × 1 + 0.5 × 0.5 = 0.75 |
| Taller: estudiante que «se retiró antes», evaluación integral 2/2 | 0.5 × 0.5 + 0.5 × 1 = 0.75 |
| Grupo con nota 0.9; un integrante «salió» tras el control | 0 para él; 0.9 para los demás |
| Estudiante movido de grupo en la sesión | Recibe la nota del grupo nuevo, no la del grupo del Excel |
| Curso Clásica que perdió T2 por feriado; T1 = 1.0 y T3 = 0.75 | Talleres del 1.er bimestre = 0.875 |
| Mismo curso, estudiante que recuperó T2 con 0.5 | Talleres = (1.0 + 0.5 + 0.75) / 3 = 0.75 |
| Clásica: preparatorios con promedio 1.0 y control 0.5 | Planificación y conocimiento = (0.4 × 1.0 + 0.6 × 0.5) × 1.5 = 1.05 |
| Clásica: el bimestre se cierra sin control; preparatorios con promedio 0.75 | Planificación y conocimiento = 0.75 × 1.5 = 1.125 → 1.13, con observación |
| Preparatorio con la revisión hecha: presente sin novedad, presente con «incompleto» y ausente | 2/2, 1/2 y 0 |
| Preparatorio de una sesión sin la revisión marcada | Pendiente: no entra en el promedio y la app avisa |
| Curso SQI sin P2 (caso hipotético) | Prácticas = (0.2 × P1 + 0.5 × P3) / 0.7 × 3 |

---

## 5. Reglas de trabajo para Claude Code

1. Una fase por sesión. No adelantes fases futuras.
2. Al empezar: lee este archivo y `PROGRESS.md`. Al terminar: actualiza `PROGRESS.md` y haz commit.
3. Cada fase termina con algo **funcional y probado**.
4. Pruebas automáticas para:
   - El cálculo de notas (incluidos feriados, faltas, salidas y recuperaciones).
   - El sorteo del control oral.
   - La lectura y la escritura del Excel.
   - El respaldo y la restauración.
5. Datos ficticios en `/datos-ejemplo`, incluido un Excel ficticio con la estructura exacta del Anexo J. **Nunca incluyas datos reales de estudiantes en el repositorio**: el Excel real solo se abre desde los dispositivos de Joel.
6. Si algo de la sección 9 bloquea una decisión, pregunta al usuario en lugar de asumir.
7. Prioriza la velocidad de uso en el aula por encima de funcionalidades extra.
8. **Nada específico de una metodología va en el código**: se resuelve con configuración y con las propiedades `metodologia` y `cronograma` del curso.
9. Las reglas oficiales y las decisiones de Joel (§1 y §2) prevalecen sobre las propuestas de este archivo. Si un documento oficial nuevo contradice este archivo, pregunta.
10. Los cursos y el calendario reales del Anexo H no son datos de estudiantes: úsalos como configuración.
11. La app nunca guarda correos. Al leer el Excel, ignora la columna de correo; las pruebas comprueban que ningún dato guardado contenga «@».
12. **El Excel de Joel es intocable fuera de las zonas de la app:**
    - Nunca lo regeneres ni cambies celdas, filas, hojas o formatos que no sean de la app.
    - Ubica a cada estudiante por su código.
    - Pide cerrar el Excel antes de escribir.
    - Si Joel editó a mano una celda de la app, pregunta antes de reemplazarla.
    - La prueba de ida y vuelta de la Fase 3 es obligatoria antes de usar el Excel real.

---

## 6. Fases

**Calendario.** La semana 2 empieza el 5 de octubre de 2026 y la nota del 1.er bimestre se envía el 1 de diciembre. Las primeras sesiones se evaluarán en papel, así que la app debe permitir **carga retroactiva** (eventos con fecha pasada). Las Fases 0 a 6 cubren todo lo necesario para calcular, guardar en el Excel y entregar la nota del 1.er bimestre. El feedback completo, las métricas y el trabajo en varios dispositivos pueden esperar al 2.º bimestre.

### Fase 0: Preparación y configuración del semestre
- Repositorio, estructura de carpetas (Anexo E), `PROGRESS.md`, `docs/modelo-datos.md` y `docs/reglas-oficiales.md` (resumen de §1 con la fuente de cada regla).
- Stack final y esquema de datos.
- Esquemas JSON para validar:
  - Esquema de evaluación.
  - Actividad (incluye la rúbrica por pregunta de los TC; la suma de los máximos debe ser 10).
  - Control oral y trabajo preparatorio.
  - Semestre (cronogramas, feriados, fechas).
- Configuración real:
  - Cursos y calendario 2026B (Anexo H).
  - Esquemas de nota (Anexo A).
  - Actividades P1-TRAD (Anexo B), P1-SQI y TC1 (Anexo C), T1 (Anexo D) y TC2–TC7 (Anexo G).
  - Control oral, preparatorio y Planificación y conocimiento (Anexo F).
- Datos ficticios (sin datos reales):
  - Un Excel con la forma exacta de `Cursos_Lab_MN_2026B.xlsx` (Anexo J): 10 hojas de curso (8 Clásica y 2 SQI; 2 en el cronograma B), de 17 a 22 estudiantes, grupos de 3 y 4.
  - Uno o dos pendientes y una columna de correo con valores falsos.
  - Algo de formato: títulos, colores y anchos de columna.

**Listo cuando:** los esquemas validan, los ejemplos cargan sin errores y una prueba automática genera el evento de cada semana para cada curso y marca las sesiones perdidas del Anexo H.

### Fase 1: Lectura del Excel, navegación y respaldo
- Almacenamiento local con el modelo de datos.
- **Leer el Excel del semestre** (Anexo J.1), con reporte de errores:
  - Cursos, estudiantes (código y nombre), grupo de trabajo, observación (solo lectura) y pendientes.
  - Ignora el correo.
  - Al volver a leerlo (cambios de nómina), agrega estudiantes nuevos y marca los que ya no están, sin tocar las evaluaciones.
- Opcional: traer la asistencia de la semana 1 desde `Asistencia_Semana1_Lab_MN_2026B.xlsx` (misma estructura, columna «Asistencia»).
- Navegación Curso → Evento → Grupo, con la metodología y el cronograma visibles y el estado de cada evento (pendiente, evaluado, pase hecho, feriado).
- PWA instalable en el iPhone y funcional sin conexión.
- **Respaldo:** exportar e importar todo en un JSON. Es también el archivo que pasa del iPhone a la Mac.

**Listo cuando:**
- Se lee el Excel ficticio, se navega sin conexión y los datos persisten.
- Una prueba exporta, borra, restaura y obtiene datos idénticos.
- Otra prueba confirma que no se guardó ningún correo.

### Fase 2: La clase: prácticas, control oral, asistencia y preparatorio (ambas metodologías)
- Implementar el **motor de notas** (§4) con pruebas: nota de actividad, elegibilidad, replicación, exclusión por feriado con renormalización, penalización total y ajuste individual.
- **Control oral al inicio** (Anexo F):
  - Botón «Sortear 3» o «Sortear 4» entre quienes aún no tienen control en el bimestre.
  - Indicador de cobertura: «faltan N; quedan M sesiones; conviene sortear K por sesión», con aviso si K pasa de 4.
  - «No está» vuelve a sortear (ese estudiante sigue pendiente).
  - Hasta 3 preguntas por estudiante: puntaje 0/1/2 en Clásica; aprobado o no en SQI.
  - «Salió» registra la falta.
- **Evaluación de práctica por grupo:**
  - La pantalla se adapta a la rúbrica configurada. Clásica: secciones diseño, toma de datos y análisis, con niveles 0–4. SQI: solo los aspectos que aplican, con 2/1/0 o 1/0.
  - Indicadores y descriptores al tocar cada aspecto o criterio; etiquetas rápidas; nota dictable; guardado automático; edición posterior.
- **Pase final por grupo** (al revisar y firmar el trabajo):
  - La pantalla del grupo muestra sus integrantes, todos presentes por defecto. Un toque marca «no vino»; otro, «se retiró antes».
  - Se puede mover a un estudiante de grupo o agregar a quien no está en ninguno. Así cambian los grupos en Clásica; el cambio se conserva para los eventos siguientes.
  - Cada estudiante tiene un **campo de observaciones** (texto o dictado), con frases rápidas configurables como «está pero no trabaja». No cambia la nota por sí solo; si Joel decide un descuento, lo registra como ajuste con motivo.
  - Al cerrar el pase, los estudiantes que no quedaron en ningún grupo cuentan como «no vino» (con confirmación).
  - Casilla de trabajo firmado y, si hace falta, penalización total con motivo.
- **Revisión del preparatorio en la puerta** (antes de entrar; los estudiantes esperan afuera y Joel revisa uno por uno):
  - Botón «Revisión hecha: todos cumplieron». Cada estudiante que esté presente en el pase final y no tenga novedad recibe 2.
  - La app no escribe un 2 a cada uno: lo calcula al cerrar el pase final. Así nunca hay que borrar notas.
  - **Novedades:** se busca al estudiante con las primeras letras del apellido y se marca «incompleto» (1) o «no lo hizo» (0), con nota opcional. Si además no ingresa, queda como falta con motivo «sin preparatorio».
  - Quien falta queda con 0 en el preparatorio, como en todo lo de esa actividad.
  - Si la revisión no se marcó como hecha, el preparatorio de esa sesión queda pendiente y la app lo avisa.
  - En SQI se usa la misma pantalla sin nota, solo para anotar quién no ingresa.
- **Resumen del evento** en la app: nota de cada estudiante y motivo de cada 0 o exclusión.
- Cargar como configuraciones reales: **P1 Clásica (Anexo B)** y **P1 SQI (Anexo C)**.

**Listo cuando:**
- Se evalúa un grupo en menos de un minuto en cada metodología.
- El pase final de un curso de 20 toma menos de 2 minutos, y la revisión del preparatorio con dos novedades, menos de 1 minuto.
- Las pruebas del sorteo confirman la cobertura (por ejemplo, GR2QB con 22 estudiantes y 5 sesiones en el 1.er bimestre pide 5 en alguna sesión).
- Las notas coinciden con cálculos manuales, incluidos ausentes, «salió», un pendiente y un estudiante movido de grupo.

### Fase 3: Escritura en el Excel (Mac, Chrome)
- Importar en la Mac el respaldo más reciente del iPhone.
- Abrir `Cursos_Lab_MN_2026B.xlsx` y **escribir solo en las zonas de la app** (Anexo J.2):
  - En cada hoja de curso: «Grupo actual», una columna por evento, componentes, notas del bimestre y observaciones de la app.
  - Hojas «Asistencia (app)» y «Detalle (app)».
  - Hoja oculta «_app» con la versión y lo último que se escribió.
- Reglas: ubicar estudiantes por código; no tocar nada fuera de esas zonas; recordar cerrar el Excel; guardar sobre el mismo archivo.
- Si Joel editó a mano una celda de la app, mostrarla y preguntar si se adopta (queda como ajuste con motivo «editado en el Excel») o se reemplaza.
- Si la librería no pasa la prueba de ida y vuelta, implementar la misma escritura como script de Python en la Mac.

**Listo cuando:**
- En la prueba de ida y vuelta con el Excel ficticio, todas las celdas fuera de las zonas de la app quedan idénticas (valores, y formato en una muestra de celdas) y las de la app tienen lo esperado.
- Escribir dos veces seguidas no cambia nada.
- Una edición a mano en una celda de la app se detecta.

### Fase 4: Talleres (ambas metodologías)
- **Asistencia y permanencia** (individual), desde el pase final: presente = 1; «se retiró antes» = valor parcial (0.5); «no vino» = 0.
- Quien está pero no trabaja, u otra situación, se anota en el campo de observaciones del estudiante; no hay descuento automático.
- **Evaluación integral por grupo** (escala configurable, por defecto 0/1/2): preguntas u observaciones del docente, ejecución y tareas.
  - Banco de preguntas visible en pantalla.
  - No exige que el grupo termine el taller.
- **Retroalimentación de la práctica anterior:** al abrir el taller, la app muestra los grupos de la última práctica del curso con sus integrantes, sus puntajes por aspecto, sus etiquetas, la nota del profesor y los resultados del control. Una casilla marca la retroalimentación como dada.
- Revisión del preparatorio en la puerta, control oral (con nota en Clásica) y pase final, como en la Fase 2.
- Todos los talleres pesan igual dentro del bimestre, con exclusión por feriado. Las notas se escriben en el Excel como en la Fase 3.
- Cargar el **Taller 1 (Anexo D)** como ejemplo.

**Listo cuando:** se toma el pase, se evalúan los grupos y se obtiene la nota del taller por estudiante. Una prueba con un curso que perdió el T2 calcula bien el componente.

### Fase 5: Trabajos en casa (SQI)
- Pantalla por TC con los **grupos** de la práctica correspondiente (unidad configurable).
  - Estado: entregado o no entregado.
  - **Rúbrica oficial pregunta por pregunta** (un toque por nivel), con la suma sobre 10 a la vista.
  - Los integrantes que faltaron a la práctica aparecen marcados y reciben 0.
  - Sin penalización por entrega tardía. El TC6 no tiene nota.
- Avance automático al siguiente grupo.
- Etiquetas rápidas de errores comunes por pregunta (opcionales; alimentan el feedback y las métricas).
- Ponderaciones de los TC por bimestre (Anexo A). Las notas se escriben en el Excel.

**Listo cuando:** se registran los TC de todos los grupos de un curso en pocos minutos y el componente se calcula bien (por ejemplo, TC1 = 40 % de 2 puntos = 0.80 como máximo).

### Fase 6: Nota bimestral, excepciones y coordinación
- **Feriados y sesiones sin clase:** se marcan desde el calendario; las actividades perdidas quedan excluidas por curso.
- **Recuperaciones:**
  - Mis estudiantes que recuperan en otra sesión: se registra la nota recibida; si no asisten a la recuperación programada, 0.
  - Estudiantes de otros docentes que recuperan en mi sesión: se agregan al evento con código y nombre y se califican. La app genera el texto con la nota para su profesor (enviar en 24 h). No se escriben en el Excel.
- **PLIC:** examen presencial controlado por un profesor. Casilla por estudiante en el 2.º bimestre, según ese control.
- **Planificación y conocimiento** (Clásica): 40 % preparatorio y 60 % control, con aviso de quién sigue sin control oral cuando se acerca el cierre del bimestre.
- **Nota bimestral por estudiante** con desglose por componente y actividad, acumulada y proyectada:
  - Clásica = Planificación y conocimiento (individual) + diseño, datos y análisis (grupal) + talleres + PLIC.
  - SQI = prácticas (grupal) + TC (grupal) + talleres + PLIC.
- **En el Excel:** columnas de componentes y nota del bimestre en cada hoja de curso.
- **Hojas «Coordinación B1» y «Coordinación B2»:** apellidos y nombres en una sola columna, número único, nota sobre 6 y profesor. Los pendientes van marcados.
- **Recordatorio** de las fechas de envío (1 de diciembre de 2026 y 29 de enero de 2027), con la lista de eventos que faltan por evaluar.

**Listo cuando:** la nota de cada bimestre coincide con cálculos manuales en ambos esquemas (incluidos feriados, faltas, recuperaciones y estudiantes sin control) y una prueba comprueba que las hojas de coordinación tienen sus cuatro columnas y las notas redondeadas a 2 decimales.

### Fase 7: Feedback
- El feedback se construye **solo con lo que la app registró:** puntajes por aspecto, etiquetas, nota del profesor (incorporada tal cual), respuestas del control y puntajes por pregunta de los TC.
- Plantillas de texto por etiqueta y por aspecto con nota baja (en la configuración de cada actividad), con la estructura *lo mejor / a mejorar / sugerencia*.
- Texto por grupo, editable antes de copiar. Solo se identifica por número de grupo.
- **Tono por metodología:**
  - SQI: invitar a preguntar y dudar, sobre la confiabilidad de los datos, la puesta a prueba del modelo, la iteración y la extensión. Por ejemplo, sugerir una pregunta para explorar en vez de solo señalar el error.
  - Clásica: concreto y correctivo.
- Versión corta de 2 o 3 líneas por grupo para la retroalimentación al inicio del taller (sustituye la vista de datos de la Fase 4).
- **Resumen del curso por evento:** etiquetas más marcadas y preguntas de TC con más errores, con sugerencia de qué reforzar.
- **Revisión de notas** (semana 18): vista del desglose por estudiante para mostrarlo en clase.

**Listo cuando:** de un evento evaluado se obtienen en pocos toques el feedback de todos los grupos, su versión corta y el resumen del curso.

### Fase 8: Métricas
- Distribución de puntajes por criterio o aspecto, por práctica.
- Control oral: cobertura por curso y resultados por pregunta o concepto (Clásica).
- TC: entregas y puntaje por pregunta (dónde fallan).
- Trabajo preparatorio: distribución por evento (Clásica).
- **Asistencia y permanencia** por estudiante, grupo, curso, evento, día y franja horaria. Advertencias obligatorias: las muestras son pequeñas (unos 20 estudiantes por curso) y la franja de 07:00–09:00 solo tiene cursos SQI.
- Etiquetas más frecuentes; estudiantes o grupos en riesgo; evolución entre eventos; impacto de los feriados; comparación entre cursos.
- **Comparación entre metodologías:** solo con notas **normalizadas** de componentes equivalentes (prácticas y talleres), nunca la nota total. Siempre con la advertencia de que las rúbricas, los grupos, los horarios y las condiciones difieren: es una descripción, no una comparación causal.
- Vistas agregadas y sin nombres para presentar; el detalle por estudiante, solo en la vista del profesor.

**Listo cuando:** se genera el tablero con datos ficticios de varios eventos y se exporta como imagen o PDF.

### Fase 9: Respaldo completo y varios dispositivos
- Exportar todo en CSV por tabla, además del JSON, con la fecha en el nombre.
- **Paquete de evento:** pasar las evaluaciones de un evento de un dispositivo a otro (reemplaza ese evento en el destino, previa confirmación). Permite, por ejemplo, calificar trabajos en casa en la Mac.
- Recordatorio en la app si hace más de N días que no se respalda.
- Documentar en `docs/respaldo.md`.

**Listo cuando:** se exporta, se borra todo, se restaura y los datos quedan idénticos (prueba automática), y un paquete de evento pasa de un dispositivo a otro sin perder nada.

---

## 7. Criterios de calidad transversales

- Evaluar una práctica en **menos de 1 minuto por grupo**; hacer el pase final de un curso en menos de 2 minutos.
- Cargar los TC de un curso en pocos minutos; la revisión del preparatorio, en menos de 1 minuto (solo novedades).
- **Nunca buscar estudiante por estudiante:** todo se hace por grupo, salvo lo individual (preparatorio y control), que aparece ya listado.
- Nunca perder datos: guardado inmediato, sin botón «guardar» obligatorio, y respaldo fácil.
- El Excel de Joel solo cambia en las zonas de la app.
- Cálculos transparentes y desglosables; cada exclusión o ajuste queda con su motivo.
- Todo texto de rúbricas, etiquetas, preguntas, calendarios y reglas está en archivos de configuración.
- Las mismas pantallas sirven a las dos metodologías; solo cambia la configuración.

---

## 8. Cómo se agrega una nueva actividad

1. Copiar una configuración existente (Anexos B, C o D) y editarla. Para un TC, copiar su rúbrica oficial del Anexo G.
2. Definir aspectos o criterios, indicadores, descriptores, etiquetas, preguntas y plantillas de feedback.
3. Colocarla en `/config/actividades/` y validarla con el esquema.
4. La app la muestra automáticamente en los eventos de los cursos de la metodología y el cronograma que corresponden, y crea su columna en el Excel la primera vez que escribe una nota.

Para un semestre nuevo: copiar `semestre-2026B.json` y `cursos-2026B.json`, actualizar fechas, feriados y cronogramas, y validar.

(Las configuraciones nuevas las puede preparar el usuario con ayuda de Claude en el chat, a partir de la guía de cada práctica.)

---

## 9. Pendientes por resolver con el usuario

### 9.1 Resueltos (no volver a preguntar)

**Por los documentos oficiales**
- La asistencia y permanencia es el 50 % individual de la nota del taller en las dos metodologías; el otro 50 % es la evaluación integral del grupo.
- Talleres por bimestre: T1–T3 y T4–T7. Prácticas: P1–P3 y P4–P7. El bimestre se asigna por actividad.
- TC de SQI: sobre 10, con rúbrica por pregunta (Anexo G); el TC6 no tiene nota.
- PLIC: 0.5 o 0.
- Feriados: la actividad perdida no cuenta; si el estudiante la recupera, cuenta para él.
- Fechas del archivo de notas para coordinación.
- La semana 3 («refuerzo de errores») no forma parte de los esquemas de nota. Las tareas de «Refuerzo» de las guías de Clásica quedan fuera de la app.

**Por Joel (2 y 3 de octubre de 2026)**
- La app se enfoca en evaluar y guardar calificaciones, en el Excel del semestre.
- Asistencia al final de la clase, grupo por grupo, con un campo de observaciones por estudiante.
- Quien falta pierde las notas de esa actividad, incluido el TC de esa práctica.
- Requisitos de ingreso en ambas metodologías: coloquio al 100 % y trabajo preparatorio; con nota solo en Clásica.
- Control oral aleatorio, de 3 o 4 estudiantes por sesión, en prácticas y talleres; todos con al menos un control por bimestre.
- Grupos de Clásica: pueden cambiar; se mueven en la app, sin volver al QR.
- Prácticas de Clásica: escala 0–4 por sección, análisis como una sola sección, todas con el mismo peso.
- Planificación y conocimiento: 40 % preparatorio (escala 0/1/2; solo se verifica que hicieron el resumen) y 60 % control.
- Revisión del preparatorio en la puerta: todos cumplen por defecto y solo se anotan novedades; quien falta queda con 0.
- Renormalización proporcional en SQI cuando un feriado excluye una actividad con peso propio.
- Penalización total por equipo no ordenado: botón opcional por grupo, a criterio del profesor.
- TC por grupo hasta nuevo aviso, registrados pregunta por pregunta, sin penalización por entrega tardía.
- Redondeo a 2 decimales.
- PLIC: examen presencial controlado por un profesor.
- No se separan apellidos y nombres.
- El feedback se construye con lo que registra la app.
- Se guardan nombres y códigos, no correos.

### 9.2 Definido en este plan (se puede cambiar en la configuración)

Nada de esto bloquea las Fases 0 a 6. Si Joel prefiere otra cosa, basta con cambiar la configuración.

| Tema | Cómo queda | Por qué |
|---|---|---|
| Varios controles orales en el bimestre | Cuenta el promedio | Todos pesan lo mismo |
| Estudiante sin control al cierre del bimestre | La app avisa antes del cierre para hacérselo; si se cierra así, Planificación y conocimiento sale solo de los preparatorios, con observación | No inventar una nota de control |
| Salida anticipada en un taller | La mitad de la asistencia (0.5) | Estuvo en parte de la sesión |
| Hoja de coordinación de SQI | El mismo formato que en Clásica | Los lineamientos de profesores describen un solo formato |

---

## Anexo A: Esquemas de nota (`/config/esquemas/`)

Los pesos de los `items` se renormalizan cuando una actividad queda excluida (feriado o sin clase). `1` significa «mismo peso».

```json
{
  "id": "TRAD_B1", "metodologia": "TRAD", "bimestre": 1,
  "componentes": [
    { "id": "planificacion_conocimiento", "valor": 1.5, "unidad": "estudiante",
      "items": { "trabajo_preparatorio": 0.40, "control_oral": 0.60 },
      "control_varios": "promedio", "sin_control": "avisar; si se cierra asi, solo_trabajo_preparatorio" },
    { "id": "diseno_datos_analisis", "valor": 3.5, "unidad": "grupo",
      "secciones": { "diseno": 0.20, "datos": 0.30, "analisis": 0.50 },
      "items": { "P1": 1, "P2": 1, "P3": 1 } },
    { "id": "talleres", "valor": 1.0, "items": { "T1": 1, "T2": 1, "T3": 1 } },
    { "id": "plic", "valor": 0.0 }
  ]
}
```

```json
{
  "id": "TRAD_B2", "metodologia": "TRAD", "bimestre": 2,
  "componentes": [
    { "id": "planificacion_conocimiento", "valor": 1.5, "unidad": "estudiante",
      "items": { "trabajo_preparatorio": 0.40, "control_oral": 0.60 },
      "control_varios": "promedio", "sin_control": "avisar; si se cierra asi, solo_trabajo_preparatorio" },
    { "id": "diseno_datos_analisis", "valor": 3.0, "unidad": "grupo",
      "secciones": { "diseno": 0.20, "datos": 0.30, "analisis": 0.50 },
      "items": { "P4": 1, "P5": 1, "P6": 1, "P7": 1 } },
    { "id": "talleres", "valor": 1.0, "items": { "T4": 1, "T5": 1, "T6": 1, "T7": 1 } },
    { "id": "plic", "valor": 0.5, "tipo": "binario" }
  ]
}
```

```json
{
  "id": "SQI_B1", "metodologia": "SQI", "bimestre": 1,
  "componentes": [
    { "id": "practicas", "valor": 3.0, "unidad": "grupo", "items": { "P1": 0.20, "P2": 0.30, "P3": 0.50 } },
    { "id": "trabajos_casa", "valor": 2.0, "unidad": "grupo", "escala": 10, "registro": "por_pregunta",
      "solo_presentes_en_la_practica": true,
      "items": { "TC1": 0.40, "TC2": 0.25, "TC3": 0.35 } },
    { "id": "talleres", "valor": 1.0, "items": { "T1": 1, "T2": 1, "T3": 1 } }
  ]
}
```

```json
{
  "id": "SQI_B2", "metodologia": "SQI", "bimestre": 2,
  "componentes": [
    { "id": "practicas", "valor": 3.0, "unidad": "grupo",
      "items": { "P4": 0.20, "P5": 0.20, "P6": 0.20, "P7": 0.40 } },
    { "id": "trabajos_casa", "valor": 1.5, "unidad": "grupo", "escala": 10, "registro": "por_pregunta",
      "solo_presentes_en_la_practica": true,
      "items": { "TC4": 0.20, "TC5": 0.30, "TC7": 0.50 }, "sin_nota": ["TC6"] },
    { "id": "talleres", "valor": 1.0, "items": { "T4": 1, "T5": 1, "T6": 1, "T7": 1 } },
    { "id": "plic", "valor": 0.5, "tipo": "binario" }
  ]
}
```

Aspectos aplicables por práctica SQI:

```json
{
  "P1": ["resp_pred_plan", "ejec_registro", "discusion"],
  "P2": ["resp_pred_plan", "ejec_registro", "analisis", "discusion"],
  "P3": ["resp_pred_plan", "ejec_registro", "analisis", "discusion", "comunicacion"],
  "P4": ["resp_pred_plan", "ejec_registro", "analisis"],
  "P5": ["resp_pred_plan", "ejec_registro", "analisis", "comunicacion"],
  "P6": ["resp_pred_plan", "ejec_registro", "analisis", "discusion", "comunicacion"],
  "P7": ["analisis", "comunicacion"]
}
```

---

## Anexo B: Práctica 1 Clásica (Errores en las medidas)

Caída de una canica desde 4 alturas (h₁ = 1.45 m, h₂ = 1.30 m, h₃ = 1.15 m, h₄ = 1.00 m), con 10 mediciones por altura (40 en total).
- Se calculan t̄, σ_m, δt_total, ε_exp y h_exp = g·t²/2 con sus incertidumbres, y se compara con h₁.
- Tiempo de reacción asumido: 0.2 s. El grupo decide si los errores son dependientes o independientes.
- Nota grupal dentro de los 3.5/6 del 1.er bimestre. Cada estudiante presente tiene además su trabajo preparatorio, y los sorteados, su control oral.
- Secciones oficiales: diseño 20 %, toma de datos 30 % y análisis 50 %, cada una con escala 0–4 (decisión de Joel). El análisis es una sola sección.
- Las tareas de «Refuerzo» de la guía (gráfica h vs t², histograma de g_exp) quedan fuera de la app.

```json
{
  "id": "P1-TRAD", "tipo": "practica", "metodologia": "TRAD", "bimestre": 1,
  "componente": "diseno_datos_analisis",
  "unidad_calificacion": "grupo",
  "individual": ["trabajo_preparatorio", "control_oral"],
  "asistencia": "pase_final_por_grupo",
  "cierre": ["trabajo_firmado"],
  "penalizacion_total": "equipo_no_ordenado",
  "criterios": [
    { "id": "diseno", "nombre": "Diseño experimental", "peso": 0.20, "escala": [0,1,2,3,4],
      "indicadores": [
        "Base de soporte al borde de la mesa y caída libre hasta el piso",
        "Alturas h1 a h4 verificadas con cinta métrica desde el piso hasta la varilla de 10 cm",
        "Protocolo de cronometraje definido (quién dispara, quién detiene)",
        "Error instrumental δ_inst identificado antes de medir" ],
      "niveles": {
        "4": "Montaje correcto a la primera, alturas verificadas, protocolo definido y δ_inst identificado.",
        "2": "Montaje funcional con correcciones tras observación; protocolo improvisado o δ_inst omitido.",
        "0": "Montaje incorrecto o depende totalmente del profesor." } },
    { "id": "datos", "nombre": "Toma de datos", "peso": 0.30, "escala": [0,1,2,3,4],
      "indicadores": [
        "10 mediciones por altura completas (40 en total)",
        "Registro ordenado en la Tabla 1.1 con unidades y cifras coherentes con el cronómetro",
        "Condiciones constantes (posición de salida, cronometrista)",
        "Reparto de roles con participación de todos",
        "Descarte de datos con criterio" ],
      "niveles": {
        "4": "Tabla completa, ordenada, con unidades; datos consistentes y trabajo repartido.",
        "2": "Tabla completa pero con desorden, unidades faltantes o condiciones variables.",
        "0": "Datos incompletos o no registrados." } },
    { "id": "analisis", "nombre": "Análisis", "peso": 0.50, "escala": [0,1,2,3,4],
      "indicadores": [
        "Media, σ_m, δt_total y ε_exp correctos por altura",
        "Decisión razonada sobre errores dependientes o independientes",
        "h_exp = g·t²/2 con propagación de incertidumbre",
        "ε_abs y ε_rel respecto a h1",
        "Distingue error sistemático de aleatorio con ejemplos de la práctica",
        "Interpreta si h_exp es compatible con h1 dentro de la incertidumbre",
        "Explica por qué domina el error de reacción" ],
      "niveles": {
        "4": "Cálculos e incertidumbres correctos, decisiones justificadas y discusión con datos propios y física correcta.",
        "2": "Cálculos correctos pero incertidumbres mal combinadas o sin justificar, o discusión memorizada sin conexión con sus datos.",
        "0": "Sin tratamiento de incertidumbres ni discusión de los resultados." } }
  ],
  "etiquetas": [
    { "id": "montaje_ok", "criterio": "diseno", "signo": "+", "texto": "Montaje correcto y alturas verificadas" },
    { "id": "h_mal_medida", "criterio": "diseno", "signo": "-", "texto": "Medida de h desde un punto equivocado" },
    { "id": "sin_protocolo", "criterio": "diseno", "signo": "-", "texto": "Sin protocolo de cronometraje" },
    { "id": "sin_dinst", "criterio": "diseno", "signo": "-", "texto": "No identificó δ_inst antes de medir" },
    { "id": "tabla_ok", "criterio": "datos", "signo": "+", "texto": "Tabla ordenada y con unidades" },
    { "id": "condiciones_var", "criterio": "datos", "signo": "-", "texto": "Condiciones variables entre mediciones" },
    { "id": "cifras_incoh", "criterio": "datos", "signo": "-", "texto": "Cifras incoherentes con el cronómetro" },
    { "id": "borra_datos", "criterio": "datos", "signo": "-", "texto": "Descartó datos sin justificar" },
    { "id": "un_solo_integrante", "criterio": "datos", "signo": "-", "texto": "Solo un integrante trabaja" },
    { "id": "distingue_errores", "criterio": "analisis", "signo": "+", "texto": "Distingue error sistemático y aleatorio con ejemplos propios" },
    { "id": "confunde_reaccion", "criterio": "analisis", "signo": "-", "texto": "Confunde error de reacción con aleatorio puro" },
    { "id": "sin_dep_indep", "criterio": "analisis", "signo": "-", "texto": "No justifica errores dependientes o independientes" },
    { "id": "propagacion_mal", "criterio": "analisis", "signo": "-", "texto": "Propagación de incertidumbre incorrecta en h_exp" },
    { "id": "sin_comparar", "criterio": "analisis", "signo": "-", "texto": "No compara h_exp con h1 dentro de la incertidumbre" },
    { "id": "memorizado", "criterio": "analisis", "signo": "-", "texto": "Respuesta memorizada, sin conexión con sus datos" }
  ],
  "preguntas_discusion": [
    "¿El tiempo de reacción de 0.2 s es un error sistemático o aleatorio? ¿Se cancela al arrancar y parar el cronómetro?",
    "¿Por qué eligieron errores dependientes (o independientes) para δt_total?",
    "¿Qué le pasaría a ε_rel si cronometrara alguien más rápido?",
    "¿Qué indica que h_exp caiga dentro o fuera del intervalo de incertidumbre?",
    "¿Qué error sistemático quedaría aunque repitieran la medición 1000 veces?"
  ]
}
```

---

## Anexo C: Práctica 1 SQI (Introducción) y trabajo en casa TC1

La guía tiene dos actividades:
- **Actividad I:** discusión grupal sobre «¿Qué es la física experimental?». Las ideas se anotan en el cuaderno y se prepara una respuesta para presentar a la clase.
- **Actividad II:** cada estudiante mide el período del mismo péndulo desde la posición más alta y desde la más baja, lo registra en su diario y responde cuál medición considera más confiable y por qué. También copia los datos de la clase (Tabla 1.1), que necesita para el TC1.

Aspectos aplicables: planificación, ejecución y registro, y discusión (máximo 5 puntos). El análisis se hace en casa (TC1). Según la guía del instructor, la discusión debe dejar dos ideas: el experimento no sirve para «confirmar» la teoría, y un experimento se refina e itera.

Catálogo de aspectos SQI (`/config/sqi/aspectos.json`, común a todas las prácticas):

```json
{
  "resp_pred_plan": { "nombre": "Respuestas, predicciones y planificación", "tipo": "objetiva", "escala": [0,1,2],
    "descriptores": {
      "2": "Responde todas las preguntas. Predicciones, diagramas, variables y decisiones experimentales correctos y justificados.",
      "1": "Responde parcialmente o presenta errores menores. Justificaciones incompletas.",
      "0": "No responde, las respuestas no corresponden a la actividad o no presenta una planificación utilizable." } },
  "ejec_registro": { "nombre": "Ejecución y registro de datos", "tipo": "objetiva", "escala": [0,1,2],
    "descriptores": {
      "2": "Realiza la actividad con un procedimiento adecuado. Registra claramente datos, unidades, observaciones, cambios y fuentes de incertidumbre solicitados.",
      "1": "Realiza la actividad, pero el procedimiento o el registro está incompleto, es poco claro o contiene errores menores.",
      "0": "No realiza la actividad o faltan datos y registros esenciales." } },
  "analisis": { "nombre": "Análisis, interpretación y conclusiones", "tipo": "objetiva", "escala": [0,1,2],
    "descriptores": {
      "2": "Aplica correctamente las herramientas solicitadas y formula interpretaciones y conclusiones coherentes con los resultados.",
      "1": "Análisis parcial o con errores, pero permite reconocer el procedimiento y obtener alguna interpretación razonable.",
      "0": "No realiza el análisis o las conclusiones no se derivan de los datos." } },
  "discusion": { "nombre": "Discusión y reflexión", "tipo": "subjetiva", "escala": [0,1],
    "descriptores": {
      "1": "Participa y registra la discusión, reflexión, estrategia ética, lluvia de ideas o retroalimentación solicitada.",
      "0": "No participa o no registra la actividad solicitada." } },
  "comunicacion": { "nombre": "Comunicación y colaboración", "tipo": "subjetiva", "escala": [0,1],
    "descriptores": {
      "1": "Realiza la presentación o reporte solicitado y existe evidencia de participación en el trabajo grupal.",
      "0": "No realiza la presentación o no existe evidencia de participación." } }
}
```

Configuración de la práctica (`P1-SQI.json`):

```json
{
  "id": "P1-SQI", "tipo": "practica", "metodologia": "SQI", "bimestre": 1,
  "unidad_calificacion": "grupo",
  "aspectos_aplicables": ["resp_pred_plan", "ejec_registro", "discusion"],
  "individual": ["control_oral_sin_nota"],
  "asistencia": "pase_final_por_grupo",
  "cierre": ["trabajo_firmado"],
  "penalizacion_total": "equipo_no_ordenado",
  "indicadores": {
    "resp_pred_plan": [
      "Responde la pregunta de confiabilidad (opciones a a d) y explica su razonamiento en el diario",
      "Sus decisiones sobre cómo medir están justificadas" ],
    "ejec_registro": [
      "Mide por su cuenta el período desde la posición más alta y desde la más baja",
      "Registra datos con unidades y observaciones en el diario",
      "Registra los datos de la clase en una tabla (Tabla 1.1)" ],
    "discusion": [
      "Participa en la discusión grupal sobre qué es la física experimental y anota las ideas",
      "Participa en la discusión dirigida sobre las mediciones" ]
  },
  "etiquetas": [
    { "id": "mide_ambas", "aspecto": "ejec_registro", "signo": "+", "texto": "Mide y registra ambas posiciones por cuenta propia" },
    { "id": "registro_incompleto", "aspecto": "ejec_registro", "signo": "-", "texto": "Registro sin unidades o incompleto" },
    { "id": "sin_datos_clase", "aspecto": "ejec_registro", "signo": "-", "texto": "No registra los datos de la clase" },
    { "id": "justifica_eleccion", "aspecto": "resp_pred_plan", "signo": "+", "texto": "Justifica con razonamiento su elección de la medición más confiable" },
    { "id": "sin_razonamiento", "aspecto": "resp_pred_plan", "signo": "-", "texto": "Responde sin explicar su razonamiento" },
    { "id": "participa_discusion", "aspecto": "discusion", "signo": "+", "texto": "Participa en la discusión y anota las ideas" },
    { "id": "no_anota_ideas", "aspecto": "discusion", "signo": "-", "texto": "No anota las ideas de la discusión" },
    { "id": "hace_preguntas", "aspecto": "discusion", "signo": "+", "texto": "Plantea preguntas o dudas sobre la medición" }
  ],
  "preguntas_discusion": [
    "¿Qué diferencia esperas entre medir desde la posición más alta y desde la más baja? ¿Por qué?",
    "¿Por qué tu medición difiere de la de tus compañeros?",
    "¿Cómo decidirías si una diferencia entre dos medidas es significativa?",
    "¿Qué harías para reducir la incertidumbre de tu medición?",
    "¿Qué es para ti la física experimental?"
  ]
}
```

Trabajo en casa TC1 (`TC1-SQI.json`): cuaderno resuelto a mano y subido como PDF. Ponderación: 40 % de los TC del 1.er bimestre. Rúbrica oficial (Tabla 4 de los lineamientos SQI), registrada pregunta por pregunta y por grupo; los integrantes que faltaron a P1 reciben 0. Sin penalización por entrega tardía.

```json
{
  "id": "TC1-SQI", "tipo": "trabajo_casa", "metodologia": "SQI", "bimestre": 1,
  "practica": "P1", "ponderacion": 0.40,
  "unidad_calificacion": "grupo",
  "solo_presentes_en_la_practica": true,
  "escala_total": 10,
  "registro": "por_pregunta",
  "entrega_tardia": "sin_penalizacion",
  "preguntas": [
    { "id": "1a", "texto": "Objetivos del curso frente a sus expectativas de un laboratorio tradicional", "puntajes": [1, 0] },
    { "id": "1b", "texto": "Los cinco objetivos de aprendizaje aplicados a sus intereses profesionales", "puntajes": [2, 0] },
    { "id": "2a-i", "texto": "Incertidumbre de las mediciones individuales, posición más alta", "puntajes": [1, 0.5, 0] },
    { "id": "2a-ii", "texto": "Incertidumbre de las mediciones individuales, posición más baja", "puntajes": [1, 0.5, 0] },
    { "id": "2b-i", "texto": "Incertidumbre de la media, posición más alta", "puntajes": [1, 0.5, 0] },
    { "id": "2b-ii", "texto": "Incertidumbre de la media, posición más baja", "puntajes": [1, 0.5, 0] },
    { "id": "2c", "texto": "Diferencia entre la incertidumbre individual y la de la media", "puntajes": [1, 0] },
    { "id": "2d", "texto": "Método de medición más confiable, justificado con los resultados", "puntajes": [2, 1, 0] }
  ],
  "etiquetas": [
    { "id": "inc_individual_ok", "pregunta": "2a-i", "signo": "+", "texto": "Calcula bien la incertidumbre de mediciones individuales" },
    { "id": "confunde_inc_media", "pregunta": "2c", "signo": "-", "texto": "Confunde la incertidumbre individual con la incertidumbre de la media" },
    { "id": "conclusion_sin_datos", "pregunta": "2d", "signo": "-", "texto": "Concluye cuál medición es más confiable sin apoyarse en sus datos" },
    { "id": "relaciona_objetivos", "pregunta": "1b", "signo": "+", "texto": "Relaciona los objetivos del curso con sus intereses profesionales con ejemplos" }
  ]
}
```

---

## Anexo D: Taller 1 (Errores en las medidas), común a ambas metodologías

Cada grupo diseña su propio procedimiento, registra los datos y justifica sus decisiones.
- **Actividades:** exactitud y precisión (tiro al blanco); errores sistemáticos y aleatorios con distintas reglas; incertidumbres en medidas indirectas (dependientes e independientes); errores absoluto y relativo.
- En el cronograma A, el T1 llega después de P1 y empieza con la retroalimentación de esa práctica. En el cronograma B es la primera actividad con nota y no hay práctica anterior.

```json
{
  "id": "T1", "tipo": "taller", "metodologia": ["TRAD", "SQI"], "bimestre": 1,
  "pesos": { "asistencia_permanencia": 0.50, "evaluacion_integral": 0.50 },
  "asistencia_permanencia": { "unidad": "estudiante", "fuente": "pase_final_por_grupo",
    "se_retiro_antes": 0.5 },
  "evaluacion_integral": { "unidad": "grupo", "escala": [0, 1, 2],
    "incluye": ["preguntas_y_observaciones_del_docente", "ejecucion", "tareas"], "exige_terminar_taller": false },
  "individual": { "TRAD": ["trabajo_preparatorio", "control_oral"], "SQI": ["control_oral_sin_nota"] },
  "retro_practica_anterior": true,
  "cierre": ["trabajo_firmado"],
  "tareas": [
    { "id": "exactitud_precision", "texto": "Tiro al blanco: x̄, s_x y σ_m; analizar exactitud o precisión; tipos de errores" },
    { "id": "sistematicos_aleatorios", "texto": "Mediciones con distintas reglas en formato x ± δx; discutir errores sistemáticos y aleatorios; influencia de la precisión" },
    { "id": "indirectas_dependientes", "texto": "Longitud total por tramos con suma lineal de errores; cómo crece la incertidumbre" },
    { "id": "indirectas_independientes", "texto": "Magnitud indirecta (área o volumen) con suma en cuadratura; comparar con el valor esperado" },
    { "id": "absoluto_relativo", "texto": "Error absoluto y relativo porcentual respecto a una referencia; ¿es aceptable?" }
  ],
  "preguntas_discusion": [
    "¿Sus tiros fueron más exactos o más precisos? ¿Qué evidencia numérica lo muestra?",
    "¿Qué error sistemático introdujo la regla mal impresa? ¿Desaparece si promedian más mediciones?",
    "¿Por qué las incertidumbres de medidas dependientes se suman linealmente y las independientes en cuadratura?",
    "Si midieran el pasillo con 10 tramos en vez de 5, ¿cómo cambiaría la incertidumbre total?",
    "¿Qué error relativo consideran aceptable para este experimento y por qué?"
  ],
  "etiquetas": [
    { "id": "distingue_exac_prec", "signo": "+", "texto": "Distingue exactitud de precisión con datos propios" },
    { "id": "disena_procedimiento", "signo": "+", "texto": "Diseña su propio procedimiento y justifica sus decisiones" },
    { "id": "registra_x_dx", "signo": "+", "texto": "Registra mediciones como x ± δx con unidades" },
    { "id": "confunde_exac_prec", "signo": "-", "texto": "Confunde exactitud con precisión" },
    { "id": "sin_dep_indep", "signo": "-", "texto": "Aplica la misma regla de propagación sin distinguir dependientes de independientes" },
    { "id": "sin_referencia", "signo": "-", "texto": "No compara con el valor de referencia" },
    { "id": "sigue_guia_sin_decidir", "signo": "-", "texto": "Sigue el ejemplo sugerido sin justificar decisiones" }
  ]
}
```

---

## Anexo E: Estructura sugerida del repositorio

```
/
├── PROYECTO_LABORATORIOS_v4.md   (este archivo)
├── PROGRESS.md
├── docs/
│   ├── modelo-datos.md
│   ├── reglas-oficiales.md      (resumen de §1 con la fuente de cada regla)
│   └── respaldo.md
├── config/
│   ├── semestre-2026B.json      (feriados, fechas de envío, PLIC)
│   ├── cursos-2026B.json        (paralelo, horario, cronograma, metodología)
│   ├── cronogramas/             (A-TRAD, A-SQI, B-TRAD, B-SQI: actividad y lugar por semana)
│   ├── esquemas/                (TRAD_B1, TRAD_B2, SQI_B1, SQI_B2)
│   ├── sqi/aspectos.json
│   ├── control-oral.json
│   ├── trabajo-preparatorio.json
│   ├── excel.json               (hojas, encabezados y zonas de la app en el Excel; Anexo J)
│   ├── esquema-actividad.json
│   └── actividades/             (P1-TRAD, P1-SQI, TC1-SQI … TC7-SQI, T1, …)
├── datos-ejemplo/               (ficticios: Excel con la forma del Anexo J)
├── src/
├── scripts/                     (solo si hace falta: escritura del Excel en Python)
└── tests/
```

---

## Anexo F: Trabajo preparatorio, control oral y Planificación y conocimiento

### F.1 Trabajo preparatorio (`/config/trabajo-preparatorio.json`)

Requisito de ingreso en las dos metodologías. Los estudiantes esperan afuera y Joel revisa uno por uno. Casi todos cumplen, y él solo verifica que hicieron el resumen, sin entrar en detalles.

En la app:
- «Revisión hecha: todos cumplieron» y una lista de novedades (incompleto = 1, no lo hizo = 0).
- La nota se calcula al cerrar el pase final: 2 para quien está presente y no tiene novedad, 0 para quien faltó. No se borra nada.
- En SQI no tiene nota; la pantalla solo sirve para anotar quién no ingresa.

```json
{
  "id": "trabajo_preparatorio",
  "descripcion": "Resumen del material, breve investigación, etc.",
  "requisito_ingreso": { "TRAD": true, "SQI": true },
  "califica": { "TRAD": true, "SQI": false },
  "aplica_a": ["practica", "taller"],
  "unidad": "estudiante",
  "escala": [0, 1, 2],
  "revision": "solo se verifica que hicieron el resumen",
  "descriptores": {
    "2": "Presentó el resumen completo.",
    "1": "Resumen incompleto o muy superficial.",
    "0": "No lo presentó o no corresponde a la práctica."
  },
  "registro": "revision_en_puerta",
  "por_defecto_presentes": 2,
  "novedades": [1, 0],
  "si_no_vino": 0,
  "sin_revision": "pendiente"
}
```

### F.2 Control oral (`/config/control-oral.json`)

- **Meta:** que cada estudiante tenga al menos un control por bimestre, usando las prácticas y los talleres del bimestre.
- **Sorteo:** al inicio de la sesión, 3 o 4 estudiantes (lo elige el profesor según el tiempo), con prioridad para quienes aún no tienen control en el bimestre. Cuando ya todos lo tienen, se sortea entre todos.
- **Cobertura:** la app muestra cuántos faltan y cuántas sesiones quedan en el bimestre sin contar feriados. Sugiere cuántos sortear y avisa si hacen falta más de 4.
  - Ejemplo: GR2QB tiene 22 estudiantes y pierde el T2 por feriado. Le quedan 5 sesiones en el 1.er bimestre, así que en alguna hay que sortear 5.
- Si el sorteado no está, se vuelve a sortear; no cuenta como controlado.
- Hasta 3 preguntas por estudiante.
- **Nota:** en Clásica, 0/1/2 por pregunta, en prácticas y talleres (cuenta en Planificación y conocimiento). En SQI, solo aprobado o no.
- Si el estudiante no está preparado, el profesor puede pedirle que salga: queda como falta en ese evento.

```json
{
  "id": "control_oral",
  "seleccion": "aleatoria",
  "estudiantes_por_sesion": [3, 4],
  "meta": "todos_al_menos_una_vez_por_bimestre",
  "prioridad": "sin_control_en_el_bimestre",
  "sesiones": ["practica", "taller"],
  "max_preguntas_por_estudiante": 3,
  "escala_pregunta": [0, 1, 2],
  "califica": { "TRAD": true, "SQI": false },
  "registro_sin_nota": ["aprobado", "no_aprobado"],
  "puede_pedir_salir": true,
  "nota_control": "suma de puntajes / (2 × preguntas realizadas)"
}
```

### F.3 Planificación y conocimiento (Clásica, individual, 1.5/6)

- **Reparto (decisión de Joel):** 40 % trabajo preparatorio (promedio de los eventos del bimestre) y 60 % control oral. Puntos máximos: 0.6 y 0.9.
- Con varios controles en el bimestre, cuenta el promedio.
- Si alguien llega al cierre sin control, la app lo avisa antes para hacérselo. Si el bimestre se cierra así, la nota sale solo de los preparatorios y queda una observación.

```json
{
  "id": "planificacion_conocimiento", "metodologia": "TRAD", "unidad_calificacion": "estudiante",
  "pesos": { "trabajo_preparatorio": 0.40, "control_oral": 0.60 },
  "control_varios": "promedio",
  "sin_control": "avisar; si se cierra asi, solo_trabajo_preparatorio",
  "trabajo_preparatorio": {
    "escala": [0, 1, 2],
    "descriptores": {
      "2": "Presentó el resumen completo.",
      "1": "Resumen incompleto o muy superficial.",
      "0": "No lo presentó o no corresponde a la práctica."
    }
  },
  "control_oral": {
    "escala_pregunta": [0, 1, 2],
    "descriptores": {
      "2": "Responde correctamente y justifica.",
      "1": "Responde parcialmente, con errores menores o con ayuda.",
      "0": "Respuesta incorrecta o no responde."
    }
  }
}
```

---

## Anexo G: Rúbricas oficiales de los trabajos en casa SQI (Tablas 4–9 de los lineamientos SQI)

Cada TC suma 10 puntos y se registra pregunta por pregunta. En cada pregunta:
- El puntaje mayor exige una respuesta correcta, pertinente y justificada.
- El parcial, cuando existe, corresponde a un procedimiento adecuado con errores de cálculo o a una justificación incompleta.
- El 0 corresponde a no responder, a un procedimiento incorrecto o a una respuesta sin relación con la pregunta.

**TC1: Introducción** (1.er bimestre, 40 %)

| Pregunta | Qué se evalúa | Puntajes |
|---|---|---|
| 1a | Objetivos del curso frente a lo que esperaba de un laboratorio tradicional | 1 · 0 |
| 1b | Los cinco objetivos de aprendizaje aplicados a sus intereses profesionales | 2 · 0 |
| 2a-i, 2a-ii | Incertidumbre de las mediciones individuales (posición más alta; más baja) | 1 · 0.5 · 0 cada una |
| 2b-i, 2b-ii | Incertidumbre de la media (más alta; más baja) | 1 · 0.5 · 0 cada una |
| 2c | Diferencia entre la incertidumbre individual y la de la media | 1 · 0 |
| 2d | Método de medición más confiable, justificado con los resultados | 2 · 1 · 0 |

**TC2: Introducción a la comprobación de modelos** (1.er bimestre, 25 %)

| Pregunta | Qué se evalúa | Puntajes |
|---|---|---|
| 1 | Comparación cuantitativa del período del péndulo a 10° y 20° | 4 · 2 · 0 |
| 2a-i | Cómo una expectativa previa puede ser productiva en un experimento | 1.5 · 0 |
| 2a-ii | Cómo puede ser contraproducente | 1.5 · 0 |
| 2b | Prácticas concretas para reducir el efecto de expectativas y sesgos | 3 · 0 |

**TC3: Comprobación de modelos y ética** (1.er bimestre, 35 %)

| Pregunta | Qué se evalúa | Puntajes |
|---|---|---|
| 1a | Al menos una pregunta nueva y comprobable | 1 · 0 |
| 1b | Reflexión sobre cómo gestionó expectativas y sesgos (los tres aspectos pedidos) | 2 · 0 |
| 2a | Si el objeto alcanza una velocidad terminal, justificado con los datos | 2 · 1 · 0 |
| 2b | Aceleración en el intervalo en que acelera (procedimiento, resultado y unidades) | 3 · 1.5 · 0 |
| 2c | Comparación cuantitativa con la gravedad en Quito | 2 · 1 · 0 |

**TC4: Comprobación y ampliación de modelos** (2.º bimestre, 20 %)

| Pregunta | Qué se evalúa | Puntajes |
|---|---|---|
| 1a | Sistema elástico concreto y pregunta comprobable para la siguiente práctica | 2 · 1 · 0 |
| 1b | Justificación del interés de la propuesta | 1 · 0 |
| 1c | Predicción: cuándo la ley de Hooke es un modelo adecuado | 2 · 1 · 0 |
| 1d | Predicción: cuándo no lo es | 2 · 1 · 0 |
| 1e | Plan de comprobación realizable (mediciones, variables y criterios) | 3 · 1.5 · 0 |

**TC5: Comprobación y ampliación de modelos, parte 2** (2.º bimestre, 30 %)

| Pregunta | Qué se evalúa | Puntajes |
|---|---|---|
| Preguntas de investigación | Dos preguntas comprobables para el proyecto (una sola = 1) | 2 · 1 · 0 |
| 1 | Justificación del interés por investigarlas | 1.5 · 0 |
| 2 | Relación con los resultados del semestre | 1.5 · 0 |
| 3 | Una buena práctica de trabajo en grupo que funcionó | 1 · 0 |
| 4 | Por qué fue efectiva | 1 · 0 |
| 5 | Una práctica de grupo por mejorar | 1 · 0 |
| 6 | Plan de mejora concreto para las prácticas finales | 2 · 1 · 0 |

**TC6:** preparación de la presentación grupal de P7. No tiene nota propia; se evalúa en P7 (comunicación y colaboración).

**TC7: Proyecto, parte 2** (2.º bimestre, 50 %)

| Pregunta | Qué se evalúa | Puntajes |
|---|---|---|
| 1a | Similitudes y diferencias entre el curso y las mediciones de la constante de estructura fina (lectura) | 4 · 2 · 0 |
| 1b-i | Referencia completa del artículo elegido (título, autor, fuente) | 2 · 1 · 0 |
| 1b-ii | Descripción del diseño experimental o del proceso de medición del artículo, con la extensión pedida | 4 · 2 · 0 |

---

## Anexo H: Semestre 2026B (`/config/semestre-2026B.json`, `/config/cursos-2026B.json`, `/config/cronogramas/`)

### H.1 Cursos

```json
[
  { "paralelo": "GR2QB", "dia": "lunes", "inicio": "09:00", "fin": "11:00", "cronograma": "A", "metodologia": "TRAD" },
  { "paralelo": "GR9EB", "dia": "lunes", "inicio": "11:00", "fin": "13:00", "cronograma": "A", "metodologia": "TRAD" },
  { "paralelo": "GR3MB", "dia": "lunes", "inicio": "14:00", "fin": "16:00", "cronograma": "A", "metodologia": "TRAD" },
  { "paralelo": "GR1AA", "dia": "martes", "inicio": "07:00", "fin": "09:00", "cronograma": "A", "metodologia": "SQI" },
  { "paralelo": "GR4EB", "dia": "martes", "inicio": "14:00", "fin": "16:00", "cronograma": "A", "metodologia": "TRAD" },
  { "paralelo": "GR6CD", "dia": "miercoles", "inicio": "07:00", "fin": "09:00", "cronograma": "B", "metodologia": "SQI" },
  { "paralelo": "GR7SA", "dia": "miercoles", "inicio": "14:00", "fin": "16:00", "cronograma": "A", "metodologia": "TRAD" },
  { "paralelo": "GR7EB", "dia": "miercoles", "inicio": "16:00", "fin": "18:00", "cronograma": "A", "metodologia": "TRAD" },
  { "paralelo": "GR3QA", "dia": "jueves", "inicio": "09:00", "fin": "11:00", "cronograma": "B", "metodologia": "TRAD" },
  { "paralelo": "GR1QA", "dia": "jueves", "inicio": "14:00", "fin": "16:00", "cronograma": "A", "metodologia": "TRAD" }
]
```

### H.2 Cronogramas (actividad y lugar por semana)

| Sem. | Fechas | A · Clásica | A · SQI | B · Clásica | B · SQI |
|---|---|---|---|---|---|
| 1 | 28/09–02/10 | Introducción (aula) | Introducción y creación de grupos (aula) | Introducción (lab) | Introducción y creación de grupos (lab) |
| 2 | 05/10–09/10 | P1 (lab) | P1 + TC1 (lab) | T1 (aula) | T1 (aula) |
| 3 | 12/10–16/10 | Refuerzo de errores (aula) | Refuerzo de errores (aula) | Refuerzo de errores (lab) | Refuerzo de errores (lab) |
| 4 | 19/10–23/10 | T1 (aula) | T1 (aula) | P1 (lab) | P1 + TC1 (lab) |
| 5 | 26/10–30/10 | P2 (lab) | P2 + TC2 (lab) | T2 (aula) | T2 (aula) |
| 6 | 02/11–06/11 | T2 (aula) | T2 (aula) | P2 (lab) | P2 + TC2 (lab) |
| 7 | 09/11–13/11 | P3 (lab) | P3 + TC3 (lab) | T3 (aula) | T3 (aula) |
| 8 | 16/11–20/11 | T3 (aula) | T3 (aula) | P3 (lab) | P3 + TC3 (lab) |
| 9 | 23/11–27/11 | P4 (lab) | P4 + TC4 (lab) | T4 (aula) | T4 (aula) |
| 10 | 30/11–04/12 | T4 (aula) | T4 (aula) | P4 (lab) | P4 + TC4 (lab) |
| 11 | 07/12–11/12 | P5 (lab) | P5 + TC5 (lab) | T5 (aula) | T5 (aula) |
| 12 | 14/12–18/12 | T5 (aula) | T5 (aula) | P5 (lab) | P5 + TC5 (lab) |
| 13 | 21/12–25/12 | P6 (lab) | P6 + TC6 sin nota (lab) | T6 (aula) | T6 (aula) |
| 14 | 28/12–01/01 | Receso | Receso | Receso | Receso |
| 15 | 04/01–08/01 | T6 (aula) | T6 (aula) | P6 (lab) | P6 + TC6 sin nota (lab) |
| 16 | 11/01–15/01 | P7 (lab) | P7 + presentación grupal + TC7 (lab) | T7 (aula) | P7 + presentación grupal + TC7 (aula) |
| 17 | 18/01–22/01 | T7 (aula); PLIC | T7 (aula); PLIC | P7 (lab); PLIC | T7 (lab); PLIC |
| 18 | 25/01–29/01 | Revisión de notas (lab) | Revisión de notas (lab) | Revisión de notas (aula) | Revisión de notas (aula) |
| 19 | 01/02–05/02 | Sin clases | Sin clases | Sin clases | Sin clases |

Nombres de las actividades:
- **Prácticas Clásica:** P1 Errores en las medidas · P2 Velocidad media y MRUV · P3 Poleas y polipastos · P4 Segunda ley de Newton · P5 Trabajo y energía · P6 Impulso y momento lineal · P7 MAS.
- **Prácticas SQI:** P1 Introducción · P2 Introducción a la comprobación de modelos · P3 Comprobación de modelos y ética · P4 y P5 Comprobación y ampliación de modelos (partes 1 y 2) · P6 y P7 Proyecto (partes 1 y 2).
- **Talleres (ambas):** T1 Errores en las medidas · T2 Presentación de gráficas · T3 Leyes de Newton · T4 Segunda ley de Newton · T5 Trabajo y energía · T6 Impulso y momento lineal · T7 MAS.

### H.3 Feriados y sesiones perdidas (según la planificación 2026B; verificar con el calendario académico)

| Fecha | Motivo | Cursos de Joel afectados | Actividad perdida |
|---|---|---|---|
| Vie 09/10 (sem. 2) | Independencia de Guayaquil | Ninguno | — |
| Mar 13 a vie 16/10 (sem. 3) | Integración Politécnica: solo hay clases de 07:00–09:00 y 14:00–16:00 (el lunes 12 es normal) | GR7EB y GR3QA | Refuerzo (sin nota) |
| Lun 02/11 y mar 03/11 (sem. 6) | Día de los Difuntos; Independencia de Cuenca | GR2QB, GR9EB, GR3MB, GR1AA y GR4EB | T2 |
| Lun 07/12 (sem. 11) | Fundación de Quito | GR2QB, GR9EB y GR3MB | P5 |
| Jue 24/12 y vie 25/12 (sem. 13) | Navidad | GR1QA y GR3QA | P6 (GR1QA); T6 (GR3QA) |

### H.4 Fechas clave

- Fin del 1.er bimestre en el calendario: jueves 26 de noviembre de 2026.
- Envío de notas del 1.er bimestre: martes 1 de diciembre de 2026 (registro en el SAEW: viernes 4 de diciembre).
- PLIC: jueves 21 de enero de 2027, de 11:00 a 13:00.
- Último día de clases: jueves 28 de enero de 2027.
- Envío de notas del 2.º bimestre: viernes 29 de enero de 2027 (registro en el SAEW: jueves 4 de febrero).

```json
{
  "semestre": "2026B", "inicio": "2026-09-28", "semanas": 19,
  "feriados": [
    { "fecha": "2026-10-09", "motivo": "Independencia de Guayaquil" },
    { "desde": "2026-10-13", "hasta": "2026-10-16", "motivo": "Integración Politécnica",
      "franjas_con_clase": ["07:00-09:00", "14:00-16:00"] },
    { "fecha": "2026-11-02", "motivo": "Día de los Difuntos" },
    { "fecha": "2026-11-03", "motivo": "Independencia de Cuenca" },
    { "fecha": "2026-12-07", "motivo": "Fundación de Quito" },
    { "fecha": "2026-12-24", "motivo": "Navidad" },
    { "fecha": "2026-12-25", "motivo": "Navidad" }
  ],
  "receso": { "desde": "2026-12-28", "hasta": "2027-01-01" },
  "fin_bimestre_1": "2026-11-26",
  "envio_notas": { "1": "2026-12-01", "2": "2027-01-29" },
  "plic": { "fecha": "2027-01-21", "inicio": "11:00", "fin": "13:00" },
  "formato_coordinacion": ["APELLIDOS Y NOMBRES", "NÚMERO ÚNICO", "NOTA(/6)", "PROFESOR"],
  "redondeo_decimales": 2
}
```

---

## Anexo I: Registro de cambios v3 → v4

| # | Tema | v3 | v4 | Fuente |
|---|---|---|---|---|
| 1 | Enfoque | Registrar todo en la app | Evaluar en el aula y guardar asistencia y notas en el Excel del semestre | Joel |
| 2 | Destino de las notas | Exportación JSON y CSV al final | El Excel `Cursos_Lab_MN_2026B.xlsx`, solo en las zonas de la app | Joel |
| 3 | Asistencia | Lista al inicio y al final de cada sesión | Pase al final de la clase, grupo por grupo, con observaciones por estudiante | Joel |
| 4 | Faltas | No contemplado | Quien falta pierde las notas de esa actividad, incluido el TC de esa práctica | Joel; Lineamientos (ambos) §3 y §6–9 |
| 5 | Requisitos de ingreso | Clásica: coloquio y preparatorio con nota; SQI: control y tarea de análisis sin nota | Ambas: coloquio al 100 % y trabajo preparatorio obligatorio; nota solo en Clásica; se verifican fuera de la app | Lineamientos; Joel |
| 6 | Control oral | Máx. 3 estudiantes por práctica, una vez por bimestre | Aleatorio, 3 o 4 por sesión en prácticas y talleres; todos al menos una vez por bimestre; nota solo en Clásica | Joel; Lineamientos profesores §18 |
| 7 | Práctica Clásica | Cuatro criterios (análisis dividido 25/25), escala 0–4 | Tres secciones (diseño 20 %, datos 30 %, análisis 50 %), escala 0–4; todas las prácticas pesan igual | Lineamientos; Joel |
| 8 | Planificación y conocimiento | Propuesta 70 % preparatorio y 30 % control | 40 % preparatorio (solo se verifica el resumen) y 60 % control | Joel |
| 9 | Calificación de los TC (SQI) | Sin rúbrica; nota global | Rúbrica oficial sobre 10, registrada pregunta por pregunta | Lineamientos SQI §10 y §12, Tablas 4–9; Joel |
| 10 | Unidad y plazo de los TC | Grupal; plazo no contemplado | Grupal hasta nuevo aviso; sin penalización por entrega tardía | Joel |
| 11 | Grupos | Fijos por curso | Del Excel (registro QR de la semana 1); en Clásica cambian moviendo estudiantes en la app | Introducción T y SQI; Joel |
| 12 | Navegación | Curso → Grupo → Actividad | Curso → Evento → Grupo | Consecuencia del punto 11 |
| 13 | Talleres | 50 % asistencia + 50 % preguntas y tareas | Igual, como «evaluación integral»; asistencia del pase final; retroalimentación de la práctica anterior | Introducción; Lineamientos profesores §19 |
| 14 | Actividades por bimestre | Por confirmar | P1–P3 y T1–T3 / P4–P7 y T4–T7, asignadas por actividad | Lineamientos profesores, Tablas 3 y 4; Planificación |
| 15 | PLIC | Rúbrica aparte, digitación manual | 0.5 o 0; examen presencial controlado por un profesor; jueves 21 de enero de 2027 | Lineamientos (ambos); Lineamientos profesores §16; Joel |
| 16 | Feriados | No contemplado | Actividad excluida y renormalización; recuperación opcional; lista 2026B | Lineamientos §15 (SQI) y §14 (VF); Planificación |
| 17 | Recuperaciones | No contemplado | Nota recibida o 0; texto para el profesor del estudiante externo | Lineamientos §14 (SQI) y §13 (VF); Lineamientos profesores §10 |
| 18 | Penalización por equipo | No contemplado | Botón opcional: 0 al grupo en la práctica, a criterio del profesor | Lineamientos §1; Lineamientos profesores §15 |
| 19 | Archivo de notas | Por confirmar | Hojas de coordinación en el mismo Excel, con apellidos y nombres en una columna; envíos el 1 de diciembre y el 29 de enero | Lineamientos profesores §17; Planificación; Joel |
| 20 | Redondeo | Sin definir | 2 decimales, redondeo usual | Joel |
| 21 | Calendario | No contemplado | Cronogramas A y B por metodología, sesiones sin nota y receso | Introducción T y SQI (cronogramas) |
| 22 | Privacidad | Solo identificadores | Códigos y nombres; nunca correos | Joel |
| 23 | Feedback | Etiquetas y nota del profesor | Todo lo que registra la app, incluidos control y TC por pregunta | Joel |
| 24 | Respaldo | Última fase | Mínimo en la Fase 1 (también lleva los datos del iPhone a la Mac); completo en la Fase 9 | Uso real desde octubre |
| 25 | Fuera del alcance | — | Volver a usar el QR para los grupos, verificar requisitos, regenerar el Excel, separar apellidos y nombres, evaluar en dos dispositivos a la vez, test final y formularios del aula virtual | Joel; Lineamientos |
| 26 | Revisión del preparatorio | Revisión manual con nota por estudiante | En la puerta: «todos cumplieron» y solo novedades; la nota se calcula con el pase final (quien falta, 0) | Joel |

---

## Anexo J: El Excel del semestre (`Cursos_Lab_MN_2026B.xlsx`)

### J.1 Lo que la app lee

- Una hoja por paralelo, con el nombre del paralelo (GR2QB, GR9EB, …). La hoja «Resumen» no se toca.
- Fila 1: título del curso (paralelo · día y hora · grupo A/B · metodología · laboratorio · aula). Fila 2: número de estudiantes.
- Fila 4: encabezados: N° | Código único | Apellidos y nombres | Correo institucional | Grupo A/B | Metodología | Grupo de trabajo | Observación.
- La app lee Código único, Apellidos y nombres, Grupo A/B, Metodología, Grupo de trabajo y Observación (esta última solo para mostrarla). **No lee el correo.**
- Busca la fila de encabezados por su texto, no por posición, y avisa si falta una columna o si una hoja no corresponde a un curso configurado.
- Las filas de los estudiantes pendientes vienen marcadas en «Observación» («Pendiente de la lista final…»).
- Al volver a leer el archivo:
  - Agrega a los estudiantes nuevos.
  - Marca como «baja» a quien ya no aparece, sin borrar sus notas.
- La columna «Grupo de trabajo» solo da los grupos del primer evento. Después mandan los grupos de la app («Grupo actual»).
- `Asistencia_Semana1_Lab_MN_2026B.xlsx` tiene la misma estructura más una columna «Asistencia» («Asistió», «No asistió», «Asistió · pendiente…», «Sin clase (…)»). Se puede leer una vez para registrar la semana 1.

### J.2 Lo que la app escribe (zonas de la app)

Todo lo demás del archivo queda como está.

**a) En cada hoja de curso**, a la derecha de las columnas existentes, después de una columna vacía:
- Fila 3: franja «1.er bimestre · lo llena la app» o «2.º bimestre · lo llena la app».
- Fila 4: encabezados.
- Contenido, en este orden:
  - «Grupo actual».
  - Una columna por evento con nota del bimestre, en el orden del cronograma del curso. Por ejemplo, en A · Clásica: P1, T1, P2, T2, P3, T3; en A · SQI: P1, TC1, T1, P2, TC2, T2, P3, TC3, T3. Cada una sobre 10.
  - Componentes en puntos: Clásica = Preparatorios (/10), Control (/10), Planificación y conocimiento (/1.5), Diseño, datos y análisis (/3.5 o /3), Talleres (/1) y PLIC (/0.5) en el 2.º. SQI = Control (sí/no), Prácticas (/3), TC (/2 o /1.5), Talleres (/1) y PLIC (/0.5) en el 2.º.
  - «Nota B1 (/6)» y «Nota B2 (/6)».
  - Al final, «Observaciones de la app» (por ejemplo, «P1: no vino · T2: feriado · sin control oral»).
- Valores:
  - Número con 2 decimales si está evaluado.
  - Vacío si falta evaluar o hacer el pase.
  - «—» si el evento no se hizo en ese curso (feriado o sin clase).
  - 0 si el estudiante faltó, con el motivo en las observaciones.

**b) Hoja «Asistencia (app)»:** todos los cursos uno debajo de otro. Columnas: Paralelo | N° | Código único | Apellidos y nombres | S1 … S18 | Asistencias | %. Valores: P (presente), F (no vino o salió), R (se retiró antes), — (sin clase o feriado), vacío (sin pase).

**c) Hoja «Detalle (app)»:** una fila por estudiante y evento, con todo lo registrado.
- Columnas: Paralelo | Código único | Apellidos y nombres | Semana | Fecha | Evento | Grupo | Asistencia | Preparatorio | Control | Puntajes | Nota del grupo | Nota del evento (/10) | Motivo | Observación del profesor.
- «Puntajes» va como texto: por ejemplo «diseño 3 · datos 4 · análisis 2» o «1a 1 · 1b 2 · 2a-i 0.5…».
- Sirve para revisar y para filtrar.

**d) Hojas «Coordinación B1» y «Coordinación B2»:** APELLIDOS Y NOMBRES | NÚMERO ÚNICO | NOTA(/6) | PROFESOR, con los pendientes marcados aparte. Los lineamientos piden nombres y apellidos por separado; Joel decidió no separarlos.

**e) Hoja oculta «_app»:** versión del formato y lo último que escribió la app en cada celda de sus zonas, para detectar ediciones a mano.

**Reglas de escritura**
- La app reescribe por completo sus hojas propias (b, c, d y e). En las hojas de curso solo llena sus columnas, y ubica la fila de cada estudiante por su código.
- Si un estudiante del Excel no está en la app, o al revés, lo avisa y no escribe esa fila.
- Si una celda de la app cambió desde la última escritura, la muestra y pregunta: adoptar el valor del Excel (queda como ajuste con motivo «editado en el Excel») o reemplazarlo.
- Antes de guardar pide cerrar el Excel y descarga una copia del archivo tal como estaba, con la fecha en el nombre. Después guarda sobre el mismo archivo.
