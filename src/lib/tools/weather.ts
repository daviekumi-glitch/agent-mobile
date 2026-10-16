// ---------------------------------------------------------------------------
// `get_weather` tool — current conditions from OpenWeatherMap.
//
// Kept in its own module so the executor stays readable and the unit tests can
// exercise the response mapper without touching the network.
// ---------------------------------------------------------------------------
export interface WeatherNow {
  location: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  pressure: number;
  wind_speed: number;
  conditions: string;
  units: "metric" | "imperial";
  observed_at: string;
}

export interface OpenWeatherResponse {
  name?: string;
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
    pressure?: number;
  };
  weather?: Array<{ description?: string; main?: string }>;
  wind?: { speed?: number };
  dt?: number;
  message?: string;
}

/** Map an OpenWeatherMap payload onto our compact, model-friendly shape. */
export function mapWeatherResponse(
  payload: OpenWeatherResponse,
  requestedLocation: string,
  units: "metric" | "imperial",
): WeatherNow | null {
  if (!payload || typeof payload.main?.temp !== "number") return null;

  return {
    location: payload.name || requestedLocation,
    temperature: payload.main.temp,
    feels_like: payload.main.feels_like ?? payload.main.temp,
    humidity: payload.main.humidity ?? 0,
    pressure: payload.main.pressure ?? 0,
    wind_speed: payload.wind?.speed ?? 0,
    conditions: payload.weather?.[0]?.description ?? "unknown",
    units,
    observed_at: payload.dt
      ? new Date(payload.dt * 1000).toISOString()
      : new Date().toISOString(),
  };
}

export function weatherUrl(
  apiKey: string,
  location: string,
  units: "metric" | "imperial",
): string {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", location);
  url.searchParams.set("units", units);
  url.searchParams.set("appid", apiKey);
  return url.toString();
}
