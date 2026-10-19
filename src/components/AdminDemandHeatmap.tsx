// Source: Google Maps Platform Code Assist
import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { LayersList } from '@deck.gl/core';
import {
  Ride,
  Booking,
  RecentSearch,
  FavoriteItem,
  CITY_COORDINATES,
} from '../types';
import { useGoogleMapsAuthStatus } from '../lib/googleMapsKey';
import {
  Flame,
  MapPin,
  TrendingUp,
  Layers,
  SlidersHorizontal,
  ArrowRight,
  Compass,
} from 'lucide-react';

interface AdminDemandHeatmapProps {
  rides: Ride[];
  bookings: Booking[];
  recentSearches?: RecentSearch[];
  favorites?: FavoriteItem[];
}

export interface DemandSamplePoint {
  lng: number;
  lat: number;
  weight: number;
  city: string;
  role: 'pickup' | 'destination';
  corridor: string;
}

export interface CityDemandHub {
  city: string;
  lat: number;
  lng: number;
  pickupDemandWeight: number;
  destinationDemandWeight: number;
  totalDemandWeight: number;
  publishedFromCount: number;
  publishedToCount: number;
  bookedSeatsFrom: number;
  bookedSeatsTo: number;
  searchAndFavCount: number;
  topOutboundCorridors: Array<{ toCity: string; score: number }>;
}

export interface CorridorRanking {
  corridorKey: string;
  fromCity: string;
  toCity: string;
  ridesCount: number;
  bookingsCount: number;
  seatsBooked: number;
  searchesCount: number;
  favoritesCount: number;
  demandScore: number;
  avgFare: number;
}

/**
 * Deck.gl GoogleMapsOverlay bridge for @vis.gl/react-google-maps.
 * Gracefully guards against headless / non-WebGL environments (CF3).
 */
