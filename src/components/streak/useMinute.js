import { useEffect, useState } from 'react'

/** The current time, refreshed on each minute boundary and when the
 *  app comes back to the foreground — enough for a countdown and for
 *  the 23:00 turn, without re-rendering the whole app every second. */
export default function useMinute() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id
    const schedule = () => { id = setTimeout(() => { setNow(new Date()); schedule() }, 60_000 - (Date.now() % 60_000) + 50) }
    schedule()
    const wake = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    document.addEventListener('visibilitychange', wake)
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', wake) }
  }, [])
  return now
}
