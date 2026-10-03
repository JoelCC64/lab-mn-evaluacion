# Progreso

Plan: [PROYECTO_LABORATORIOS_v4.md](PROYECTO_LABORATORIOS_v4.md). Al empezar una sesión, leer el plan y este archivo; al terminar una fase, actualizar este archivo y hacer commit.

## Estado

| Fase | Estado | Fecha |
|---|---|---|
| 0. Preparación y configuración del semestre | ✅ Completa | 3-oct-2026 |
| 1. Lectura del Excel, navegación y respaldo | ✅ Completa | 3-oct-2026 |
| 2. La clase: prácticas, control oral, asistencia y preparatorio | ⏳ | |
| 3. Escritura en el Excel (Mac, Chrome) | — | |
| 4–9 | — | |

## Fase 0 (3-oct-2026)

**Hecho**
- **Entorno aislado:**
  - `.venv` (uv) con Python, nodeenv y openpyxl.
  - Node 24.21.0 dentro del mismo `.venv`.
  - Dependencias en `node_modules`.
  - `scripts/crear-entorno.sh` lo recrea. Una guarda impide `npm install` y `npm test` con un Node global.
- **Stack final:**
  - HTML + JavaScript (módulos ES) sin paso de compilación.
  - Preact + htm (13 KB, un solo archivo) para la interfaz.
  - Dexie 4 (IndexedDB).
  - ExcelJS 4.4 para el Excel; se carga solo al leerlo o escribirlo.
  - Pruebas con el corredor de Node, fake-indexeddb y Ajv.
  - Las librerías del navegador están copiadas en `src/vendor` (con licencias).
- **Configuración real** en `/config`:
  - 10 cursos y calendario 2026B (Anexo H).
  - 4 cronogramas: A/B × Clásica/SQI.
  - Esquemas de nota TRAD/SQI B1/B2 (Anexo A).
  - Catálogo de actividades.
  - Aspectos SQI y aspectos por práctica.
  - P1-TRAD, P1-SQI, T1 y TC1–TC7 (Anexos B, C, D y G).
  - Control oral, trabajo preparatorio, Planificación y conocimiento, asistencia y estructura del Excel.
- **Esquemas JSON** en `config/schemas/`. `npm run config` valida forma y reglas cruzadas: pesos que suman 1, TC que suman 10, aspectos oficiales y referencias de etiquetas. También genera `config/manifest.json`.
- **Datos ficticios** en `datos-ejemplo/`, generados con openpyxl copiando el formato de `generar.py`:
  - Excel del semestre con 10 hojas de curso (17 a 22 estudiantes), grupos de 3 y 4, algunos sin grupo, 2 pendientes en fila ámbar y correos falsos.
  - Excel de asistencia de la semana 1.
- **Documentación:** `docs/modelo-datos.md` y `docs/reglas-oficiales.md`.
- **Pruebas** (23): configuración, casos que deben fallar, calendario con las sesiones perdidas del Anexo H y forma del Excel ficticio.

**Decisiones de implementación**
- **Los eventos se calculan desde la configuración; no se guardan.** Id `PARALELO:CÓDIGO`. Solo se guardan los cambios manuales de estado.
- **Sesiones sin nota.** Introducción, refuerzo y revisión de notas también son eventos, para registrar su asistencia (columnas S1…S18).
- **El TC sigue a su práctica.** Si la práctica se pierde, el TC queda excluido.
- **Valores definidos por defecto** (se cambian en la configuración):
  - «Salió» en el control cuenta como control con nota 0 (`control-oral.json → salio`). Pierde la actividad, pero ya tuvo su control.
  - Frases rápidas de observación: «Está pero no trabaja», «Llegó tarde», «Participa poco», «Trabajo destacado» (`asistencia.json`).
- **Planificación y conocimiento.** Su JSON incluye `valor: 1.5`. Los esquemas PLIC del B2 llevan `items: { PLIC: 1 }` para enlazar la actividad.
- **El plan se movió a la raíz de este repositorio** (Anexo E).

## Fase 1 (3-oct-2026) · versión 0.2.0

**Hecho**
- **Base local** (Dexie, una base por semestre: `lab-mn-2026B`) con el modelo de `docs/modelo-datos.md`.
- **Lectura del Excel del semestre** (`src/nucleo/excel-lectura.js`):
  - Busca los encabezados por su texto, en cualquier fila y orden.
  - No lee la columna de correo y quita cualquier correo colado en el nombre o la observación.
  - Reporta errores: filas sin código y códigos repetidos.
  - Avisa de hojas desconocidas, columnas faltantes y diferencias de cronograma o metodología.
- **Importación con vista previa** antes de guardar (nuevos, actualizados, bajas, por curso). Al volver a leer:
  - Agrega a los nuevos.
  - Marca «baja» a quien ya no está, sin borrar sus evaluaciones.
  - Reactiva a quien vuelve.
  - Si una hoja falta, no da de baja a nadie de ese curso.
- **Asistencia de la semana 1** (opcional): presente/no vino en la Introducción, con el pase cerrado. Los cursos sin clase (GR2QB) quedan «sin clase».
- **Navegación** Curso → Evento → Grupo:
  - Metodología y cronograma visibles.
  - Estado de cada evento: pendiente, en curso, pase hecho, evaluado, feriado o sin clase.
  - Sesión sugerida: la de la semana; el fin de semana, la próxima.
- **Grupos por evento** (`src/nucleo/grupos.js`): instantánea propia → evento anterior → Excel. El TC usa los de su práctica.
- **Respaldo JSON:**
  - Exportar (en el iPhone, hoja de compartir para AirDrop; en la Mac, descarga).
  - Restaurar con validación (formato, versión, semestre) y confirmación «Reemplazar todo».
- **PWA:**
  - Manifiesto, íconos (péndulo) y service worker generado por `npm run build` con todos los archivos.
  - Sin conexión: en localhost primero la red; publicada, primero la caché.
  - Una versión nueva se instala solo cuando Joel toca «Actualizar».
- **Demostración** (`?demo=1`): una base aparte con el Excel ficticio, para probar sin tocar los datos reales.
- **Pruebas** (44 en total):
  - Lector del Excel.
  - Importación y relectura.
  - Ningún «@» guardado.
  - Respaldo: exportar → borrar → restaurar → idéntico.
  - Grupos.
  - PWA al día.

**Verificado en el navegador** (375 px):
- Se lee el Excel ficticio y se navega por cursos, eventos y grupos.
- La asistencia de la semana 1 queda registrada.
- Los datos persisten al recargar.
- Con el servidor apagado, la app abre desde la caché con sus datos.

**Notas**
- El panel de vista previa no pudo lanzar el servidor (el proceso quedaba detenido antes de arrancar, probablemente por un permiso de macOS). Se usa `npm run servidor` desde la terminal y el panel se conecta a http://localhost:8765.
- Para instalar la app en el iPhone hace falta publicarla con HTTPS (por ejemplo GitHub Pages). Sin eso, el service worker no se registra fuera de localhost.

## Pendiente

- Fase 2: motor de notas, control oral, evaluación por grupo, pase final y revisión del preparatorio.
- Antes de la Fase 6: nombre del profesor para la columna PROFESOR de las hojas de coordinación.
- Publicación con HTTPS (por ejemplo GitHub Pages) para instalar la app en el iPhone. Lo decide Joel.