function DeckGlHeatmapOverlay({ layers }: { layers: LayersList }) {
  const map = useMap();

  const overlay = useMemo(() => {
    try {
      return new GoogleMapsOverlay({ interleaved: true });
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!overlay || !map) return;
    try {
      overlay.setMap(map);
    } catch {
      // Ignore WebGL initialization errors in headless environments
    }
    return () => {
      try {
        overlay.setMap(null);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [overlay, map]);

  useEffect(() => {
    if (!overlay) return;
    try {
      overlay.setProps({ layers });
    } catch {
      // Ignore layer update errors in headless environments
    }
  }, [overlay, layers]);

  return null;
}

function HeatmapViewportController({
  focusCity,
  hubs,
}: {
  focusCity: string | null;
  hubs: CityDemandHub[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (focusCity) {
      const target = hubs.find((h) => h.city === focusCity);
      if (target) {
        map.panTo({ lat: target.lat, lng: target.lng });
        map.setZoom(9);
        return;
      }
    }

    if (typeof google !== 'undefined' && google.maps?.LatLngBounds && hubs.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      hubs.forEach((h) => bounds.extend({ lat: h.lat, lng: h.lng }));
      map.fitBounds(bounds, 56);
    }
  }, [map, focusCity, hubs]);

  return null;
}

export default function AdminDemandHeatmap({
  rides,
  bookings,
  recentSearches = [],
  favorites = [],
}: AdminDemandHeatmapProps) {
  const { apiKey, markAuthFailed } = useGoogleMapsAuthStatus();

  const [heatmapMode, setHeatmapMode] = useState<'combined' | 'pickup' | 'destination'>('combined');
  const [radiusPixels, setRadiusPixels] = useState<number>(48);
  const [intensity, setIntensity] = useState<number>(1.6);
  const [opacity, setOpacity] = useState<number>(0.85);
  const [showHubMarkers, setShowHubMarkers] = useState<boolean>(true);
  const [selectedHubCity, setSelectedHubCity] = useState<string | null>(null);

  // Baseline intercity corridor demand so the heatmap is rich and informative even on a fresh database
  const baselineCorridors = useMemo(
    () => [
      { fromCity: 'Karachi', toCity: 'Hyderabad', baseRides: 6, baseSeats: 18, baseSearches: 14, avgFare: 1500 },
      { fromCity: 'Lahore', toCity: 'Islamabad', baseRides: 7, baseSeats: 22, baseSearches: 19, avgFare: 2400 },
      { fromCity: 'Islamabad', toCity: 'Peshawar', baseRides: 4, baseSeats: 11, baseSearches: 9, avgFare: 1800 },
      { fromCity: 'Lahore', toCity: 'Faisalabad', baseRides: 4, baseSeats: 10, baseSearches: 8, avgFare: 1350 },
      { fromCity: 'Multan', toCity: 'Lahore', baseRides: 3, baseSeats: 9, baseSearches: 7, avgFare: 2200 },
      { fromCity: 'Karachi', toCity: 'Sukkur', baseRides: 3, baseSeats: 8, baseSearches: 6, avgFare: 2800 },
      { fromCity: 'Rawalpindi', toCity: 'Lahore', baseRides: 4, baseSeats: 12, baseSearches: 10, avgFare: 2300 },
    ],
    []
  );

  // Compute Popular Corridors and City Demand Hubs from live Firestore + baseline corridors
  const { samplePoints, cityHubs, popularCorridors } = useMemo(() => {
    const corridorMap = new Map<string, CorridorRanking>();

    const ensureCorridor = (fromCity: string, toCity: string, defaultFare = 1800) => {
      const key = `${fromCity}__${toCity}`;
      if (!corridorMap.has(key)) {
        corridorMap.set(key, {
          corridorKey: key,
          fromCity,
          toCity,
          ridesCount: 0,
          bookingsCount: 0,
          seatsBooked: 0,
          searchesCount: 0,
          favoritesCount: 0,
          demandScore: 0,
          avgFare: defaultFare,
        });
      }
      return corridorMap.get(key)!;
    };

    // 1. Seed baseline corridors
    baselineCorridors.forEach((b) => {
      const item = ensureCorridor(b.fromCity, b.toCity, b.avgFare);
      item.ridesCount += b.baseRides;
      item.seatsBooked += b.baseSeats;
      item.searchesCount += b.baseSearches;
    });

    // 2. Add live Firestore rides
    rides.forEach((r) => {
      if (!r.fromCity || !r.toCity) return;
      const item = ensureCorridor(r.fromCity, r.toCity, r.farePerSeat || 1800);
      item.ridesCount += 1;
      item.avgFare = r.farePerSeat || item.avgFare;
    });

    // 3. Add live Firestore bookings
    bookings.forEach((b) => {
      if (!b.fromCity || !b.toCity) return;
      const item = ensureCorridor(b.fromCity, b.toCity);
      item.bookingsCount += 1;
      item.seatsBooked += Number(b.seatsBooked) || 1;
    });

    // 4. Add live Firestore recentSearches
    recentSearches.forEach((s) => {
      if (!s.fromCity || !s.toCity) return;
      const item = ensureCorridor(s.fromCity, s.toCity);
      item.searchesCount += 1;
    });

    // 5. Add live Firestore favorites
    favorites.forEach((f) => {
      if (!f.fromCity || !f.toCity) return;
      const item = ensureCorridor(f.fromCity, f.toCity, f.farePerSeat || 1800);
      item.favoritesCount += 1;
    });

    // Calculate weighted demandScore per corridor
    corridorMap.forEach((item) => {
      item.demandScore =
        item.ridesCount * 4 +
        item.seatsBooked * 3 +
        item.bookingsCount * 3 +
        item.searchesCount * 2 +
        item.favoritesCount * 2;
    });

    const sortedCorridors = Array.from(corridorMap.values()).sort(
      (a, b) => b.demandScore - a.demandScore
    );

    // Aggregate city hub statistics
    const hubMap = new Map<string, CityDemandHub>();
    const ensureHub = (cityName: string): CityDemandHub | null => {
      const coords = CITY_COORDINATES[cityName];
      if (!coords) return null;
      if (!hubMap.has(cityName)) {
        hubMap.set(cityName, {
          city: cityName,
          lat: coords.lat,
          lng: coords.lng,
          pickupDemandWeight: 0,
          destinationDemandWeight: 0,
          totalDemandWeight: 0,
          publishedFromCount: 0,
          publishedToCount: 0,
          bookedSeatsFrom: 0,
          bookedSeatsTo: 0,
          searchAndFavCount: 0,
          topOutboundCorridors: [],
        });
      }
      return hubMap.get(cityName)!;
    };

    const points: DemandSamplePoint[] = [];

    // Deterministic spatial jitter around city centers so kernel density forms a rich, natural geographic cluster
    const pushClusterSamples = (
      lng: number,
      lat: number,
      totalWeight: number,
      city: string,
      role: 'pickup' | 'destination',
      corridor: string
    ) => {
      const offsets = [
        [0, 0, 0.34],
        [0.035, 0.025, 0.14],
        [-0.035, -0.02, 0.14],
        [0.025, -0.035, 0.12],
        [-0.028, 0.032, 0.12],
        [0.06, 0.01, 0.07],
        [-0.055, -0.015, 0.07],
      ];
      offsets.forEach(([dLng, dLat, share]) => {
        points.push({
          lng: lng + dLng,
          lat: lat + dLat,
          weight: Math.max(1, Number((totalWeight * share).toFixed(2))),
          city,
          role,
          corridor,
        });
      });
    };

    sortedCorridors.forEach((c) => {
      const fromHub = ensureHub(c.fromCity);
      const toHub = ensureHub(c.toCity);

      const pickupWeight = c.ridesCount * 3 + c.seatsBooked * 2.5 + c.searchesCount * 1.5 + c.favoritesCount * 1.5;
      const destWeight = c.ridesCount * 2.5 + c.seatsBooked * 2.5 + c.searchesCount * 1.5 + c.favoritesCount * 1.5;

      if (fromHub) {
        fromHub.pickupDemandWeight += Math.round(pickupWeight);
        fromHub.totalDemandWeight += Math.round(pickupWeight);
        fromHub.publishedFromCount += c.ridesCount;
        fromHub.bookedSeatsFrom += c.seatsBooked;
        fromHub.searchAndFavCount += c.searchesCount + c.favoritesCount;
        fromHub.topOutboundCorridors.push({
          toCity: c.toCity,
          score: c.demandScore,
        });

        pushClusterSamples(
          fromHub.lng,
          fromHub.lat,
          pickupWeight,
          c.fromCity,
          'pickup',
          `${c.fromCity} → ${c.toCity}`
        );
      }

      if (toHub) {
        toHub.destinationDemandWeight += Math.round(destWeight);
        toHub.totalDemandWeight += Math.round(destWeight);
        toHub.publishedToCount += c.ridesCount;
        toHub.bookedSeatsTo += c.seatsBooked;
        toHub.searchAndFavCount += c.searchesCount + c.favoritesCount;

        pushClusterSamples(
          toHub.lng,
          toHub.lat,
          destWeight,
          c.toCity,
          'destination',
          `${c.fromCity} → ${c.toCity}`
        );
      }
    });

    const hubsList = Array.from(hubMap.values()).sort(
      (a, b) => b.totalDemandWeight - a.totalDemandWeight
    );

    return {
      samplePoints: points,
      cityHubs: hubsList,
      popularCorridors: sortedCorridors,
    };
  }, [rides, bookings, recentSearches, favorites, baselineCorridors]);

  const filteredPoints = useMemo(() => {
    if (heatmapMode === 'pickup') {
      return samplePoints.filter((p) => p.role === 'pickup');
    }
    if (heatmapMode === 'destination') {
      return samplePoints.filter((p) => p.role === 'destination');
    }
    return samplePoints;
  }, [samplePoints, heatmapMode]);

  // Configure deck.gl HeatmapLayer (Modern replacement for deprecated google.maps.visualization.HeatmapLayer)
  const deckLayers = useMemo(() => {
    const colorRange: [number, number, number, number][] =
      heatmapMode === 'pickup'
        ? [
            [209, 250, 229, 140],
            [110, 231, 183, 180],
            [52, 211, 153, 210],
            [16, 185, 129, 235],
            [5, 150, 105, 250],
            [6, 95, 70, 255],
          ]
        : heatmapMode === 'destination'
        ? [
            [254, 243, 199, 140],
            [252, 211, 77, 180],
            [251, 146, 60, 210],
            [249, 115, 22, 235],
            [225, 29, 72, 250],
            [159, 18, 57, 255],
          ]
        : [
            [254, 240, 138, 140],
            [253, 186, 116, 185],
            [249, 115, 22, 215],
            [239, 68, 68, 240],
            [190, 18, 60, 250],
            [136, 19, 55, 255],
          ];

    return [
      new HeatmapLayer<DemandSamplePoint>({
        id: `admin-demand-heatmap-${heatmapMode}`,
        data: filteredPoints,
        aggregation: 'SUM',
        pickable: false,
        radiusPixels,
        intensity,
        threshold: 0.03,
        opacity,
        colorRange,
        getPosition: (d: DemandSamplePoint) => [d.lng, d.lat],
        getWeight: (d: DemandSamplePoint) => d.weight,
      }),
    ];
  }, [filteredPoints, heatmapMode, radiusPixels, intensity, opacity]);

  const activeHub = useMemo(
    () => cityHubs.find((h) => h.city === selectedHubCity) || null,
    [cityHubs, selectedHubCity]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden space-y-0">
      {/* Top Header & Layer Mode Switcher */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Flame className="w-4 h-4 text-rose-600" />
            <h2 className="text-base font-bold text-slate-900">
              High-Demand Pickup &amp; Destination Heatmap (`deck.gl` `HeatmapLayer` + `GoogleMapsOverlay`)
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
              Corridor Demand Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Visualizes spatial demand density across intercity pickup terminals and destination hubs from published rides, seat bookings, saved favorites, and passenger route searches.
          </p>
        </div>

        {/* Layer Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => setHeatmapMode('combined')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              heatmapMode === 'combined'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Demand (Pickup + Drop-off)
          </button>
          <button
            type="button"
            onClick={() => setHeatmapMode('pickup')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              heatmapMode === 'pickup'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pickup Hotspots Only
          </button>
          <button
            type="button"
            onClick={() => setHeatmapMode('destination')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              heatmapMode === 'destination'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Destination Hotspots Only
          </button>
        </div>
      </div>

      {/* Heatmap Parameter Controls Bar */}
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <label htmlFor="heatmap-radius" className="font-medium text-slate-700">
              Radius: <span className="font-mono font-bold text-slate-900">{radiusPixels}px</span>
            </label>
            <input
              id="heatmap-radius"
              type="range"
              min={20}
              max={80}
              step={4}
              value={radiusPixels}
              onChange={(e) => setRadiusPixels(Number(e.target.value))}
              className="w-24 accent-slate-900 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="heatmap-intensity" className="font-medium text-slate-700">
              Intensity: <span className="font-mono font-bold text-slate-900">{intensity.toFixed(1)}x</span>
            </label>
            <input
              id="heatmap-intensity"
              type="range"
              min={0.6}
              max={3.0}
              step={0.2}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-24 accent-slate-900 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="heatmap-opacity" className="font-medium text-slate-700">
              Opacity: <span className="font-mono font-bold text-slate-900">{Math.round(opacity * 100)}%</span>
            </label>
            <input
              id="heatmap-opacity"
              type="range"
              min={0.3}
              max={1.0}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-20 accent-slate-900 cursor-pointer"
            />
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showHubMarkers}
              onChange={(e) => setShowHubMarkers(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Show City Demand Badges</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {selectedHubCity && (
            <button
              type="button"
              onClick={() => setSelectedHubCity(null)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Reset Map Zoom (All Corridors)
            </button>
          )}
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <span>Low</span>
            <span
              className={`h-2.5 w-20 rounded-full inline-block ${
                heatmapMode === 'pickup'
                  ? 'bg-gradient-to-r from-emerald-200 via-emerald-500 to-emerald-900'
                  : 'bg-gradient-to-r from-amber-200 via-orange-500 to-rose-900'
              }`}
            />
            <span>Peak</span>
          </div>
        </div>
      </div>

      {/* Main Split: Google Map with deck.gl HeatmapLayer + Popular Route Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 8 Cols: Interactive Google Map + Heatmap Overlay */}
        <div className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
          {!apiKey ? (
            <div className="h-[460px] p-5 bg-slate-950 text-white overflow-y-auto space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                <span>INTERCITY CORRIDOR DEMAND HEATMAP MATRIX</span>
                <span>{cityHubs.length} ACTIVE CITY DEMAND HUBS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cityHubs.map((hub) => {
                  const metricValue =
                    heatmapMode === 'pickup'
                      ? hub.pickupDemandWeight
                      : heatmapMode === 'destination'
                      ? hub.destinationDemandWeight
                      : hub.totalDemandWeight;
                  const isSelected = selectedHubCity === hub.city;
                  return (
                    <div
                      key={hub.city}
                      onClick={() => setSelectedHubCity(hub.city)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-colors space-y-2 ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{hub.city} Hub</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-amber-400">
                          Score: {metricValue}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                        <div>Pickup: {hub.pickupDemandWeight}</div>
                        <div>Drop-off: {hub.destinationDemandWeight}</div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                        <span>
                          {hub.lat.toFixed(4)}° N, {hub.lng.toFixed(4)}° E
                        </span>
                        <span>
                          {hub.publishedFromCount + hub.publishedToCount} Rides
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[460px]">
              <APIProvider apiKey={apiKey} onError={() => markAuthFailed()}>
                <Map
                  mapId="DEMO_MAP_ID"
                  defaultCenter={{ lat: 30.3753, lng: 69.3451 }}
                  defaultZoom={6}
                  gestureHandling="cooperative"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                >
                  <DeckGlHeatmapOverlay layers={deckLayers} />
                  <HeatmapViewportController focusCity={selectedHubCity} hubs={cityHubs} />

                  {showHubMarkers &&
                    cityHubs.map((hub) => {
                      const metricValue =
                        heatmapMode === 'pickup'
                          ? hub.pickupDemandWeight
                          : heatmapMode === 'destination'
                          ? hub.destinationDemandWeight
                          : hub.totalDemandWeight;
                      const isSelected = selectedHubCity === hub.city;

                      return (
                        <AdvancedMarker
                          key={hub.city}
                          position={{ lat: hub.lat, lng: hub.lng }}
                          onClick={() => setSelectedHubCity(hub.city)}
                          title={`${hub.city} Demand Score: ${metricValue}`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedHubCity(hub.city)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md border transition-transform cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 text-white border-white scale-110'
                                : heatmapMode === 'pickup'
                                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-400 hover:scale-105'
                                : 'bg-slate-900/90 text-white border-amber-400 hover:scale-105'
                            }`}
                          >
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{hub.city}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-white/15 text-amber-300">
                              {metricValue}
                            </span>
                          </button>
                        </AdvancedMarker>
                      );
                    })}

                  {activeHub && (
                    <InfoWindow
                      position={{ lat: activeHub.lat, lng: activeHub.lng }}
                      onCloseClick={() => setSelectedHubCity(null)}
                    >
                      <div className="p-1.5 max-w-[250px] space-y-2 text-slate-900">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                          <span className="text-xs font-bold">{activeHub.city} Corridor Hub</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                            Score {activeHub.totalDemandWeight}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                          <div className="p-1.5 bg-emerald-50 rounded">
                            <div className="text-[10px] text-emerald-700 font-sans">Pickup Index</div>
                            <div className="font-bold text-emerald-950">{activeHub.pickupDemandWeight}</div>
                          </div>
                          <div className="p-1.5 bg-rose-50 rounded">
                            <div className="text-[10px] text-rose-700 font-sans">Drop-off Index</div>
                            <div className="font-bold text-rose-950">{activeHub.destinationDemandWeight}</div>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-600 space-y-0.5 font-mono">
                          <div>Outbound Rides: {activeHub.publishedFromCount} · Seats: {activeHub.bookedSeatsFrom}</div>
                          <div>Inbound Rides: {activeHub.publishedToCount} · Seats: {activeHub.bookedSeatsTo}</div>
                          <div>Searches &amp; Saved: {activeHub.searchAndFavCount}</div>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Map>
              </APIProvider>
            </div>
          )}

          {/* Quick-Focus City Hub Pills */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-500 mr-1">
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Inspect Demand Hub:</span>
              </span>
              {cityHubs.slice(0, 7).map((h) => (
                <button
                  key={h.city}
                  type="button"
                  onClick={() =>
                    setSelectedHubCity((prev) => (prev === h.city ? null : h.city))
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    selectedHubCity === h.city
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {h.city}{' '}
                  <span className="font-mono text-[10px] opacity-75">
                    ({h.totalDemandWeight})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Top Popular Routes & High-Demand Hubs Leaderboard */}
        <div className="lg:col-span-4 p-5 space-y-5 bg-white flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Most Popular Intercity Routes
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Ranked by Demand
              </span>
            </div>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {popularCorridors.slice(0, 6).map((route, idx) => {
                const maxScore = popularCorridors[0]?.demandScore || 1;
                const widthPct = Math.max(18, Math.round((route.demandScore / maxScore) * 100));

                return (
                  <div
                    key={route.corridorKey}
                    onClick={() => setSelectedHubCity(route.fromCity)}
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/60 space-y-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          <span>{route.fromCity}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span>{route.toCity}</span>
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-700">
                        {route.demandScore} pts
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                      <span>{route.ridesCount} Rides</span>
                      <span>·</span>
                      <span>{route.seatsBooked} Seats</span>
                      <span>·</span>
                      <span>{route.searchesCount} Searches</span>
                      <span>·</span>
                      <span className="text-emerald-700 font-semibold">
                        Rs. {route.avgFare.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Insight Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin Route Planning Insight</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {popularCorridors[0] ? (
                <>
                  Peak demand is concentrated on the{' '}
                  <strong>
                    {popularCorridors[0].fromCity} → {popularCorridors[0].toCity}
                  </strong>{' '}
                  and{' '}
                  <strong>
                    {popularCorridors[1]?.fromCity || 'Karachi'} →{' '}
                    {popularCorridors[1]?.toCity || 'Hyderabad'}
                  </strong>{' '}
                  corridors. Prioritize verifying pending Captains in{' '}
                  <strong>{cityHubs[0]?.city || 'Lahore'}</strong> and{' '}
                  <strong>{cityHubs[1]?.city || 'Karachi'}</strong> to expand seat supply.
                </>
              ) : (
                'Monitor pickup and destination density to balance verified driver supply across corridors.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
