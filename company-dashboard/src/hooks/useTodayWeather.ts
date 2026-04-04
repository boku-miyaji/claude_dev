import { useEffect, useState } from 'react'

interface Weather {
  icon: string
  tempMax: number
  tempMin: number
}

const CACHE_KEY = 'today_weather'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/** WMO Weather Code → emoji */
function weatherIcon(code: number): string {
  if (code === 0) return '\u2600\ufe0f'        // Clear
  if (code <= 3) return '\u26c5'               // Partly cloudy
  if (code <= 48) return '\u2601\ufe0f'        // Cloudy/fog
  if (code <= 57) return '\ud83c\udf27\ufe0f'  // Drizzle
  if (code <= 67) return '\ud83c\udf27\ufe0f'  // Rain
  if (code <= 77) return '\u2744\ufe0f'        // Snow
  if (code <= 82) return '\ud83c\udf27\ufe0f'  // Rain showers
  if (code <= 86) return '\u2744\ufe0f'        // Snow showers
  return '\u26c8\ufe0f'                        // Thunderstorm
}

/**
 * Fetch today's weather from Open-Meteo API (free, no API key).
 * Caches in localStorage for 1 hour.
 * Falls back silently on error (returns null).
 */
export function useTodayWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) return data
      }
    } catch { /* ignore */ }
    return null
  })

  useEffect(() => {
    // Skip if cached
    if (weather) return

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia/Tokyo&forecast_days=1'

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const d = data.daily
        if (!d) return
        const w: Weather = {
          icon: weatherIcon(d.weathercode[0]),
          tempMax: Math.round(d.temperature_2m_max[0]),
          tempMin: Math.round(d.temperature_2m_min[0]),
        }
        setWeather(w)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: w, ts: Date.now() }))
      })
      .catch(() => { /* silent fallback */ })
  }, [weather])

  return weather
}
