// Markdown block parser with comment-marker extraction.
//
// The reader treats the file as a sequence of blocks separated by blank lines.
// Blocks that are *only* an HTML comment of shape
//     <!-- @comment id="..." by="..." time="..." -->
//     body text (any markdown)
//     <!-- /@comment -->
// are attached to the preceding regular block as annotations, not rendered.
//
// All offsets are byte indexes into the normalized (LF-only) content.

export interface ParsedComment {
  id: string;
  by: string;
  time: string;
  body: string;
  startOffset: number;
  endOffset: number;
}

export interface ParsedBlock {
  source: string;
  startOffset: number;
  endOffset: number;
  comments: ParsedComment[];
}

const ATTR_RE = /(\w+)="([^"]*)"/g;
const COMMENT_OPEN_RE = /^<!--\s*@comment\s+([^>]*?)\s*-->/;
const COMMENT_CLOSE_RE = /<!--\s*\/@comment\s*-->\s*$/;

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(s)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function asCommentBlock(block: { source: string; startOffset: number; endOffset: number }): ParsedComment | null {
  const trimmed = block.source.trim();
  const openMatch = trimmed.match(COMMENT_OPEN_RE);
  if (!openMatch) return null;
  const closeMatch = trimmed.match(COMMENT_CLOSE_RE);
  if (!closeMatch) return null;
  const openLen = openMatch[0].length;
  const closeLen = closeMatch[0].length;
  const body = trimmed.slice(openLen, trimmed.length - closeLen).trim();
  const attrs = parseAttrs(openMatch[1]);
  return {
    id: attrs.id ?? '',
    by: attrs.by ?? '',
    time: attrs.time ?? '',
    body,
    startOffset: block.startOffset,
    endOffset: block.endOffset,
  };
}

export function splitRawBlocks(content: string): { source: string; startOffset: number; endOffset: number }[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const blocks: { source: string; startOffset: number; endOffset: number }[] = [];
  let i = 0;
  let inFence = false;

  while (i < normalized.length) {
    while (i < normalized.length && normalized[i] === '\n') i++;
    if (i >= normalized.length) break;

    const startOffset = i;
    let end = i;

    while (end < normalized.length) {
      const atLineStart = end === 0 || normalized[end - 1] === '\n';
      if (atLineStart && normalized.substring(end, end + 3) === '```') {
        inFence = !inFence;
      }
      if (!inFence && normalized[end] === '\n' && (end + 1 >= normalized.length || normalized[end + 1] === '\n')) {
        break;
      }
      end++;
    }

    blocks.push({
      source: normalized.slice(startOffset, end),
      startOffset,
      endOffset: end,
    });
    i = end + 1;
  }

  return blocks;
}

export function parseBlocks(content: string): ParsedBlock[] {
  const raw = splitRawBlocks(content);
  const result: ParsedBlock[] = [];

  for (const block of raw) {
    const asComment = asCommentBlock(block);
    if (asComment && result.length > 0) {
      result[result.length - 1].comments.push(asComment);
      result[result.length - 1].endOffset = block.endOffset;
    } else {
      result.push({
        source: block.source,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        comments: [],
      });
    }
  }

  return result;
}

export function buildMarker(id: string, by: string, time: string, body: string): string {
  return `<!-- @comment id="${id}" by="${by}" time="${time}" -->\n${body}\n<!-- /@comment -->`;
}

export function newCommentId(): string {
  return 'c-' + Math.random().toString(36).slice(2, 8);
}

export function insertComment(content: string, block: ParsedBlock, comment: ParsedComment): string {
  const insertAt = block.comments.length > 0
    ? Math.max(...block.comments.map((c) => c.endOffset))
    : block.endOffset;
  const marker = buildMarker(comment.id, comment.by, comment.time, comment.body);
  return content.slice(0, insertAt) + '\n\n' + marker + content.slice(insertAt);
}

export function removeComment(content: string, comment: ParsedComment): string {
  let start = comment.startOffset;
  const end = comment.endOffset;
  // Strip up to one preceding blank line so we don't leave orphan whitespace
  while (start > 0 && content[start - 1] === '\n') start--;
  if (start > 0 && content[start - 1] !== '\n') start++;
  return content.slice(0, start) + content.slice(end);
}

export function updateComment(content: string, comment: ParsedComment, newBody: string): string {
  const marker = buildMarker(comment.id, comment.by, comment.time, newBody);
  return content.slice(0, comment.startOffset) + marker + content.slice(comment.endOffset);
}
