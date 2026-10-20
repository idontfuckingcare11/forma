export type UserLocationInfo = {
  lat: number;
  lng: number;
  street?: string;
  neighborhood?: string;
  city: string;
  country?: string;
  formatted: string;
  source: "gps" | "ip" | "search";
};

export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  address?: string;
  city?: string;
  distanceMeters?: number;
  walkMinutes?: number;
  driveMinutes?: number;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  rating?: number;
  isChain?: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: "Entrees" | "Bowls & Salads" | "High Protein" | "Light Bites" | "Sides & Drinks" | string;
  portionGrams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
  price?: string;
};

export type RestaurantMenu = {
  restaurantName: string;
  cuisine: string;
  summary: string;
  confidenceNotes: string;
  healthyTips: string[];
  items: MenuItem[];
};

export type MacroComparison = {
  kcalRemaining: number;
  proteinRemaining: number;
  carbRemaining: number;
  fatRemaining: number;
  calorieTarget: number;
  proteinTarget: number;
};
