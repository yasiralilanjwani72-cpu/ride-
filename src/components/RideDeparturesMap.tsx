// Source: Google Maps Platform Code Assist
import React, { useEffect, useState, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { Ride } from '../types';
import { useGoogleMapsAuthStatus } from '../lib/googleMapsKey';
import { MapPin, Navigation, Calendar, Clock, Users, Star } from 'lucide-react';

interface RideDeparturesMapProps {
  rides: Ride[];
  onSelectRide?: (ride: Ride, initialTab?: 'overview' | 'vehicle' | 'ride' | 'reviews') => void;
  onFilterByDepartureCity?: (city: string) => void;
}

/**
 * Automatically fits the Google Map viewport bounds to include all visible ride departure markers
 */
function FitDepartureMarkersBounds({
  markers,
}: {
  markers: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || markers.length === 0 || typeof google === 'undefined') return;
    if (markers.length === 1) {
      map.setCenter(markers[0]);
      map.setZoom(10);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend(m));
    map.fitBounds(bounds, 56);
  }, [map, markers]);

  return null;
}

export default function RideDeparturesMap({
  rides,
  onSelectRide,
  onFilterByDepartureCity,
}: RideDeparturesMapProps) {
  const { apiKey, markAuthFailed } = useGoogleMapsAuthStatus();
  const [viewMode, setViewMode] = useState<'google_maps' | 'corridor_hubs'>('google_maps');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(
    rides[0]?.id || null
  );

  // Offset markers slightly if multiple rides share identical city coordinates so every departure marker is distinct and clickable
  const departureMarkers = useMemo(() => {
    const coordCountMap: Record<string, number> = {};
    return rides.map((ride) => {
      const baseLat = Number(ride.pickupLat) || 24.8607;
      const baseLng = Number(ride.pickupLng) || 67.0011;
      const key = `${baseLat.toFixed(3)},${baseLng.toFixed(3)}`;
      const seenCount = coordCountMap[key] || 0;
      coordCountMap[key] = seenCount + 1;

      const offsetAngle = seenCount * (Math.PI / 3);
      const offsetRadius = seenCount > 0 ? 0.015 * Math.ceil(seenCount / 2) : 0;

      return {
        ride,
        lat: baseLat + offsetRadius * Math.cos(offsetAngle),
        lng: baseLng + offsetRadius * Math.sin(offsetAngle),
      };
    });
  }, [rides]);

  const activeSelectedEntry = useMemo(() => {
    if (!selectedRideId) return departureMarkers[0] || null;
    return (
      departureMarkers.find((m) => m.ride.id === selectedRideId) ||
      departureMarkers[0] ||
      null
    );
  }, [departureMarkers, selectedRideId]);

  const defaultCenter = useMemo(() => {
    if (departureMarkers.length > 0) {
      return { lat: departureMarkers[0].lat, lng: departureMarkers[0].lng };
    }
    // Pakistan National Highway Corridor center
    return { lat: 30.3753, lng: 69.3451 };
  }, [departureMarkers]);

  return (
    <section
      aria-label="Available Ride Departure Locations Map"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Available Ride Departure Locations ({departureMarkers.length}{' '}
              {departureMarkers.length === 1 ? 'Departure Pin' : 'Departure Pins'})
            </h2>
            <p className="text-xs text-slate-500">
              Click any departure marker to inspect pickup coordinates, Captain rating, seat availability, and fare.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setViewMode('google_maps')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              viewMode === 'google_maps'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Maps Markers
          </button>
          <button
            type="button"
            onClick={() => setViewMode('corridor_hubs')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              viewMode === 'corridor_hubs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Departure Hub Grid
          </button>
        </div>
      </div>

      {/* Map Viewport (Explicit height h-80 = 320px for CF2 compliance) */}
      <div className="relative w-full h-80 bg-slate-900 overflow-hidden">
        {departureMarkers.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-2">
            <MapPin className="w-6 h-6 text-slate-500" />
            <div className="text-sm font-semibold text-white">
              No Departure Locations Match Current Filters
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              Adjust your search filters in the sidebar to view available intercity departure markers on the map.
            </p>
          </div>
        ) : viewMode === 'google_maps' && apiKey ? (
          <APIProvider apiKey={apiKey} language="en" region="PK" onError={() => markAuthFailed()}>
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={6}
              mapId="DEMO_MAP_ID"
              gestureHandling="cooperative"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              <FitDepartureMarkersBounds
                markers={departureMarkers.map((m) => ({ lat: m.lat, lng: m.lng }))}
              />

              {departureMarkers.map(({ ride, lat, lng }) => {
                const isSelected = activeSelectedEntry?.ride.id === ride.id;
                return (
                  <AdvancedMarker
                    key={ride.id}
                    position={{ lat, lng }}
                    title={`Departure: ${ride.fromCity} → ${ride.toCity} (${ride.pickupLocation})`}
                    onClick={() => setSelectedRideId(ride.id)}
                  >
                    <div
                      className={`px-2.5 py-1 rounded-lg shadow-md border text-xs font-semibold flex items-center gap-1.5 transition-transform ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-white scale-105'
                          : 'bg-slate-900 text-white border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {ride.fromCity} → {ride.toCity}
                      </span>
                      <span className="font-mono text-[11px] text-emerald-300">
                        Rs.{ride.farePerSeat.toLocaleString()}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

              {activeSelectedEntry && (
                <InfoWindow
                  position={{
                    lat: activeSelectedEntry.lat,
                    lng: activeSelectedEntry.lng,
                  }}
                  onCloseClick={() => setSelectedRideId(null)}
                >
                  <div className="text-xs text-slate-900 p-1 space-y-1.5 min-w-[210px] max-w-[250px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase font-bold text-emerald-700">
                        DEPARTURE TERMINAL
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-amber-600">
                        ⭐ {activeSelectedEntry.ride.driverRating.toFixed(1)}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900">
                      {activeSelectedEntry.ride.fromCity} → {activeSelectedEntry.ride.toCity}
                    </div>

                    <div className="text-slate-600">
                      <strong>Pickup:</strong> {activeSelectedEntry.ride.pickupLocation}
                    </div>

                    <div className="font-mono text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                      <span>{activeSelectedEntry.ride.departureDate}</span>
                      <span>|</span>
                      <span>{activeSelectedEntry.ride.departureTime}</span>
                      <span>·</span>
                      <span className="text-emerald-700 font-semibold">
                        {activeSelectedEntry.ride.availableSeats} seats
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                      <span className="font-mono font-bold text-emerald-700">
                        Rs. {activeSelectedEntry.ride.farePerSeat.toLocaleString()} / seat
                      </span>
                      {onSelectRide && (
                        <button
                          type="button"
                          onClick={() => onSelectRide(activeSelectedEntry.ride, 'ride')}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md transition-colors"
                        >
                          Inspect & Book
                        </button>
                      )}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* High-Contrast Interactive Departure Hub Grid Fallback */
          <div className="w-full h-full p-5 bg-slate-950 text-white overflow-y-auto space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
              <span>INTERCITY DEPARTURE COORDINATES DIRECTORY</span>
              <span>{departureMarkers.length} ACTIVE DEPARTURE PINS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {departureMarkers.map(({ ride, lat, lng }) => (
                <div
                  key={ride.id}
                  onClick={() => setSelectedRideId(ride.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-colors space-y-2 ${
                    activeSelectedEntry?.ride.id === ride.id
                      ? 'bg-slate-900 border-emerald-500'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        {ride.fromCity} → {ride.toCity}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      Rs. {ride.farePerSeat.toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 truncate">
                    Pickup: {ride.pickupLocation}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                    <span>
                      {lat.toFixed(4)}° N, {lng.toFixed(4)}° E
                    </span>
                    {onSelectRide && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRide(ride, 'ride');
                        }}
                        className="text-emerald-400 hover:underline font-sans font-semibold"
                      >
                        Inspect Ride →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Quick-Jump Departure Chips */}
      {departureMarkers.length > 0 && (
        <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold mr-1">
              Departure Pins:
            </span>
            {departureMarkers.map(({ ride }) => {
              const active = activeSelectedEntry?.ride.id === ride.id;
              return (
                <button
                  key={ride.id}
                  type="button"
                  onClick={() => {
                    setSelectedRideId(ride.id);
                    if (onFilterByDepartureCity) {
                      // Keep map focused on selected departure pin
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>{ride.fromCity}</span>
                  <span className="opacity-70">({ride.departureTime})</span>
                </button>
              );
            })}
          </div>

          {activeSelectedEntry && onSelectRide && (
            <button
              type="button"
              onClick={() => onSelectRide(activeSelectedEntry.ride, 'ride')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline whitespace-nowrap"
            >
              Open Selected Departure ({activeSelectedEntry.ride.fromCity} →{' '}
              {activeSelectedEntry.ride.toCity})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
