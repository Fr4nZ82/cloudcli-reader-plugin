import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

interface TreeNode {
  name: string;
  children: TreeNode[];
  file?: string;
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { name: '', children: [] };
  for (const file of files) {
    const parts = file.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, children: [] };
        if (isLast) child.file = file;
        node.children.push(child);
      }
      node = child;
    }
  }
  const sortNode = (n: TreeNode) => {
    n.children.sort((a, b) => {
      const aFolder = !a.file;
      const bFolder = !b.file;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

interface Props {
  files: string[];
  selected: string | null;
  onSelect: (path: string) => void;
  theme: 'dark' | 'light';
}

export function FileTree({ files, selected, onSelect, theme }: Props) {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div style={{
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: theme === 'dark' ? '#d4d4d4' : '#1a1a1a',
      padding: '8px 4px',
    }}>
      {tree.children.length === 0 ? (
        <div style={{ padding: '12px 8px', opacity: 0.6 }}>Nessun file .md trovato</div>
      ) : (
        tree.children.map((child) => (
          <TreeItem
            key={child.name}
            node={child}
            depth={0}
            selected={selected}
            onSelect={onSelect}
            theme={theme}
          />
        ))
      )}
    </div>
  );
}

interface ItemProps {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
  theme: 'dark' | 'light';
}

function TreeItem({ node, depth, selected, onSelect, theme }: ItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isFolder = !node.file;
  const isSelected = !!node.file && selected === node.file;

  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: `${depth * 14 + 8}px`,
    paddingRight: '8px',
    paddingTop: '6px',
    paddingBottom: '6px',
    cursor: 'pointer',
    userSelect: 'none',
    borderRadius: '4px',
    background: isSelected
      ? (theme === 'dark' ? 'rgba(80,130,200,0.25)' : 'rgba(60,120,200,0.15)')
      : undefined,
    color: isSelected
      ? (theme === 'dark' ? '#a8c8ff' : '#1450a0')
      : undefined,
    minHeight: '32px',
  };

  if (isFolder) {
    return (
      <>
        <div style={itemStyle} onClick={() => setExpanded((e) => !e)}>
          <span style={{ display: 'inline-block', width: '14px', opacity: 0.6 }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span style={{ marginLeft: '4px', opacity: 0.85 }}>{node.name}</span>
        </div>
        {expanded && node.children.map((c) => (
          <TreeItem
            key={c.name}
            node={c}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            theme={theme}
          />
        ))}
      </>
    );
  }

  return (
    <div style={itemStyle} onClick={() => onSelect(node.file!)}>
      <span style={{ display: 'inline-block', width: '14px', opacity: 0.4, fontSize: '11px' }}>
        ◆
      </span>
      <span style={{ marginLeft: '4px' }}>{node.name}</span>
    </div>
  );
}
