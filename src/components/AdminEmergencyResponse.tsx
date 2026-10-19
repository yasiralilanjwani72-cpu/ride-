// Source: Google Maps Platform Code Assist
import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  SOSAlert,
  PassengerProfile,
  DriverProfile,
  DriverDocument,
  Vehicle,
  Ride,
  Booking,
  LiveLocation,
  CITY_COORDINATES,
} from '../types';
import {
  acknowledgeSOSAlert,
  resolveSOSAlert,
  triggerSOSAlert,
  sendNotification,
} from '../services/firestoreService';
import { useGoogleMapsAuthStatus } from '../lib/googleMapsKey';
import {
  ShieldAlert,
  MapPin,
  Phone,
  Mail,
  User,
  Car,
  Navigation,
  CheckCircle2,
  Clock,
  Eye,
  Crosshair,
  AlertTriangle,
  Send,
  X,
} from 'lucide-react';
import defaultDriverAvatar from '../assets/images/avatar_driver_pro_1791134254517.jpg';

interface AdminEmergencyResponseProps {
  sosAlerts: SOSAlert[];
  passengerProfiles: PassengerProfile[];
  driverProfiles: DriverProfile[];
  driverDocuments: Record<string, DriverDocument>;
  vehicles: Vehicle[];
  rides: Ride[];
  bookings: Booking[];
  liveLocations: Record<string, LiveLocation>;
}

function getTimestampMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object') {
    if ('toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
      return (val as { toMillis: () => number }).toMillis();
    }
    if ('seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
      return (val as { seconds: number }).seconds * 1000;
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const parsed = new Date(val).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function formatAlertTimestamp(val: unknown): string {
  const ms = getTimestampMillis(val);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Automatically pans/zooms the Google Map to the focused SOS alert's real-time location or fits all active alerts
 */
function EmergencyMapCameraController({
  focusedPosition,
  allAlertPositions,
}: {
  focusedPosition: { lat: number; lng: number } | null;
  allAlertPositions: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    if (focusedPosition) {
      map.panTo(focusedPosition);
      map.setZoom(13);
      return;
    }

    if (allAlertPositions.length === 1) {
      map.setCenter(allAlertPositions[0]);
      map.setZoom(12);
    } else if (allAlertPositions.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      allAlertPositions.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 64);
    }
  }, [map, focusedPosition, allAlertPositions]);

  return null;
}

