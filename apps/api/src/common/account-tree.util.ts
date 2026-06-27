import type { AccountCategory, AccountFlatRow, AccountTreeNode } from '@eccounting/shared';

export interface AccountRowForTree {
  id: bigint;
  parentId: bigint | null;
  code: string;
  name: string;
  level: number;
  category: AccountCategory;
  subCategory: string | null;
  normalBalance: 'D' | 'C';
  isPostable: boolean;
  isRetainedEarning: boolean;
}

interface TreeNodeInternal extends AccountRowForTree {
  children: TreeNodeInternal[];
}

export function buildAccountTree(rows: AccountRowForTree[]): AccountTreeNode[] {
  const nodes = new Map<bigint, TreeNodeInternal>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }

  const roots: TreeNodeInternal[] = [];
  for (const node of nodes.values()) {
    if (node.parentId != null && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: TreeNodeInternal[]): void => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);

  return roots.map(toTreeNode);
}

export function flattenAccountRows(rows: AccountRowForTree[]): AccountFlatRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    parentId: row.parentId != null ? String(row.parentId) : null,
    code: row.code,
    name: row.name,
    level: row.level,
    category: row.category,
    subCategory: row.subCategory,
    normalBalance: row.normalBalance,
    isPostable: row.isPostable,
    isRetainedEarning: row.isRetainedEarning,
  }));
}

function toTreeNode(node: TreeNodeInternal): AccountTreeNode {
  return {
    id: String(node.id),
    parentId: node.parentId != null ? String(node.parentId) : null,
    code: node.code,
    name: node.name,
    level: node.level,
    category: node.category,
    subCategory: node.subCategory,
    normalBalance: node.normalBalance,
    isPostable: node.isPostable,
    isRetainedEarning: node.isRetainedEarning,
    children: node.children.map(toTreeNode),
  };
}

/** Kumpulkan semua descendant id (tidak termasuk root). */
export function collectDescendantIds(
  rows: AccountRowForTree[],
  rootId: bigint,
): Set<bigint> {
  const byParent = new Map<bigint | null, AccountRowForTree[]>();
  for (const row of rows) {
    const key = row.parentId;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }

  const result = new Set<bigint>();
  const walk = (parentId: bigint): void => {
    for (const child of byParent.get(parentId) ?? []) {
      result.add(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return result;
}
