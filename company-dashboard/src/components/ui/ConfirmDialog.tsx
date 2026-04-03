import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = '実行', danger = true }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-g" onClick={onClose}>キャンセル</button>
        <button className={`btn ${danger ? 'btn-d' : 'btn-p'}`} onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
