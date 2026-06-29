'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { DrawerLayout } from '@/components/drawer-layout';
import { RequireAuth } from '@/components/require-auth';
import {
  UserListPage,
  fetchUsers,
  getUsersErrorMessage,
} from '@/components/users/user-list-page';
import type { UserListItem } from '@eccounting/shared';

export function UsersPageClient(): JSX.Element {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createFormOpen, setCreateFormOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    const rows = await fetchUsers();
    setUsers(rows);
  }, []);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(getUsersErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleRefresh(): Promise<void> {
    await loadUsers();
  }

  return (
    <RequireAuth>
      <DrawerLayout
        title="Pengguna"
        headerActions={
          <button
            type="button"
            onClick={() => setCreateFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Baru
          </button>
        }
      >
        {loading && (
          <p className="text-sm text-muted-foreground">Memuat daftar pengguna…</p>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-white p-4 text-sm text-destructive shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <UserListPage
            users={users}
            onRefresh={handleRefresh}
            createFormOpen={createFormOpen}
            onCreateFormOpenChange={setCreateFormOpen}
          />
        )}
      </DrawerLayout>
    </RequireAuth>
  );
}
