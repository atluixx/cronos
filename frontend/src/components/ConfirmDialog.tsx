export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-lg p-7 w-[min(480px,90vw)] max-h-[85vh] overflow-y-auto flex flex-col gap-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-medium tracking-tight m-0">{title}</h2>
        {body && <p className="text-muted text-sm m-0">{body}</p>}
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-transparent border-0 text-muted hover:text-text underline p-0 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-danger/15 text-danger border border-danger rounded-md px-4 py-2 text-sm font-medium hover:bg-danger/25"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
