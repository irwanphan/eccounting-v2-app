import Link from 'next/link';

export default function HomePage(): JSX.Element {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          v2 · scaffold
        </span>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Eccounting</h1>
        <p className="text-lg text-muted-foreground">
          Multi-company accounting platform untuk konsultan pajak.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <Link
          href="/login"
          className="group rounded-lg border border-border bg-card p-6 transition hover:border-primary hover:shadow-sm"
        >
          <h2 className="text-lg font-semibold">Masuk konsultan →</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Login untuk mengelola pembukuan klien.
          </p>
        </Link>

        <Link
          href="/api/health"
          className="group rounded-lg border border-border bg-card p-6 transition hover:border-primary hover:shadow-sm"
        >
          <h2 className="text-lg font-semibold">Status sistem →</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cek kesehatan API & infrastructure.
          </p>
        </Link>
      </div>

      <footer className="mt-12 text-xs text-muted-foreground">
        Build:{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {process.env.npm_package_version ?? 'dev'}
        </code>
      </footer>
    </main>
  );
}
