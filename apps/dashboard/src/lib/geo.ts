/** Great-circle length of a [lon, lat] line, in kilometres. */
export function lineLengthKm(coords: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    m += 2 * 6371000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return m / 1000;
}

/** EWKT for PostGIS: PostgREST passes it straight to the geometry input. */
export function lineToEwkt(coords: [number, number][]): string {
  return `SRID=4326;LINESTRING(${coords.map(([lon, lat]) => `${lon} ${lat}`).join(', ')})`;
}

export function bounds(points: [number, number][]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/** Monday of the week containing d, local midnight. */
export function weekStart(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