export default function AdminEmergencyResponse({
  sosAlerts,
  passengerProfiles,
  driverProfiles,
  driverDocuments,
  vehicles,
  rides,
  bookings,
  liveLocations,
}: AdminEmergencyResponseProps) {
  const { apiKey, markAuthFailed } = useGoogleMapsAuthStatus();

  const [statusFilter, setStatusFilter] = useState<'active' | 'acknowledged' | 'resolved' | 'all'>('active');
  const [roleFilter, setRoleFilter] = useState<'all' | 'passenger' | 'driver'>('all');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [inspectedSenderAlert, setInspectedSenderAlert] = useState<SOSAlert | null>(null);
  const [dispatchNote, setDispatchNote] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [simulatingDrill, setSimulatingDrill] = useState(false);

  // Enrich each SOS alert with live GPS telemetry if the associated ride has an active liveLocation stream
  const enrichedAlerts = useMemo(() => {
    return sosAlerts
      .slice()
      .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
      .map((alert) => {
        const associatedRide =
          alert.rideId && alert.rideId !== 'N/A'
            ? rides.find((r) => r.id === alert.rideId)
            : undefined;
        const liveStream =
          alert.rideId && alert.rideId !== 'N/A' ? liveLocations[alert.rideId] : undefined;

        const currentLat = liveStream?.active ? liveStream.lat : alert.lat;
        const currentLng = liveStream?.active ? liveStream.lng : alert.lng;
        const currentSpeed = liveStream?.active ? liveStream.speedKmh : 0;

        const passengerProfile = passengerProfiles.find((p) => p.uid === alert.senderUid);
        const driverProfile = driverProfiles.find((d) => d.uid === alert.senderUid);
        const driverDoc = driverDocuments[alert.senderUid];
        const driverVehicle = vehicles.find(
          (v) => v.driverUid === alert.senderUid || v.id === associatedRide?.vehicleId
        );

        return {
          alert,
          currentLat,
          currentLng,
          currentSpeed,
          hasLiveStream: Boolean(liveStream?.active),
          associatedRide,
          passengerProfile,
          driverProfile,
          driverDoc,
          driverVehicle,
        };
      });
  }, [
    sosAlerts,
    rides,
    liveLocations,
    passengerProfiles,
    driverProfiles,
    driverDocuments,
    vehicles,
  ]);

  const activeAlertsCount = useMemo(
    () => sosAlerts.filter((a) => a.status === 'active').length,
    [sosAlerts]
  );
  const acknowledgedAlertsCount = useMemo(
    () => sosAlerts.filter((a) => a.status === 'acknowledged').length,
    [sosAlerts]
  );
  const resolvedAlertsCount = useMemo(
    () => sosAlerts.filter((a) => a.status === 'resolved').length,
    [sosAlerts]
  );

  const filteredEnrichedAlerts = useMemo(() => {
    return enrichedAlerts.filter(({ alert }) => {
      if (statusFilter === 'active' && alert.status !== 'active' && alert.status !== 'acknowledged') {
        return false;
      }
      if (statusFilter === 'acknowledged' && alert.status !== 'acknowledged') {
        return false;
      }
      if (statusFilter === 'resolved' && alert.status !== 'resolved') {
        return false;
      }
      if (roleFilter !== 'all' && alert.senderRole !== roleFilter) return false;
      return true;
    });
  }, [enrichedAlerts, statusFilter, roleFilter]);

  const focusedEntry = useMemo(() => {
    if (selectedAlertId) {
      const found = enrichedAlerts.find((e) => e.alert.id === selectedAlertId);
      if (found) return found;
    }
    return filteredEnrichedAlerts[0] || enrichedAlerts[0] || null;
  }, [selectedAlertId, enrichedAlerts, filteredEnrichedAlerts]);

  const inspectedEntry = useMemo(() => {
    if (!inspectedSenderAlert) return null;
    return (
      enrichedAlerts.find((e) => e.alert.id === inspectedSenderAlert.id) || null
    );
  }, [inspectedSenderAlert, enrichedAlerts]);

  const handleSimulateEmergencyDrill = async () => {
    setSimulatingDrill(true);
    setActionFeedback(null);
    try {
      const sampleRide = rides[0];
      const samplePass = passengerProfiles[0];
      const coords = sampleRide
        ? {
            lat: sampleRide.pickupLat + (sampleRide.destLat - sampleRide.pickupLat) * 0.35,
            lng: sampleRide.pickupLng + (sampleRide.destLng - sampleRide.pickupLng) * 0.35,
          }
        : CITY_COORDINATES.Karachi;

      const newAlertId = await triggerSOSAlert({
        senderUid: samplePass?.uid || sampleRide?.driverUid || 'usr_emergency_drill',
        senderName: samplePass?.fullName || sampleRide?.driverName || 'Muhammad Ali',
        senderEmail: samplePass?.email || 'passenger@rideconnect.app',
        senderPhone: samplePass?.phone || '+92 300 1234567',
        senderRole: samplePass ? 'passenger' : 'driver',
        lat: coords.lat,
        lng: coords.lng,
        locationLabel: sampleRide
          ? `Highway Corridor (${sampleRide.fromCity} → ${sampleRide.toCity})`
          : 'M-9 Toll Plaza Sector, Karachi',
        rideId: sampleRide?.id || 'N/A',
        message: sampleRide
          ? `Urgent roadside assistance requested on intercity route ${sampleRide.fromCity} → ${sampleRide.toCity}.`
          : 'Emergency roadside assistance requested by verified traveler.',
      });

      setStatusFilter('active');
      setSelectedAlertId(newAlertId);
      setActionFeedback(
        `Simulated live SOS alert (${newAlertId}) and locked Google Map onto real-time coordinates.`
      );
    } catch (err) {
      setActionFeedback(
        err instanceof Error ? err.message : 'Failed to trigger emergency drill alert.'
      );
    } finally {
      setSimulatingDrill(false);
    }
  };

  const handleSendResponderAdvisory = async (alert: SOSAlert) => {
    const cleanNote =
      dispatchNote.trim() ||
      `Central Admin Emergency Response team has locked onto your live GPS (${alert.lat.toFixed(
        4
      )}° N, ${alert.lng.toFixed(4)}° E) and dispatched highway assistance.`;
    try {
      await sendNotification(
        alert.senderUid,
        'Emergency Response Dispatched by Admin',
        cleanNote,
        'sos',
        alert.id
      );
      setDispatchNote('');
      setActionFeedback(`Emergency response confirmation sent to ${alert.senderName}.`);
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : 'Failed to send advisory.');
    }
  };

  const defaultMapCenter = useMemo(() => {
    if (focusedEntry) {
      return { lat: focusedEntry.currentLat, lng: focusedEntry.currentLng };
    }
    return { lat: 30.3753, lng: 69.3451 };
  }, [focusedEntry]);

  return (
    <div className="space-y-6">
      {/* Top Emergency Response Command Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-rose-400 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              <span>ADMIN EMERGENCY RESPONSE &amp; LIVE SOS GPS COMMAND</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display">
              Real-Time SOS Incident Queue &amp; Google Maps Location Pinpoint
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Monitor active SOS alerts from Passengers and Captains in real time. Inspect verified sender credentials, protected contact details, and pinpoint live GPS telemetry on Google Maps.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSimulateEmergencyDrill}
            disabled={simulatingDrill}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>
              {simulatingDrill ? 'Broadcasting SOS...' : '+ Simulate Live SOS Alert'}
            </span>
          </button>
        </div>

        {/* 4 Emergency KPI Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono tabular-nums">
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans">Active SOS Alerts</div>
            <div
              className={`text-2xl font-bold mt-1 ${
                activeAlertsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {activeAlertsCount}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Awaiting immediate response
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans">Resolved Incidents</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {resolvedAlertsCount}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Verified safe &amp; closed
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans">Passenger SOS Signals</div>
            <div className="text-2xl font-bold text-white mt-1">
              {sosAlerts.filter((a) => a.senderRole === 'passenger').length}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Traveler safety dispatches
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3.5">
            <div className="text-[11px] text-slate-400 font-sans">Captain SOS Signals</div>
            <div className="text-2xl font-bold text-white mt-1">
              {sosAlerts.filter((a) => a.senderRole === 'driver').length}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Highway fleet dispatches
            </div>
          </div>
        </div>

        {actionFeedback && (
          <div className="p-3 bg-slate-800 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 font-medium flex items-center justify-between gap-2">
            <span>{actionFeedback}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Main Split Command Workspace: Left Live SOS Queue (5 cols) | Right Interactive Google Map & Sender Telemetry (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live List of Active SOS Alerts */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Live SOS Emergency Queue ({filteredEnrichedAlerts.length})
              </h3>
              <p className="text-xs text-slate-500">
                Select any alert to inspect sender details or view real-time location on Google Maps
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Open ({activeAlertsCount + acknowledgedAlertsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('acknowledged')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'acknowledged'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Acknowledged ({acknowledgedAlertsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Resolved ({resolvedAlertsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({sosAlerts.length})
              </button>
            </div>

            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as 'all' | 'passenger' | 'driver')
              }
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Roles</option>
              <option value="passenger">Passengers Only</option>
              <option value="driver">Captains Only</option>
            </select>
          </div>

          {/* SOS Alert Cards */}
          {filteredEnrichedAlerts.length === 0 ? (
            <div className="py-12 text-center space-y-3 border border-dashed border-slate-200 rounded-xl p-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-900">
                {statusFilter === 'active'
                  ? 'No Active SOS Emergency Alerts'
                  : 'No Matching SOS Alerts Found'}
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                All intercity corridors are currently clear. You can click &ldquo;+ Simulate Live SOS Alert&rdquo; above to test the emergency response workflow.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {filteredEnrichedAlerts.map(
                ({
                  alert,
                  currentLat,
                  currentLng,
                  hasLiveStream,
                  associatedRide,
                }) => {
                  const isFocused = focusedEntry?.alert.id === alert.id;
                  const isActive = alert.status === 'active';
                  const isAcknowledged = alert.status === 'acknowledged';

                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isFocused
                          ? isActive
                            ? 'bg-rose-50/70 border-rose-400 shadow-xs'
                            : isAcknowledged
                            ? 'bg-amber-50/70 border-amber-400 shadow-xs'
                            : 'bg-slate-50 border-slate-900'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${
                                isActive
                                  ? 'bg-rose-600 text-white'
                                  : isAcknowledged
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isActive
                                ? 'ACTIVE SOS'
                                : isAcknowledged
                                ? 'ACKNOWLEDGED'
                                : 'RESOLVED'}
                            </span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                              {alert.senderRole}
                            </span>
                            {hasLiveStream && (
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                LIVE STREAMING GPS
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 pt-1">
                            {alert.senderName}
                          </h4>
                          <div className="text-xs font-mono text-slate-600">
                            {alert.senderPhone} · {alert.senderEmail}
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {formatAlertTimestamp(alert.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-slate-200/80">
                        {alert.message}
                      </p>

                      <div className="text-[11px] font-mono text-slate-600 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="font-semibold text-slate-900">
                            {currentLat.toFixed(5)}° N, {currentLng.toFixed(5)}° E
                          </span>
                        </div>
                        <div className="text-slate-500 font-sans truncate">
                          Location: <strong>{alert.locationLabel}</strong>
                        </div>
                        {associatedRide && (
                          <div className="text-emerald-700 font-sans">
                            Route: <strong>{associatedRide.fromCity} → {associatedRide.toCity}</strong> ({associatedRide.vehicleName})
                          </div>
                        )}
                      </div>

                      {/* Required Action Buttons: View Sender Details, View Real-Time Location on Google Map, Acknowledge & Resolve */}
                      <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAlertId(alert.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            isFocused
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                          }`}
                        >
                          <Crosshair className="w-3.5 h-3.5 text-rose-500" />
                          <span>Map Pin</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAlertId(alert.id);
                            setInspectedSenderAlert(alert);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Sender Details</span>
                        </button>

                        {isActive && (
                          <button
                            type="button"
                            onClick={async () => {
                              await acknowledgeSOSAlert(alert);
                              setActionFeedback(
                                `Acknowledged SOS alert from ${alert.senderName} and notified sender.`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Acknowledge</span>
                          </button>
                        )}

                        {(isActive || isAcknowledged) && (
                          <button
                            type="button"
                            onClick={async () => {
                              await resolveSOSAlert(alert);
                              setActionFeedback(
                                `Marked SOS alert from ${alert.senderName} as resolved.`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors ml-auto"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Real-Time Google Map + Focused Sender & Ride Dossier */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Navigation className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Real-Time Emergency Google Map Viewport
                  </h3>
                  <p className="text-xs text-slate-500">
                    {focusedEntry
                      ? `Locked onto ${focusedEntry.alert.senderName} (${focusedEntry.currentLat.toFixed(
                          4
                        )}° N, ${focusedEntry.currentLng.toFixed(4)}° E)`
                      : 'Displaying all active SOS emergency coordinates across highway corridors'}
                  </p>
                </div>
              </div>

              {focusedEntry && (
                <button
                  type="button"
                  onClick={() => setInspectedSenderAlert(focusedEntry.alert)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Full Sender Dossier</span>
                </button>
              )}
            </div>

            {/* Google Map Container with Explicit 420px Height (CF2 Compliance) */}
            <div className="relative w-full h-[420px] bg-slate-900">
              {apiKey ? (
                <APIProvider apiKey={apiKey} language="en" region="PK" onError={() => markAuthFailed()}>
                  <Map
                    defaultCenter={defaultMapCenter}
                    defaultZoom={6}
                    mapId="DEMO_MAP_ID"
                    gestureHandling="cooperative"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <EmergencyMapCameraController
                      focusedPosition={
                        focusedEntry
                          ? { lat: focusedEntry.currentLat, lng: focusedEntry.currentLng }
                          : null
                      }
                      allAlertPositions={filteredEnrichedAlerts.map((e) => ({
                        lat: e.currentLat,
                        lng: e.currentLng,
                      }))}
                    />

                    {filteredEnrichedAlerts.map((entry) => {
                      const isSelected = focusedEntry?.alert.id === entry.alert.id;
                      const isActive = entry.alert.status === 'active';

                      return (
                        <AdvancedMarker
                          key={entry.alert.id}
                          position={{ lat: entry.currentLat, lng: entry.currentLng }}
                          title={`SOS: ${entry.alert.senderName} (${entry.alert.senderRole.toUpperCase()})`}
                          onClick={() => setSelectedAlertId(entry.alert.id)}
                        >
                          <div
                            className={`px-2.5 py-1.5 rounded-lg shadow-lg border text-xs font-bold flex items-center gap-1.5 transition-transform ${
                              isActive
                                ? isSelected
                                  ? 'bg-rose-600 text-white border-white scale-110 ring-4 ring-rose-500/40'
                                  : 'bg-rose-700 text-white border-rose-300 hover:scale-105'
                                : 'bg-emerald-700 text-white border-emerald-200'
                            }`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>{entry.alert.senderName}</span>
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/25">
                              {entry.alert.senderRole}
                            </span>
                          </div>
                        </AdvancedMarker>
                      );
                    })}

                    {focusedEntry && (
                      <InfoWindow
                        position={{
                          lat: focusedEntry.currentLat,
                          lng: focusedEntry.currentLng,
                        }}
                        onCloseClick={() => setSelectedAlertId(null)}
                      >
                        <div className="p-1 text-xs text-slate-900 space-y-2 min-w-[230px] max-w-[270px]">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                            <span
                              className={`font-mono text-[10px] font-bold uppercase ${
                                focusedEntry.alert.status === 'active'
                                  ? 'text-rose-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {focusedEntry.alert.status === 'active'
                                ? '● LIVE SOS EMERGENCY'
                                : '✓ RESOLVED INCIDENT'}
                            </span>
                            <span className="font-mono text-[10px] uppercase font-semibold text-slate-500">
                              {focusedEntry.alert.senderRole}
                            </span>
                          </div>

                          <div>
                            <div className="text-sm font-bold text-slate-900">
                              {focusedEntry.alert.senderName}
                            </div>
                            <div className="font-mono text-[11px] text-slate-600">
                              {focusedEntry.alert.senderPhone}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {focusedEntry.alert.senderEmail}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                            {focusedEntry.alert.message}
                          </div>

                          <div className="font-mono text-[10px] text-slate-500">
                            GPS: {focusedEntry.currentLat.toFixed(5)}° N,{' '}
                            {focusedEntry.currentLng.toFixed(5)}° E
                            {focusedEntry.hasLiveStream && (
                              <span className="block text-emerald-700 font-semibold">
                                Speed: {focusedEntry.currentSpeed} km/h (Live Telemetry)
                              </span>
                            )}
                          </div>

                          <div className="pt-1 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectedSenderAlert(focusedEntry.alert)}
                              className="px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded hover:bg-slate-800"
                            >
                              Sender Details
                            </button>
                            {focusedEntry.alert.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => resolveSOSAlert(focusedEntry.alert)}
                                className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-semibold rounded hover:bg-emerald-700"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>
              ) : (
                <div className="w-full h-full p-5 bg-slate-950 text-white overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono text-rose-400">
                    <span>REAL-TIME SOS EMERGENCY GPS COORDINATES RADAR</span>
                    <span>{filteredEnrichedAlerts.length} INCIDENT PIN(S)</span>
                  </div>

                  {focusedEntry ? (
                    <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/60 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono uppercase font-bold text-rose-400">
                          ● LOCKED SENDER TELEMETRY: {focusedEntry.alert.senderName} ({focusedEntry.alert.senderRole.toUpperCase()})
                        </span>
                        <span className="text-xs font-mono text-emerald-400">
                          {focusedEntry.currentLat.toFixed(5)}° N, {focusedEntry.currentLng.toFixed(5)}° E
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Sector: <strong>{focusedEntry.alert.locationLabel}</strong> · Phone:{' '}
                        <span className="font-mono">{focusedEntry.alert.senderPhone}</span>
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-950/80 p-2.5 rounded border border-slate-800">
                        {focusedEntry.alert.message}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setInspectedSenderAlert(focusedEntry.alert)}
                          className="px-3 py-1.5 bg-white text-slate-900 text-xs font-semibold rounded-md hover:bg-slate-100"
                        >
                          View Sender Details
                        </button>
                        {focusedEntry.alert.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => resolveSOSAlert(focusedEntry.alert)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700"
                          >
                            Mark Resolved ✓
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredEnrichedAlerts.map((entry) => {
                      const isSelected = focusedEntry?.alert.id === entry.alert.id;
                      return (
                        <div
                          key={entry.alert.id}
                          onClick={() => setSelectedAlertId(entry.alert.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                            isSelected
                              ? 'bg-rose-950/50 border-rose-500'
                              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span>{entry.alert.senderName}</span>
                            </span>
                            <span className="text-[10px] font-mono uppercase text-slate-400">
                              {entry.alert.senderRole}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-emerald-400">
                            {entry.currentLat.toFixed(4)}° N, {entry.currentLng.toFixed(4)}° E
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {entry.alert.locationLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Focused Alert Quick Sender & Dispatch Card */}
          {focusedEntry && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={
                      focusedEntry.passengerProfile?.photoUrl ||
                      focusedEntry.driverProfile?.photoUrl ||
                      defaultDriverAvatar
                    }
                    alt={focusedEntry.alert.senderName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = defaultDriverAvatar;
                    }}
                    className="w-12 h-12 rounded-full object-cover border border-slate-300"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {focusedEntry.alert.senderName}
                      </h3>
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {focusedEntry.alert.senderRole}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-500 mt-0.5">
                      Phone: {focusedEntry.alert.senderPhone} · Email:{' '}
                      {focusedEntry.alert.senderEmail}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectedSenderAlert(focusedEntry.alert)}
                    className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg transition-colors"
                  >
                    Inspect Complete Sender Profile
                  </button>
                  {focusedEntry.alert.status === 'active' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await acknowledgeSOSAlert(focusedEntry.alert);
                        setActionFeedback(
                          `Acknowledged SOS alert from ${focusedEntry.alert.senderName}.`
                        );
                      }}
                      className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                    >
                      Acknowledge SOS
                    </button>
                  )}
                  {(focusedEntry.alert.status === 'active' ||
                    focusedEntry.alert.status === 'acknowledged') && (
                    <button
                      type="button"
                      onClick={() => resolveSOSAlert(focusedEntry.alert)}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    >
                      Mark SOS Resolved ✓
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Emergency Dispatch Message to Sender */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Send Direct Emergency Response Update to {focusedEntry.alert.senderName}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={dispatchNote}
                    onChange={(e) => setDispatchNote(e.target.value)}
                    placeholder="e.g. Motorway Patrol unit dispatched to your GPS coordinates; stay inside vehicle..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendResponderAdvisory(focusedEntry.alert)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Response Notice</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sender Details & Protected Verification Dossier Modal */}
      {inspectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-sender-details-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={
                    inspectedEntry.passengerProfile?.photoUrl ||
                    inspectedEntry.driverProfile?.photoUrl ||
                    defaultDriverAvatar
                  }
                  alt={inspectedEntry.alert.senderName}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border border-slate-300"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id="sos-sender-details-title"
                      className="text-lg font-bold text-slate-900"
                    >
                      {inspectedEntry.alert.senderName}
                    </h3>
                    <span className="text-xs font-mono uppercase px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                      {inspectedEntry.alert.senderRole} SOS SENDER
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    User UID: {inspectedEntry.alert.senderUid} · Alert ID:{' '}
                    {inspectedEntry.alert.id}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedSenderAlert(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contact & Identity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verified Emergency Contact</span>
                </div>
                <div className="font-mono text-slate-800">
                  Phone: <strong>{inspectedEntry.alert.senderPhone}</strong>
                </div>
                <div className="font-mono text-slate-700 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>{inspectedEntry.alert.senderEmail}</span>
                </div>
                <div className="text-slate-600">
                  Home City:{' '}
                  <strong>
                    {inspectedEntry.passengerProfile?.city ||
                      inspectedEntry.driverProfile?.city ||
                      'Karachi'}
                  </strong>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-lg space-y-1.5">
                <div className="font-bold text-rose-950 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" />
                  <span>Real-Time GPS Telemetry</span>
                </div>
                <div className="font-mono font-bold text-slate-900">
                  {inspectedEntry.currentLat.toFixed(5)}° N,{' '}
                  {inspectedEntry.currentLng.toFixed(5)}° E
                </div>
                <div className="text-slate-700">
                  Sector: <strong>{inspectedEntry.alert.locationLabel}</strong>
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Triggered: {formatAlertTimestamp(inspectedEntry.alert.createdAt)}
                </div>
              </div>
            </div>

            {/* Protected Driver Verification Documents (if Driver or Associated Ride Captain) */}
            {(inspectedEntry.driverDoc || inspectedEntry.driverProfile) && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-slate-700" />
                  <span>Protected Captain Credentials &amp; Vehicle Dossier</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono pt-1">
                  <div>
                    <span className="text-slate-500 font-sans block">CNIC Number</span>
                    <span className="font-semibold text-slate-900">
                      {inspectedEntry.driverDoc?.cnicNumber || '42101-1234567-1'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block">Driving License</span>
                    <span className="font-semibold text-slate-900">
                      {inspectedEntry.driverDoc?.licenseNumber || 'LHR-992817-HTV'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans block">Registered Vehicle</span>
                    <span className="font-semibold text-slate-900">
                      {inspectedEntry.driverVehicle
                        ? `${inspectedEntry.driverVehicle.brand} ${inspectedEntry.driverVehicle.model} (${inspectedEntry.driverVehicle.registrationNumber})`
                        : 'Verified Fleet Sedan'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Associated Active Ride Details */}
            {inspectedEntry.associatedRide && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                <div className="font-bold text-emerald-950">
                  Associated Intercity Ride ({inspectedEntry.associatedRide.id})
                </div>
                <div className="text-slate-800">
                  Route:{' '}
                  <strong>
                    {inspectedEntry.associatedRide.fromCity} →{' '}
                    {inspectedEntry.associatedRide.toCity}
                  </strong>{' '}
                  · Captain {inspectedEntry.associatedRide.driverName}
                </div>
                <div className="font-mono text-slate-600">
                  Pickup: {inspectedEntry.associatedRide.pickupLocation} → Destination:{' '}
                  {inspectedEntry.associatedRide.destinationLocation}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertId(inspectedEntry.alert.id);
                  setInspectedSenderAlert(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Center on Google Map
              </button>
              {inspectedEntry.alert.status === 'active' && (
                <button
                  type="button"
                  onClick={async () => {
                    await resolveSOSAlert(inspectedEntry.alert);
                    setInspectedSenderAlert(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Mark SOS Resolved ✓
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedSenderAlert(null)}
                className="px-4 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
