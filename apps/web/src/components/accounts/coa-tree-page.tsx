'use client';

import type { AccountTreeNode, AccountTreeResponse, CoaFormInput } from '@eccounting/shared';
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CoaDeleteModal,
  CoaFormModal,
  findApiErrorMessage,
  getFlatAccount,
  type CoaFormState,
} from '@/components/accounts/coa-form-modal';
import { apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { cn } from '@/lib/utils';

interface TreeResponse {
  data: AccountTreeResponse;
  meta?: { message?: string };
}

function CoaTreeNodeRow({
  node,
  depth,
  expanded,
  selectedId,
  onToggle,
  onSelect,
  onContextMenu,
}: {
  node: AccountTreeNode;
  depth: number;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (node: AccountTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: AccountTreeNode) => void;
}): JSX.Element {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <>
      <tr
        className={cn(
          'cursor-pointer border-b border-slate-100 hover:bg-sky-50/60',
          isSelected && 'bg-sky-100/70',
        )}
        onClick={() => onSelect(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <td className="px-3 py-1.5">
          <div
            className="flex items-center gap-1 font-mono text-sm text-slate-700"
            style={{ paddingLeft: `${depth * 1.25}rem` }}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-label={isExpanded ? 'Ciutkan' : 'Buka'}
                className="rounded p-0.5 text-slate-500 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(node.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
            {hasChildren ? (
              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <span>{node.code}</span>
            <span className="font-sans text-slate-600">{node.name}</span>
          </div>
        </td>
      </tr>
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <CoaTreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedId={selectedId}
            onToggle={onToggle}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
}

function collectAllIds(nodes: AccountTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: AccountTreeNode[]): void => {
    for (const node of list) {
      ids.push(node.id);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

export function CoaTreePage(): JSX.Element {
  const companyId = getSelectedCompany()?.id;
  const [tree, setTree] = useState<AccountTreeNode[]>([]);
  const [flat, setFlat] = useState<AccountTreeResponse['flat']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: AccountTreeNode;
  } | null>(null);

  const [formState, setFormState] = useState<CoaFormState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AccountTreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedFlat = useMemo(
    () => (selectedId ? getFlatAccount(flat, selectedId) : undefined),
    [flat, selectedId],
  );

  const loadTree = useCallback(async (): Promise<void> => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: AccountTreeResponse }>(
        `/companies/${companyId}/accounts/tree`,
      );
      setTree(res.data.tree);
      setFlat(res.data.flat);
      setExpanded(new Set(collectAllIds(res.data.tree)));
    } catch (err) {
      setTree([]);
      setFlat([]);
      setError(findApiErrorMessage(err, 'Gagal memuat daftar kode akun'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  function toggleExpand(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreateRoot(): void {
    setFormState({ mode: 'create-root' });
    setFormOpen(true);
    setContextMenu(null);
  }

  function openCreateChild(node: AccountTreeNode): void {
    setFormState({ mode: 'create-child', parentId: node.id });
    setFormOpen(true);
    setContextMenu(null);
  }

  function openEdit(node: AccountTreeNode): void {
    const account = getFlatAccount(flat, node.id);
    if (!account) return;
    setFormState({ mode: 'edit', account });
    setFormOpen(true);
    setContextMenu(null);
  }

  function openDelete(node: AccountTreeNode): void {
    setDeleteTarget(node);
    setContextMenu(null);
  }

  function handleContextMenu(e: React.MouseEvent, node: AccountTreeNode): void {
    e.preventDefault();
    setSelectedId(node.id);
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }

  async function handleFormSubmit(input: CoaFormInput): Promise<void> {
    if (!companyId || !formState) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (formState.mode === 'edit' && formState.account) {
        const res = await apiFetch<TreeResponse>(
          `/companies/${companyId}/accounts/${formState.account.id}`,
          { method: 'PATCH', body: input },
        );
        setTree(res.data.tree);
        setFlat(res.data.flat);
        setSuccess(res.meta?.message ?? 'Kode akun berhasil diperbaharui.');
      } else {
        const res = await apiFetch<TreeResponse>(`/companies/${companyId}/accounts`, {
          method: 'POST',
          body: input,
        });
        setTree(res.data.tree);
        setFlat(res.data.flat);
        setExpanded(new Set(collectAllIds(res.data.tree)));
        setSuccess(res.meta?.message ?? 'Kode akun berhasil disimpan.');
      }
      setFormOpen(false);
      setFormState(null);
    } catch (err) {
      setError(findApiErrorMessage(err, 'Gagal menyimpan kode akun'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!companyId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<TreeResponse>(
        `/companies/${companyId}/accounts/${deleteTarget.id}`,
        { method: 'DELETE' },
      );
      setTree(res.data.tree);
      setFlat(res.data.flat);
      setSuccess(res.meta?.message ?? 'Kode akun berhasil dihapus.');
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(findApiErrorMessage(err, 'Gagal menghapus kode akun'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreateRoot}
            disabled={!companyId || loading}
            className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            Buat Kode Akun Induk Baru
          </button>
          {selectedFlat && (
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  const full = flat.find((r) => r.id === selectedFlat.id);
                  if (!full) return;
                  setFormState({ mode: 'create-child', parentId: full.id });
                  setFormOpen(true);
                }}
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sky-800 hover:bg-sky-100"
              >
                Buat sub-akun
              </button>
              <button
                type="button"
                onClick={() => {
                  const full = flat.find((r) => r.id === selectedFlat.id);
                  if (full) {
                    setFormState({ mode: 'edit', account: full });
                    setFormOpen(true);
                  }
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  const node = flat.find((r) => r.id === selectedFlat.id);
                  if (node) openDelete({ ...node, children: [] } as AccountTreeNode);
                }}
                className="rounded-md border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
              >
                Hapus
              </button>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Memuat kode akun…</p>
        ) : tree.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Belum ada kode akun.</p>
        ) : (
          <table className="min-w-full">
            <tbody>
              {tree.map((node) => (
                <CoaTreeNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  selectedId={selectedId}
                  onToggle={toggleExpand}
                  onSelect={(n) => setSelectedId(n.id)}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contextMenu && (
        <>
          <button
            type="button"
            aria-label="Tutup menu"
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 min-w-[240px] rounded-md border border-border bg-white py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm hover:bg-sky-50"
              onClick={() => openCreateChild(contextMenu.node)}
            >
              Buat Kode Akun dibawah &quot;{contextMenu.node.code} {contextMenu.node.name}&quot;
            </button>
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm hover:bg-sky-50"
              onClick={() => openEdit(contextMenu.node)}
            >
              Edit Kode Akun &quot;{contextMenu.node.code} {contextMenu.node.name}&quot;
            </button>
            <button
              type="button"
              className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              onClick={() => openDelete(contextMenu.node)}
            >
              Delete Kode Akun &quot;{contextMenu.node.code} {contextMenu.node.name}&quot;
            </button>
          </div>
        </>
      )}

      <CoaFormModal
        open={formOpen}
        formState={formState}
        flatAccounts={flat}
        saving={saving}
        onClose={() => {
          setFormOpen(false);
          setFormState(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <CoaDeleteModal
        open={deleteTarget != null}
        account={deleteTarget ? getFlatAccount(flat, deleteTarget.id) ?? null : null}
        deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
