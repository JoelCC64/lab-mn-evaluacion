// Notas escritas en la observación de un grupo («9.5», «1.8»…): se leen como la nota del grupo y pasan a su propio campo
// (nota fijada, con decimales). Funciones puras sobre el contexto del motor; lo que se aplica está en `src/datos/`.
import { gruposDe, notaGrupo, notaTrabajo, topeDeNota, unidadTrabajo } from './motor.js';

const NUMERO = /^\d+(?:[.,]\d+)?$/;

/**
 * Número que el profesor escribió como nota en una observación: el texto entero («9.5», «8,25») o, si hay varias líneas,
 * el que está solo en la última («-8.50» tras viñetas). Devuelve { valor, resto } (resto = el texto sin esa línea; vacío
 * si solo era el número) o null si no hay nota. Los números dentro de una frase («falla por 2 cm») no cuentan.
 */
export function notaEnObservacion(texto) {
  const t = String(texto ?? '').trim();
  if (NUMERO.test(t)) return { valor: Number(t.replace(',', '.')), resto: '' };
  const lineas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas.length < 2) return null;
  const ultima = lineas[lineas.length - 1].replace(/^[-•*]\s*/, '');
  if (!NUMERO.test(ultima)) return null;
  return { valor: Number(ultima.replace(',', '.')), resto: lineas.slice(0, -1).join('\n') };
}

/**
 * Propuestas de un curso: por cada grupo de una práctica o taller (o cada unidad de un trabajo en casa: grupo, o
 * estudiante si el TC es individual) cuya observación trae una nota, con la nota que hoy tiene (en las unidades de la
 * actividad). `revisar` marca lo que conviene mirar antes de aplicar (cambia más del 30 % del tope); `invalida`, un número
 * fuera de 0–tope. Las que ya tienen nota fijada, y los TC que no entregaron, no se proponen.
 * Cada una: { evento, unidad ('grupo' | 'estudiante'), grupo (el id de la unidad), nombre, … }.
 */
export function propuestasDeObservaciones(ctx) {
  const lista = [];
  for (const n of ctx.reg.notas ?? []) {
    const evento = ctx.eventoPorId.get(n.evento);
    if (!evento || !['practica', 'taller', 'trabajo_casa'].includes(evento.tipo) || !evento.con_nota) continue;
    const config = evento.config ? ctx.cfg.actividades[evento.config] : null;
    if (!config) continue;
    const esTC = evento.tipo === 'trabajo_casa';
    if (esTC ? !config.preguntas || n.unidad !== unidadTrabajo(config) : n.unidad !== 'grupo') continue;
    const hallada = notaEnObservacion(n.texto);
    if (!hallada) continue;
    const grupo = String(n.unidad_id);
    const tope = topeDeNota(config);
    let actual, fijada;
    if (esTC) {
      const t = notaTrabajo(ctx, evento, grupo);
      if (t.entregado === false) continue;
      fijada = t.fijada;
      actual = t.completo ? t.puntos : null;
    } else {
      const g = notaGrupo(ctx, evento, grupo);
      if (g.penalizacion) continue;
      fijada = ctx.revisiones.get(`${evento.id}|${grupo}`)?.nota_fijada !== undefined;
      actual = g.completo ? Math.round(g.valor * tope * 100) / 100 : null;
    }
    if (fijada) continue;
    const invalida = hallada.valor > tope;
    lista.push({
      evento, unidad: n.unidad, grupo, nombre: n.unidad === 'estudiante' ? ctx.estudiantePorId.get(grupo)?.nombre ?? grupo : null,
      texto: n.texto, valor: hallada.valor, resto: hallada.resto, tope, actual, invalida,
      revisar: !invalida && actual !== null && Math.abs(hallada.valor - actual) > 0.3 * tope,
      grupos: esTC ? null : gruposDe(ctx, evento),
    });
  }
  return lista.sort((a, b) => a.evento.curso.localeCompare(b.evento.curso) || a.evento.fecha.localeCompare(b.evento.fecha) || a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
}
