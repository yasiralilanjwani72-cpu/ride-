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
  AuditLog,
} from '../types';
import {
  adminSetDriverVerification,
  adminUpdateUserStatus,
  adminDeleteReview,
  updateBookingStatus,
  sendNotification,
} from '../services/firestoreService';
import LiveRideMap from './LiveRideMap';
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
  auditLogs,
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<
    'drivers' | 'live_monitor' | 'users' | 'vehicles' | 'rides' | 'bookings' | 'reviews' | 'broadcast' | 'audit'
  >('drivers');

  const [selectedLiveRideId, setSelectedLiveRideId] = useState<string>('');
  const [broadcastRecipient, setBroadcastRecipient] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const activeLiveLocations = Object.values(liveLocations);
  const currentMonitoredLocation =
    (selectedLiveRideId && liveLocations[selectedLiveRideId]) || activeLiveLocations[0];

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
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
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
