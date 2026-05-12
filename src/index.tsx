import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PluginAPI } from './types.js';
import { ReaderApp } from './ReaderApp.js';

// Track React roots per container so unmount() can clean up correctly
// even if the host instantiates the plugin in multiple containers.
const roots = new WeakMap<HTMLElement, Root>();

export function mount(container: HTMLElement, api: PluginAPI): void {
  const root = createRoot(container);
  roots.set(container, root);
  root.render(
    <StrictMode>
      <ReaderApp api={api} />
    </StrictMode>
  );
}

export function unmount(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
  container.innerHTML = '';
}
