import { useEffect, useState } from 'react';
import type { PluginAPI, PluginContext } from './types.js';

interface Props {
  api: PluginAPI;
}

export function ReaderApp({ api }: Props) {
  const [ctx, setCtx] = useState<PluginContext>(api.context);
  const [serverPing, setServerPing] = useState<string>('checking…');

  useEffect(() => {
    return api.onContextChange(setCtx);
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    api.rpc('GET', '/ping')
      .then((res) => { if (!cancelled) setServerPing(JSON.stringify(res)); })
      .catch((err) => { if (!cancelled) setServerPing(`error: ${err?.message ?? err}`); });
    return () => { cancelled = true; };
  }, [api]);

  return (
    <div style={{
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: ctx.theme === 'dark' ? '#e8e8e8' : '#1a1a1a',
      background: ctx.theme === 'dark' ? '#1a1a1a' : '#fafafa',
      minHeight: '100%',
    }}>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Reader</h2>
      <p style={{ margin: '0 0 1.5rem', opacity: 0.7, lineHeight: 1.5 }}>
        v0.1.0 scaffold — plugin si carica correttamente. La UI di lettura e i commenti laterali arrivano nella v0.2.
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '0.5rem 1rem',
        fontSize: '0.9rem',
        opacity: 0.85,
      }}>
        <strong>Project:</strong><span>{ctx.project?.name ?? '(no project active)'}</span>
        <strong>Path:</strong><span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85em' }}>{ctx.project?.path ?? '—'}</span>
        <strong>Session:</strong><span>{ctx.session?.title ?? '—'}</span>
        <strong>Theme:</strong><span>{ctx.theme}</span>
        <strong>Server RPC:</strong><span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85em' }}>{serverPing}</span>
      </div>
    </div>
  );
}
