import { useEffect, useId, useState } from 'react';

interface Props {
  code: string;
  theme: 'dark' | 'light';
}

// Lazy single-load of the mermaid library. With Vite's inlineDynamicImports
// this gets bundled into the main chunk, but the module is still memoized so
// initialize() / render() share one instance across all diagrams in the file.
let mermaidPromise: Promise<any> | null = null;
function loadMermaid(): Promise<any> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m: any) => m.default ?? m);
  }
  return mermaidPromise;
}

export function MermaidBlock({ code, theme }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        });
        const id = `mmd-${uid}-${Date.now().toString(36)}`;
        const result = await mermaid.render(id, code);
        if (!cancelled) setSvg(result.svg);
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err && (err as Error).message) || String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, theme, uid]);

  if (error) {
    return (
      <div style={{
        padding: '12px 14px',
        background: theme === 'dark' ? '#3a1a1a' : '#fde7e7',
        border: `1px solid ${theme === 'dark' ? '#5a2a2a' : '#f5b5b5'}`,
        borderRadius: '4px',
        color: theme === 'dark' ? '#ff9b9b' : '#a02525',
        margin: '1em 0',
        fontSize: '13px',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Mermaid diagram failed to render</div>
        <div style={{ marginBottom: '8px', wordBreak: 'break-word' }}>{error}</div>
        <pre style={{ background: 'transparent', padding: 0, margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ padding: '14px', opacity: 0.6, fontSize: '13px', fontStyle: 'italic' }}>
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      style={{ margin: '1.2em 0', textAlign: 'center', overflowX: 'auto' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
