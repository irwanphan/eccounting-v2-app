import { Metadata } from 'next';

import { LoginLayout } from '@/components/auth/login-layout';

import { LoginForm } from './login-form';
import { LoginPageClient } from './login-page-client';

export const metadata: Metadata = {
  title: 'Masuk',
};

export default function LoginPage(): JSX.Element {
  return (
    <LoginPageClient>
      <main className="min-h-screen">
        <LoginLayout>
          <LoginForm />
        </LoginLayout>
      </main>
    </LoginPageClient>
  );
}
