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
import { LiveLocation } from '../types';
import { useGoogleMapsAuthStatus } from '../lib/googleMapsKey';
import { Navigation, MapPin, ShieldCheck, Clock, Gauge, Radio, Search } from 'lucide-react';

interface LiveRideMapProps {
  liveLocation: LiveLocation;
  isDriverView?: boolean;
  onStepDriverPosition?: () => void;
}

/**
 * Modern Places API (New) Autocomplete using AutocompleteSuggestion & AutocompleteSessionToken
 * Reference: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
function CorridorPlaceSearch({
  onSelectCoordinates,
}: {
  onSelectCoordinates: (coords: { lat: number; lng: number; label: string }) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placesLib || queryText.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    setLoading(true);
    const req: google.maps.places.AutocompleteRequest = {
      input: queryText.trim(),
      sessionToken: sessionTokenRef.current,
      includedRegionCodes: ['pk'],
    };

    AutocompleteSuggestion.fetchAutocompleteSuggestions(req)
      .then((res) => {
        setSuggestions(res?.suggestions || []);
      })
      .catch((err: unknown) => {
        console.warn('Unable to load place autocomplete suggestions:', err);
        setSuggestions([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [placesLib, queryText]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      // Reset session token after fetchFields per GMP cost optimization guidelines
      sessionTokenRef.current = null;
      setSuggestions([]);
      const label =
        place.displayName || place.formattedAddress || suggestion.placePrediction.text.text;
      setQueryText(label);

      if (place.viewport && map) {
        map.fitBounds(place.viewport);
      } else if (place.location && map) {
        map.setCenter(place.location);
        map.setZoom(13);
      }

      if (place.location) {
        onSelectCoordinates({
          lat: place.location.lat(),
          lng: place.location.lng(),
          label,
        });
      }
    } catch (err) {
      console.warn('Unable to fetch place details:', err);
    }
  };

  return (
    <div className="relative w-full sm:w-72">
      <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search highway stop or landmark..."
          aria-label="Search highway stop or landmark via Google Places"
          className="w-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      {loading && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-[11px] text-slate-500 shadow-lg z-30">
          Searching Google Places...
        </div>
      )}
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-lg z-30 max-h-48 overflow-y-auto">
          {suggestions.map((s, idx) => {
            const pred = s.placePrediction;
            if (!pred) return null;
            return (
              <li key={pred.placeId || idx}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {pred.text.text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Modern Routes API Route.computeRoutes() Overlay
 * Replaces legacy DirectionsService (Disabled March 2025)
 * Reference: https://developers.google.com/maps/documentation/javascript/routes?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
function RoutePolylineOverlay({
  origin,
  destination,
  onRouteError,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
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
      })
      .catch((err: unknown) => {
        console.warn('Unable to load route data via Routes API:', err);
        onRouteError('Unable to load route data. Please check your network or API quota.');
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin.lat, origin.lng, destination.lat, destination.lng, onRouteError]);

  return null;
}

export default function LiveRideMap({
  liveLocation,
  isDriverView = false,
  onStepDriverPosition,
}: LiveRideMapProps) {
  const { apiKey, markAuthFailed } = useGoogleMapsAuthStatus();
  const [mapViewMode, setMapViewMode] = useState<'google_maps' | 'telemetry_vector'>('google_maps');
  const [activeInfoMarker, setActiveInfoMarker] = useState<'pickup' | 'driver' | 'destination' | 'searched' | null>('driver');
  const [routeErrorMsg, setRouteErrorMsg] = useState<string | null>(null);
  const [searchedPlace, setSearchedPlace] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const progressRatio = Math.min(
    0.95,
    Math.max(
      0.08,
      Math.abs(liveLocation.destLat - liveLocation.pickupLat) > 0.001
        ? Math.abs(liveLocation.lat - liveLocation.pickupLat) /
            Math.abs(liveLocation.destLat - liveLocation.pickupLat)
        : 0.45
    )
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Telemetry Header Bar */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              liveLocation.active ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span>
                {liveLocation.active
                  ? `Driver is ${liveLocation.distanceRemainingKm.toFixed(1)} km away`
                  : 'Ride Completed — Location Sharing Stopped'}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums text-emerald-700">
                Estimated arrival: {liveLocation.etaMinutes} minutes
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              <span>Captain {liveLocation.driverName}</span>
              <span aria-hidden="true"> · </span>
              <span>{liveLocation.vehicleName}</span>
              <span aria-hidden="true"> · </span>
              <span>
                Live Location: {liveLocation.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>{liveLocation.speedKmh} km/h</span>
          </div>
          <span aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ETA {liveLocation.etaMinutes} min</span>
          </div>

          {/* Interactive View Switcher: Google Maps SDK vs Corridor Telemetry Grid */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg font-sans">
            <button
              type="button"
              onClick={() => setMapViewMode('google_maps')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mapViewMode === 'google_maps'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google Maps
            </button>
            <button
              type="button"
              onClick={() => setMapViewMode('telemetry_vector')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mapViewMode === 'telemetry_vector'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Corridor Vector
            </button>
          </div>

          {isDriverView && liveLocation.active && onStepDriverPosition && (
            <button
              type="button"
              onClick={onStepDriverPosition}
              className="px-3 py-1.5 bg-slate-900 text-white font-sans font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Broadcast GPS Step
            </button>
          )}
        </div>
      </div>

      {routeErrorMsg && mapViewMode === 'google_maps' && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <span>{routeErrorMsg}</span>
          <button
            type="button"
            onClick={() => setMapViewMode('telemetry_vector')}
            className="font-semibold underline whitespace-nowrap"
          >
            Switch to Corridor Vector View
          </button>
        </div>
      )}

      {/* Map Viewport (Sized Parent for CF2 compliance: explicit height h-[400px]) */}
      <div className="relative w-full h-[400px] bg-slate-900 overflow-hidden">
        {mapViewMode === 'google_maps' && apiKey ? (
          <APIProvider
            apiKey={apiKey}
            language="en"
            region="PK"
            onError={() => markAuthFailed()}
          >
            {/* Places API (New) Search Overlay */}
            <div className="absolute top-3 left-3 z-20">
              <CorridorPlaceSearch
                onSelectCoordinates={(coords) => {
                  setSearchedPlace(coords);
                  setActiveInfoMarker('searched');
                }}
              />
            </div>

            <Map
              defaultCenter={{ lat: liveLocation.lat, lng: liveLocation.lng }}
              defaultZoom={10}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              <RoutePolylineOverlay
                origin={{ lat: liveLocation.pickupLat, lng: liveLocation.pickupLng }}
                destination={{ lat: liveLocation.destLat, lng: liveLocation.destLng }}
                onRouteError={setRouteErrorMsg}
              />

              {/* Pickup AdvancedMarker */}
              <AdvancedMarker
                position={{ lat: liveLocation.pickupLat, lng: liveLocation.pickupLng }}
                title={`Pickup: ${liveLocation.pickupLocation}`}
                onClick={() => setActiveInfoMarker('pickup')}
              >
                <Pin background="#0f172a" glyphColor="#ffffff" borderColor="#0f172a" />
              </AdvancedMarker>

              {/* Destination AdvancedMarker */}
              <AdvancedMarker
                position={{ lat: liveLocation.destLat, lng: liveLocation.destLng }}
                title={`Destination: ${liveLocation.destinationLocation}`}
                onClick={() => setActiveInfoMarker('destination')}
              >
                <Pin background="#2563eb" glyphColor="#ffffff" borderColor="#1d4ed8" />
              </AdvancedMarker>

              {/* Live Driver Vehicle AdvancedMarker */}
              <AdvancedMarker
                position={{ lat: liveLocation.lat, lng: liveLocation.lng }}
                title={`Driver: ${liveLocation.driverName}`}
                onClick={() => setActiveInfoMarker('driver')}
              >
                <div className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-1.5 border border-white">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{liveLocation.driverName}</span>
                </div>
              </AdvancedMarker>

              {/* Searched Highway Stop Marker */}
              {searchedPlace && (
                <AdvancedMarker
                  position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }}
                  title={searchedPlace.label}
                  onClick={() => setActiveInfoMarker('searched')}
                >
                  <Pin background="#d97706" glyphColor="#ffffff" borderColor="#b45309" />
                </AdvancedMarker>
              )}

              {/* Interactive InfoWindows */}
              {activeInfoMarker === 'driver' && (
                <InfoWindow
                  position={{ lat: liveLocation.lat, lng: liveLocation.lng }}
                  onCloseClick={() => setActiveInfoMarker(null)}
                >
                  <div className="text-xs text-slate-900 space-y-1 p-1">
                    <div className="font-bold">Captain {liveLocation.driverName}</div>
                    <div className="text-slate-600">{liveLocation.vehicleName}</div>
                    <div className="font-mono text-emerald-700 font-semibold">
                      {liveLocation.speedKmh} km/h · {liveLocation.distanceRemainingKm.toFixed(1)} km away (ETA {liveLocation.etaMinutes}m)
                    </div>
                  </div>
                </InfoWindow>
              )}

              {activeInfoMarker === 'pickup' && (
                <InfoWindow
                  position={{ lat: liveLocation.pickupLat, lng: liveLocation.pickupLng }}
                  onCloseClick={() => setActiveInfoMarker(null)}
                >
                  <div className="text-xs text-slate-900 space-y-0.5 p-1">
                    <div className="font-bold">Origin Pickup</div>
                    <div className="text-slate-600">{liveLocation.pickupLocation}</div>
                  </div>
                </InfoWindow>
              )}

              {activeInfoMarker === 'destination' && (
                <InfoWindow
                  position={{ lat: liveLocation.destLat, lng: liveLocation.destLng }}
                  onCloseClick={() => setActiveInfoMarker(null)}
                >
                  <div className="text-xs text-slate-900 space-y-0.5 p-1">
                    <div className="font-bold">Drop-off Destination</div>
                    <div className="text-slate-600">{liveLocation.destinationLocation}</div>
                  </div>
                </InfoWindow>
              )}

              {activeInfoMarker === 'searched' && searchedPlace && (
                <InfoWindow
                  position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }}
                  onCloseClick={() => setActiveInfoMarker(null)}
                >
                  <div className="text-xs text-slate-900 space-y-0.5 p-1">
                    <div className="font-bold">Highway Stop / Landmark</div>
                    <div className="text-slate-600">{searchedPlace.label}</div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* Corridor Vector Telemetry View */
          <div className="w-full h-full relative flex flex-col justify-between p-6 bg-slate-950 text-slate-100 select-none">
            <svg
              className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id="corridorGrid" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path
                    d="M 48 0 L 0 0 0 48"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#corridorGrid)" />
            </svg>

            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 800 380"
              preserveAspectRatio="none"
            >
              <path
                d="M 110 280 C 290 260, 480 120, 690 100"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 110 280 C 290 260, 480 120, 690 100"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
              <circle cx="110" cy="280" r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
              <circle cx="690" cy="100" r="9" fill="#0f172a" stroke="#a855f7" strokeWidth="3" />

              <g
                transform={`translate(${110 + (690 - 110) * progressRatio}, ${
                  280 + (100 - 280) * progressRatio
                })`}
              >
                <circle r="18" fill="#10b981" fillOpacity="0.25" />
                <circle r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
              </g>
            </svg>

            <div className="relative z-10 flex items-center justify-between">
              <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-lg text-xs">
                <div className="font-mono tabular-nums text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>
                    GPS CORRIDOR STREAM · {liveLocation.lat.toFixed(4)}° N,{' '}
                    {liveLocation.lng.toFixed(4)}° E
                  </span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  Authorized Private Feed · Confirmed Passengers & Admin Only
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-lg text-right text-xs font-mono tabular-nums">
                <div className="text-slate-300">
                  DIST REMAINING: <strong className="text-white">{liveLocation.distanceRemainingKm.toFixed(1)} km</strong>
                </div>
                <div className="text-emerald-400">
                  EST. ARRIVAL: <strong>{liveLocation.etaMinutes} min</strong>
                </div>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-sky-400 font-mono">ORIGIN PICKUP</div>
                <div className="text-xs font-medium text-white truncate mt-0.5">
                  {liveLocation.pickupLocation}
                </div>
              </div>
              <div className="bg-slate-900/90 border border-emerald-800/60 p-3 rounded-lg">
                <div className="text-[11px] text-emerald-400 font-mono">
                  LIVE VEHICLE ({liveLocation.speedKmh} KM/H)
                </div>
                <div className="text-xs font-medium text-white truncate mt-0.5">
                  {liveLocation.driverName} · {liveLocation.vehicleName}
                </div>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
                <div className="text-[11px] text-purple-400 font-mono">DESTINATION</div>
                <div className="text-xs font-medium text-white truncate mt-0.5">
                  {liveLocation.destinationLocation}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Route & Privacy Footer */}
      <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>{liveLocation.pickupLocation}</span>
          <span aria-hidden="true">→</span>
          <span>{liveLocation.destinationLocation}</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>End-to-End Protected Location Privacy</span>
        </div>
      </div>
    </div>
  );
}
