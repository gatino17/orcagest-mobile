const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
global.__DEV__ = false;

function cargar(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = (name) => mocks[name] || require(name);
  loaded._compile(code, filename);
  return loaded.exports;
}
const lib = cargar('lib/armado-seleccion.ts');
const equipo = lib.elementoBulto('equipo', '1', 'PC', true, 'normal');
const material = lib.elementoBulto('material', '1', 'Cable', true);
const nuevo = lib.elementoBulto('equipo', 'grupo-2', 'Router', true);

test('identifica equipos, materiales y nuevos sin mezclar ids compartidos', () => {
  assert.notEqual(equipo.key, material.key);
  assert.equal(equipo.guardado, true);
  assert.equal(material.guardado, true);
  assert.equal(nuevo.guardado, false);
});
test('no habilita elementos vacios, pendientes o que no aplican', () => {
  for (const estado of ['pendiente', 'no_aplica']) assert.equal(lib.elementoBulto('equipo', '1', 'PC', true, estado).habilitado, false);
  assert.equal(lib.elementoBulto('material', '1', 'Cable', false).habilitado, false);
});
test('seleccionar y desmarcar un elemento no modifica los originales', () => {
  const keys = [equipo.key];
  assert.deepEqual(lib.alternarSeleccion(keys, material.key), [equipo.key, material.key]);
  assert.deepEqual(lib.alternarSeleccion(keys, equipo.key), []);
  assert.deepEqual(keys, [equipo.key]);
});
test('selecciona solo visibles habilitados y conserva las selecciones de otro filtro', () => {
  const vacio = lib.elementoBulto('material', '2', 'Sin cantidad', false);
  const keys = lib.alternarTodosVisibles([equipo.key], [material, vacio]);
  assert.deepEqual(keys, [equipo.key, material.key]);
  assert.deepEqual(lib.alternarTodosVisibles(keys, [material, vacio]), [equipo.key]);
});
test('al actualizar la lista quita eliminados o invalidados sin conservar selecciones fantasma', () => {
  assert.deepEqual(lib.seleccionVigente([equipo.key, equipo.key, 'equipo:999', material.key], [equipo]), [equipo.key]);
});
test('la asignacion envia solo ids guardados y caja, nunca cantidades ni series', () => {
  const resultado = lib.prepararAsignacionBulto([equipo.key, material.key, nuevo.key], [equipo, material, nuevo], 'Caja 2');
  assert.deepEqual(resultado.payload, { caja: 'Caja 2', equipos: [1], materiales: [1] });
  assert.deepEqual(resultado.nuevos, [nuevo]);
  assert.equal(resultado.seleccionados.length, 3);
});
test('un material mostrado tambien en Equipos se asigna una sola vez', () => {
  const resultado = lib.prepararAsignacionBulto([material.key], [material, material], 'Caja 1');
  assert.deepEqual(resultado.payload.materiales, [1]);
  assert.equal(resultado.seleccionados.length, 1);
});
test('una lista filtrada vacia no selecciona elementos ocultos', () => {
  assert.deepEqual(lib.alternarTodosVisibles([equipo.key], []), [equipo.key]);
});
test('la llamada usa PATCH para el armado correcto y devuelve la respuesta del servidor', async () => {
  const patch = mock.fn(async () => ({ data: { caja: 'Caja 2', count: 2 } }));
  const api = cargar('lib/api.ts', {
    axios: { create: () => ({ patch, interceptors: { request: { use() {} } } }) },
    'react-native': { Platform: { OS: 'android' } }, 'expo-secure-store': {},
  });
  const payload = { caja: 'Caja 2', equipos: [1], materiales: [1] };
  assert.deepEqual(await api.asignarBultoArmado(7, payload), { caja: 'Caja 2', count: 2 });
  assert.deepEqual(patch.mock.calls[0].arguments, ['/armados/7/asignar-bulto', payload]);
});

function cola(asignarBultoArmado) {
  const storage = new Map();
  const lib = cargar('lib/offline-queue.ts', {
    'expo-secure-store': { getItemAsync: async (k) => storage.get(k), setItemAsync: async (k, v) => storage.set(k, v), deleteItemAsync: async (k) => storage.delete(k) },
    '@/lib/api': { asignarBultoArmado },
  });
  return lib;
}
test('la cola sincroniza una asignacion con solo caja e ids', async () => {
  const api = mock.fn(async () => ({}));
  const queue = cola(api);
  const data = { caja: 'Caja 2', equipos: [1], materiales: [2] };
  await queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId: '7', data });
  assert.equal((await queue.getOfflineStatus()).pending, 1);
  assert.deepEqual(await queue.syncOfflineQueue(), { synced: 1, pending: 0 });
  assert.deepEqual(api.mock.calls[0].arguments, ['7', data]);
});
test('sin red conserva la asignacion pendiente para reintentar', async () => {
  const queue = cola(async () => { throw new Error('Network Error'); });
  await queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId: 7, data: { caja: 'Caja 2', equipos: [1], materiales: [] } });
  assert.deepEqual(await queue.syncOfflineQueue(), { synced: 0, pending: 1 });
  assert.match((await queue.getOfflineStatus()).notice, /pendientes por sincronizar/);
});

test('si la caja se cerro mientras estaba sin red informa el rechazo y no anuncia exito', async () => {
  const queue = cola(async () => { throw { response: { status: 409, data: { message: 'El bulto esta cerrado.' } } }; });
  await queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId: 7, data: { caja: 'Caja 2', equipos: [1], materiales: [] } });
  assert.deepEqual(await queue.syncOfflineQueue(), { synced: 0, pending: 0 });
  const estado = await queue.getOfflineStatus();
  assert.match(estado.notice, /No se pudo sincronizar/);
  assert.match(estado.notice, /cerrado/);
  assert.doesNotMatch(estado.notice, /Todo en linea/);
});

test('dos asignaciones encoladas simultaneamente no se pisan', async () => {
  const queue = cola(async () => ({}));
  await Promise.all([1, 2, 3].map((armadoId) => queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId, data: {} })));
  assert.equal((await queue.listPendingOfflineOps()).length, 3);
});

test('un error temporal del servidor conserva la asignacion para reintentar', async () => {
  const queue = cola(async () => { throw { response: { status: 500 } }; });
  await queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId: 7, data: { caja: 'Caja 2', equipos: [1], materiales: [] } });
  assert.deepEqual(await queue.syncOfflineQueue(), { synced: 0, pending: 1 });
});

test('una operacion agregada durante la sincronizacion no desaparece al terminar el lote', async () => {
  let resolver;
  let iniciar;
  const iniciada = new Promise((resolve) => { iniciar = resolve; });
  const queue = cola(() => new Promise((resolve) => { resolver = resolve; iniciar(); }));
  await queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId: 1, data: {} });
  const sincronizacion = queue.syncOfflineQueue();
  await iniciada;
  await queue.enqueueOfflineOp('asignar_bulto_armado', { armadoId: 2, data: {} });
  resolver({});
  assert.deepEqual(await sincronizacion, { synced: 1, pending: 1 });
  assert.equal((await queue.listPendingOfflineOps())[0].payload.armadoId, 2);
});
