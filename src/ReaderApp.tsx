import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PluginAPI, PluginContext } from './types.js';
import { FileTree } from './FileTree.js';
import { MarkdownViewer } from './MarkdownViewer.js';
import { CommentComposer } from './CommentComposer.js';
import {
  insertComment,
  newCommentId,
  parseBlocks,
  updateComment,
  type ParsedBlock,
  type ParsedComment,
} from './parser.js';
import { sendPayloadToChat } from './chatBridge.js';

interface Props {
  api: PluginAPI;
}

function projectLabel(p: PluginContext['project']): string {
  if (!p) return '';
  const path = p.path ?? '';
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p.name || path;
}

const DEFAULT_FONT_SIZE = 17;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;

function loadFontSize(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_FONT_SIZE;
  const stored = parseInt(localStorage.getItem('reader.fontSize') ?? '', 10);
  if (isNaN(stored)) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, stored));
}

function loadAuthor(): string {
  if (typeof localStorage === 'undefined') return 'user';
  return localStorage.getItem('reader.author') || 'user';
}

function blockSnippet(block: ParsedBlock): string {
  const text = block.source
    .split('\n')
    .filter((line) => !line.trim().startsWith('<!--'))
    .join(' ')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 100 ? text.slice(0, 98) + '…' : text;
}

