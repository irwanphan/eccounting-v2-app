import { ModalShell } from '@/components/ui/modal-shell';

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
    <ModalShell
      open
      onClose={onCancel}
      title="Hapus Klien"
      titleId="client-delete-title"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
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
      }
    >
      <p className="text-sm text-slate-600">
        Arsip klien &quot;<strong className="font-semibold text-slate-900">{clientName}</strong>
        &quot;? Data jurnal tetap tersimpan, klien tidak akan muncul di daftar aktif.
      </p>
    </ModalShell>
  );
}
