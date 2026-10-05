export const CITIES = [
  { code: "BOM", name: "Mumbai" },
  { code: "DEL", name: "Delhi" },
  { code: "BLR", name: "Bengaluru" },
  { code: "HYD", name: "Hyderabad" },
  { code: "MAA", name: "Chennai" },
  { code: "CCU", name: "Kolkata" },
  { code: "GOI", name: "Goa" },
  { code: "PNQ", name: "Pune" },
];

const AIRLINES = ["IndiGo", "Air India", "Vistara", "SpiceJet", "Akasa Air"];

// Deterministic pseudo-random so the same search shows the same results
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function searchFlights(from, to, date) {
  const seed = [...(from + to + date)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seeded(seed);
  return Array.from({ length: 10 }, (_, i) => {
    const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)];
    const depH = 5 + Math.floor(rand() * 17);
    const depM = Math.floor(rand() * 4) * 15;
    const duration = 60 + Math.floor(rand() * 15) * 10;
    const arr = depH * 60 + depM + duration;
    const stops = rand() > 0.75 ? 1 : 0;
    const fmt = (m) =>
      `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return {
      id: `${from}${to}${date}${i}`,
      airline,
      number: `${airline.slice(0, 2).toUpperCase()}-${100 + Math.floor(rand() * 900)}`,
      from,
      to,
      date,
      departure: fmt(depH * 60 + depM),
      arrival: fmt(arr),
      duration: duration + stops * 90,
      stops,
      price: 2500 + Math.floor(rand() * 9000) + stops * -500,
    };
  });
}