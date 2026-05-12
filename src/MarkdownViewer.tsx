import { useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidBlock } from './MermaidBlock.js';
import { parseBlocks, type ParsedBlock, type ParsedComment } from './parser.js';

interface Props {
  content: string;
  theme: 'dark' | 'light';
  fontSize: number;
  currentFile: string;
  onNavigate: (file: string) => void;
  onAddComment: (block: ParsedBlock, blockIndex: number) => void;
  onEditComment: (comment: ParsedComment, block: ParsedBlock) => void;
  onResolveComment: (comment: ParsedComment) => void | Promise<void>;
}

const darkColors = {
  text: '#e6e6e6',
  muted: '#a0a0a0',
  link: '#7eb3ff',
  rule: '#2c2c2e',
  codeBg: '#1e1e20',
  active: 'rgba(80,130,200,0.16)',
  commentBg: '#1a2030',
  commentBorder: '#2c3850',
};

const lightColors = {
  text: '#1a1a1a',
  muted: '#666666',
  link: '#1450a0',
  rule: '#e5e5e7',
  codeBg: '#f3f3f4',
  active: 'rgba(60,120,200,0.12)',
  commentBg: '#f4f7fc',
  commentBorder: '#d8e2f1',
};

type Colors = typeof darkColors;

function resolveRelative(base: string, rel: string): string {
  if (rel.startsWith('/')) return rel.slice(1);
  const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
  const baseParts = baseDir ? baseDir.split('/') : [];
  const relParts = rel.split('/');
  const resolved = [...baseParts];
  for (const part of relParts) {
    if (part === '..') resolved.pop();
    else if (part !== '.' && part !== '') resolved.push(part);
  }
  return resolved.join('/');
}

export function MarkdownViewer({ content, theme, fontSize, currentFile, onNavigate, onAddComment, onEditComment, onResolveComment }: Props) {
  const c = theme === 'dark' ? darkColors : lightColors;
  const blocks = useMemo(() => parseBlocks(content), [content]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div style={{
      maxWidth: '780px',
      margin: '0 auto',
      padding: '0 4px 96px',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: `${fontSize}px`,
      lineHeight: 1.65,
      color: c.text,
    }}>
      {blocks.length === 0 && (
        <div style={{ opacity: 0.5, padding: '40px 0', textAlign: 'center' }}>(file vuoto)</div>
      )}
      {blocks.map((block, i) => (
        <BlockView
          key={`${block.startOffset}-${i}`}
          block={block}
          isActive={activeIndex === i}
          theme={theme}
          colors={c}
          currentFile={currentFile}
          onNavigate={onNavigate}
          onActivate={() => setActiveIndex(i)}
          onDeactivate={() => setActiveIndex(null)}
          onAddComment={() => {
            setActiveIndex(null);
            onAddComment(block, i);
          }}
          onEditComment={(comment) => onEditComment(comment, block)}
          onResolveComment={onResolveComment}
        />
      ))}
    </div>
  );
}

interface BlockViewProps {
  block: ParsedBlock;
  isActive: boolean;
  theme: 'dark' | 'light';
  colors: Colors;
  currentFile: string;
  onNavigate: (file: string) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onAddComment: () => void;
  onEditComment: (comment: ParsedComment) => void;
  onResolveComment: (comment: ParsedComment) => void | Promise<void>;
}

