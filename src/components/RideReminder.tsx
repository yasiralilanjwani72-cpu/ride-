import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Booking, Ride } from '../types';
import { sendNotification } from '../services/firestoreService';
import { Bell, BellRing, Clock, Calendar, Navigation, CheckCircle2, AlertTriangle } from 'lucide-react';

interface RideReminderProps {
  passengerUid: string;
  passengerName: string;
  bookings: Booking[];
  rides: Ride[];
  onNavigateToSection?: (section: 'search' | 'bookings' | 'tracking' | 'notifications') => void;
}

export interface UpcomingReminderItem {
  id: string;
  isBooked: boolean;
  rideId: string;
  bookingId?: string;
  fromCity: string;
  toCity: string;
  pickupLocation: string;
  driverName: string;
  vehicleName: string;
  departureDate: string;
  departureTime: string;
  seats: number;
  status: string;
  departureTimestampMs: number;
}

function parseDepartureTimestamp(departureDate: string, departureTime: string): number {
  const cleanDate = (departureDate || '').trim();
  const cleanTime = (departureTime || '10:00 AM').trim().toUpperCase();

  const dateParts = cleanDate.split('-').map((p) => parseInt(p, 10));
  if (dateParts.length !== 3 || dateParts.some((n) => Number.isNaN(n))) {
    return Date.now() + 3600 * 1000 * 4;
  }

  const [year, month, day] = dateParts;
  let hours = 10;
  let minutes = 0;

  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const meridiem = timeMatch[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function formatCountdownParts(diffMs: number) {
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isDepartingNow: true };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isDepartingNow: false };
}

