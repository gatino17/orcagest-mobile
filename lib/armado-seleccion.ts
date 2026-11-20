export type ElementoBulto = {
  key: string;
  tipo: 'equipo' | 'material';
  id: string;
  nombre: string;
  guardado: boolean;
  habilitado: boolean;
};

export function elementoBulto(tipo: ElementoBulto['tipo'], id: string, nombre: string, tieneDatos: boolean, estado?: string): ElementoBulto {
  const normal = String(estado || 'normal').trim().toLowerCase() === 'normal';
  return { key: `${tipo}:${id}`, tipo, id, nombre,
    guardado: /^[1-9]\d*$/.test(id), habilitado: normal && tieneDatos };
}

export function seleccionVigente(keys: string[], elementos: ElementoBulto[]): string[] {
  const habilitados = new Set(elementos.filter((item) => item.habilitado).map((item) => item.key));
  return [...new Set(keys)].filter((key) => habilitados.has(key));
}

export function alternarSeleccion(keys: string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
}

export function alternarTodosVisibles(keys: string[], elementos: ElementoBulto[]): string[] {
  const visibles = new Set(elementos.filter((item) => item.habilitado).map((item) => item.key));
  if ([...visibles].every((key) => keys.includes(key))) return keys.filter((key) => !visibles.has(key));
  return [...new Set([...keys, ...visibles])];
}

export function prepararAsignacionBulto(keys: string[], elementos: ElementoBulto[], caja: string) {
  const vigentes = new Set(seleccionVigente(keys, elementos));
  const seleccionados = [...new Map(elementos.filter((item) => vigentes.has(item.key)).map((item) => [item.key, item])).values()];
  return {
    seleccionados,
    nuevos: seleccionados.filter((item) => !item.guardado),
    payload: {
      caja,
      equipos: seleccionados.filter((item) => item.guardado && item.tipo === 'equipo').map((item) => Number(item.id)),
      materiales: seleccionados.filter((item) => item.guardado && item.tipo === 'material').map((item) => Number(item.id)),
    },
  };
}
