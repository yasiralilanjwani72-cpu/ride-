import React, { useEffect, useState, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { LiveLocation } from '../types';
import { Navigation, MapPin, ShieldCheck, Clock, Gauge, Radio } from 'lucide-react';

interface LiveRideMapProps {
  liveLocation: LiveLocation;
  isDriverView?: boolean;
  onStepDriverPosition?: () => void;
}

function RoutePolylineOverlay({
  origin,
  destination,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const RouteClass = (routesLib as unknown as { Route?: { computeRoutes?: (req: unknown) => Promise<{ routes?: Array<{ createPolylines: () => google.maps.Polyline[]; viewport?: google.maps.LatLngBounds }> }> } }).Route;
    if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') return;

    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    RouteClass.computeRoutes(request)
      .then(({ routes }) => {
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
      })
      .catch((err: unknown) => {
        console.warn('Unable to load route data via Routes API:', err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin.lat, origin.lng, destination.lat, destination.lng]);

  return null;
}

export default function LiveRideMap({
  liveLocation,
  isDriverView = false,
  onStepDriverPosition,
}: LiveRideMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [mapLoadError, setMapLoadError] = useState(false);

  // Detect if API key is missing or a short test placeholder
  const hasValidKeyFormat = apiKey.length >= 25 && apiKey.startsWith('AIza');

  useEffect(() => {
    const handleAuthFailure = () => {
      setMapLoadError(true);
    };
    window.addEventListener('gmp-auth-failure', handleAuthFailure);
    return () => window.removeEventListener('gmp-auth-failure', handleAuthFailure);
  }, []);

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

        <div className="flex items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>{liveLocation.speedKmh} km/h</span>
          </div>
          <span aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ETA {liveLocation.etaMinutes} min</span>
          </div>
          {isDriverView && liveLocation.active && onStepDriverPosition && (
            <button
              onClick={onStepDriverPosition}
              className="px-3 py-1.5 bg-slate-900 text-white font-sans font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Broadcast GPS Step
            </button>
          )}
        </div>
      </div>

      {/* Map Viewport (Sized Parent for CF2 compliance) */}
      <div className="relative w-full h-[380px] bg-slate-900 overflow-hidden">
        {hasValidKeyFormat && !mapLoadError ? (
          <APIProvider
            apiKey={apiKey}
            language="en"
            region="PK"
          >
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
              />

              {/* Pickup Marker */}
              <AdvancedMarker
                position={{ lat: liveLocation.pickupLat, lng: liveLocation.pickupLng }}
                title={`Pickup: ${liveLocation.pickupLocation}`}
              >
                <Pin background="#0f172a" glyphColor="#ffffff" borderColor="#0f172a" />
              </AdvancedMarker>

              {/* Destination Marker */}
              <AdvancedMarker
                position={{ lat: liveLocation.destLat, lng: liveLocation.destLng }}
                title={`Destination: ${liveLocation.destinationLocation}`}
              >
                <Pin background="#2563eb" glyphColor="#ffffff" borderColor="#1d4ed8" />
              </AdvancedMarker>

              {/* Live Driver Vehicle Marker */}
              <AdvancedMarker
                position={{ lat: liveLocation.lat, lng: liveLocation.lng }}
                title={`Driver: ${liveLocation.driverName}`}
              >
                <div className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-1.5 border border-white">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{liveLocation.driverName}</span>
                </div>
              </AdvancedMarker>
            </Map>
          </APIProvider>
        ) : (
          /* Resilient Vector Corridor Telemetry Map when custom API key is not a live Google Maps key */
          <div className="w-full h-full relative flex flex-col justify-between p-6 bg-slate-950 text-slate-100 select-none">
            {/* Subtle Highway Coordinate Grid */}
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

            {/* Animated SVG Route Corridor */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 800 380"
              preserveAspectRatio="none"
            >
              {/* Background Highway Track */}
              <path
                d="M 110 280 C 290 260, 480 120, 690 100"
                fill="none"
                stroke="#1e293b"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Active Route Vector */}
              <path
                d="M 110 280 C 290 260, 480 120, 690 100"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
              {/* Pickup Node */}
              <circle cx="110" cy="280" r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
              {/* Destination Node */}
              <circle cx="690" cy="100" r="9" fill="#0f172a" stroke="#a855f7" strokeWidth="3" />

              {/* Interpolated Live Vehicle Position */}
              <g
                transform={`translate(${110 + (690 - 110) * progressRatio}, ${
                  280 + (100 - 280) * progressRatio
                })`}
              >
                <circle r="18" fill="#10b981" fillOpacity="0.25" />
                <circle r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
              </g>
            </svg>

            {/* Top Overlay Info */}
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

            {/* Bottom Waypoint Labels */}
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
