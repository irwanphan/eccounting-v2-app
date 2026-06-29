'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api-client';
import { getSelectedCompany, saveSelectedCompany } from '@/lib/company-store';
import { cn } from '@/lib/utils';

export interface CompanySettingsData {
  id: string;
  name: string;
  npwp: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  postingNumberPrefix: string;
  legacyV1ClientId: string | null;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

interface CompanySettingsFormProps {
  companyId: string;
}

export function CompanySettingsForm({ companyId }: CompanySettingsFormProps): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    npwp: '',
    address: '',
    phone: '',
    email: '',
    baseCurrency: 'IDR',
    fiscalYearStartMonth: 1,
    postingNumberPrefix: 'JU',
    legacyV1ClientId: '',
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<Record<string, unknown>>(`/companies/${companyId}`)
      .then((row) => {
        setForm({
          name: String(row.name ?? ''),
          npwp: row.npwp ? String(row.npwp) : '',
          address: row.address ? String(row.address) : '',
          phone: row.phone ? String(row.phone) : '',
          email: row.email ? String(row.email) : '',
          baseCurrency: String(row.baseCurrency ?? 'IDR'),
          fiscalYearStartMonth: Number(row.fiscalYearStartMonth ?? 1),
          postingNumberPrefix: String(row.postingNumberPrefix ?? 'JU'),
          legacyV1ClientId: row.legacyV1ClientId ? String(row.legacyV1ClientId) : '',
        });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data klien');
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiFetch<Record<string, unknown>>(`/companies/${companyId}`, {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          npwp: form.npwp.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || '',
          baseCurrency: form.baseCurrency.trim().toUpperCase(),
          fiscalYearStartMonth: form.fiscalYearStartMonth,
          postingNumberPrefix: form.postingNumberPrefix.trim(),
        },
      });

      const selected = getSelectedCompany();
      if (selected?.id === companyId) {
        saveSelectedCompany({
          id: companyId,
          name: String(updated.name),
          legacyV1ClientId: form.legacyV1ClientId || null,
        });
      }

      setSuccess('Pengaturan klien berhasil disimpan.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan klien.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Memuat pengaturan klien…</p>;
  }

  if (error && !form.name) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-white p-4 text-sm text-destructive shadow-sm">
        {error}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-6 rounded-lg border border-sky-300/70 bg-white p-6 shadow-sm"
    >
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Data Klien
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nama" htmlFor="company-name" className="md:col-span-2">
            <input
              id="company-name"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="Telepon" htmlFor="company-phone">
            <input
              id="company-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="Email" htmlFor="company-email">
            <input
              id="company-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="Alamat" htmlFor="company-address" className="md:col-span-2">
            <textarea
              id="company-address"
              rows={4}
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Pengaturan Akuntansi
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="NPWP" htmlFor="company-npwp">
            <input
              id="company-npwp"
              value={form.npwp}
              onChange={(e) => setForm((prev) => ({ ...prev, npwp: e.target.value }))}
              placeholder="Opsional"
              className={inputClass}
            />
          </Field>

          <Field label="Mata Uang" htmlFor="company-currency">
            <input
              id="company-currency"
              maxLength={3}
              value={form.baseCurrency}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))
              }
              className={inputClass}
            />
          </Field>

          <Field label="Awal Tahun Fiskal" htmlFor="company-fiscal-month">
            <select
              id="company-fiscal-month"
              value={form.fiscalYearStartMonth}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  fiscalYearStartMonth: Number(e.target.value),
                }))
              }
              className={inputClass}
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prefix Nomor Jurnal" htmlFor="company-posting-prefix">
            <input
              id="company-posting-prefix"
              value={form.postingNumberPrefix}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, postingNumberPrefix: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {form.legacyV1ClientId && (
        <p className="text-xs text-slate-400">v1 client #{form.legacyV1ClientId}</p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => router.push('/companies')}
          className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
        >
          Kembali
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <label className={cn('block space-y-1.5', className)} htmlFor={htmlFor}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass = cn(
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus:outline-none focus:ring-2 focus:ring-sky-400',
);

export async function fetchCompanySettings(companyId: string): Promise<CompanySettingsData> {
  const row = await apiFetch<Record<string, unknown>>(`/companies/${companyId}`);
  return {
    id: String(row.id),
    name: String(row.name),
    npwp: row.npwp ? String(row.npwp) : null,
    address: row.address ? String(row.address) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    baseCurrency: String(row.baseCurrency ?? 'IDR'),
    fiscalYearStartMonth: Number(row.fiscalYearStartMonth ?? 1),
    postingNumberPrefix: String(row.postingNumberPrefix ?? 'JU'),
    legacyV1ClientId: row.legacyV1ClientId ? String(row.legacyV1ClientId) : null,
  };
}
