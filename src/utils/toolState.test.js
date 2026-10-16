import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolIdContext, clearToolState, useToolState } from './toolState';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let setter;
function Probe() {
  const [v, setV] = useToolState('text', 'initial');
  setter = setV;
  return React.createElement('span', null, v);
}

const mount = (toolId) => {
  const el = document.createElement('div');
  const root = createRoot(el);
  act(() => root.render(React.createElement(ToolIdContext.Provider, { value: toolId }, React.createElement(Probe))));
  return { el, root };
};

test('useToolState keeps a draft across remounts until the tool is reset', () => {
  let { el, root } = mount('demo');
  expect(el.textContent).toBe('initial');
  act(() => setter('pasted'));
  act(() => root.unmount());

  ({ el, root } = mount('demo'));
  expect(el.textContent).toBe('pasted');
  act(() => root.unmount());

  expect(mount('other').el.textContent).toBe('initial');

  clearToolState('demo');
  expect(mount('demo').el.textContent).toBe('initial');
});
