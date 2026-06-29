import { ModalShell } from '@/components/ui/modal-shell';

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
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title="Import CSV"
      titleId="journal-draft-conflict-title"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
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
    </ModalShell>
  );
}
