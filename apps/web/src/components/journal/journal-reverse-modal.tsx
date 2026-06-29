interface JournalReverseModalProps {
  postingNumber: string;
  reversing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function JournalReverseModal({
  postingNumber,
  reversing,
  onConfirm,
  onCancel,
}: JournalReverseModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="journal-reverse-title"
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="journal-reverse-title" className="text-base font-semibold uppercase tracking-wide text-slate-700">
            Batalkan Jurnal
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm text-slate-600">
          <p>
            Yakin batalkan jurnal <strong className="text-slate-900">{postingNumber}</strong>?
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Di v2, jurnal tidak dihapus dari database. Sistem akan membuat <strong>jurnal pembalik</strong>{' '}
            (reversal) sehingga saldo netto kembali nol, dan audit trail tetap utuh.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            disabled={reversing}
            onClick={onCancel}
            className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-60"
          >
            Tidak
          </button>
          <button
            type="button"
            disabled={reversing}
            onClick={onConfirm}
            className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {reversing ? 'Memproses…' : 'Ya, Batalkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
