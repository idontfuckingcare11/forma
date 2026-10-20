"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  searchNearbyPlacesAction,
  getRestaurantMenuAction,
  logRestaurantDishAction,
  detectLocationAction,
} from "@/lib/actions/places";
import type { Restaurant, RestaurantMenu, MenuItem, MacroComparison, UserLocationInfo } from "@/lib/places/types";
import type { MealType } from "@/lib/db-types";
import { MEAL_OPTIONS } from "@/components/diary/food-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Compass,
  Flame,
  Footprints,
  Info,
  Lightbulb,
  Loader2,
  Locate,
  MapPin,
  MessageSquare,
  Navigation,
  Plus,
  Radio,
  Search,
  Sparkles,
  Store,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
} from "lucide-react";

export function PlacesExplorer({
  initialMacros,
}: {
  initialMacros: MacroComparison | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Location & Search state
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocationInfo | null>(null);
  const [cityInput, setCityInput] = useState<string>("");
  const [radius, setRadius] = useState<number>(5000);
  const [locating, setLocating] = useState<boolean>(false);

  // Places state
  const [places, setPlaces] = useState<Restaurant[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "chains" | "local">("all");

  // Selected Restaurant & Menu
  const [selectedPlace, setSelectedPlace] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(false);
  const [menuSheetOpen, setMenuSheetOpen] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Quick Log Dialog
  const [dishToLog, setDishToLog] = useState<MenuItem | null>(null);
  const [logMeal, setLogMeal] = useState<MealType>("lunch");
  const [logging, setLogging] = useState<boolean>(false);

  // Automatic geolocation on initial mount
  useEffect(() => {
    handleScanCurrentLocation();
  }, []);

  async function fallbackToIpLocation() {
    try {
      const ip = await detectLocationAction();
      if (ip) {
        setCoords({ lat: ip.lat, lng: ip.lng });
        setUserLocation(ip);
        toast.info(`Detected location near: ${ip.city || "your area"}. Enable browser GPS for street precision.`);
        handleSearchPlaces({ lat: ip.lat, lng: ip.lng, isGps: false });
        return;
      }
    } catch {
      // Ignore
    }
    toast.info("Please search for your city or neighborhood in the search bar above.");
  }

  async function handleScanCurrentLocation() {
    if (!navigator.geolocation) {
      await fallbackToIpLocation();
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setCoords({ lat: userLat, lng: userLng });
        setLocating(false);
        handleSearchPlaces({ lat: userLat, lng: userLng, isGps: true });
      },
      async () => {
        setLocating(false);
        await fallbackToIpLocation();
      },
      { timeout: 7000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  }

  async function handleSearchPlaces(override?: {
    lat?: number;
    lng?: number;
    query?: string;
    isGps?: boolean;
  }) {
    setSearching(true);
    try {
      const res = await searchNearbyPlacesAction({
        lat: override?.lat ?? coords?.lat,
        lng: override?.lng ?? coords?.lng,
        radiusMeters: radius,
        cityQuery: override?.query,
        isGps: override?.isGps,
      });

      if (!res.ok) {
        toast.error(res.error || "Could not find nearby places.");
      } else {
        setPlaces(res.places);
        if (res.coords) {
          setCoords(res.coords);
        }
        if (res.userLocation) {
          setUserLocation(res.userLocation);
        }
      }
    } catch {
      toast.error("Failed to load restaurants. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function openRestaurantMenu(place: Restaurant) {
    setSelectedPlace(place);
    setMenuSheetOpen(true);
    setLoadingMenu(true);
    setMenu(null);
    setCategoryFilter("all");

    try {
      const res = await getRestaurantMenuAction({
        restaurantName: place.name,
        cuisine: place.cuisine,
        location: place.address || userLocation?.formatted || userLocation?.city,
      });

      if (res.ok && res.menu) {
        setMenu(res.menu);
      } else {
        toast.error("Could not load the menu for this spot.");
      }
    } catch {
      toast.error("Failed to fetch restaurant menu.");
    } finally {
      setLoadingMenu(false);
    }
  }

  async function handleConfirmLog() {
    if (!dishToLog || !selectedPlace) return;
    setLogging(true);
    try {
      const res = await logRestaurantDishAction({
        meal: logMeal,
        dish: dishToLog,
        restaurantName: selectedPlace.name,
      });

      if (res.ok) {
        toast.success(`Logged "${dishToLog.name}" to ${logMeal.toUpperCase()}!`, {
          description: `${Math.round(dishToLog.kcal)} kcal · ${Math.round(dishToLog.protein)}g protein`,
        });
        setDishToLog(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to log entry.");
      }
    } catch {
      toast.error("Something went wrong while logging.");
    } finally {
      setLogging(false);
    }
  }

  // Filter places
  const displayedPlaces = places.filter((p) => {
    if (activeFilter === "chains") return p.isChain;
    if (activeFilter === "local") return !p.isChain;
    return true;
  });

  // Filter menu items
  const menuCategories = Array.from(
    new Set(menu?.items.map((i) => i.category || "General") || [])
  );

  const displayedMenuItems = menu?.items.filter((item) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "high-protein") return item.protein >= 30;
    if (categoryFilter === "low-cal") return item.kcal <= 550;
    return item.category === categoryFilter;
  });

  const locationTitle =
    userLocation?.street && userLocation?.neighborhood
      ? `${userLocation.street}, ${userLocation.neighborhood}`
      : userLocation?.street
      ? `${userLocation.street}`
      : userLocation?.neighborhood
      ? `${userLocation.neighborhood}, ${userLocation.city}`
      : userLocation?.city
      ? `${userLocation.city}`
      : "Your Location";

  return (
    <div className="space-y-6">
      {/* 📡 YOU ARE HERE & SCANNING HERO RADAR CARD */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="relative mt-1 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0 border border-primary/20">
              <MapPin className="size-5.5 z-10" />
              <span className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping opacity-75" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-500">
                  {userLocation?.source === "gps" ? "Live GPS Pinpoint" : "Area Location"}
                </span>
                <span className="text-xs text-muted-foreground">· Scanning {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} perimeter</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                You are near <span className="text-primary">{locationTitle}</span>
              </h2>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {userLocation?.formatted || (coords ? `Coords: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Scanning coordinates…")}
              </p>
            </div>
          </div>

          {/* Quick Rescan & Radius Select */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-10 gap-2 flex-1 sm:flex-initial text-xs font-semibold"
              onClick={handleScanCurrentLocation}
              disabled={locating || searching}
            >
              <Locate className={cn("size-3.5 text-primary", locating && "animate-spin")} />
              {locating ? "Locking GPS…" : "Rescan My Area"}
            </Button>

            <Select
              value={String(radius)}
              onValueChange={(val) => {
                const r = Number(val);
                setRadius(r);
                if (coords) handleSearchPlaces({ lat: coords.lat, lng: coords.lng });
              }}
            >
              <SelectTrigger className="w-[145px] h-10 rounded-xl text-xs font-medium">
                <SelectValue placeholder="Radius" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 km (Walking)</SelectItem>
                <SelectItem value="3000">3 km (Near)</SelectItem>
                <SelectItem value="5000">5 km (Drive)</SelectItem>
                <SelectItem value="10000">10 km (Extended)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Live Area Sweep Status Line */}
        <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Radio className="size-3.5 text-primary animate-pulse shrink-0" />
            {searching ? (
              <span className="text-primary font-medium">
                Scanning restaurants within {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`} of your position…
              </span>
            ) : (
              <span>
                Found <strong className="text-foreground">{displayedPlaces.length} dining spots</strong> near you.
                {displayedPlaces[0]?.distanceMeters !== undefined && (
                  <> Closest spot is <strong className="text-primary">{displayedPlaces[0].name}</strong> ({displayedPlaces[0].distanceMeters}m away · ~{displayedPlaces[0].walkMinutes || 1} min walk).</>
                )}
              </span>
            )}
          </div>

          {initialMacros && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium shrink-0">
              <Sparkles className="size-3" />
              <span>
                Remaining Today: <strong className="text-foreground">{initialMacros.kcalRemaining} kcal</strong> · <strong className="text-foreground">{initialMacros.proteinRemaining}g protein</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Manual Search Bar (If user wants to look at another neighborhood or city) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search another neighborhood, city, or specific restaurant…"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cityInput.trim()) {
                handleSearchPlaces({ query: cityInput });
              }
            }}
            className="pl-9 pr-3 rounded-xl h-11"
          />
        </div>
        {cityInput.trim() && (
          <Button
            variant="secondary"
            className="h-11 rounded-xl"
            onClick={() => handleSearchPlaces({ query: cityInput })}
            disabled={searching}
          >
            Search
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveFilter("all")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
            activeFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          All Spots Near You ({places.length})
        </button>
        <button
          onClick={() => setActiveFilter("chains")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
            activeFilter === "chains"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Popular Chains
        </button>
        <button
          onClick={() => setActiveFilter("local")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
            activeFilter === "local"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Local & Independent Eateries
        </button>
      </div>

      {/* Places Cards Grid (Sorted Closest First) */}
      {searching ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Scanning radius around you…</p>
          <p className="text-xs text-muted-foreground">Identifying nearby kitchens, bistros, and cafes</p>
        </div>
      ) : displayedPlaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center space-y-3">
          <UtensilsCrossed className="mx-auto size-10 text-muted-foreground/60" />
          <h3 className="font-semibold text-base">No restaurants detected in this radius</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Try expanding your search radius to 5km or 10km, or search for a specific landmark above.
          </p>
          <Button
            variant="outline"
            className="rounded-xl mt-2"
            onClick={() => {
              setRadius(10000);
              if (coords) handleSearchPlaces({ lat: coords.lat, lng: coords.lng });
            }}
          >
            Expand to 10 km Radius
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedPlaces.map((place, index) => (
            <Card
              key={place.id}
              className="flex flex-col justify-between hover:border-primary/50 transition-all shadow-xs group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {index === 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          CLOSEST
                        </span>
                      )}
                      <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors">
                        {place.name}
                      </CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Utensils className="size-3 text-primary/70 shrink-0" />
                      {place.cuisine}
                    </p>
                  </div>

                  {/* Relative Distance & Travel Time Badge */}
                  {place.distanceMeters !== undefined && (
                    <Badge variant="secondary" className="text-[11px] font-mono shrink-0 gap-1 flex items-center">
                      <Footprints className="size-3 text-primary" />
                      {place.distanceMeters < 1000
                        ? `${place.distanceMeters}m · ~${place.walkMinutes || 1}m walk`
                        : `${(place.distanceMeters / 1000).toFixed(1)}km · ~${place.driveMinutes || 5}m drive`}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {place.address && (
                  <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground shrink-0" />
                    {place.address}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    className="flex-1 rounded-xl gap-1.5 text-xs font-semibold"
                    onClick={() => openRestaurantMenu(place)}
                  >
                    <Sparkles className="size-3.5" />
                    View Menu & Macros
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-2.5 text-xs font-medium shrink-0 gap-1 text-muted-foreground hover:text-primary"
                    title="Open directions in Google Maps"
                    asChild
                  >
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="size-3 text-primary" />
                      <span>Directions</span>
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Menu Detail Drawer / Sheet */}
      <Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background">
          <SheetHeader className="p-6 border-b shrink-0 bg-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                  {selectedPlace?.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{selectedPlace?.cuisine}</span>
                  {selectedPlace?.distanceMeters && (
                    <span>· {selectedPlace.distanceMeters}m away (~{selectedPlace.walkMinutes || 1} min walk)</span>
                  )}
                  {selectedPlace && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-medium ml-1"
                    >
                      <Navigation className="size-3" />
                      Open in Maps
                    </a>
                  )}
                </SheetDescription>
              </div>

              {/* Ask Assistant Shortcut */}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs gap-1.5 shrink-0"
                asChild
              >
                <Link
                  href={`/assistant?q=${encodeURIComponent(
                    `I'm at ${selectedPlace?.name}. What should I order to hit my nutrition targets?`
                  )}`}
                >
                  <MessageSquare className="size-3.5 text-primary" />
                  Ask AI
                </Link>
              </Button>
            </div>

            {/* Quick Healthy Tips if loaded */}
            {menu?.healthyTips && menu.healthyTips.length > 0 && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Lightbulb className="size-3.5" />
                  Smart Ordering Tips
                </div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  {menu.healthyTips.map((tip, idx) => (
                    <li key={idx} className="line-clamp-2">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SheetHeader>

          {/* Menu Categories Filter */}
          <div className="px-6 py-3 border-b flex items-center gap-2 overflow-x-auto shrink-0 bg-muted/30">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All Items
            </button>
            <button
              onClick={() => setCategoryFilter("high-protein")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                categoryFilter === "high-protein"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              ⚡ High Protein (30g+)
            </button>
            <button
              onClick={() => setCategoryFilter("low-cal")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                categoryFilter === "low-cal"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              🥗 Under 550 kcal
            </button>
            {menuCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Dishes List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingMenu ? (
              <div className="py-24 text-center space-y-3">
                <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Extracting dishes & calculating macros…</p>
                <p className="text-xs text-muted-foreground">Powered by Forma AI nutrition intelligence</p>
              </div>
            ) : !displayedMenuItems || displayedMenuItems.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-sm">No items found under this category.</p>
              </div>
            ) : (
              displayedMenuItems.map((dish) => {
                const fitsCalories =
                  initialMacros && dish.kcal <= initialMacros.kcalRemaining;
                const isHighProtein = dish.protein >= 35;

                return (
                  <div
                    key={dish.id}
                    className="rounded-2xl border bg-card p-4 shadow-2xs space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm leading-tight text-foreground">
                            {dish.name}
                          </h4>
                          {dish.price && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {dish.price}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {dish.description}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl h-8 px-2.5 text-xs font-medium shrink-0 gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                        onClick={() => setDishToLog(dish)}
                      >
                        <Plus className="size-3.5" />
                        Log Meal
                      </Button>
                    </div>

                    {/* Macro Breakdown Strip */}
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t text-center">
                      <div className="rounded-xl bg-muted/50 p-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-center gap-0.5">
                          <Flame className="size-3 text-amber-500" />
                          CAL
                        </p>
                        <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">
                          {Math.round(dish.kcal)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-primary/10 p-1.5">
                        <p className="text-[10px] text-primary font-medium">PROTEIN</p>
                        <p className="text-xs font-bold text-primary tabular-nums mt-0.5">
                          {Math.round(dish.protein)}g
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium">CARBS</p>
                        <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">
                          {Math.round(dish.carbs)}g
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium">FAT</p>
                        <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">
                          {Math.round(dish.fat)}g
                        </p>
                      </div>
                    </div>

                    {/* Macro Match Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {fitsCalories && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 gap-1"
                        >
                          <CheckCircle2 className="size-3" />
                          Fits remaining {initialMacros.kcalRemaining} kcal
                        </Badge>
                      )}
                      {isHighProtein && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] py-0"
                        >
                          ⚡ High Protein
                        </Badge>
                      )}
                      {dish.tags?.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 1-Click Log to Food Diary Dialog */}
      <Dialog open={Boolean(dishToLog)} onOpenChange={(open) => !open && setDishToLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Log Restaurant Meal</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add this dish directly to your daily Forma nutrition log.
            </DialogDescription>
          </DialogHeader>

          {dishToLog && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border p-3 bg-muted/30 space-y-1">
                <p className="font-semibold text-sm">{dishToLog.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPlace?.name}</p>
                <div className="flex items-center gap-3 text-xs font-medium pt-2">
                  <span className="text-amber-500">{Math.round(dishToLog.kcal)} kcal</span>
                  <span className="text-primary">{Math.round(dishToLog.protein)}g protein</span>
                  <span>{Math.round(dishToLog.carbs)}g carbs</span>
                  <span>{Math.round(dishToLog.fat)}g fat</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">Select Meal Time</label>
                <Select
                  value={logMeal}
                  onValueChange={(val) => setLogMeal(val as MealType)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setDishToLog(null)}
                  disabled={logging}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-xl gap-1.5"
                  onClick={handleConfirmLog}
                  disabled={logging}
                >
                  {logging && <Loader2 className="size-4 animate-spin" />}
                  Add to Food Diary
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
