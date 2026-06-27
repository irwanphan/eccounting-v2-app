interface ClientDeleteModalProps {
  clientName: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClientDeleteModal({
  clientName,
  deleting,
  onConfirm,
  onCancel,
}: ClientDeleteModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="client-delete-title"
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="client-delete-title" className="text-base font-semibold uppercase tracking-wide text-slate-700">
            Hapus Klien
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            Arsip klien &quot;<strong className="font-semibold text-slate-900">{clientName}</strong>&quot;? Data
            jurnal tetap tersimpan, klien tidak akan muncul di daftar aktif.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {deleting ? 'Menghapus…' : 'Ya, Arsipkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
