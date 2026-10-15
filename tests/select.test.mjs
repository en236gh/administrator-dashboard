import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';

function harness(props) {
  const states = [];
  let cursor = 0;
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return states[index] ??= { current: initial }; },
    useId() { return 'test-select'; }, useEffect() {},
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/ui/select.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => name === 'react' ? hooks : jsx,
  });
  function nodes(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate));
    return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
  }
  function render() { cursor = 0; return exports.Select(props); }
  function find(predicate) { return nodes(render(), predicate)[0]; }
  const native = { value: '', disabled: false };
  let focused = false;
  find(n => n.type === 'select').props.ref.current = native;
  find(n => n.type === 'button').props.ref.current = { matches: () => !!props.disabled, focus: () => { focused = true; } };
  const key = value => find(n => n.props?.role === 'combobox').props.onKeyDown({ key: value, preventDefault() {} });
  return { render, find, nodes, key, native, focused: () => focused };
}
const children = [jsx.jsx('option', { value: '', children: 'Choose course' }), jsx.jsx('option', { value: 'a', children: 'Accounting' }), jsx.jsx('option', { value: 'b', disabled: true, children: 'Biology' }), jsx.jsx('option', { value: 'c', children: 'Computing' })];

test('search and keyboard selection update the submitted value and restore focus', () => {
  let selected;
  const h = harness({ name: 'course', required: true, children, onChange: event => { selected = event.target.value; } });
  assert.equal(h.find(n => n.type === 'select').props.required, true);
  h.find(n => n.type === 'button').props.onClick();
  h.find(n => n.props?.role === 'combobox').props.onChange({ target: { value: 'Comput' } });
  assert.equal(h.nodes(h.render(), n => n.props?.role === 'option').length, 1);
  h.key('Enter');
  assert.equal(selected, 'c');
  assert.equal(h.find(n => n.type === 'select').props.value, 'c');
  assert.equal(h.find(n => n.type === 'button').props['aria-expanded'], false);
  assert.equal(h.focused(), true);
});

test('arrow navigation skips disabled options and escape preserves the selection', () => {
  let selected;
  const h = harness({ children, onChange: event => { selected = event.target.value; } });
  h.find(n => n.type === 'button').props.onClick();
  h.key('ArrowDown'); h.key('ArrowDown'); h.key('Enter');
  assert.equal(selected, 'c');
  h.find(n => n.type === 'button').props.onClick(); h.key('ArrowDown'); h.key('Escape');
  assert.equal(h.find(n => n.type === 'select').props.value, 'c');
  assert.equal(h.find(n => n.type === 'button').props['aria-expanded'], false);
});

test('required-field errors focus the visible control and disabled controls stay disabled', () => {
  const h = harness({ name: 'venue', required: true, disabled: true, children });
  assert.equal(h.find(n => n.type === 'select').props.disabled, true);
  assert.equal(h.find(n => n.type === 'button').props.disabled, true);
  h.find(n => n.type === 'select').props.onInvalid({ preventDefault() {} });
  assert.ok(h.find(n => n.props?.role === 'alert'));
  assert.equal(h.focused(), true);
});
