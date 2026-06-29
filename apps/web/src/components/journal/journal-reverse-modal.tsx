import { ModalShell } from '@/components/ui/modal-shell';

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
    <ModalShell
      open
      onClose={onCancel}
      title="Batalkan Jurnal"
      titleId="journal-reverse-title"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
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
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        <p>
          Yakin batalkan jurnal <strong className="text-slate-900">{postingNumber}</strong>?
        </p>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          Di v2, jurnal tidak dihapus dari database. Sistem akan membuat <strong>jurnal pembalik</strong>{' '}
          (reversal) sehingga saldo netto kembali nol, dan audit trail tetap utuh.
        </p>
      </div>
    </ModalShell>
  );
}
