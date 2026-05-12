// Plugin API surface exposed by the CloudCLI host to mount(container, api).
// Mirrors the contract defined by siteboon/claudecodeui plugin-loader.

export interface PluginContext {
  theme: 'dark' | 'light';
  project: { name: string; path: string } | null;
  session: { id: string; title: string } | null;
}

export interface PluginAPI {
  context: PluginContext;
  onContextChange(callback: (ctx: PluginContext) => void): () => void;
  rpc(method: string, path: string, body?: unknown): Promise<unknown>;
}

export interface PluginModule {
  mount(container: HTMLElement, api: PluginAPI): void;
  unmount(container: HTMLElement): void;
}
