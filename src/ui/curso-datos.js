// Datos vivos de un curso: estudiantes, registros y eventos calculados.
import { useMemo } from '../vendor/preact-htm.js';
import { useApp, useVivo } from './base.js';
import { registrosDelCurso } from '../datos/consultas.js';
import { generarEventos } from '../nucleo/calendario.js';
import { DIAS_TEXTO } from '../nucleo/util.js';

export function useCurso(paralelo) {
  const { cfg, db } = useApp();
  const curso = cfg.cursoPorId[paralelo] ?? null;
  const reg = useVivo(() => (curso ? registrosDelCurso(db, paralelo) : Promise.resolve(null)), [paralelo]);
  const eventos = useMemo(
    () => (curso && reg ? generarEventos(cfg, curso, reg.cambios_evento) : null),
    [curso, reg],
  );
  return { curso, reg, eventos, cargando: reg === undefined };
}

export function textoBimestre(b) {
  return b === 1 ? '1.er bimestre' : b === 2 ? '2.º bimestre' : '';
}

export function horario(curso, corto = false) {
  const dia = DIAS_TEXTO[curso.dia];
  return `${corto ? dia.slice(0, 3) : dia} ${curso.inicio}–${curso.fin}`;
}