export default function RideReminder({
  passengerUid,
  bookings,
  rides,
  onNavigateToSection,
}: RideReminderProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [simulateOneHourWindow, setSimulateOneHourWindow] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification.permission;
    }
    return 'default';
  });
  const [alertBannerMessage, setAlertBannerMessage] = useState<string | null>(null);

  // Track which ride reminders have already fired the 1-hour notification in this session
  const firedOneHourRemindersRef = useRef<Set<string>>(new Set());

  // 1-second real-time countdown ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Build sorted list of upcoming rides (prioritizing passenger's booked upcoming rides, falling back to scheduled corridor rides)
  const upcomingItems = useMemo<UpcomingReminderItem[]>(() => {
    const activeBookings = bookings.filter(
      (b) =>
        b.passengerUid === passengerUid &&
        (b.status === 'confirmed' ||
          b.status === 'accepted' ||
          b.status === 'pending' ||
          b.status === 'ride_started')
    );

    if (activeBookings.length > 0) {
      return activeBookings
        .map((b) => {
          const rideObj = rides.find((r) => r.id === b.rideId);
          return {
            id: b.id,
            isBooked: true,
            rideId: b.rideId,
            bookingId: b.id,
            fromCity: b.fromCity,
            toCity: b.toCity,
            pickupLocation: rideObj?.pickupLocation || `${b.fromCity} Intercity Terminal`,
            driverName: b.driverName,
            vehicleName: rideObj?.vehicleName || 'Verified Intercity Sedan',
            departureDate: b.departureDate,
            departureTime: b.departureTime,
            seats: b.seatsBooked,
            status: b.status,
            departureTimestampMs: parseDepartureTimestamp(b.departureDate, b.departureTime),
          };
        })
        .sort((a, b) => a.departureTimestampMs - b.departureTimestampMs);
    }

    // Fallback: show upcoming scheduled corridor rides so passengers always have a live departure countdown
    return rides
      .filter((r) => r.status === 'upcoming' || r.status === 'active')
      .map((r) => ({
        id: r.id,
        isBooked: false,
        rideId: r.id,
        fromCity: r.fromCity,
        toCity: r.toCity,
        pickupLocation: r.pickupLocation,
        driverName: r.driverName,
        vehicleName: r.vehicleName,
        departureDate: r.departureDate,
        departureTime: r.departureTime,
        seats: r.availableSeats,
        status: r.status,
        departureTimestampMs: parseDepartureTimestamp(r.departureDate, r.departureTime),
      }))
      .sort((a, b) => a.departureTimestampMs - b.departureTimestampMs);
  }, [bookings, rides, passengerUid]);

  const activeItem = upcomingItems[selectedIndex] || upcomingItems[0] || null;

  // Effective remaining time in milliseconds (supports 1-Hour Pre-Departure Simulation)
  const effectiveDiffMs = useMemo(() => {
    if (!activeItem) return 0;
    if (simulateOneHourWindow) {
      // Simulate 59 minutes and 45 seconds remaining (inside the <= 1 hour notification window)
      const elapsedSinceToggle = (nowMs % 60000);
      return Math.max(0, 59 * 60 * 1000 + 59000 - elapsedSinceToggle);
    }
    return Math.max(0, activeItem.departureTimestampMs - nowMs);
  }, [activeItem, nowMs, simulateOneHourWindow]);

  const countdown = useMemo(() => formatCountdownParts(effectiveDiffMs), [effectiveDiffMs]);
  const isWithinOneHour = activeItem !== null && effectiveDiffMs > 0 && effectiveDiffMs <= 3600 * 1000;

  const requestBrowserNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setAlertBannerMessage(
        'Browser Notification API is restricted in this frame; in-app & Firestore ride reminders are active.'
      );
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        setAlertBannerMessage(
          'Browser notifications enabled! You will receive an alert 1 hour before departure.'
        );
      } else {
        setAlertBannerMessage(
          'Browser notifications permission not granted. In-app 1-hour departure alerts remain active.'
        );
      }
    } catch {
      setAlertBannerMessage(
        'In-app 1-hour departure alerts enabled for your upcoming rides.'
      );
    }
  };

  const triggerOneHourDepartureNotification = async (
    item: UpcomingReminderItem,
    manualTrigger = false
  ) => {
    const title = `Ride Departure Reminder — 1 Hour Left (${item.fromCity} → ${item.toCity})`;
    const body = `Your intercity ride with Captain ${item.driverName} (${item.vehicleName}) departs at ${item.departureTime} from ${item.pickupLocation}. Please be ready at the pickup point.`;

    // 1. Trigger Web Browser Notification API if permitted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (window.Notification.permission === 'granted') {
          new window.Notification(title, {
            body,
            tag: `ride-reminder-1h-${item.id}`,
          });
        } else if (manualTrigger && window.Notification.permission === 'default') {
          const perm = await window.Notification.requestPermission();
          setNotifPermission(perm);
          if (perm === 'granted') {
            new window.Notification(title, {
              body,
              tag: `ride-reminder-1h-${item.id}`,
            });
          }
        }
      } catch {
        // Fallback to in-app banner if iframe blocks native Notification constructor
      }
    }

    // 2. Always show immediate in-app alert banner and persist to Firestore notifications
    setAlertBannerMessage(`${title}: ${body}`);

    try {
      await sendNotification(
        passengerUid,
        title,
        body,
        'ride',
        item.rideId
      );
    } catch {
      // Non-blocking if already notified
    }
  };

  // Automatically trigger 1-hour notification when countdown enters <= 1 hour (3,600,000 ms)
  useEffect(() => {
    if (!activeItem) return;
    const reminderKey = `${activeItem.id}-${simulateOneHourWindow ? 'sim' : 'real'}`;
    if (isWithinOneHour && !firedOneHourRemindersRef.current.has(reminderKey)) {
      firedOneHourRemindersRef.current.add(reminderKey);
      triggerOneHourDepartureNotification(activeItem, false);
    }
  }, [activeItem, isWithinOneHour, simulateOneHourWindow]);

  if (!activeItem) {
    return null;
  }

  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      aria-label="Upcoming Ride Departure Reminder & Countdown"
      className={`border rounded-xl p-5 space-y-4 transition-colors ${
        isWithinOneHour
          ? 'bg-emerald-950 text-white border-emerald-700'
          : 'bg-white text-slate-900 border-slate-200'
      }`}
    >
      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-mono uppercase font-bold px-2.5 py-0.5 rounded-md ${
                isWithinOneHour
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {isWithinOneHour
                  ? 'DEPARTING WITHIN 1 HOUR — 1H ALERT TRIGGERED'
                  : activeItem.isBooked
                  ? 'UPCOMING BOOKED RIDE REMINDER'
                  : 'NEXT SCHEDULED CORRIDOR DEPARTURE'}
              </span>
            </span>

            {upcomingItems.length > 1 && (
              <div className="flex items-center gap-1">
                {upcomingItems.slice(0, 4).map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                      idx === selectedIndex
                        ? isWithinOneHour
                          ? 'bg-white text-slate-900 font-bold'
                          : 'bg-slate-900 text-white font-bold'
                        : isWithinOneHour
                        ? 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    #{idx + 1} {item.fromCity.slice(0, 3).toUpperCase()}→
                    {item.toCity.slice(0, 3).toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-2 pt-0.5">
            <span>
              {activeItem.fromCity} → {activeItem.toCity}
            </span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <span
              className={`text-xs font-normal ${
                isWithinOneHour ? 'text-emerald-200' : 'text-slate-600'
              }`}
            >
              Captain {activeItem.driverName} ({activeItem.vehicleName})
            </span>
          </h2>

          <div
            className={`flex flex-wrap items-center gap-3 text-xs font-mono ${
              isWithinOneHour ? 'text-emerald-200' : 'text-slate-500'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{activeItem.departureDate}</span>
            </span>
            <span aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{activeItem.departureTime}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Pickup: {activeItem.pickupLocation}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase font-semibold">
              {activeItem.isBooked
                ? `${activeItem.seats} Seat(s) (${activeItem.status.replace(/_/g, ' ')})`
                : `${activeItem.seats} Seats Open`}
            </span>
          </div>
        </div>

        {/* Live Digital Countdown Timer */}
        <div className="flex items-center gap-2 font-mono tabular-nums">
          {[
            { label: 'DAYS', value: pad2(countdown.days) },
            { label: 'HRS', value: pad2(countdown.hours) },
            { label: 'MIN', value: pad2(countdown.minutes) },
            { label: 'SEC', value: pad2(countdown.seconds) },
          ].map((unit) => (
            <div
              key={unit.label}
              className={`px-3 py-2 rounded-lg border text-center min-w-[60px] ${
                isWithinOneHour
                  ? 'bg-emerald-900/80 border-emerald-600 text-white'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <div className="text-lg sm:text-xl font-bold leading-none">{unit.value}</div>
              <div className="text-[10px] tracking-wider text-emerald-400 mt-1">{unit.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Browser Notification Controls & 1-Hour Alert Trigger Bar */}
      <div
        className={`pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
          isWithinOneHour ? 'border-emerald-800/80' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              isWithinOneHour ? 'text-emerald-200' : 'text-slate-600'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              1-Hour Pre-Departure Browser Alert:{' '}
              <strong className="font-mono uppercase">
                {notifPermission === 'granted'
                  ? 'Browser Notifications Enabled ✓'
                  : notifPermission === 'denied'
                  ? 'In-App & Firestore Fallback Active'
                  : 'Ready to Enable'}
              </strong>
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifPermission !== 'granted' && (
            <button
              type="button"
              onClick={requestBrowserNotificationPermission}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                isWithinOneHour
                  ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              Enable Browser Notifications
            </button>
          )}

          <button
            type="button"
            onClick={() => setSimulateOneHourWindow((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg font-mono font-semibold border transition-colors whitespace-nowrap ${
              simulateOneHourWindow
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : isWithinOneHour
                ? 'bg-emerald-900 border-emerald-700 text-emerald-100 hover:bg-emerald-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            title="Simulate 59m 59s remaining before departure to automatically trigger the 1-hour browser notification"
          >
            {simulateOneHourWindow ? 'Reset Countdown Clock' : 'Simulate <1h Departure Window'}
          </button>

          <button
            type="button"
            onClick={() => triggerOneHourDepartureNotification(activeItem, true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${
              isWithinOneHour
                ? 'bg-white text-slate-900 hover:bg-emerald-50'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Test 1h Browser Alert</span>
          </button>

          {activeItem.isBooked && onNavigateToSection && (
            <button
              type="button"
              onClick={() => onNavigateToSection('tracking')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                isWithinOneHour
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Track Ride</span>
            </button>
          )}
        </div>
      </div>

      {/* Live 1-Hour Notification Banner Feedback */}
      {alertBannerMessage && (
        <div
          role="status"
          className={`p-3 rounded-lg border flex items-start justify-between gap-3 text-xs ${
            isWithinOneHour
              ? 'bg-emerald-900/90 border-emerald-500 text-emerald-50'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-start gap-2">
            {isWithinOneHour ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{alertBannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertBannerMessage(null)}
            className="text-[11px] font-semibold underline opacity-80 hover:opacity-100 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
