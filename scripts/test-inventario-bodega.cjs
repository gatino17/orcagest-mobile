const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

function cargar(ruta, mocks = {}) {
  const filename = path.resolve(path.dirname(module.filename), '..', ruta);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = new Module(filename, module);
  modulo.filename = filename;
  modulo.require = (nombre) => mocks[nombre] || require(nombre);
  modulo._compile(code, filename);
  return modulo.exports;
}

const inventario = cargar('lib/inventario-bodega.ts');
const registros = Array.from({ length: 40 }, (_, i) => ({
  id_escaneo: i + 1, codigo: '31142', numero_serie: `SERIE-${i + 1}`,
  equipo_nombre: i === 0 ? 'C\u00e1mara Bodega' : 'PC', resultado: 'encontrado',
  created_at: `2026-10-22T10:00:${String(i).padStart(2, '0')}Z`,
}));

test('busca en todo el informe, no solo los seis o diez recientes', () => {
  const ordenados = inventario.ordenarEscaneosInventario(registros);
  assert.equal(inventario.filtrarEquiposInventario(ordenados, 'SERIE-1').some((r) => r.id_escaneo === 1), true);
  assert.equal(inventario.filtrarEquiposInventario(ordenados, '31142').length, 40);
  assert.equal(inventario.filtrarEquiposInventario(ordenados, ' CAMARA ').length, 1);
  assert.equal(inventario.filtrarEquiposInventario(ordenados, 'no existe').length, 0);
  assert.equal(inventario.filtrarEquiposInventario(ordenados, '').length, 40);
});

test('el mismo buscador permite corroborar un faltante por serie o nombre', () => {
  const faltantes = [{ codigo: '60109', numero_serie: '6010900129', equipo_nombre: 'Axis P8221' }];
  assert.equal(inventario.filtrarEquiposInventario(faltantes, '00129').length, 1);
  assert.equal(inventario.filtrarEquiposInventario(faltantes, 'axis').length, 1);
});

test('incorpora el ultimo registro primero sin duplicar el aviso del servidor', () => {
  const nuevo = { ...registros[0], id_escaneo: 41, numero_serie: 'NUEVO', created_at: '2026-10-22T11:00:00Z' };
  const una = inventario.incorporarEscaneoInventario(registros, nuevo);
  const dos = inventario.incorporarEscaneoInventario(una, nuevo);
  assert.equal(dos.length, 41);
  assert.equal(dos[0].id_escaneo, 41);
  assert.equal(registros.length, 40);
  assert.equal(registros[0].id_escaneo, 1);
});

test('desempata por id y no confunde unidades que comparten codigo', () => {
  const a = { ...registros[0], id_escaneo: 1 };
  const b = { ...a, id_escaneo: 2, numero_serie: 'OTRA' };
  assert.deepEqual(inventario.ordenarEscaneosInventario([a, b]).map((r) => r.id_escaneo), [2, 1]);
});

test('conserva los mismos resultados visibles que la web', () => {
  for (const resultado of ['encontrado', 'manual', 'no_corresponde']) {
    assert.equal(inventario.esEscaneoVisible({ resultado }), true);
  }
  for (const resultado of ['duplicado', 'no_esperado']) {
    assert.equal(inventario.esEscaneoVisible({ resultado }), false);
  }
});

test('una respuesta anterior no puede reemplazar el informe mas reciente', async () => {
  const control = inventario.crearControlConsultasInventario();
  let resolver;
  const anterior = control.iniciar('detalle');
  const espera = new Promise((resolve) => { resolver = resolve; });
  const tardia = espera.then(() => control.vigente('detalle', anterior));
  const actual = control.iniciar('detalle');
  resolver();
  assert.equal(await tardia, false);
  assert.equal(control.vigente('detalle', actual), true);
});

test('cambiar informe, guardar o salir invalida las consultas pendientes', () => {
  const control = inventario.crearControlConsultasInventario();
  const lista = control.iniciar('lista');
  const activa = control.iniciar('activa');
  const detalle = control.iniciar('detalle');
  control.invalidar('activa');
  assert.equal(control.vigente('activa', activa), false);
  assert.equal(control.vigente('detalle', detalle), true);
  control.invalidar();
  assert.equal(control.vigente('lista', lista), false);
  assert.equal(control.vigente('detalle', detalle), false);
});

function realtime() {
  const conexiones = [];
  const modulo = cargar('lib/realtime.ts', {
    'socket.io-client': { io: () => {
      const socket = new EventEmitter();
      socket.disconnect = mock.fn();
      conexiones.push(socket);
      return socket;
    } },
    '@/lib/api': { SOCKET_URL: 'http://test.invalid', SOCKET_TRANSPORTS: ['polling'] },
  });
  return { ...modulo, conexiones };
}

test('recibe cambios y refresca al reconectar, sin acumular listeners', () => {
  const rt = realtime();
  const cambio = mock.fn();
  const reconectar = mock.fn();
  const cerrar = rt.subscribeInventarioUpdated(cambio, reconectar);
  const socket = rt.conexiones[0];
  socket.emit('inventario_updated', { tipo: 'escaneo_creado', id_toma: 1 });
  socket.emit('connect');
  assert.equal(cambio.mock.calls.length, 1);
  assert.equal(reconectar.mock.calls.length, 1);
  cerrar();
  socket.emit('connect');
  socket.emit('inventario_updated', {});
  assert.equal(cambio.mock.calls.length, 1);
  assert.equal(reconectar.mock.calls.length, 1);
  assert.equal(socket.disconnect.mock.calls.length, 1);
});

test('al salir de inventario no desconecta otras pantallas suscritas', () => {
  const rt = realtime();
  const salirArmado = rt.subscribeArmadoUpdated(() => {});
  const salirInventario = rt.subscribeInventarioUpdated(() => {});
  assert.equal(rt.conexiones.length, 1);
  salirInventario();
  assert.equal(rt.conexiones[0].disconnect.mock.calls.length, 0);
  salirArmado();
  assert.equal(rt.conexiones[0].disconnect.mock.calls.length, 1);
  rt.subscribeInventarioUpdated(() => {})();
  assert.equal(rt.conexiones.length, 2);
});
