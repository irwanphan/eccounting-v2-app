interface JournalDraftConflictModalProps {
  open: boolean;
  mode: 'new' | 'import';
  onContinue: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function JournalDraftConflictModal({
  open,
  mode,
  onContinue,
  onDiscard,
  onCancel,
}: JournalDraftConflictModalProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold uppercase tracking-wide text-slate-700">
            Import CSV
          </h2>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-600">
            Oopps, ada data jurnal yang masih dikerjakan! Lanjutkan?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Lanjutkan
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
            >
              {mode === 'import'
                ? 'Hapus Data yang Belum Diproses dan Lanjutkan Import'
                : 'Hapus Data yang Belum Diproses dan Buat Baru'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border px-4 py-2 text-sm text-slate-600 hover:bg-muted"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
