import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardPage(): JSX.Element {
  return (
    <main className="container mx-auto py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Pilih pembukuan klien untuk mulai bekerja. (UI lengkap menyusul.)
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['Jurnal hari ini', 'Posting pending', 'Periode aktif'].map((label) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
            <p className="mt-2 text-3xl font-semibold">—</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Data akan muncul setelah modul implementasi selesai.
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
