import React, { useState } from 'react';
import {
  UserAccount,
  PassengerProfile,
  DriverProfile,
  DriverDocument,
  Vehicle,
  Ride,
  Booking,
  LiveLocation,
  Review,
  SOSAlert,
  RecentSearch,
  FavoriteItem,
  WalletTransaction,
  AuditLog,
} from '../types';
import {
  adminSetDriverVerification,
  adminUpdateUserStatus,
  adminDeleteReview,
  updateBookingStatus,
  sendNotification,
  acknowledgeSOSAlert,
  resolveSOSAlert,
  triggerSOSAlert,
} from '../services/firestoreService';
import LiveRideMap from './LiveRideMap';
import AdminDemandHeatmap from './AdminDemandHeatmap';
import AdminEmergencyResponse from './AdminEmergencyResponse';
import AdminAnalyticsOverview from './AdminAnalyticsOverview';
import {
  ShieldAlert,
  Users,
  UserCheck,
  Car,
  Navigation,
  BookOpen,
  Star,
  Bell,
  FileText,
  CheckCircle2,
  XCircle,
  MapPin,
  Flame,
  BarChart3,
} from 'lucide-react';
import defaultDriverAvatar from '../assets/images/avatar_driver_pro_1791134254517.jpg';

interface AdminPortalProps {
  users: UserAccount[];
  passengerProfiles: PassengerProfile[];
  driverProfiles: DriverProfile[];
  driverDocuments: Record<string, DriverDocument>;
  vehicles: Vehicle[];
  rides: Ride[];
  bookings: Booking[];
  liveLocations: Record<string, LiveLocation>;
  reviews: Review[];
  sosAlerts: SOSAlert[];
  recentSearches?: RecentSearch[];
  favorites?: FavoriteItem[];
  walletTransactions?: WalletTransaction[];
  auditLogs: AuditLog[];
}

