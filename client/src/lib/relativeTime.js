const UNITS = [
  ["an", 31536000],
  ["mois", 2592000],
  ["semaine", 604800],
  ["jour", 86400],
  ["heure", 3600],
  ["minute", 60],
];

export function relativeTime(isoDate) {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);

  if (seconds < 60) {
    return "à l'instant";
  }

  for (const [unit, secondsInUnit] of UNITS) {
    const count = Math.floor(seconds / secondsInUnit);
    if (count >= 1) {
      return `il y a ${count} ${unit}${count > 1 && unit !== "mois" ? "s" : ""}`;
    }
  }

  return "à l'instant";
}
