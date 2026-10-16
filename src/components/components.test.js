import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ClearableTextarea } from './ClearableTextarea';
import { FileDrop } from './FileDrop';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const render = (element) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(element));
  return el;
};

test('ClearableTextarea shows Clear only when it has content and empties the value', () => {
  const onChange = jest.fn();
  expect(render(React.createElement(ClearableTextarea, { value: '', onChange })).querySelector('button')).toBeNull();
  const el = render(React.createElement(ClearableTextarea, { value: 'abc', onChange }));
  act(() => el.querySelector('button').click());
  expect(onChange).toHaveBeenCalledWith({ target: { value: '' } });
});

test('FileDrop passes dropped files that match accept, and only one unless multiple', () => {
  const onFiles = jest.fn();
  const el = render(React.createElement(FileDrop, { accept: '.csv,image/*', onFiles }));
  const files = [
    new File(['a'], 'notes.txt', { type: 'text/plain' }),
    new File(['b'], 'data.CSV', { type: '' }),
    new File(['c'], 'pic.png', { type: 'image/png' }),
  ];
  const drop = new Event('drop', { bubbles: true });
  drop.dataTransfer = { files };
  act(() => el.querySelector('.file-drop').dispatchEvent(drop));
  expect(onFiles).toHaveBeenCalledWith([files[1]]);
});
