interface ClientSelectModalProps {
  clientName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClientSelectModal({
  clientName,
  onConfirm,
  onCancel,
}: ClientSelectModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="client-select-title"
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 id="client-select-title" className="text-base font-semibold uppercase tracking-wide text-slate-700">
            Konfirmasi Pilih Klien
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            Pilih klien &quot;<strong className="font-semibold text-slate-900">{clientName}</strong>&quot; untuk
            dikelola?
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
          >
            Tidak
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            Ya
          </button>
        </div>
      </div>
    </div>
  );
}
