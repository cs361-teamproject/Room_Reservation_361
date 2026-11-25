import { useCallback, useState } from 'react'
import RejectBookingDialog from '../components/RejectBookingDialog'
import { useToast } from '../components/Toast'
import { useAdminContext } from '../layouts/adminContext'
import { ApiError } from '../services/api'
import { approveBooking } from '../services/admin'
import type { BookingDetail, ManageBooking } from '../types/booking'

/** The fields the approve toast and the reject dialog need, from a booking's detail */
export const toDecisionTarget = (b: BookingDetail): ManageBooking => {
  const person = b.requester ?? b.user
  return {
    id: b.id,
    title: b.title,
    status: b.status,
    start_time: b.start_time,
    end_time: b.end_time,
    created_at: b.created_at,
    room_name: b.room.room_name,
    user: { display_name: person?.display_name ?? '-', role: person?.role ?? 'STUDENT' },
    attendee_count: b.attendee_count,
    booked_for: b.booked_for,
  }
}

/**
 * Approve / reject shared by the list and the calendar views (STAFF only, the API checks again).
 * `onChanged` reloads the caller's data; the pending badge in the side menu is refreshed too.
 * Render `ui` once: it holds the reject dialog and the toast.
 */
export function useBookingDecisions(onChanged: () => void) {
  const { refreshPending } = useAdminContext()
  const { toast, show } = useToast()
  const [rejecting, setRejecting] = useState<ManageBooking | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    onChanged()
    refreshPending()
  }, [onChanged, refreshPending])

  // 409: another staff member decided it first
  const conflict = useCallback(
    (message: string) => {
      setRejecting(null)
      show(`${message} รายการถูกโหลดใหม่แล้ว`)
      refresh()
    },
    [refresh, show],
  )

  /** Resolves true when the booking was approved */
  const approve = useCallback(
    async (b: ManageBooking): Promise<boolean> => {
      setBusyId(b.id)
      try {
        await approveBooking(b.id)
        show(`อนุมัติการจอง ${b.room_name} ของ ${b.user.display_name} แล้ว`)
        refresh()
        return true
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) conflict(e.message)
        else show(e instanceof ApiError ? e.message : 'อนุมัติไม่สำเร็จ กรุณาลองใหม่')
        return false
      } finally {
        setBusyId(null)
      }
    },
    [conflict, refresh, show],
  )

  const ui = (
    <>
      {rejecting && (
        <RejectBookingDialog
          booking={rejecting}
          onClose={() => setRejecting(null)}
          onConflict={conflict}
          onDone={() => {
            setRejecting(null)
            show(`ไม่อนุมัติการจอง ${rejecting.room_name} แล้ว ผู้จองจะเห็นเหตุผล`)
            refresh()
          }}
        />
      )}
      {toast}
    </>
  )

  return { approve, reject: setRejecting, busyId, refresh, ui }
}
