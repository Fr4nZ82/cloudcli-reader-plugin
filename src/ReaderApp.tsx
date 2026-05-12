import { useEffect, useState } from 'react';
import type { PluginAPI, PluginContext } from './types.js';
import { FileTree } from './FileTree.js';
import { MarkdownViewer } from './MarkdownViewer.js';

interface Props {
  api: PluginAPI;
}

function projectLabel(p: PluginContext['project']): string {
  if (!p) return '';
  // CloudCLI passes an internal UUID as `name` — derive a friendly label
  // from the last segment of the path instead.
  const path = p.path ?? '';
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p.name || path;
}

export function ReaderApp({ api }: Props) {
  const [ctx, setCtx] = useState<PluginContext>(api.context);
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(false);
  const [mobile, setMobile] = useState<boolean>(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
  );

  useEffect(() => api.onContextChange(setCtx), [api]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 760px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const reloadFiles = () => {
    if (!ctx.project) {
      setFiles([]);
      return;
    }
    setLoadingFiles(true);
    setError(null);
    api.rpc('GET', `/files?project=${encodeURIComponent(ctx.project.path)}`)
      .then((res: any) => {
        setFiles(Array.isArray(res?.files) ? res.files : []);
      })
      .catch((err) => setError(`Failed to list files: ${err?.message ?? err}`))
      .finally(() => setLoadingFiles(false));
  };

  useEffect(() => {
    reloadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.project?.path]);

  useEffect(() => {
    if (!selected || !ctx.project) {
      setContent('');
      return;
    }
    setLoadingContent(true);
    setError(null);
    const rpcPath = `/file?project=${encodeURIComponent(ctx.project.path)}&path=${encodeURIComponent(selected)}`;
    api.rpc('GET', rpcPath)
      .then((res: any) => setContent(typeof res?.content === 'string' ? res.content : ''))
      .catch((err) => setError(`Failed to load file: ${err?.message ?? err}`))
      .finally(() => setLoadingContent(false));
  }, [api, selected, ctx.project?.path]);

  const handleSelect = (p: string) => {
    setSelected(p);
    if (mobile) setShowTree(false);
  };

  const bg = ctx.theme === 'dark' ? '#0e0e10' : '#fafafa';
  const sidebarBg = ctx.theme === 'dark' ? '#161618' : '#ffffff';
  const border = ctx.theme === 'dark' ? '#262628' : '#e5e5e7';
  const fg = ctx.theme === 'dark' ? '#e8e8e8' : '#1a1a1a';

  const sidebar = (
    <aside style={{
      width: '280px',
      maxWidth: mobile ? '85vw' : '280px',
      background: sidebarBg,
      borderRight: `1px solid ${border}`,
      overflow: 'hidden',
      flexShrink: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 12px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6, color: fg }}>
          {projectLabel(ctx.project) || 'Files'}
        </span>
        <button
          onClick={reloadFiles}
          disabled={loadingFiles}
          title="Re-scan project for .md files"
          style={{
            background: 'transparent',
            border: `1px solid ${border}`,
            color: fg,
            padding: '3px 9px',
            borderRadius: '4px',
            fontSize: '11px',
            cursor: 'pointer',
            opacity: loadingFiles ? 0.5 : 1,
          }}
        >
          {loadingFiles ? '…' : 'Refresh'}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <FileTree files={files} selected={selected} onSelect={handleSelect} theme={ctx.theme} />
      </div>
    </aside>
  );

  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: bg,
      color: fg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {mobile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          borderBottom: `1px solid ${border}`,
          background: sidebarBg,
          flexShrink: 0,
        }}>
          <button
            onClick={() => setShowTree(true)}
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: fg,
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ☰ Files
          </button>
          <span style={{ fontSize: '13px', opacity: 0.75, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
            {selected ?? '(nessun file)'}
          </span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {!mobile && sidebar}

        {mobile && showTree && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 10,
              display: 'flex',
            }}
            onClick={() => setShowTree(false)}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ height: '100%', display: 'flex' }}>
              {sidebar}
            </div>
          </div>
        )}

        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', minWidth: 0 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: ctx.theme === 'dark' ? '#3a1a1a' : '#fde7e7',
              border: `1px solid ${ctx.theme === 'dark' ? '#5a2a2a' : '#f5b5b5'}`,
              borderRadius: '4px',
              color: ctx.theme === 'dark' ? '#ff9b9b' : '#a02525',
              marginBottom: '16px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {!ctx.project && (
            <div style={{ opacity: 0.6, padding: '40px 0', textAlign: 'center' }}>
              Nessun progetto attivo. Selezionane uno dalla sidebar di CloudCLI.
            </div>
          )}

          {ctx.project && !selected && (
            <div style={{ opacity: 0.7, padding: '40px 0', textAlign: 'center' }}>
              <div>Seleziona un file dalla lista{mobile ? ' (bottone ☰ Files in alto)' : ' a sinistra'} per iniziare a leggere.</div>
              <div style={{ marginTop: '12px', fontSize: '13px', opacity: 0.8 }}>
                {loadingFiles ? 'Scansione in corso…' : `${files.length} file markdown trovati in `}
                <code style={{ fontFamily: 'ui-monospace, monospace' }}>{ctx.project.path}</code>
              </div>
            </div>
          )}

          {selected && loadingContent && (
            <div style={{ opacity: 0.6 }}>Caricamento…</div>
          )}

          {selected && !loadingContent && (
            <MarkdownViewer content={content} theme={ctx.theme} />
          )}
        </main>
      </div>
    </div>
  );
}
