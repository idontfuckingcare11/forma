import type { Restaurant, UserLocationInfo } from "./types";

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export async function detectUserLocationFromIP(): Promise<UserLocationInfo | null> {
  try {
    const res = await fetch("https://ipwho.is/", {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 600 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && data.latitude && data.longitude) {
        const city = data.city || data.region || "";
        const country = data.country || "";
        return {
          lat: Number(data.latitude),
          lng: Number(data.longitude),
          city,
          country,
          formatted: city && country ? `${city}, ${country}` : city || country || "Detected Location",
          source: "ip",
        };
      }
    }
  } catch {
    // fallback
  }

  try {
    const res2 = await fetch("https://freeipapi.com/api/json", {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 600 },
    });
    if (res2.ok) {
      const d = await res2.json();
      if (d.latitude && d.longitude) {
        const city = d.cityName || "";
        const country = d.countryName || "";
        return {
          lat: Number(d.latitude),
          lng: Number(d.longitude),
          city,
          country,
          formatted: city && country ? `${city}, ${country}` : city || country || "Detected Location",
          source: "ip",
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function geocodeLocation(
  query: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FormaFitnessApp/1.0 (fitness-places@forma.app)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (err) {
    console.error("Geocoding failed:", err);
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{
  street?: string;
  neighborhood?: string;
  city: string;
  country?: string;
  formatted: string;
  address?: string;
} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FormaFitnessApp/1.0 (fitness-places@forma.app)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const street = addr.road || addr.pedestrian || addr.footway || addr.street;
    const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter || addr.village;
    const city =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.suburb ||
      addr.county ||
      "";
    const country = addr.country || "";

    const parts = [street, neighborhood, city].filter(Boolean);
    const formatted = parts.length > 0 ? parts.join(", ") : data.display_name || "Current Location";

    return {
      street,
      neighborhood,
      city,
      country,
      formatted,
      address: data.display_name,
    };
  } catch {
    return null;
  }
}

const COMMON_CHAINS = [
  "Jollibee",
  "McDonald's",
  "Chipotle",
  "Sweetgreen",
  "Subway",
  "Panera",
  "Starbucks",
  "Shake Shack",
  "Panda Express",
  "Taco Bell",
  "Chick-fil-A",
  "In-N-Out",
  "Cava",
  "KFC",
  "Mang Inasal",
  "Chowking",
  "Greenwich",
  "Pret A Manger",
  "Dunkin'",
  "Burger King",
];

function isKnownChain(name: string): boolean {
  const lower = name.toLowerCase();
  return COMMON_CHAINS.some((chain) => lower.includes(chain.toLowerCase()));
}

async function fetchRestaurantsViaNominatim(
  lat: number,
  lng: number,
  cityName: string
): Promise<Restaurant[]> {
  try {
    const searchQuery = cityName ? `restaurant in ${cityName}` : `restaurant`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      searchQuery
    )}&format=json&limit=35`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FormaFitnessApp/1.0 (fitness-places@forma.app)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const places: Restaurant[] = [];
    const seen = new Set<string>();

    for (const item of data) {
      const name = item.name || item.display_name?.split(",")[0]?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const itemLat = parseFloat(item.lat);
      const itemLng = parseFloat(item.lon);
      const distance = haversineDistance(lat, lng, itemLat, itemLng);

      const walkMinutes = Math.max(1, Math.round(distance / 80));
      const driveMinutes = Math.max(1, Math.round(distance / 450));

      places.push({
        id: `nom-${item.place_id || Math.random()}`,
        name,
        cuisine: "Local Dining",
        address: item.display_name,
        city: cityName,
        distanceMeters: distance,
        walkMinutes,
        driveMinutes,
        lat: itemLat,
        lng: itemLng,
        isChain: isKnownChain(name),
      });
    }

    places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    return places;
  } catch {
    return [];
  }
}

export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters = 3000
): Promise<Restaurant[]> {
  const clampedRadius = Math.min(Math.max(radiusMeters, 300), 12000);

  // 1. Get accurate location context
  const rev = await reverseGeocode(lat, lng);
  const cityName = rev?.city || "";

  // 2. Query Overpass API with reasonable timeout
  const query = `
    [out:json][timeout:12];
    (
      node["amenity"~"restaurant|fast_food|cafe"]["name"](around:${clampedRadius},${lat},${lng});
      way["amenity"~"restaurant|fast_food|cafe"]["name"](around:${clampedRadius},${lat},${lng});
    );
    out center 45;
  `;

  try {
    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

    let rawData: any = null;

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          rawData = await res.json();
          if (rawData?.elements && rawData.elements.length > 0) {
            break;
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    if (rawData?.elements && Array.isArray(rawData.elements) && rawData.elements.length > 0) {
      const places: Restaurant[] = [];
      const seenNames = new Set<string>();

      for (const el of rawData.elements) {
        const tags = el.tags || {};
        const name = tags.name?.trim();
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        const placeLat = el.lat ?? el.center?.lat;
        const placeLng = el.lon ?? el.center?.lon;
        if (!placeLat || !placeLng) continue;

        const distance = haversineDistance(lat, lng, placeLat, placeLng);
        const cuisine =
          tags.cuisine?.replace(/;/g, ", ") ||
          (tags.amenity === "cafe" ? "Cafe & Bakery" : "Casual Dining");

        const street = tags["addr:street"]
          ? `${tags["addr:housenumber"] ? tags["addr:housenumber"] + " " : ""}${tags["addr:street"]}`
          : undefined;

        const walkMinutes = Math.max(1, Math.round(distance / 80));
        const driveMinutes = Math.max(1, Math.round(distance / 450));

        places.push({
          id: `osm-${el.id}`,
          name,
          cuisine: cuisine.charAt(0).toUpperCase() + cuisine.slice(1),
          address: street || rev?.address,
          city: tags["addr:city"] || cityName,
          distanceMeters: distance,
          walkMinutes,
          driveMinutes,
          lat: placeLat,
          lng: placeLng,
          phone: tags.phone || tags["contact:phone"],
          website: tags.website || tags["contact:website"],
          openingHours: tags.opening_hours,
          isChain: isKnownChain(name),
        });
      }

      places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
      if (places.length > 0) {
        return places.slice(0, 35);
      }
    }
  } catch (err) {
    console.error("Overpass query error:", err);
  }

  // 3. Fast fallback: Query Nominatim for the user's city
  if (cityName) {
    const nominatimResults = await fetchRestaurantsViaNominatim(lat, lng, cityName);
    if (nominatimResults.length > 0) {
      return nominatimResults;
    }
  }

  return [];
}
