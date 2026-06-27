import { BookCopy } from 'lucide-react';

interface LoginBrandingProps {
  className?: string;
}

export function LoginBranding({ className }: LoginBrandingProps): JSX.Element {
  return (
    <div className={className}>
      <div className="flex items-center gap-4">
        <BookCopy
          className="h-14 w-14 shrink-0 text-white drop-shadow-md"
          strokeWidth={1.25}
          aria-hidden
        />
        <div>
          <h1 className="text-3xl font-light tracking-wide text-white drop-shadow-sm md:text-4xl">
            e<span className="font-semibold">.ccounting</span><span className="text-xs font-semibold text-white/90 ml-2">v2.26.01</span>
          </h1>
          <p className="mt-0.5 text-sm font-medium tracking-[0.2em] text-white/90">
            strength.in.numbers
          </p>
        </div>
      </div>
    </div>
  );
}
