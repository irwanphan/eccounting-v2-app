import { ModalShell } from '@/components/ui/modal-shell';

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
    <ModalShell
      open
      onClose={onCancel}
      title="Konfirmasi Pilih Klien"
      titleId="client-select-title"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
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
      }
    >
      <p className="text-sm text-slate-600">
        Pilih klien &quot;<strong className="font-semibold text-slate-900">{clientName}</strong>&quot;
        untuk dikelola?
      </p>
    </ModalShell>
  );
}
