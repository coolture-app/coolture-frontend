/**
 * Directions to a point in the phone's map app. Apple Maps on Apple devices, where Google's link opens a web page
 * unless its app is installed; Google Maps elsewhere, where Android hands the link to whichever map app is set.
 */
export function directionsUrl(
  point: { latitude: number; longitude: number },
  userAgent: string,
): string {
  const at = `${point.latitude},${point.longitude}`;
  return /iPhone|iPad|Macintosh/.test(userAgent)
    ? `https://maps.apple.com/?daddr=${at}`
    : `https://www.google.com/maps/dir/?api=1&destination=${at}`;
}
