import { Metadata } from 'next';

import { LoginForm } from './login-form';
import { LoginPageClient } from './login-page-client';

export const metadata: Metadata = {
  title: 'Masuk',
};

export default function LoginPage(): JSX.Element {
  return (
    <LoginPageClient>
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Masuk ke Eccounting</h1>
            <p className="text-sm text-muted-foreground">
              Gunakan email & password yang diberikan firma kamu.
            </p>
          </div>
          <LoginForm />
        </div>
      </main>
    </LoginPageClient>
  );
}
