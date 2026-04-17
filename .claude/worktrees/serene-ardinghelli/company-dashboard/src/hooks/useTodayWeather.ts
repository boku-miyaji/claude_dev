import { useEffect, useState } from 'react'

interface DayWeather {
  icon: string
  tempMax: number
  tempMin: number
}

interface WeatherData {
  today: DayWeather
  tomorrow: DayWeather
}

const CACHE_KEY = 'today_weather_v2'
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
 * Fetch today's and tomorrow's weather from Open-Meteo API (free, no API key).
 * Caches in localStorage for 1 hour.
 */
export function useTodayWeather(): WeatherData | null {
  const [weather, setWeather] = useState<WeatherData | null>(() => {
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
    if (weather) return

    const url = 'https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia/Tokyo&forecast_days=2'

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const d = data.daily
        if (!d || !d.weathercode || d.weathercode.length < 2) return
        const w: WeatherData = {
          today: {
            icon: weatherIcon(d.weathercode[0]),
            tempMax: Math.round(d.temperature_2m_max[0]),
            tempMin: Math.round(d.temperature_2m_min[0]),
          },
          tomorrow: {
            icon: weatherIcon(d.weathercode[1]),
            tempMax: Math.round(d.temperature_2m_max[1]),
            tempMin: Math.round(d.temperature_2m_min[1]),
          },
        }
        setWeather(w)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: w, ts: Date.now() }))
      })
      .catch(() => { /* silent fallback */ })
  }, [weather])

  return weather
}
