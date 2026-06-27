import Link from 'next/link';

const REPORT_LINKS = [
  { href: '/financial-reports/ledger', label: 'Buku Besar', enabled: true },
  { href: '/financial-reports/balance-sheet', label: 'Neraca', enabled: true },
  { href: '/financial-reports/trial-balance', label: 'Neraca Saldo', enabled: true },
  { href: '/financial-reports/income-statement', label: 'Laporan Laba Rugi', enabled: true },
] as const;

export function FinancialReportIndex(): JSX.Element {
  const primary = REPORT_LINKS[0]!;
  const secondary = REPORT_LINKS.slice(1);

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Tampilkan</p>

      <div className="mt-3">
        <ReportButton href={primary.href} label={primary.label} enabled={primary.enabled} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {secondary.map((item) => (
          <ReportButton key={item.label} href={item.href} label={item.label} enabled={item.enabled} />
        ))}
      </div>
    </div>
  );
}

function ReportButton({
  href,
  label,
  enabled,
}: {
  href: string;
  label: string;
  enabled: boolean;
}): JSX.Element {
  const className =
    'inline-block rounded-md bg-sky-500 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60';

  if (!enabled) {
    return (
      <button type="button" disabled title="Menyusul" className={className}>
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
