# cloudcli-reader-plugin

> Read and annotate markdown files from any device — desktop, tablet, or phone.

A plugin for [CloudCLI](https://github.com/siteboon/claudecodeui) that adds a **Reader** tab dedicated to comfortable markdown consumption. Tap a paragraph on mobile, leave a comment, and it gets written into the file as an HTML-comment marker. AI agents reading the file later (Claude Code, Cursor, Codex) see the markers as inline user notes they can address.

## Status

Work in progress. v0.1.0 is the initial scaffold — installable in CloudCLI, but the Reader UI is just a placeholder so far.

## Installation

In CloudCLI go to **Settings → Plugins**, paste this URL:

```
https://github.com/Fr4nZ82/cloudcli-reader-plugin
```

and click **Install**. CloudCLI will clone the repo, run `npm install`, and build automatically. A **Reader** tab will appear once you enable the plugin.

## Development

```bash
git clone https://github.com/Fr4nZ82/cloudcli-reader-plugin.git
cd cloudcli-reader-plugin
npm install
npm run dev    # watch mode — rebuilds dist/ on every change
```

To see your changes inside CloudCLI: after each rebuild, toggle the plugin off and on again in **Settings → Plugins** (this re-loads the bundle).

## Design

See [docs/DESIGN.md](./docs/DESIGN.md) for the full UX flow, comment marker syntax, and agent-integration convention.

## License

MIT — see [LICENSE](./LICENSE).