export default function AdminPortal({
  users,
  passengerProfiles,
  driverProfiles,
  driverDocuments,
  vehicles,
  rides,
  bookings,
  liveLocations,
  reviews,
  sosAlerts,
  recentSearches = [],
  favorites = [],
  walletTransactions = [],
  auditLogs,
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'demand_heatmap' | 'drivers' | 'sos_center' | 'live_monitor' | 'users' | 'vehicles' | 'rides' | 'bookings' | 'reviews' | 'broadcast' | 'audit'
  >('overview');

  const [selectedLiveRideId, setSelectedLiveRideId] = useState<string>('');
  const [broadcastRecipient, setBroadcastRecipient] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const activeLiveLocations = Object.values(liveLocations);
  const currentMonitoredLocation =
    (selectedLiveRideId && liveLocations[selectedLiveRideId]) || activeLiveLocations[0];
  const openSosAlerts = sosAlerts.filter(
    (a) => a.status === 'active' || a.status === 'acknowledged'
  );
  const activeSosAlerts = sosAlerts.filter((a) => a.status === 'active');
  const [selectedSosAlert, setSelectedSosAlert] = useState<SOSAlert | null>(null);
  const [sosActionNotice, setSosActionNotice] = useState<string | null>(null);
  const [simulatingQuickSos, setSimulatingQuickSos] = useState(false);

  const focusedQuickSos =
    (selectedSosAlert &&
      sosAlerts.find((a) => a.id === selectedSosAlert.id)) ||
    openSosAlerts[0] ||
    sosAlerts[0] ||
    null;

  const handleQuickAcknowledgeSos = async (alert: SOSAlert) => {
    setSosActionNotice(null);
    await acknowledgeSOSAlert(alert);
    setSosActionNotice(
      `Acknowledged SOS alert from ${alert.senderName} (${alert.locationLabel}) and dispatched confirmation to sender.`
    );
  };

  const handleQuickResolveSos = async (alert: SOSAlert) => {
    setSosActionNotice(null);
    await resolveSOSAlert(alert);
    setSosActionNotice(
      `Resolved SOS incident for ${alert.senderName} (${alert.locationLabel}).`
    );
  };

  const handleQuickSimulateSos = async () => {
    setSimulatingQuickSos(true);
    setSosActionNotice(null);
    try {
      const sampleRide = rides[0];
      const samplePass = passengerProfiles[0];
      const lat = sampleRide ? sampleRide.pickupLat + 0.042 : 24.9265;
      const lng = sampleRide ? sampleRide.pickupLng + 0.038 : 67.1312;

      const createdId = await triggerSOSAlert({
        senderUid: samplePass?.uid || sampleRide?.driverUid || 'usr_sos_live',
        senderName: samplePass?.fullName || sampleRide?.driverName || 'Zainab Tariq',
        senderEmail: samplePass?.email || 'passenger@rideconnect.app',
        senderPhone: samplePass?.phone || '+92 300 8129345',
        senderRole: samplePass ? 'passenger' : 'driver',
        lat,
        lng,
        locationLabel: sampleRide
          ? `M-9 Highway Sector (${sampleRide.fromCity} → ${sampleRide.toCity})`
          : 'M-9 Toll Plaza Corridor, Karachi',
        rideId: sampleRide?.id || 'N/A',
        message: 'Urgent SOS triggered — requesting immediate Admin verification and highway patrol lock.',
      });
      const found = sosAlerts.find((a) => a.id === createdId);
      if (found) setSelectedSosAlert(found);
      setSosActionNotice('Simulated real-time SOS signal with live GPS map pin coordinates.');
    } finally {
      setSimulatingQuickSos(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastStatus(null);
    try {
      const targets =
        broadcastRecipient === 'ALL'
          ? users.map((u) => u.uid)
          : [broadcastRecipient];
      for (const uid of targets) {
        if (uid) {
          await sendNotification(uid, broadcastTitle, broadcastMessage, 'system', 'admin_broadcast');
        }
      }
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastStatus(`Dispatched platform notification to ${targets.length} user(s).`);
    } catch (err) {
      setBroadcastStatus(err instanceof Error ? err.message : 'Failed to send notification');
    }
  };

  return (
    <div className="space-y-6">
      {/* Dedicated Real-Time SOS Alerts & Map Pin Administrative Response Section */}
      <section
        aria-label="Real-Time SOS Alerts Command Section"
        className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/70 rounded-xl overflow-hidden shadow-xs"
      >
        <div className="px-5 py-4 bg-rose-50/80 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Real-Time SOS Emergency Alerts &amp; Map Pin Response
                </h2>
                <span className="text-[11px] font-mono font-bold uppercase text-rose-700 dark:text-rose-400">
                  · {activeSosAlerts.length} Unacknowledged · {openSosAlerts.length} Open
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Inspect live SOS GPS pin locations and click Acknowledge for immediate administrative response.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickSimulateSos}
              disabled={simulatingQuickSos}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100/60 rounded-lg transition-colors whitespace-nowrap"
            >
              {simulatingQuickSos ? 'Dispatching Test SOS...' : '+ Simulate SOS Alert'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sos_center')}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
            >
              Full Emergency Command →
            </button>
          </div>
        </div>

        {sosActionNotice && (
          <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
            <span>{sosActionNotice}</span>
            <button
              type="button"
              onClick={() => setSosActionNotice(null)}
              className="text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {sosAlerts.length === 0 ? (
          <div className="p-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                No emergency SOS signals active across intercity corridors. Use <strong>+ Simulate SOS Alert</strong> to test real-time map pin tracking and acknowledgement.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Left 7 Cols: Real-Time SOS Alert Cards with Acknowledge Button */}
            <div className="lg:col-span-7 p-4 space-y-3 max-h-[320px] overflow-y-auto">
              {sosAlerts.slice(0, 6).map((alert) => {
                const isSelected = focusedQuickSos?.id === alert.id;
                const isActive = alert.status === 'active';
                const isAcknowledged = alert.status === 'acknowledged';

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedSosAlert(alert)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-mono font-bold uppercase ${
                            isActive
                              ? 'text-rose-600 dark:text-rose-400'
                              : isAcknowledged
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isActive
                            ? '● ACTIVE SOS'
                            : isAcknowledged
                            ? '◉ ACKNOWLEDGED'
                            : '✓ RESOLVED'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {alert.senderName}
                        </span>
                        <span className="font-mono text-slate-500 uppercase">
                          ({alert.senderRole})
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {alert.senderPhone}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {alert.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-semibold">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {alert.lat.toFixed(4)}° N, {alert.lng.toFixed(4)}° E
                          </span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans truncate">{alert.locationLabel}</span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => handleQuickAcknowledgeSos(alert)}
                          className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          Acknowledge
                        </button>
                      )}
                      {isAcknowledged && (
                        <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 px-2 py-1">
                          Acknowledged ✓
                        </span>
                      )}
                      {(isActive || isAcknowledged) && (
                        <button
                          type="button"
                          onClick={() => handleQuickResolveSos(alert)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right 5 Cols: Interactive Map Pin Location Visualizer for Selected SOS Alert */}
            <div className="lg:col-span-5 p-4 bg-slate-950 text-white flex flex-col justify-between space-y-3">
              {focusedQuickSos ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-rose-400 font-semibold">
                        LIVE SOS MAP PIN LOCATION
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        {focusedQuickSos.locationLabel}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-emerald-400">
                      {focusedQuickSos.lat.toFixed(4)}° N, {focusedQuickSos.lng.toFixed(4)}° E
                    </span>
                  </div>

                  {/* Tactical Map Pin Canvas */}
                  <div className="relative h-36 w-full rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle at center, #f43f5e 1px, transparent 1px), linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                      }}
                    />
                    <div className="relative z-10 flex flex-col items-center text-center space-y-1">
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-12 h-12 rounded-full bg-rose-500/30 animate-ping" />
                        <div className="w-9 h-9 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="px-2.5 py-1 rounded bg-slate-950/90 border border-slate-700 text-[11px] font-mono">
                        {focusedQuickSos.senderName} · {focusedQuickSos.senderRole.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] font-mono text-slate-400">
                      Status:{' '}
                      <strong className="uppercase text-white">{focusedQuickSos.status}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      {focusedQuickSos.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAcknowledgeSos(focusedQuickSos)}
                          className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                        >
                          Acknowledge Signal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSosAlert(focusedQuickSos);
                          setActiveTab('sos_center');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                      >
                        Open Full Map →
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* Top Executive KPI Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono tabular-nums">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-sans">Registered Users</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{users.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-sans">Verified Captains</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {driverProfiles.filter((d) => d.verificationStatus === 'verified').length} / {driverProfiles.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-sans">Registered Vehicles</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{vehicles.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-sans">Published Rides</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{rides.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-sans">Total Seat Bookings</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{bookings.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500 font-sans">Live GPS Feeds</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {activeLiveLocations.filter((l) => l.active).length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Admin Navigation */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="px-3 py-2 text-xs font-bold text-slate-900 border-b border-slate-200 mb-2">
            Centralized System Administration
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              <span>Dashboard Overview</span>
            </span>
            <span className="font-mono">30d</span>
          </button>

          <button
            onClick={() => setActiveTab('demand_heatmap')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'demand_heatmap'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-rose-500" />
              <span>Route Demand Heatmap</span>
            </span>
            <span className="font-mono">{rides.length + bookings.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('sos_center')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'sos_center'
                ? 'bg-rose-600 text-white'
                : activeSosAlerts.length > 0
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Emergency Response (SOS)</span>
            </span>
            <span className="font-mono font-bold">{activeSosAlerts.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('drivers')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'drivers'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <UserCheck className="w-4 h-4" />
              <span>Verify Drivers & Docs</span>
            </span>
            <span className="font-mono">{driverProfiles.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('live_monitor')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'live_monitor'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Navigation className="w-4 h-4" />
              <span>Live Ride Monitoring Map</span>
            </span>
            <span className="font-mono">{activeLiveLocations.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'users'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>Users & Passengers</span>
            </span>
            <span className="font-mono">{users.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('vehicles')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'vehicles'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Car className="w-4 h-4" />
              <span>Manage Vehicles</span>
            </span>
            <span className="font-mono">{vehicles.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('rides')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'rides'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4" />
              <span>All Intercity Rides</span>
            </span>
            <span className="font-mono">{rides.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'bookings'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Bookings & Disputes</span>
            </span>
            <span className="font-mono">{bookings.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'reviews'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Star className="w-4 h-4" />
              <span>Moderate Reviews</span>
            </span>
            <span className="font-mono">{reviews.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'broadcast'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Bell className="w-4 h-4" />
              <span>Dispatch Notifications</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'audit'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <span>Security Audit Logs</span>
            </span>
            <span className="font-mono">{auditLogs.length}</span>
          </button>
        </aside>

        {/* Right Admin Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {activeTab === 'overview' && (
            <AdminAnalyticsOverview
              users={users}
              passengerProfiles={passengerProfiles}
              driverProfiles={driverProfiles}
              vehicles={vehicles}
              rides={rides}
              bookings={bookings}
              liveLocations={liveLocations}
              reviews={reviews}
              sosAlerts={sosAlerts}
              walletTransactions={walletTransactions}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {(activeTab === 'demand_heatmap' || activeTab === 'rides') && (
            <AdminDemandHeatmap
              rides={rides}
              bookings={bookings}
              recentSearches={recentSearches}
              favorites={favorites}
            />
          )}

          {activeTab === 'sos_center' && (
            <AdminEmergencyResponse
              sosAlerts={sosAlerts}
              passengerProfiles={passengerProfiles}
              driverProfiles={driverProfiles}
              driverDocuments={driverDocuments}
              vehicles={vehicles}
              rides={rides}
              bookings={bookings}
              liveLocations={liveLocations}
            />
          )}

          {activeTab === 'drivers' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Driver Verification & Protected Document Inspection
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify CNIC, Driving License, and Vehicle Registration before granting public ride publishing privileges.
                </p>
              </div>

              {driverProfiles.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">No driver profiles registered yet.</p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {driverProfiles.map((drv) => {
                    const docInfo = driverDocuments[drv.uid];
                    return (
                      <div key={drv.uid} className="py-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={drv.photoUrl || defaultDriverAvatar}
                              alt={drv.fullName}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-full object-cover border border-slate-300"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900">{drv.fullName}</h3>
                                <span aria-hidden="true" className="text-slate-300">·</span>
                                <span className="text-xs font-mono uppercase font-semibold text-emerald-700">
                                  Status: {drv.verificationStatus}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                {drv.city} · {drv.drivingExperienceYears} Yrs Exp · ⭐ {drv.rating.toFixed(1)} ({drv.completedRides} Rides)
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() =>
                                adminSetDriverVerification(
                                  drv,
                                  'verified',
                                  'Verified by Central Admin after CNIC and License inspection.'
                                )
                              }
                              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              Verify Driver ✓
                            </button>
                            <button
                              onClick={() =>
                                adminSetDriverVerification(
                                  drv,
                                  'rejected',
                                  'Verification documents require clearer scan.'
                                )
                              }
                              className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() =>
                                adminSetDriverVerification(
                                  drv,
                                  'suspended',
                                  'Account suspended by Central Admin.'
                                )
                              }
                              className="px-3 py-1.5 text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                              Suspend
                            </button>
                          </div>
                        </div>

                        {docInfo && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 text-xs font-mono">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <span className="text-slate-500 font-sans block">Protected CNIC Number</span>
                                <span className="font-semibold text-slate-900">{docInfo.cnicNumber}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-sans block">Driving License & Expiry</span>
                                <span className="font-semibold text-slate-900">
                                  {docInfo.licenseNumber} (Exp: {docInfo.licenseExpiry})
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-sans block">Private Contact</span>
                                <span className="font-semibold text-slate-900">
                                  {docInfo.phone} · {docInfo.email}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                              {[
                                { label: 'CNIC Scan', url: docInfo.cnicDocUrl },
                                { label: 'Driving License Scan', url: docInfo.licenseDocUrl },
                                { label: 'Vehicle Reg Scan', url: docInfo.vehicleRegDocUrl },
                              ].map((d) => {
                                const isImg =
                                  d.url &&
                                  (d.url.startsWith('data:image/') ||
                                    /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(d.url) ||
                                    d.url.includes('images.unsplash.com'));
                                return (
                                  <div
                                    key={d.label}
                                    className="bg-white border border-slate-200 rounded-md p-2 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-sans">
                                      <span className="font-semibold text-slate-700">{d.label}</span>
                                      <span className="font-mono text-emerald-700">
                                        {d.url ? 'Attached' : 'None'}
                                      </span>
                                    </div>
                                    {isImg ? (
                                      <img
                                        src={d.url}
                                        alt={d.label}
                                        referrerPolicy="no-referrer"
                                        className="h-16 w-full object-cover rounded bg-slate-950"
                                      />
                                    ) : (
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {d.url || 'No document linked'}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'live_monitor' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Admin Live Ride Monitoring Command Center
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select any active corridor ride to inspect live GPS telemetry, driver speed, route, and passenger manifest count.
                    </p>
                  </div>

                  {activeLiveLocations.length > 0 && (
                    <select
                      value={selectedLiveRideId}
                      onChange={(e) => setSelectedLiveRideId(e.target.value)}
                      className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                    >
                      {activeLiveLocations.map((loc) => (
                        <option key={loc.rideId} value={loc.rideId}>
                          {loc.driverName} — {loc.pickupLocation} → {loc.destinationLocation} (
                          {loc.active ? 'LIVE' : 'COMPLETED'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {currentMonitoredLocation ? (
                  <LiveRideMap liveLocation={currentMonitoredLocation} />
                ) : (
                  <div className="py-10 text-center text-xs text-slate-500">
                    No active driver GPS streams currently broadcasting. Start a ride in the Driver Portal to see live telemetry here.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">All Registered Accounts & Passenger Profiles</h2>
              <div className="divide-y divide-slate-200">
                {users.map((u) => {
                  const pass = passengerProfiles.find((p) => p.uid === u.uid);
                  return (
                    <div key={u.uid} className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {pass?.fullName || u.email}{' '}
                          <span className="font-mono font-normal text-slate-500">({u.email})</span>
                        </div>
                        <div className="text-slate-500 font-mono mt-0.5">
                          Role: <span className="uppercase font-semibold text-slate-800">{u.role}</span> · Status:{' '}
                          <span className="uppercase font-semibold text-emerald-700">{u.status}</span> · City:{' '}
                          {pass?.city || 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.status === 'active' ? (
                          <button
                            onClick={() => adminUpdateUserStatus(u, 'suspended')}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 font-medium rounded-lg hover:bg-rose-100"
                          >
                            Suspend Account
                          </button>
                        ) : (
                          <button
                            onClick={() => adminUpdateUserStatus(u, 'active')}
                            className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700"
                          >
                            Activate Account
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Registered Fleet Vehicles</h2>
              <div className="divide-y divide-slate-200">
                {vehicles.map((v) => (
                  <div key={v.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {v.brand} {v.model} ({v.modelYear}) — {v.vehicleType}
                      </div>
                      <div className="text-slate-500 font-mono mt-0.5">
                        Plate: {v.registrationNumber} · Color: {v.color} · Capacity: {v.seats} Seats
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-emerald-700">
                      {v.verified ? 'Verified Vehicle ✓' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'rides' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">All Platform Intercity Rides</h2>
              <div className="divide-y divide-slate-200">
                {rides.map((r) => (
                  <div key={r.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {r.fromCity} → {r.toCity} (Captain {r.driverName})
                      </div>
                      <div className="text-slate-500 font-mono mt-0.5">
                        {r.departureDate} | {r.departureTime} · {r.availableSeats}/{r.totalSeats} Seats · Rs.{' '}
                        {r.farePerSeat.toLocaleString()}/seat
                      </div>
                    </div>
                    <span className="uppercase font-mono font-semibold text-slate-800">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Centralized Booking Control & Issue Resolution</h2>
              <div className="divide-y divide-slate-200">
                {bookings.map((b) => {
                  const r = rides.find((x) => x.id === b.rideId);
                  return (
                    <div key={b.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {b.passengerName} → Captain {b.driverName} ({b.fromCity} → {b.toCity})
                        </div>
                        <div className="text-slate-500 font-mono mt-0.5">
                          {b.seatsBooked} Seat(s) · Rs. {b.totalFare.toLocaleString()} · Status:{' '}
                          <span className="uppercase font-semibold">{b.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.status !== 'completed' && b.status !== 'cancelled_by_driver' && (
                          <button
                            onClick={() => updateBookingStatus(b, r, 'confirmed')}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-semibold"
                          >
                            Force Confirm
                          </button>
                        )}
                        {b.status !== 'completed' && b.status !== 'cancelled_by_passenger' && (
                          <button
                            onClick={() => updateBookingStatus(b, r, 'cancelled_by_driver')}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md font-medium"
                          >
                            Admin Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Review Moderation</h2>
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500">No reviews to moderate.</p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="py-3.5 flex items-start justify-between gap-4 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {rev.reviewerName} rated {rev.targetName} — {rev.rating} ★
                        </div>
                        <p className="text-slate-600 mt-0.5">{rev.comment}</p>
                      </div>
                      <button
                        onClick={() => adminDeleteReview(rev.id)}
                        className="px-3 py-1 bg-rose-50 text-rose-700 rounded-md font-medium shrink-0"
                      >
                        Remove Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'broadcast' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Send Platform Notification</h2>
              <form onSubmit={handleSendBroadcast} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient</label>
                  <select
                    value={broadcastRecipient}
                    onChange={(e) => setBroadcastRecipient(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    required
                  >
                    <option value="">-- Select Recipient --</option>
                    <option value="ALL">All Registered Platform Users ({users.length})</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notification Title</label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. M-9 Motorway Weather Advisory"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
                  <textarea
                    rows={3}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter official platform announcement..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                >
                  Dispatch Notification
                </button>
                {broadcastStatus && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                    {broadcastStatus}
                  </div>
                )}
              </form>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">System Security & Administrative Audit Logs</h2>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No audit events recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-200 font-mono text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">{log.action}</span>
                        <span className="text-slate-500"> · {log.actorEmail} · </span>
                        <span className="text-slate-700 font-sans">{log.details}</span>
                      </div>
                      <span className="text-slate-400">{log.targetType}/{log.targetId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
