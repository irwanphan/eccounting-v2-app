import type { Metadata } from 'next';

import { JournalFormPageClient } from './journal-form-page-client';

export const metadata: Metadata = {
  title: 'Jurnal Umum',
};

export default function JournalNewPage(): JSX.Element {
  return <JournalFormPageClient />;
}
