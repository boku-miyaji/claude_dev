import { useCallback, useEffect, useRef } from 'react'
import { create } from 'zustand'

interface ToastState {
  message: string
  visible: boolean
  undoFn: (() => void) | null
  show: (msg: string, opts?: { undo?: () => void }) => void
  hide: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  visible: false,
  undoFn: null,
  show: (msg, opts) => set({ message: msg, visible: true, undoFn: opts?.undo ?? null }),
  hide: () => set({ visible: false, undoFn: null }),
}))

/** Convenience function — callable from anywhere without hooks */
export function toast(msg: string, opts?: { undo?: () => void }) {
  useToastStore.getState().show(msg, opts)
}

export function Toast() {
  const { message, visible, undoFn, hide } = useToastStore()
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const scheduleHide = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hide, undoFn ? 5000 : 2500)
  }, [hide, undoFn])

  useEffect(() => {
    if (visible) scheduleHide()
    return () => clearTimeout(timerRef.current)
  }, [visible, scheduleHide])

  return (
    <div className={`toast${visible ? ' show' : ''}`}>
      {undoFn ? (
        <div className="toast-undo">
          {message}
          <button
            className="undo-btn"
            onClick={(e) => {
              e.stopPropagation()
              hide()
              undoFn()
            }}
          >
            取消
          </button>
        </div>
      ) : (
        message
      )}
    </div>
  )
}
