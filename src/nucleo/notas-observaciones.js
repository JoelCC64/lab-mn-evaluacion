// Notas escritas en la observación de un grupo («9.5», «1.8»…): se leen como la nota del grupo y pasan a su propio campo
// (nota fijada, con decimales). Funciones puras sobre el contexto del motor; lo que se aplica está en `src/datos/`.
import { gruposDe, notaGrupo, topeDeNota } from './motor.js';

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
 * Propuestas de un curso: por cada grupo de una práctica o taller cuya observación trae una nota, con la nota que hoy
 * tiene (en las unidades de la actividad). `revisar` marca lo que conviene mirar antes de aplicar (cambia más del 30 % del
 * tope); `invalida`, un número fuera de 0–tope. Las que ya tienen nota fijada no se proponen.
 */
export function propuestasDeObservaciones(ctx) {
  const lista = [];
  for (const n of ctx.reg.notas ?? []) {
    if (n.unidad !== 'grupo') continue;
    const evento = ctx.eventoPorId.get(n.evento);
    if (!evento || !['practica', 'taller'].includes(evento.tipo) || !evento.con_nota) continue;
    const config = evento.config ? ctx.cfg.actividades[evento.config] : null;
    if (!config) continue;
    const hallada = notaEnObservacion(n.texto);
    if (!hallada) continue;
    const grupo = String(n.unidad_id);
    if (ctx.revisiones.get(`${evento.id}|${grupo}`)?.nota_fijada !== undefined) continue;
    const tope = topeDeNota(config);
    const g = notaGrupo(ctx, evento, grupo);
    if (g.penalizacion) continue;
    const actual = g.completo ? Math.round(g.valor * tope * 100) / 100 : null;
    const invalida = hallada.valor > tope;
    lista.push({
      evento, grupo, texto: n.texto, valor: hallada.valor, resto: hallada.resto, tope, actual, invalida,
      revisar: !invalida && actual !== null && Math.abs(hallada.valor - actual) > 0.3 * tope,
      grupos: gruposDe(ctx, evento),
    });
  }
  return lista.sort((a, b) => a.evento.curso.localeCompare(b.evento.curso) || a.evento.fecha.localeCompare(b.evento.fecha) || a.grupo.localeCompare(b.grupo, 'es', { numeric: true }));
}