function BlockView({ block, isActive, theme, colors, currentFile, onNavigate, onActivate, onDeactivate, onAddComment, onEditComment, onResolveComment }: BlockViewProps) {
  const handleClick = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, textarea')) return;
    if (isActive) onDeactivate();
    else onActivate();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        padding: '4px 12px 4px 10px',
        marginBottom: '2px',
        borderLeft: isActive ? `3px solid ${colors.link}` : '3px solid transparent',
        background: isActive ? colors.active : 'transparent',
        borderRadius: '0 4px 4px 0',
        transition: 'background 0.15s, border-color 0.15s',
        cursor: 'default',
      }}
    >
      <MarkdownContent source={block.source} theme={theme} colors={colors} currentFile={currentFile} onNavigate={onNavigate} />

      {isActive && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onAddComment(); }}
            style={{
              background: colors.link,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Commenta
          </button>
        </div>
      )}

      {block.comments.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          {block.comments.map((comment, idx) => (
            <CommentCard
              key={comment.id || `${comment.startOffset}-${idx}`}
              comment={comment}
              colors={colors}
              onEdit={() => onEditComment(comment)}
              onResolve={() => onResolveComment(comment)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentCard({ comment, colors, onEdit, onResolve }: { comment: ParsedComment; colors: Colors; onEdit: () => void; onResolve: () => void }) {
  const time = comment.time ? formatTime(comment.time) : '';
  return (
    <div style={{
      background: colors.commentBg,
      border: `1px solid ${colors.commentBorder}`,
      borderRadius: '6px',
      padding: '8px 12px',
      marginTop: '6px',
      fontSize: '0.9em',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.78em', color: colors.muted, gap: '8px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong style={{ color: colors.text }}>{comment.by || 'user'}</strong>{time && ` · ${time}`}
        </span>
        <span style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={linkBtn(colors)}>edit</button>
          <button onClick={(e) => { e.stopPropagation(); onResolve(); }} style={linkBtn(colors)}>risolvi</button>
        </span>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{comment.body}</div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function linkBtn(colors: Colors): CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: colors.link,
    fontSize: 'inherit',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    textDecoration: 'underline',
  };
}

interface ContentProps {
  source: string;
  theme: 'dark' | 'light';
  colors: Colors;
  currentFile: string;
  onNavigate: (file: string) => void;
}

function MarkdownContent({ source, theme, colors, currentFile, onNavigate }: ContentProps) {
  const c = colors;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 style={{ fontSize: '1.9em', fontWeight: 600, marginTop: '0.4em', marginBottom: '0.5em', borderBottom: `1px solid ${c.rule}`, paddingBottom: '0.3em' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: '1.45em', fontWeight: 600, marginTop: '1.3em', marginBottom: '0.5em' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: '1.2em', fontWeight: 600, marginTop: '1.2em', marginBottom: '0.4em' }}>{children}</h3>,
        h4: ({ children }) => <h4 style={{ fontSize: '1.05em', fontWeight: 600, marginTop: '1.1em', marginBottom: '0.3em' }}>{children}</h4>,
        p: ({ children }) => <p style={{ margin: '0.5em 0' }}>{children}</p>,
        a: ({ children, href }) => {
          if (!href) return <span>{children}</span>;
          const linkStyle: CSSProperties = { color: c.link, textDecoration: 'none', borderBottom: `1px solid ${c.link}33` };
          const isExternal = /^(https?:|mailto:|ftp:|tel:)/i.test(href);
          if (isExternal) {
            return <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{children}</a>;
          }
          const [pathPart] = href.split('#');
          let decoded = pathPart || '';
          try { decoded = decodeURIComponent(pathPart || ''); } catch { /* keep raw */ }
          const resolved = resolveRelative(currentFile, decoded);
          const isMarkdown = /\.(md|markdown|mdx)$/i.test(resolved);
          if (isMarkdown) {
            return (
              <a
                href={`#${resolved}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNavigate(resolved); }}
                style={{ ...linkStyle, fontWeight: 500 }}
                title={resolved}
              >
                {children}
              </a>
            );
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, opacity: 0.7 }} title={href}>{children}</a>;
        },
        ul: ({ children }) => <ul style={{ paddingLeft: '1.6em', margin: '0.4em 0' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ paddingLeft: '1.6em', margin: '0.4em 0' }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
        blockquote: ({ children }) => <blockquote style={{ borderLeft: `3px solid ${c.rule}`, paddingLeft: '1em', margin: '0.6em 0', color: c.muted, fontStyle: 'italic' }}>{children}</blockquote>,
        code: (props: any) => {
          const { children, className } = props;
          const isBlock = typeof className === 'string' && className.startsWith('language-');
          if (isBlock) {
            return <code className={className} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.88em' }}>{children}</code>;
          }
          return <code style={{ background: c.codeBg, padding: '0.15em 0.4em', borderRadius: '3px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.88em' }}>{children}</code>;
        },
        pre: (props: any) => {
          const child = Array.isArray(props.children) ? props.children[0] : props.children;
          const childClassName: string | undefined = child?.props?.className;
          if (childClassName === 'language-mermaid') {
            const raw = child.props.children;
            const codeText = String(Array.isArray(raw) ? raw.join('') : (raw ?? '')).trim();
            return <MermaidBlock code={codeText} theme={theme} />;
          }
          return <pre style={{ background: c.codeBg, padding: '0.9em 1em', borderRadius: '6px', overflowX: 'auto', margin: '0.6em 0', fontSize: '0.88em', lineHeight: 1.5 }}>{props.children}</pre>;
        },
        table: ({ children }) => <div style={{ overflowX: 'auto', margin: '0.6em 0' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table></div>,
        th: ({ children }) => <th style={{ border: `1px solid ${c.rule}`, padding: '6px 10px', background: c.codeBg, textAlign: 'left' }}>{children}</th>,
        td: ({ children }) => <td style={{ border: `1px solid ${c.rule}`, padding: '6px 10px' }}>{children}</td>,
        hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${c.rule}`, margin: '1.2em 0' }} />,
        img: ({ alt, src }) => <img src={src} alt={alt ?? ''} style={{ maxWidth: '100%', borderRadius: '4px' }} />,
      }}
    >
      {source}
    </ReactMarkdown>
  );
}
