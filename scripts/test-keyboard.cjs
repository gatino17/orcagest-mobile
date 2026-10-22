const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(path.dirname(module.filename), '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = (name) => mocks[name] || require(name);
  loaded._compile(code, filename);
  return loaded.exports;
}
const geometry = load('lib/keyboard.ts');

function harness(options = {}) {
  const slots = [];
  let cursor = 0, effects = [], currentInput = null, metrics = null, tree;
  const viewport = { top: 0, height: 800, ...options.viewport };
  const scrolls = [], listeners = new Map(), externalRef = { current: null };
  const flatten = (value) => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten)) : value || {};
  const host = { measureInWindow: (callback) => callback(0, viewport.top, 360, viewport.height) };
  const native = { getNativeScrollRef: () => host, scrollTo: (value) => scrolls.push(value) };
  const memo = (create, deps) => {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      slots[index] = { value: create(), deps };
    }
    return slots[index].value;
  };
  const react = {
    forwardRef: (render) => render,
    useRef: (value) => {
      const index = cursor++;
      return slots[index] ||= { current: value };
    },
    useState: (initial) => {
      const index = cursor++;
      slots[index] ||= { value: initial };
      return [slots[index].value, (value) => { slots[index].value = value; }];
    },
    useCallback: (callback, deps) => memo(() => callback, deps),
    useImperativeHandle: (ref, create) => { effects.push(() => { ref.current = create(); }); },
    useEffect: (create, deps) => {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: create() };
        });
      }
    },
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  const keyboard = {
    metrics: () => metrics,
    addListener: (name, listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return { remove: () => listeners.get(name).delete(listener) };
    },
  };
  const components = load('components/keyboard-aware.tsx', {
    react,
    'react-native': { Keyboard: keyboard, ScrollView: 'ScrollView', Modal: 'Modal', View: 'View',
      Platform: { OS: options.platform || 'ios' }, StatusBar: { currentHeight: 24 },
      StyleSheet: { flatten, create: (value) => value },
      TextInput: { State: { currentlyFocusedInput: () => currentInput } } },
    '@/lib/keyboard': geometry,
  });
  const component = options.modal
    ? components.KeyboardModal({ visible: true }).props.children[0].type
    : components.KeyboardScrollView;
  const props = { contentContainerStyle: { paddingBottom: 36 }, ...options.props };
  const render = () => {
    cursor = 0;
    effects = [];
    tree = component(props, externalRef);
    tree.props.ref.current = options.modal ? host : native;
    effects.forEach((effect) => effect());
    return tree;
  };
  const emit = (name, top = 500) => {
    metrics = name.endsWith('Hide') ? null : { screenY: top, height: 300 };
    listeners.get(name)?.forEach((listener) => listener({ endCoordinates: metrics }));
  };
  render();
  return { components, render, viewport, scrolls, listeners, externalRef, flatten, emit,
    get props() { return tree.props; },
    focus(top, height = 50) {
      currentInput = { measureInWindow: (callback) => callback(0, top, 240, height) };
      let stopped = false;
      tree.props.onFocus({ stopPropagation: () => { stopped = true; } });
      return { input: currentInput, stopped };
    },
    dispose: () => slots.forEach((slot) => slot.cleanup?.()),
  };
}

test('calcula solo el solapamiento real y no duplica adjustResize', () => {
  assert.equal(geometry.keyboardOverlap({ top: 0, height: 800 }, 500), 300);
  assert.equal(geometry.keyboardOverlap({ top: 24, height: 476 }, 500), 0);
  assert.equal(geometry.keyboardOverlap({ top: 24, height: 776 }, 500), 300);
  assert.equal(geometry.keyboardOverlap({ top: 0, height: 800 }, null), 0);
  assert.equal(geometry.keyboardOverlap({ top: 0, height: 800 }, NaN), 0);
});

test('sube un campo oculto conservando un margen sobre el teclado', () => {
  assert.equal(geometry.focusedFieldScroll({ top: 650, height: 50 }, { top: 0, height: 800 }, 500), 216);
  assert.equal(geometry.focusedFieldScroll({ top: 400, height: 50 }, { top: 0, height: 800 }, 500), 0);
  assert.equal(geometry.focusedFieldScroll({ top: 90, height: 50 }, { top: 100, height: 400 }, 500), -26);
});

test('respeta limites del modal y no recorta arriba campos multilinea altos', () => {
  assert.equal(geometry.focusedFieldScroll({ top: 350, height: 50 }, { top: 100, height: 280 }, 500), 36);
  assert.equal(geometry.focusedFieldScroll({ top: 200, height: 600 }, { top: 100, height: 400 }, 500), 84);
  assert.equal(geometry.focusedFieldScroll({ top: 200, height: 50 }, { top: 100, height: 20 }, 500), 0);
});

test('enfocar contrasena agrega espacio y desplaza solo el campo activo', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const form = harness();
  assert.equal(form.focus(650).stopped, true);
  form.emit('keyboardDidShow');
  form.render();
  assert.equal(form.flatten(form.props.contentContainerStyle).paddingBottom, 352);
  t.mock.timers.tick(100);
  assert.deepEqual(form.scrolls, [{ y: 216, animated: true }]);
  assert.equal(form.props.keyboardShouldPersistTaps, 'handled');
  form.dispose();
});

