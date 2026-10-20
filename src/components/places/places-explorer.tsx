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
  CheckCircle2,
  Flame,
  Footprints,
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
  Utensils,
  UtensilsCrossed,
} from "lucide-react";

export function PlacesExplorer({
  initialMacros,
}: {
  initialMacros: MacroComparison | null;
}) {
  const router = useRouter();

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

  useEffect(() => {
    handleScanCurrentLocation();
  }, []);

  async function fallbackToIpLocation() {
    try {
      const ip = await detectLocationAction();
      if (ip) {
        setCoords({ lat: ip.lat, lng: ip.lng });
        setUserLocation(ip);
        handleSearchPlaces({ lat: ip.lat, lng: ip.lng, isGps: false });
        return;
      }
    } catch {}
    toast.info("Please search for your city in the search bar.");
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
        if (res.coords) setCoords(res.coords);
        if (res.userLocation) setUserLocation(res.userLocation);
      }
    } catch {
      toast.error("Failed to load restaurants. Try again.");
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
        toast.error("Could not load the menu.");
      }
    } catch {
      toast.error("Failed to fetch menu.");
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
        toast.success(`Logged "${dishToLog.name}" to ${logMeal}!`, {
          description: `${Math.round(dishToLog.kcal)} kcal · ${Math.round(dishToLog.protein)}g protein`,
        });
        setDishToLog(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to log.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLogging(false);
    }
  }

  const displayedPlaces = places.filter((p) => {
    if (activeFilter === "chains") return p.isChain;
    if (activeFilter === "local") return !p.isChain;
    return true;
  });

  const menuCategories = Array.from(new Set(menu?.items.map((i) => i.category || "General") || []));

  const displayedMenuItems = menu?.items.filter((item) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "high-protein") return item.protein >= 30;
    if (categoryFilter === "low-cal") return item.kcal <= 550;
    return item.category === categoryFilter;
  });

  const locationTitle =
    userLocation?.street && userLocation?.neighborhood
      ? `${userLocation.street}, ${userLocation.neighborhood}`
      : userLocation?.neighborhood
      ? `${userLocation.neighborhood}, ${userLocation.city}`
      : userLocation?.city || "Your Area";

  const closest = displayedPlaces[0];

  return (
    <div className="space-y-5">

      {/* ── LOCATION HERO ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">

        {/* Top accent strip */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <div className="p-5 space-y-4">

          {/* Location header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Ping marker */}
              <div className="relative size-10 shrink-0 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                <MapPin className="size-5 text-primary" />
                {!searching && !locating && places.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-emerald-500 border-2 border-card" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Radio className="size-3 text-primary" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-primary">
                    {userLocation?.source === "gps" ? "GPS Locked" : "Area Detected"}
                  </span>
                </div>
                <p className="text-base font-bold leading-tight">
                  {searching || locating ? (
                    <span className="text-muted-foreground text-sm">Scanning location…</span>
                  ) : (
                    <span className="line-clamp-1">{locationTitle}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {userLocation?.city || ""}
                  {userLocation?.country ? `, ${userLocation.country}` : ""}
                </p>
              </div>
            </div>

            {/* Rescan button */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold shrink-0"
              onClick={handleScanCurrentLocation}
              disabled={locating || searching}
            >
              <Locate className={cn("size-3.5 text-primary", locating && "animate-spin")} />
              {locating ? "Locking…" : "Rescan"}
            </Button>
          </div>

          {/* Stats row */}
          {!searching && !locating && places.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                <UtensilsCrossed className="size-3.5 text-primary shrink-0" />
                <span><strong className="text-foreground">{displayedPlaces.length}</strong> spots found</span>
              </div>
              {closest && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                  <Footprints className="size-3.5 text-primary shrink-0" />
                  <span>Closest: <strong className="text-foreground">{closest.name}</strong> · {closest.distanceMeters}m · ~{closest.walkMinutes}m walk</span>
                </div>
              )}
              {initialMacros && (
                <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-lg px-2.5 py-1.5 font-medium">
                  <Sparkles className="size-3 shrink-0" />
                  <span>{initialMacros.kcalRemaining} kcal · {initialMacros.proteinRemaining}g protein remaining</span>
                </div>
              )}
            </div>
          )}

          {/* Search + Radius row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search city or neighborhood…"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && cityInput.trim()) handleSearchPlaces({ query: cityInput });
                }}
                className="pl-9 h-9 rounded-xl text-sm"
              />
            </div>
            <Select
              value={String(radius)}
              onValueChange={(val) => {
                const r = Number(val);
                setRadius(r);
                if (coords) handleSearchPlaces({ lat: coords.lat, lng: coords.lng });
              }}
            >
              <SelectTrigger className="w-[130px] h-9 rounded-xl text-xs font-medium shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 km (Walk)</SelectItem>
                <SelectItem value="3000">3 km (Near)</SelectItem>
                <SelectItem value="5000">5 km (Drive)</SelectItem>
                <SelectItem value="10000">10 km (Area)</SelectItem>
              </SelectContent>
            </Select>
            {cityInput.trim() && (
              <Button
                size="sm"
                className="h-9 rounded-xl px-3"
                onClick={() => handleSearchPlaces({ query: cityInput })}
                disabled={searching}
              >
                Go
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER PILLS ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(["all", "chains", "local"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
              activeFilter === f
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {f === "all" ? `All (${places.length})` : f === "chains" ? "Chains" : "Local Spots"}
          </button>
        ))}
      </div>

      {/* ── RESTAURANT CARDS ──────────────────────────────────── */}
      {searching ? (
        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-sm font-medium">Scanning nearby dining spots…</p>
        </div>
      ) : displayedPlaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
          <UtensilsCrossed className="mx-auto size-9 text-muted-foreground/50" />
          <p className="font-semibold text-sm">No restaurants found in this radius</p>
          <p className="text-xs text-muted-foreground">Try expanding to 10 km or search a specific area above.</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setRadius(10000); if (coords) handleSearchPlaces({ lat: coords.lat, lng: coords.lng }); }}>
            Expand to 10 km
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayedPlaces.map((place, index) => (
            <div
              key={place.id}
              className="group relative rounded-2xl border bg-card hover:border-primary/40 transition-all shadow-xs overflow-hidden"
            >
              {/* Closest tag */}
              {index === 0 && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    CLOSEST
                  </span>
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* Name & cuisine */}
                <div className="space-y-1 pr-16">
                  <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">
                    {place.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Utensils className="size-3 text-primary/60 shrink-0" />
                    {place.cuisine}
                  </p>
                </div>

                {/* Distance + travel pill */}
                {place.distanceMeters !== undefined && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Footprints className="size-3.5 text-primary shrink-0" />
                    <span>
                      {place.distanceMeters < 1000
                        ? `${place.distanceMeters}m`
                        : `${(place.distanceMeters / 1000).toFixed(1)}km`}
                      {" · "}
                      {place.distanceMeters < 1500
                        ? `~${place.walkMinutes || 1}m walk`
                        : `~${place.driveMinutes || 3}m drive`}
                    </span>
                  </div>
                )}

                {/* Address */}
                {place.address && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1 flex items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    {place.address}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <Button
                    size="sm"
                    className="flex-1 h-8 rounded-xl gap-1.5 text-xs font-semibold"
                    onClick={() => openRestaurantMenu(place)}
                  >
                    <Sparkles className="size-3" />
                    Menu & Macros
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 rounded-xl text-xs gap-1 shrink-0"
                    asChild
                  >
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Directions"
                    >
                      <Navigation className="size-3.5 text-primary" />
                      <span className="sr-only sm:not-sr-only">Directions</span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MENU SHEET ────────────────────────────────────────── */}
      <Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col h-full bg-background">

          {/* Sheet Header */}
          <SheetHeader className="p-5 border-b shrink-0 bg-card space-y-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-lg font-bold leading-tight">
                  {selectedPlace?.name}
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedPlace?.cuisine}</span>
                    {selectedPlace?.distanceMeters && (
                      <span className="flex items-center gap-1">
                        <Footprints className="size-3 text-primary" />
                        {selectedPlace.distanceMeters}m · ~{selectedPlace.walkMinutes || 1}m walk
                      </span>
                    )}
                    {selectedPlace && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <Navigation className="size-3" />
                        Open in Maps
                      </a>
                    )}
                  </div>
                </SheetDescription>
              </div>

              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 shrink-0 h-8" asChild>
                <Link href={`/assistant?q=${encodeURIComponent(`I'm at ${selectedPlace?.name}. What should I order to hit my nutrition targets?`)}`}>
                  <MessageSquare className="size-3.5 text-primary" />
                  Ask AI
                </Link>
              </Button>
            </div>

            {/* Tips */}
            {menu?.healthyTips && menu.healthyTips.length > 0 && (
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Lightbulb className="size-3.5" />
                  Ordering Tips
                </div>
                <ul className="space-y-1 text-muted-foreground">
                  {menu.healthyTips.map((tip, i) => (
                    <li key={i} className="line-clamp-2 pl-2 border-l border-primary/30">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SheetHeader>

          {/* Category Filter */}
          <div className="px-5 py-2.5 border-b flex items-center gap-2 overflow-x-auto shrink-0 bg-muted/20 no-scrollbar">
            {[
              { id: "all", label: "All" },
              { id: "high-protein", label: "⚡ High Protein" },
              { id: "low-cal", label: "🥗 Under 550 kcal" },
              ...menuCategories.map((c) => ({ id: c, label: c })),
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCategoryFilter(f.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                  categoryFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Dishes */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {loadingMenu ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="mx-auto size-7 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading menu & macros…</p>
                <p className="text-xs text-muted-foreground">Powered by Forma AI</p>
              </div>
            ) : !displayedMenuItems?.length ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No items in this category.
              </div>
            ) : (
              displayedMenuItems.map((dish) => {
                const fits = initialMacros && dish.kcal <= initialMacros.kcalRemaining;
                const highProtein = dish.protein >= 35;
                return (
                  <div
                    key={dish.id}
                    className="rounded-2xl border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors"
                  >
                    {/* Dish header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm leading-tight">{dish.name}</p>
                          {dish.price && <span className="text-[11px] text-muted-foreground font-mono">{dish.price}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{dish.description}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 rounded-xl text-xs gap-1 bg-primary/5 border-primary/20 text-primary hover:bg-primary/15 shrink-0"
                        onClick={() => setDishToLog(dish)}
                      >
                        <Plus className="size-3.5" />
                        Log
                      </Button>
                    </div>

                    {/* Macro row */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "CAL", value: Math.round(dish.kcal), highlight: false, unit: "" },
                        { label: "PROTEIN", value: Math.round(dish.protein), highlight: true, unit: "g" },
                        { label: "CARBS", value: Math.round(dish.carbs), highlight: false, unit: "g" },
                        { label: "FAT", value: Math.round(dish.fat), highlight: false, unit: "g" },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className={cn(
                            "rounded-xl p-2 text-center",
                            m.highlight ? "bg-primary/10" : "bg-muted/40"
                          )}
                        >
                          <p className={cn("text-[9px] font-bold uppercase tracking-wide", m.highlight ? "text-primary" : "text-muted-foreground")}>
                            {m.label}
                          </p>
                          <p className={cn("text-xs font-bold tabular-nums mt-0.5", m.highlight ? "text-primary" : "text-foreground")}>
                            {m.value}{m.unit}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {fits && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 gap-1">
                          <CheckCircle2 className="size-3" />
                          Fits {initialMacros?.kcalRemaining} kcal remaining
                        </Badge>
                      )}
                      {highProtein && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] py-0">
                          ⚡ High Protein
                        </Badge>
                      )}
                      {dish.tags?.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] py-0">{t}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── LOG DIALOG ────────────────────────────────────────── */}
      <Dialog open={Boolean(dishToLog)} onOpenChange={(o) => !o && setDishToLog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Log to Food Diary</DialogTitle>
            <DialogDescription className="text-xs">
              Add this dish to your Forma daily log.
            </DialogDescription>
          </DialogHeader>
          {dishToLog && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border p-3 bg-muted/30 space-y-2">
                <p className="font-semibold text-sm">{dishToLog.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPlace?.name}</p>
                <div className="flex items-center gap-3 text-xs font-medium pt-1 border-t">
                  <span className="text-amber-500 flex items-center gap-1"><Flame className="size-3" />{Math.round(dishToLog.kcal)} kcal</span>
                  <span className="text-primary">{Math.round(dishToLog.protein)}g protein</span>
                  <span className="text-muted-foreground">{Math.round(dishToLog.carbs)}g carbs</span>
                  <span className="text-muted-foreground">{Math.round(dishToLog.fat)}g fat</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Meal time</p>
                <Select value={logMeal} onValueChange={(v) => setLogMeal(v as MealType)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setDishToLog(null)} disabled={logging}>Cancel</Button>
                <Button className="rounded-xl gap-1.5" onClick={handleConfirmLog} disabled={logging}>
                  {logging && <Loader2 className="size-3.5 animate-spin" />}
                  Add to Diary
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
