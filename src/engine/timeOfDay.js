// Time-of-day utilities
// Game day runs 6 AM → 10 PM (16 hours). Chunks divide that evenly.

/**
 * Convert a chunk number to a human-readable time window.
 * e.g. chunk 1 of 8 → "6–8 AM", chunk 5 of 8 → "2–4 PM"
 */
export function chunkToTimeLabel(chunk, chunksPerDay = 8) {
  const DAY_START_HOUR = 6;   // 6 AM
  const DAY_END_HOUR   = 22;  // 10 PM
  const totalHours = DAY_END_HOUR - DAY_START_HOUR; // 16
  const hoursPerChunk = totalHours / chunksPerDay;

  const startHour = DAY_START_HOUR + (chunk - 1) * hoursPerChunk;
  const endHour   = startHour + hoursPerChunk;

  function fmt(h) {
    const whole = Math.floor(h);
    const half  = h % 1 === 0.5;
    const mins  = half ? '30' : '00';
    if (whole === 0 || whole === 24) return `12:${mins} AM`;
    if (whole === 12) return `12:${mins} PM`;
    if (whole < 12)  return `${whole}:${mins} AM`;
    return `${whole - 12}:${mins} PM`;
  }

  return `${fmt(startHour)}–${fmt(endHour)}`;
}

/**
 * Returns a named period + a lighting config for the map overlay.
 *
 * period:       short label ('Dawn', 'Morning', etc.)
 * overlayColor: CSS rgba string for a color rect draped over the map
 * overlayOpacity: 0–1
 * filterStyle:  CSS filter string to apply to location images (extra warmth/cool)
 */
export function chunkToLighting(chunk, chunksPerDay = 8) {
  // Normalise chunk to 0–1 position through the day
  const pos = (chunk - 1) / (chunksPerDay - 1 || 1); // 0 = first chunk, 1 = last

  if (pos <= 0.1) {
    // Dawn — warm amber glow, slightly dim
    return {
      period: 'Dawn',
      overlayColor: 'rgb(255, 160, 50)',
      overlayOpacity: 0.18,
      filterStyle: 'brightness(0.88) sepia(0.25) saturate(1.2)',
    };
  }
  if (pos <= 0.3) {
    // Morning — clear, bright, slightly warm
    return {
      period: 'Morning',
      overlayColor: 'rgb(255, 220, 130)',
      overlayOpacity: 0.08,
      filterStyle: 'brightness(1.05) saturate(1.05)',
    };
  }
  if (pos <= 0.55) {
    // Midday — full sun, neutral-warm
    return {
      period: 'Midday',
      overlayColor: 'rgb(255, 255, 200)',
      overlayOpacity: 0.04,
      filterStyle: 'brightness(1.1) saturate(1.0)',
    };
  }
  if (pos <= 0.75) {
    // Afternoon — golden hour starting
    return {
      period: 'Afternoon',
      overlayColor: 'rgb(255, 180, 60)',
      overlayOpacity: 0.12,
      filterStyle: 'brightness(1.0) sepia(0.15) saturate(1.15)',
    };
  }
  if (pos <= 0.9) {
    // Evening — orange-amber, dimming
    return {
      period: 'Evening',
      overlayColor: 'rgb(220, 100, 30)',
      overlayOpacity: 0.22,
      filterStyle: 'brightness(0.85) sepia(0.4) saturate(1.3)',
    };
  }
  // Dusk — deep orange-red, nearly dark
  return {
    period: 'Dusk',
    overlayColor: 'rgb(140, 60, 20)',
    overlayOpacity: 0.32,
    filterStyle: 'brightness(0.7) sepia(0.5) saturate(1.2)',
  };
}