test('con Android ya redimensionado solo agrega el margen, no otra altura de teclado', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const form = harness({ platform: 'android', viewport: { top: 24, height: 476 } });
  form.focus(650);
  form.emit('keyboardDidShow', 524);
  form.render();
  assert.equal(form.flatten(form.props.contentContainerStyle).paddingBottom, 52);
  t.mock.timers.tick(100);
  assert.deepEqual(form.scrolls, [{ y: 216, animated: true }]);
  form.dispose();
});

test('cambiar de campo con el teclado abierto cancela el desplazamiento anterior', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const form = harness();
  form.focus(650);
  form.emit('keyboardDidShow');
  form.focus(600, 40);
  t.mock.timers.tick(100);
  assert.deepEqual(form.scrolls, [{ y: 156, animated: true }]);
  form.dispose();
});

test('no mueve un campo que ya se ve ni pelea con el desplazamiento manual', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const form = harness();
  form.focus(350);
  form.emit('keyboardDidShow');
  t.mock.timers.tick(100);
  form.props.onScroll({ nativeEvent: { contentOffset: { y: 120 } } });
  t.mock.timers.tick(200);
  assert.deepEqual(form.scrolls, []);
  form.focus(650);
  t.mock.timers.tick(100);
  assert.deepEqual(form.scrolls, [{ y: 336, animated: true }]);
  form.dispose();
});

test('ocultar teclado restaura el espacio y cancela timers; desmontar libera listeners', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const form = harness();
  form.focus(650);
  form.emit('keyboardDidShow');
  form.emit('keyboardDidHide');
  form.render();
  t.mock.timers.tick(200);
  assert.deepEqual(form.scrolls, []);
  assert.equal(form.flatten(form.props.contentContainerStyle).paddingBottom, 36);
  form.dispose();
  assert.equal([...form.listeners.values()].reduce((sum, set) => sum + set.size, 0), 0);
});

test('descarta mediciones de un campo despues de cerrar el formulario', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const form = harness();
  const { input } = form.focus(650);
  let measured;
  input.measureInWindow = (callback) => { measured = callback; };
  form.emit('keyboardDidShow');
  t.mock.timers.tick(100);
  form.dispose();
  measured(0, 650, 240, 50);
  assert.deepEqual(form.scrolls, []);
});

test('listas horizontales conservan foco hacia el formulario y el ref nativo funciona', () => {
  const form = harness({ props: { horizontal: true, keyboardShouldPersistTaps: 'always' } });
  assert.equal(form.focus(650).stopped, false);
  assert.equal(form.listeners.size, 0);
  assert.equal(form.props.keyboardShouldPersistTaps, 'always');
  form.externalRef.current.scrollTo({ y: 0, animated: true });
  assert.deepEqual(form.scrolls, [{ y: 0, animated: true }]);
  form.dispose();
});

test('modales reducen solo el espacio tapado y recuperan su tamano original', () => {
  const modal = harness({ modal: true });
  modal.emit('keyboardDidShow');
  modal.render();
  assert.equal(modal.flatten(modal.props.style).paddingBottom, 300);
  modal.viewport.height = 500;
  modal.props.onLayout();
  modal.render();
  assert.equal(modal.flatten(modal.props.style).paddingBottom, 0);
  modal.emit('keyboardDidHide');
  modal.render();
  assert.equal(modal.flatten(modal.props.style).paddingBottom, 0);
  modal.dispose();
});

test('el modal conserva los callbacks y deja que el nativo termine su animacion al cerrar', () => {
  const form = harness();
  const close = () => {};
  const modal = form.components.KeyboardModal({ visible: false, onRequestClose: close, children: 'formulario' });
  assert.equal(modal.props.visible, false);
  assert.equal(modal.props.onRequestClose, close);
  assert.deepEqual(modal.props.children[0].props.children, ['formulario']);
  form.dispose();
});

test('convierte coordenadas Android y descarta frames de teclado oculto o invalidos', () => {
  assert.equal(geometry.keyboardWindowTop({ screenY: 524, height: 300 }, 24), 500);
  assert.equal(geometry.keyboardWindowTop({ screenY: 500, height: 300 }), 500);
  assert.equal(geometry.keyboardWindowTop({ screenY: 0, height: 300 }, 24), null);
  assert.equal(geometry.keyboardWindowTop({ screenY: 800, height: 0 }, 24), null);
  assert.equal(geometry.keyboardWindowTop(undefined, 24), null);
});

test('todos los formularios usan el comportamiento compartido y Android conserva resize', () => {
  for (const name of ['login', '(tabs)/armado', '(tabs)/inventariobodega', '(tabs)/informes',
    '(tabs)/rendiciones', '(tabs)/consultacentro', '(tabs)/finalizados']) {
    assert.match(fs.readFileSync(path.join(root, 'app', `${name}.tsx`), 'utf8'), /KeyboardScrollView as ScrollView/);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.android.softwareKeyboardLayoutMode, 'resize');
});
