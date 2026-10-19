// Source: Google Maps Platform Code Assist
import React, { useEffect, useState, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Ride } from '../types';
import { Navigation, MapPin, Clock, Route as RouteIcon } from 'lucide-react';

interface RideRoutePreviewMapProps {
  ride: Ride;
}

/**
 * Planned Corridor Polyline Renderer using Modern Routes API (Route.computeRoutes)
 * Reference: https://developers.google.com/maps/documentation/javascript/routes?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
function PlannedRoutePolyline({
  origin,
  destination,
  onRouteMetrics,
  onRouteError,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  onRouteMetrics: (metrics: { distanceKm: number; durationMin: number } | null) => void;
  onRouteError: (msg: string | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const RouteClass = (
      routesLib as unknown as {
        Route?: {
          computeRoutes?: (req: unknown) => Promise<{
            routes?: Array<{
              createPolylines: () => google.maps.Polyline[];
              viewport?: google.maps.LatLngBounds;
              distanceMeters?: number;
              durationMillis?: number;
            }>;
          }>;
        };
      }
    ).Route;
    if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') return;

    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    RouteClass.computeRoutes(request)
      .then(({ routes }) => {
        onRouteError(null);
        if (!routes || routes.length === 0) return;
        const primaryRoute = routes[0];
        if (typeof primaryRoute.createPolylines === 'function') {
          const newPolylines = primaryRoute.createPolylines();
          newPolylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: '#059669',
              strokeWeight: 5,
            });
            polyline.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }
        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }
        if (primaryRoute.distanceMeters && primaryRoute.durationMillis) {
          onRouteMetrics({
            distanceKm: Number((primaryRoute.distanceMeters / 1000).toFixed(1)),
            durationMin: Math.round(primaryRoute.durationMillis / 60000),
          });
        }
      })
      .catch((err: unknown) => {
        console.warn('Unable to load planned route data via Routes API:', err);
        onRouteError('Unable to load route data. Switching to corridor preview.');
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    routesLib,
    map,
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    onRouteMetrics,
    onRouteError,
  ]);

  return null;
}

export default function RideRoutePreviewMap({ ride }: RideRoutePreviewMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [viewMode, setViewMode] = useState<'google_maps' | 'corridor_vector'>('google_maps');
  const [selectedMarker, setSelectedMarker] = useState<'origin' | 'destination' | null>('origin');
  const [routeMetrics, setRouteMetrics] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Compute approximate straight-line fallback distance if Routes API hasn't returned yet
  const approxDistanceKm = React.useMemo(() => {
    const R = 6371;
    const dLat = ((ride.destLat - ride.pickupLat) * Math.PI) / 180;
    const dLng = ((ride.destLng - ride.pickupLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((ride.pickupLat * Math.PI) / 180) *
        Math.cos((ride.destLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(12, Math.round(R * c * 1.18));
  }, [ride.pickupLat, ride.pickupLng, ride.destLat, ride.destLng]);

  const displayDistanceKm = routeMetrics?.distanceKm ?? approxDistanceKm;
  const displayDurationMin = routeMetrics?.durationMin ?? Math.round((approxDistanceKm / 85) * 60);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Route Preview Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <RouteIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-900">
              Planned Intercity Corridor Preview ({ride.fromCity} → {ride.toCity})
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              Est. Distance: {displayDistanceKm} km · Est. Highway Transit: ~{displayDurationMin} mins
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setViewMode('google_maps')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'google_maps'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Maps Route
          </button>
          <button
            type="button"
            onClick={() => setViewMode('corridor_vector')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'corridor_vector'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Corridor Diagram
          </button>
        </div>
      </div>

      {routeError && viewMode === 'google_maps' && (
        <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-[11px] text-amber-900">
          <span>{routeError}</span>
          <button
            type="button"
            onClick={() => setViewMode('corridor_vector')}
            className="font-semibold underline"
          >
            View Corridor Diagram
          </button>
        </div>
      )}

      {/* Explicit Sized Map Container (h-64 = 256px) */}
      <div className="relative w-full h-64 bg-slate-900 overflow-hidden">
        {viewMode === 'google_maps' && apiKey ? (
          <APIProvider apiKey={apiKey} language="en" region="PK">
            <Map
              defaultCenter={{
                lat: (ride.pickupLat + ride.destLat) / 2,
                lng: (ride.pickupLng + ride.destLng) / 2,
              }}
              defaultZoom={8}
              mapId="DEMO_MAP_ID"
              gestureHandling="cooperative"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <PlannedRoutePolyline
                origin={{ lat: ride.pickupLat, lng: ride.pickupLng }}
                destination={{ lat: ride.destLat, lng: ride.destLng }}
                onRouteMetrics={setRouteMetrics}
                onRouteError={setRouteError}
              />

              {/* Pickup Origin Marker */}
              <AdvancedMarker
                position={{ lat: ride.pickupLat, lng: ride.pickupLng }}
                title={`Origin: ${ride.pickupLocation}`}
                onClick={() => setSelectedMarker('origin')}
              >
                <Pin background="#0f172a" borderColor="#ffffff" glyphColor="#ffffff" />
              </AdvancedMarker>

              {/* Drop-off Destination Marker */}
              <AdvancedMarker
                position={{ lat: ride.destLat, lng: ride.destLng }}
                title={`Destination: ${ride.destinationLocation}`}
                onClick={() => setSelectedMarker('destination')}
              >
                <Pin background="#059669" borderColor="#ffffff" glyphColor="#ffffff" />
              </AdvancedMarker>

              {selectedMarker === 'origin' && (
                <InfoWindow
                  position={{ lat: ride.pickupLat, lng: ride.pickupLng }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="text-xs text-slate-900 p-1 space-y-0.5 max-w-[200px]">
                    <div className="font-bold">From: {ride.fromCity}</div>
                    <div className="text-slate-600">{ride.pickupLocation}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      Departs: {ride.departureDate} | {ride.departureTime}
                    </div>
                  </div>
                </InfoWindow>
              )}

              {selectedMarker === 'destination' && (
                <InfoWindow
                  position={{ lat: ride.destLat, lng: ride.destLng }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="text-xs text-slate-900 p-1 space-y-0.5 max-w-[200px]">
                    <div className="font-bold text-emerald-800">To: {ride.toCity}</div>
                    <div className="text-slate-600">{ride.destinationLocation}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      Fare: Rs. {ride.farePerSeat.toLocaleString()} / seat
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* High-Contrast Vector Corridor Preview */
          <div className="relative w-full h-full flex flex-col justify-between p-5 text-white bg-slate-950">
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            <div className="relative z-10 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                ORIGIN: {ride.pickupLat.toFixed(4)}° N, {ride.pickupLng.toFixed(4)}° E
              </span>
              <span>
                DEST: {ride.destLat.toFixed(4)}° N, {ride.destLng.toFixed(4)}° E
              </span>
            </div>

            <div className="relative z-10 my-auto py-4">
              <svg viewBox="0 0 600 100" className="w-full h-24 overflow-visible">
                <path
                  d="M 50 70 Q 300 15 550 40"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="5"
                  strokeDasharray="8 6"
                />
                <path
                  d="M 50 70 Q 300 15 550 40"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                />
                <circle cx="50" cy="70" r="8" fill="#0f172a" stroke="#ffffff" strokeWidth="3" />
                <text x="50" y="94" fill="#cbd5e1" fontSize="11" textAnchor="middle">
                  {ride.fromCity}
                </text>
                <circle cx="550" cy="40" r="8" fill="#10b981" stroke="#ffffff" strokeWidth="3" />
                <text x="550" y="66" fill="#34d399" fontSize="11" textAnchor="middle">
                  {ride.toCity}
                </text>
              </svg>
            </div>

            <div className="relative z-10 flex items-center justify-between text-xs border-t border-slate-800 pt-2.5 text-slate-300">
              <div className="truncate max-w-[45%]">
                <span className="text-slate-500">From: </span>
                {ride.pickupLocation}
              </div>
              <div className="truncate max-w-[45%] text-right">
                <span className="text-slate-500">To: </span>
                {ride.destinationLocation}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
