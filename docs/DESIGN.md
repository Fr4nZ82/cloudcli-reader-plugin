# Reader plugin — design

## Goal

Make `.md` files in a CloudCLI project comfortable to read on mobile, with the ability to leave comments on specific paragraphs without breaking the reading flow. Comments are stored *inside the file itself* as HTML-comment markers — invisible when the markdown is rendered, but visible to any AI agent (Claude Code, Cursor, Codex) that opens the file later.

## Why a plugin tab instead of a fork of CloudCLI

CloudCLI's plugin system (v1.25.0+) only lets plugins add new top-level tabs — it does not expose hooks to inject UI into the existing file viewer or toolbar. Since the use case is a *reading* experience and not an *editing* one, a dedicated tab is the right abstraction. As a bonus, there is no fork to keep in sync with upstream.

## UX flow

### Reading

- A file tree on the left lists the `.md` files in the active CloudCLI project.
- The center pane renders the selected file as proper HTML (headings, lists, code blocks, tables, links).
- Paragraphs that already have comments show a numbered bubble in the right margin.

### Adding a comment

1. The user taps a paragraph (touch on mobile, click on desktop).
2. The paragraph highlights with a soft accent background and a left border.
3. A floating "Commenta" button appears on the right.
4. Tapping the button opens a bottom sheet (mobile) or right sidebar (desktop) containing:
   - The paragraph quoted at the top for context
   - A textarea
   - Cancel / Save buttons
5. On Save the comment marker is written into the file right after the paragraph, and a bubble appears on the right margin.

### Viewing and managing existing comments

- Tap the margin bubble → opens the thread sheet with the comment.
- Actions per comment: **Edit**, **Resolve** (removes the marker), **Delete**.

## Marker syntax

A comment in the source file looks like:

```markdown
L'agente consulta il calendario condiviso e nota due eventi nel pomeriggio.
<!-- @comment id="c-7f3a" by="franz" time="2026-05-12T14:32" -->
Manca il caso d'uso "festività": cosa fa se è Pasqua e i negozi sono chiusi?
<!-- /@comment -->
```

Properties:

- Plain HTML comment — invisible when rendered outside the plugin (GitHub, Obsidian, any markdown viewer).
- `id` is unique per comment, used for editing / deleting / resolving.
- `by` and `time` are metadata; the plugin displays them but agents can ignore them.
- The body between the open and close tags is free text; newlines and inline markdown are allowed.

### Anchor stability

The marker is positioned right after the paragraph it refers to. If the agent edits the file, the marker travels with the surrounding text. The file is the single source of truth — there is no external index.

If a paragraph gets deleted but the marker survives, the plugin detects markers that are not preceded by a recognizable paragraph and shows them in a separate **Orphan comments** section at the top of the document. The user can re-anchor or delete them.

## Agent integration

The agent (Claude Code) running on the user's project is taught the convention via a section in the project's `CLAUDE.md`:

> If you encounter `<!-- @comment id="…" by="…" time="…" -->…<!-- /@comment -->` blocks in a file, treat them as user notes attached to the preceding paragraph. Address each comment in the way the text requests, then remove the marker block when done.

This closes the loop: user reads on mobile → comments → agent picks up the comments next time it opens the file → file is cleaned up after the work is done.

## Out of scope for v1

- Sub-paragraph (word or range) selection — paragraph-level only.
- Threads with replies — one comment block per marker.
- Mentions, assignments, statuses beyond resolved / not-resolved.
- Comment versioning — edit overwrites.
- Cross-file comments.
- Comments on rendered images or diagrams.

## Roadmap

- **v0.1** (current) — scaffold: manifest, build pipeline, placeholder tab, RPC echo.
- **v0.2** — file tree + read-only markdown viewer.
- **v0.3** — comment composer + marker writing + sidebar display.
- **v0.4** — orphan detection, marker resolve / delete, mobile polish.
- **v0.5** — settings panel, font-size / theme overrides per file.
