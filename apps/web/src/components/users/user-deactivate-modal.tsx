interface UserDeactivateModalProps {
  userName: string;
  deactivating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UserDeactivateModal({
  userName,
  deactivating,
  onConfirm,
  onCancel,
}: UserDeactivateModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="user-deactivate-title"
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="user-deactivate-title" className="text-base font-semibold uppercase tracking-wide text-slate-700">
            Nonaktifkan Pengguna
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm text-slate-600">
          <p>
            Nonaktifkan pengguna &quot;
            <strong className="font-semibold text-slate-900">{userName}</strong>&quot;?
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Di v2, pengguna tidak dihapus dari database. Akun dinonaktifkan sehingga tidak bisa login,
            tetapi riwayat tetap utuh.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            disabled={deactivating}
            onClick={onCancel}
            className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={deactivating}
            onClick={onConfirm}
            className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-600 disabled:opacity-60"
          >
            {deactivating ? 'Memproses…' : 'Ya, Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
}
