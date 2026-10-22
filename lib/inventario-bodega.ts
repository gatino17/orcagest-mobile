export const normalizarInventario = (valor: unknown) => String(valor || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export const esEscaneoVisible = (item: any) =>
  !['duplicado', 'no_esperado'].includes(normalizarInventario(item?.resultado));

export const filtrarEquiposInventario = <T extends Record<string, any>>(items: T[], busqueda: string): T[] => {
  const texto = normalizarInventario(busqueda);
  if (!texto) return items;
  return items.filter((item) => [item.codigo, item.numero_serie, item.equipo_nombre,
    item.revision_area, item.estado_sistema, item.ubicacion_sistema]
    .some((valor) => normalizarInventario(valor).includes(texto)));
};

export const ordenarEscaneosInventario = <T extends Record<string, any>>(items: T[]): T[] => [...items].sort((a, b) =>
  (Date.parse(String(b.created_at || '')) || 0) - (Date.parse(String(a.created_at || '')) || 0)
  || Number(b.id_escaneo || 0) - Number(a.id_escaneo || 0));

export const incorporarEscaneoInventario = <T extends Record<string, any>>(items: T[], nuevo: T): T[] =>
  ordenarEscaneosInventario([nuevo, ...items.filter((item) => Number(item.id_escaneo) !== Number(nuevo.id_escaneo))]);

type CanalConsulta = 'lista' | 'activa' | 'detalle';
export const crearControlConsultasInventario = () => {
  const versiones = { lista: 0, activa: 0, detalle: 0 };
  return {
    iniciar: (canal: CanalConsulta) => ++versiones[canal],
    vigente: (canal: CanalConsulta, version: number) => versiones[canal] === version,
    invalidar: (canal?: CanalConsulta) => {
      if (canal) versiones[canal] += 1;
      else Object.keys(versiones).forEach((key) => { versiones[key as CanalConsulta] += 1; });
    },
  };
};