function offsetToLine(content: string, offset: number): number {
  let line = 1;
  const upTo = Math.min(offset, content.length);
  for (let i = 0; i < upTo; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}

function buildSubmitPayload(
  content: string,
  projectPath: string,
  filePath: string,
  blocks: ParsedBlock[],
): string {
  const items: Array<{ block: ParsedBlock; comment: ParsedComment }> = [];
  for (const block of blocks) {
    for (const comment of block.comments) {
      items.push({ block, comment });
    }
  }
  const n = items.length;
  const wordCount = n === 1 ? 'commento aperto' : 'commenti aperti';

  const out: string[] = [];
  out.push(`Ho ${n} ${wordCount} nel file \`${filePath}\` (progetto \`${projectPath}\`).`);
  out.push('');
  out.push('Ogni commento è salvato nel file come blocco HTML-comment di questa forma:');
  out.push('');
  out.push('```');
  out.push('<!-- @comment id="..." by="..." time="..." -->');
  out.push('corpo libero del commento, può andare a capo, può contenere markdown');
  out.push('<!-- /@comment -->');
  out.push('```');
  out.push('');
  out.push('Il blocco marker è attaccato al blocco markdown che lo precede (paragrafo, heading, lista, code block, ecc.) ed è invisibile al rendering markdown — è un commento HTML standard.');
  out.push('');
  out.push('Per ogni commento elencato sotto:');
  out.push('');
  out.push(`1. Apri \`${filePath}\`.`);
  out.push('2. Localizza il blocco `<!-- @comment id="..." -->...<!-- /@comment -->` con l\'`id` indicato (l\'`id` è univoco nel file).');
  out.push('3. Capisci la richiesta dal corpo del commento, riferita al blocco markdown che precede il marker.');
  out.push('4. Esegui la modifica nel file dove serve (modifica del blocco, aggiunta di una sezione, riformulazione, ecc.), restando dentro lo scope di lavoro consentito dal progetto.');
  out.push('5. Quando hai finito, **rimuovi l\'intero blocco marker** (apertura + corpo + chiusura) dal file. Lascia invariato il blocco markdown precedente, a meno che la modifica richiesta non lo abbia esplicitamente toccato.');
  out.push('6. Se la richiesta non è chiara, non eseguibile, o ti costringe a uscire dallo scope, chiedi conferma all\'utente prima di rimuovere il marker.');
  out.push('');
  out.push('---');
  out.push('');
  out.push(`Commenti (${n}):`);
  out.push('');

  for (const { block, comment } of items) {
    const blockLine = offsetToLine(content, block.startOffset);
    const markerStartLine = offsetToLine(content, comment.startOffset);
    const markerEndLine = offsetToLine(content, comment.endOffset);
    const snippet = blockSnippet(block);
    out.push(`### [${comment.id}] marker linee ${markerStartLine}-${markerEndLine}`);
    out.push(`Blocco a L${blockLine}: "${snippet}"`);
    const meta: string[] = [];
    if (comment.by) meta.push(comment.by);
    if (comment.time) meta.push(comment.time);
    if (meta.length > 0) out.push(`Autore: ${meta.join(' · ')}`);
    out.push('');
    out.push(comment.body);
    out.push('');
  }

  return out.join('\n');
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
  const [fontSize, setFontSize] = useState<number>(loadFontSize);
  const [composerState, setComposerState] = useState<{
    block: ParsedBlock;
    blockIndex: number;
    existing?: ParsedComment;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const blocks = useMemo(() => parseBlocks(content), [content]);
  const commentCount = useMemo(
    () => blocks.reduce((acc, b) => acc + b.comments.length, 0),
    [blocks]
  );

  useEffect(() => api.onContextChange(setCtx), [api]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 760px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('reader.fontSize', String(fontSize));
    }
  }, [fontSize]);

  const showToast = (msg: string, durationMs = 3500) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), durationMs);
  };

  const reloadFiles = () => {
    if (!ctx.project) {
      setFiles([]);
      return;
    }
    setLoadingFiles(true);
    setError(null);
    api.rpc('GET', `/files?project=${encodeURIComponent(ctx.project.path)}`)
      .then((res: any) => setFiles(Array.isArray(res?.files) ? res.files : []))
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

  const handleNavigate = (filePath: string) => {
    if (files.includes(filePath)) {
      setSelected(filePath);
    } else {
      setError(`File non trovato nel progetto: ${filePath}`);
    }
  };

  const writeContent = async (newContent: string): Promise<void> => {
    if (!ctx.project || !selected) throw new Error('no project or file selected');
    const rpcPath = `/file?project=${encodeURIComponent(ctx.project.path)}&path=${encodeURIComponent(selected)}`;
    await api.rpc('POST', rpcPath, { content: newContent });
    setContent(newContent);
  };

  const handleAddComment = (block: ParsedBlock, blockIndex: number) => {
    setComposerState({ block, blockIndex });
  };

  const handleEditComment = (comment: ParsedComment, block: ParsedBlock) => {
    setComposerState({ block, blockIndex: -1, existing: comment });
  };

  const handleSaveComment = async (body: string, author: string) => {
    if (!composerState) return;
    if (typeof localStorage !== 'undefined') localStorage.setItem('reader.author', author);
    let newContent: string;
    if (composerState.existing) {
      newContent = updateComment(content, composerState.existing, body);
    } else {
      const newComment: ParsedComment = {
        id: newCommentId(),
        by: author,
        time: new Date().toISOString(),
        body,
        startOffset: 0,
        endOffset: 0,
      };
      newContent = insertComment(content, composerState.block, newComment);
    }
    await writeContent(newContent);
    setComposerState(null);
  };

  const handleSubmit = async () => {
    if (!ctx.project || !selected) return;
    if (commentCount === 0) {
      showToast('Nessun commento da inviare.');
      return;
    }
    setSubmitting(true);
    const payload = buildSubmitPayload(content, ctx.project.path, selected, blocks);

    // Try auto-send into the active Chat tab session first
    const result = await sendPayloadToChat(payload);
    if (result.ok) {
      if (result.injectedOnly) {
        showToast(`Payload incollato in Chat. Se non parte da solo premi Invio.`, 5000);
      } else {
        showToast(`Inviati ${commentCount} commento${commentCount === 1 ? '' : 'i'} alla chat.`);
      }
      setSubmitting(false);
      return;
    }

    // Fall back to clipboard if the DOM bridge could not locate the chat input
    try {
      await navigator.clipboard.writeText(payload);
      showToast(`Auto-send non riuscito (${result.reason ?? 'unknown'}) — payload copiato negli appunti, incolla manualmente in Chat.`, 6000);
    } catch (err: any) {
      setError(`Auto-send e copia negli appunti falliti: ${err?.message ?? err}`);
    }
    setSubmitting(false);
  };

  const bg = ctx.theme === 'dark' ? '#0e0e10' : '#fafafa';
  const sidebarBg = ctx.theme === 'dark' ? '#161618' : '#ffffff';
  const border = ctx.theme === 'dark' ? '#262628' : '#e5e5e7';
  const fg = ctx.theme === 'dark' ? '#e8e8e8' : '#1a1a1a';

  const toolbarBtnStyle = (disabled = false): CSSProperties => ({
    background: 'transparent',
    border: `1px solid ${border}`,
    color: fg,
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit',
    minWidth: '32px',
  });

  const submitBtnEnabled = commentCount > 0 && !submitting;
  const submitBtnStyle: CSSProperties = {
    background: submitBtnEnabled ? '#185FA5' : 'transparent',
    border: `1px solid ${submitBtnEnabled ? '#185FA5' : border}`,
    color: submitBtnEnabled ? '#ffffff' : fg,
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: submitBtnEnabled ? 'pointer' : 'default',
    opacity: submitBtnEnabled ? 1 : 0.4,
    fontFamily: 'inherit',
  };

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
            fontFamily: 'inherit',
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: `1px solid ${border}`,
        background: sidebarBg,
        flexShrink: 0,
      }}>
        {mobile && (
          <button
            onClick={() => setShowTree(true)}
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: fg,
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ☰ Files
          </button>
        )}
        <span style={{ fontSize: '13px', opacity: 0.75, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
          {selected ?? '(nessun file)'}
        </span>
        <button
          onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 2))}
          disabled={fontSize <= MIN_FONT_SIZE}
          title={`Diminuisci font (attuale ${fontSize}px)`}
          style={toolbarBtnStyle(fontSize <= MIN_FONT_SIZE)}
        >
          A−
        </button>
        <button
          onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 2))}
          disabled={fontSize >= MAX_FONT_SIZE}
          title={`Aumenta font (attuale ${fontSize}px)`}
          style={toolbarBtnStyle(fontSize >= MAX_FONT_SIZE)}
        >
          A+
        </button>
        <button
          onClick={handleSubmit}
          disabled={!submitBtnEnabled}
          title={commentCount === 0 ? 'Nessun commento da inviare' : `Invia ${commentCount} commenti nella chat selezionata`}
          style={submitBtnStyle}
        >
          {submitting ? 'Invio…' : `Invia (${commentCount})`}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {!mobile && sidebar}

        {mobile && showTree && (
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10, display: 'flex' }}
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
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => setError(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px', padding: 0 }}
              >
                ×
              </button>
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
            <MarkdownViewer
              content={content}
              theme={ctx.theme}
              fontSize={fontSize}
              currentFile={selected}
              onNavigate={handleNavigate}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
            />
          )}
        </main>
      </div>

      {composerState && (
        <CommentComposer
          theme={ctx.theme}
          blockSnippet={blockSnippet(composerState.block)}
          existing={composerState.existing}
          defaultAuthor={loadAuthor()}
          onCancel={() => setComposerState(null)}
          onSave={handleSaveComment}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: ctx.theme === 'dark' ? 'rgba(20, 20, 22, 0.95)' : 'rgba(40, 40, 45, 0.95)',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '6px',
          fontSize: '13px',
          zIndex: 200,
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.3)',
          maxWidth: '90vw',
          textAlign: 'center',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
