/**
 * A distance as a person reads it: "850 m" under a kilometre (to 50 m), "2,3 km" under ten, then
 * whole kilometres. Numbers follow the language, so Polish gets a decimal comma.
 */
export function formatDistance(meters: number, language: string): string {
  if (meters < 1000) {
    return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  }
  const km = meters / 1000;
  const digits = km < 10 ? 1 : 0;
  const number = new Intl.NumberFormat(language, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(km);
  return `${number} km`;
}
