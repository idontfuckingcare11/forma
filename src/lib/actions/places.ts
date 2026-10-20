"use server";

import {
  geocodeLocation,
  fetchNearbyRestaurants,
  reverseGeocode,
  detectUserLocationFromIP,
} from "@/lib/places/service";
import { fetchRestaurantMenu } from "@/lib/places/menu";
import type {
  Restaurant,
  RestaurantMenu,
  MenuItem,
  MacroComparison,
  UserLocationInfo,
} from "@/lib/places/types";
import { getDiaryDay } from "@/lib/diary/data";
import { todayKey } from "@/lib/dates";
import { remaining } from "@/lib/nutrition";
import { addFoodEntry } from "@/lib/actions/food";
import type { MealType } from "@/lib/db-types";

export type SearchPlacesResult = {
  ok: boolean;
  places: Restaurant[];
  coords: { lat: number; lng: number };
  locationName?: string;
  userLocation?: UserLocationInfo;
  error?: string;
};

export async function detectLocationAction(): Promise<UserLocationInfo | null> {
  const ip = await detectUserLocationFromIP();
  return ip;
}

export async function searchNearbyPlacesAction(params: {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  cityQuery?: string;
  isGps?: boolean;
}): Promise<SearchPlacesResult> {
  try {
    let lat = params.lat;
    let lng = params.lng;
    let locationName = "";
    let isSearch = false;

    if (params.cityQuery && params.cityQuery.trim()) {
      isSearch = true;
      const geo = await geocodeLocation(params.cityQuery.trim());
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        locationName = geo.displayName;
      } else {
        return {
          ok: false,
          places: [],
          coords: { lat: 0, lng: 0 },
          error: `Could not locate "${params.cityQuery}". Try another city or neighborhood.`,
        };
      }
    }

    if (lat === undefined || lng === undefined) {
      const ipLocation = await detectUserLocationFromIP();
      if (ipLocation) {
        lat = ipLocation.lat;
        lng = ipLocation.lng;
        locationName = ipLocation.city
          ? `${ipLocation.city}, ${ipLocation.country || ""}`
          : ipLocation.country || "";
      } else {
        return {
          ok: false,
          places: [],
          coords: { lat: 0, lng: 0 },
          error: "Could not detect location. Please click 'Scan Location' or type your city.",
        };
      }
    }

    const rev = await reverseGeocode(lat, lng);
    const userLocation: UserLocationInfo = {
      lat,
      lng,
      street: rev?.street,
      neighborhood: rev?.neighborhood,
      city: rev?.city || "",
      country: rev?.country || "",
      formatted: rev?.formatted || locationName || "Your Location",
      source: isSearch ? "search" : params.isGps ? "gps" : "ip",
    };

    const places = await fetchNearbyRestaurants(lat, lng, params.radiusMeters || 5000);

    return {
      ok: true,
      places,
      coords: { lat, lng },
      locationName: userLocation.formatted,
      userLocation,
    };
  } catch (err: any) {
    return {
      ok: false,
      places: [],
      coords: { lat: params.lat ?? 0, lng: params.lng ?? 0 },
      error: err.message || "Failed to search nearby places",
    };
  }
}

export async function getRestaurantMenuAction(params: {
  restaurantName: string;
  cuisine: string;
  location?: string;
}): Promise<{ ok: boolean; menu?: RestaurantMenu; error?: string }> {
  try {
    const res = await fetchRestaurantMenu(params.restaurantName, params.cuisine, params.location);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true, menu: res.data };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to fetch menu." };
  }
}

export async function getUserRemainingMacrosAction(): Promise<MacroComparison | null> {
  try {
    const dateKey = todayKey();
    const day = await getDiaryDay(dateKey);
    const kcalLeft = remaining(day.totals.kcal, day.goals.calorieTarget);
    const proteinLeft = remaining(day.totals.protein, day.goals.proteinTarget);
    const carbLeft = remaining(day.totals.carbs, day.goals.carbTarget);
    const fatLeft = remaining(day.totals.fat, day.goals.fatTarget);

    return {
      kcalRemaining: Math.round(kcalLeft),
      proteinRemaining: Math.round(proteinLeft),
      carbRemaining: Math.round(carbLeft),
      fatRemaining: Math.round(fatLeft),
      calorieTarget: Math.round(day.goals.calorieTarget),
      proteinTarget: Math.round(day.goals.proteinTarget),
    };
  } catch {
    return null;
  }
}

export async function logRestaurantDishAction(params: {
  meal: MealType;
  eatenOn?: string;
  dish: MenuItem;
  restaurantName: string;
}) {
  const portion = params.dish.portionGrams || 350;
  // Calculate per 100g values for addFoodEntry
  const scale = portion / 100;
  const kcalPer100g = Math.round((params.dish.kcal / scale) * 10) / 10;
  const proteinPer100g = Math.round((params.dish.protein / scale) * 10) / 10;
  const carbsPer100g = Math.round((params.dish.carbs / scale) * 10) / 10;
  const fatPer100g = Math.round((params.dish.fat / scale) * 10) / 10;

  return await addFoodEntry({
    meal: params.meal,
    eatenOn: params.eatenOn || todayKey(),
    name: `${params.dish.name} (${params.restaurantName})`,
    portionGrams: portion,
    kcalPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    source: "ai",
  });
}
