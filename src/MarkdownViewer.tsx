import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  theme: 'dark' | 'light';
}

const darkColors = {
  text: '#e6e6e6',
  muted: '#a0a0a0',
  link: '#7eb3ff',
  rule: '#2c2c2e',
  codeBg: '#1e1e20',
};

const lightColors = {
  text: '#1a1a1a',
  muted: '#666666',
  link: '#1450a0',
  rule: '#e5e5e7',
  codeBg: '#f3f3f4',
};

export function MarkdownViewer({ content, theme }: Props) {
  const c = theme === 'dark' ? darkColors : lightColors;

  return (
    <div style={{
      maxWidth: '760px',
      margin: '0 auto',
      padding: '0 4px 64px',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: '17px',
      lineHeight: 1.65,
      color: c.text,
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: '1.9em', fontWeight: 600, marginTop: '0.5em', marginBottom: '0.5em', borderBottom: `1px solid ${c.rule}`, paddingBottom: '0.3em' }}>{children}</h1>
          ),
          h2: ({ children }) => <h2 style={{ fontSize: '1.45em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.5em' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '1.2em', fontWeight: 600, marginTop: '1.3em', marginBottom: '0.4em' }}>{children}</h3>,
          h4: ({ children }) => <h4 style={{ fontSize: '1.05em', fontWeight: 600, marginTop: '1.2em', marginBottom: '0.3em' }}>{children}</h4>,
          p: ({ children }) => <p style={{ margin: '0.8em 0' }}>{children}</p>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: c.link, textDecoration: 'none', borderBottom: `1px solid ${c.link}33` }}>{children}</a>
          ),
          ul: ({ children }) => <ul style={{ paddingLeft: '1.6em', margin: '0.6em 0' }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ paddingLeft: '1.6em', margin: '0.6em 0' }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: '0.25em 0' }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: `3px solid ${c.rule}`, paddingLeft: '1em', margin: '1em 0', color: c.muted, fontStyle: 'italic' }}>{children}</blockquote>
          ),
          code: (props: any) => {
            const { children, className } = props;
            const isBlock = typeof className === 'string' && className.startsWith('language-');
            if (isBlock) {
              return (
                <code className={className} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.88em' }}>
                  {children}
                </code>
              );
            }
            return (
              <code style={{ background: c.codeBg, padding: '0.15em 0.4em', borderRadius: '3px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.88em' }}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre style={{ background: c.codeBg, padding: '0.9em 1em', borderRadius: '6px', overflowX: 'auto', margin: '1em 0', fontSize: '0.88em', lineHeight: 1.5 }}>{children}</pre>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '1em 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>
            </div>
          ),
          th: ({ children }) => <th style={{ border: `1px solid ${c.rule}`, padding: '6px 10px', background: c.codeBg, textAlign: 'left' }}>{children}</th>,
          td: ({ children }) => <td style={{ border: `1px solid ${c.rule}`, padding: '6px 10px' }}>{children}</td>,
          hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${c.rule}`, margin: '2em 0' }} />,
          img: ({ alt, src }) => <img src={src} alt={alt ?? ''} style={{ maxWidth: '100%', borderRadius: '4px' }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
