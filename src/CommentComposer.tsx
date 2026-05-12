import { useEffect, useState } from 'react';
import type { ParsedComment } from './parser.js';

interface Props {
  theme: 'dark' | 'light';
  blockSnippet: string;
  existing?: ParsedComment;
  defaultAuthor: string;
  onCancel: () => void;
  onSave: (body: string, author: string) => Promise<void>;
}

export function CommentComposer({ theme, blockSnippet, existing, defaultAuthor, onCancel, onSave }: Props) {
  const [body, setBody] = useState(existing?.body ?? '');
  const [author, setAuthor] = useState(existing?.by ?? defaultAuthor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ta = document.getElementById('reader-comment-textarea');
    ta?.focus();
  }, []);

  const isDark = theme === 'dark';
  const bg = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e5e5e7';
  const fg = isDark ? '#e8e8e8' : '#1a1a1a';
  const muted = isDark ? '#a0a0a0' : '#666666';
  const accent = '#185FA5';

  const handleSave = async () => {
    if (!body.trim()) {
      setError('Il commento non può essere vuoto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(body.trim(), author.trim() || 'user');
    } catch (err: any) {
      setError(`Salvataggio fallito: ${err?.message ?? err}`);
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bg,
          color: fg,
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          maxWidth: '720px',
          width: '100%',
          margin: '0 auto',
          padding: '14px 18px 18px',
          borderTop: `1px solid ${border}`,
          boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.35)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '36px', height: '3px', background: muted, borderRadius: '999px', margin: '0 auto 14px', opacity: 0.6 }} />

        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
          {existing ? 'Modifica commento' : 'Nuovo commento'}
        </div>

        <div style={{
          fontSize: '12px',
          color: muted,
          borderLeft: `2px solid ${border}`,
          paddingLeft: '8px',
          margin: '0 0 12px',
          fontStyle: 'italic',
          maxHeight: '60px',
          overflow: 'hidden',
        }}>
          {blockSnippet}
        </div>

        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Autore"
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid ${border}`,
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '13px',
            color: fg,
            marginBottom: '8px',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        <textarea
          id="reader-comment-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrivi il tuo commento…"
          rows={4}
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid ${border}`,
            borderRadius: '4px',
            padding: '8px 10px',
            fontSize: '14px',
            color: fg,
            resize: 'vertical',
            minHeight: '90px',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <div style={{ color: '#ff7777', fontSize: '12px', marginTop: '8px' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              background: 'transparent',
              border: `1px solid ${border}`,
              color: fg,
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !body.trim()}
            style={{
              background: accent,
              border: `1px solid ${accent}`,
              color: 'white',
              padding: '6px 14px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: !body.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
