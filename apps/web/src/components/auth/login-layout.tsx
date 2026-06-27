import Image from 'next/image';
import type { ReactNode } from 'react';

import loginImage from '@/assets/images/loginimage.jpg';

import { LoginBranding } from './login-branding';

interface LoginLayoutProps {
  children: ReactNode;
}

export function LoginLayout({ children }: LoginLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section
        aria-hidden
        className="relative hidden min-h-screen flex-1 lg:block"
      >
        <Image
          src={loginImage}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 62vw, 0"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-sky-900/35 via-sky-800/15 to-transparent" />
        <LoginBranding className="absolute bottom-12 left-12 xl:bottom-16 xl:left-16" />
      </section>

      <section className="relative h-44 shrink-0 overflow-hidden lg:hidden">
        <Image
          src={loginImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sky-900/50 to-sky-800/20" />
        <LoginBranding className="absolute bottom-6 left-6" />
      </section>

      <section className="flex w-full flex-1 flex-col justify-center border-t-4 border-[#22A7F0] bg-white px-8 py-10 sm:px-12 lg:max-w-md lg:border-l lg:border-t-0 lg:px-14 lg:py-16 xl:max-w-lg">
        {children}
      </section>
    </div>
  );
}
