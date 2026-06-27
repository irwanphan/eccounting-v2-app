'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { AppShell } from '@/components/app-shell';
import { getSelectedCompany } from '@/lib/company-store';

export function DashboardPageClient(): JSX.Element {
  const selected = getSelectedCompany();

  return (
    <RequireAuth>
      <RequireCompany>
        <AppShell title="Daftar Jurnal">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Konteks klien aktif: <strong>{selected?.name}</strong>
            </p>
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6">
              <h2 className="text-sm font-medium">Tanggal Pencatatan Jurnal</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Modul jurnal (setara v1 <code>/admin/group-journal</code>) belum diimplementasi.
                Halaman ini placeholder setelah pilih klien — flow sudah selaras dengan v1.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Langkah berikutnya untuk parity data: ETL COA + journal dari v1 per{' '}
                <code>legacy_v1_client_id</code>.
              </p>
            </div>
          </div>
        </AppShell>
      </RequireCompany>
    </RequireAuth>
  );
}
