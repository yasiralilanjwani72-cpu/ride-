import React, { useMemo, useState } from 'react';
import {
  Ride,
  Booking,
  LiveLocation,
  ChatMessage,
  RecentSearch,
  DriverProfile,
} from '../types';
import {
  Search,
  CheckCircle2,
  Clock,
  Navigation,
  MessageSquare,
  Bell,
  Star,
  Flame,
  ArrowRight,
  ShieldCheck,
  Car,
  Users,
} from 'lucide-react';

interface PlatformWorkflowOverviewProps {
  isAuthenticated: boolean;
  activePortal: 'passenger' | 'driver' | 'admin';
  isAdmin: boolean;
  rides: Ride[];
  bookings: Booking[];
  liveLocations: Record<string, LiveLocation>;
  messages: ChatMessage[];
  recentSearches: RecentSearch[];
  driverProfiles: DriverProfile[];
  onSwitchPortal: (portal: 'passenger' | 'driver' | 'admin') => void;
  onLoginRole?: (role: 'passenger' | 'driver' | 'admin') => void;
  onClose?: () => void;
}

export default function PlatformWorkflowOverview({
  isAuthenticated,
  activePortal,
  isAdmin,
  rides,
  bookings,
  liveLocations,
  messages,
  recentSearches,
  driverProfiles,
  onSwitchPortal,
  onLoginRole,
  onClose,
}: PlatformWorkflowOverviewProps) {
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'passenger' | 'driver' | 'admin'>('all');

  const stats = useMemo(() => {
    const activeRides = rides.filter((r) => r.status === 'upcoming' || r.status === 'active').length;
    const pendingBookings = bookings.filter((b) => b.status === 'pending').length;
    const confirmedBookings = bookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'ride_started'
    ).length;
    const completedBookings = bookings.filter((b) => b.status === 'completed').length;
    const activeGpsStreams = Object.values(liveLocations).filter((l) => l.active).length;
    const verifiedDrivers = driverProfiles.filter((d) => d.verificationStatus === 'verified').length;

    return {
      activeRides,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      activeGpsStreams,
      verifiedDrivers,
      savedSearches: recentSearches.length,
      chatCount: messages.length,
    };
  }, [rides, bookings, liveLocations, recentSearches, messages, driverProfiles]);

  const workflowStages = useMemo(
    () => [
      {
        stageNumber: '01',
        role: 'driver' as const,
        roleLabel: 'Captain & Admin',
        title: 'Captain Verification & Route Publishing',
        description:
          'Captains register their vehicle and submit CNIC & commercial license credentials. Once verified by Admin, Captains publish intercity corridors with seat capacity and pickup coordinates.',
        metricText: `${stats.verifiedDrivers || 1} Verified Captain(s) · ${stats.activeRides || 2} Active Corridor Ride(s)`,
        actionLabel: isAuthenticated ? 'Open Driver Portal' : 'Register as Captain',
        targetPortal: 'driver' as const,
        icon: ShieldCheck,
      },
      {
        stageNumber: '02',
        role: 'passenger' as const,
        roleLabel: 'Passenger',
        title: 'Interactive Departure Map, Route Preview & Recent Searches',
        description:
          'Passengers explore departure markers on Google Maps, inspect the planned highway polyline in Ride Details, and re-apply persisted Recent Searches in 1 click.',
        metricText: `${stats.activeRides || 2} Departure Pin(s) · ${stats.savedSearches} Saved Search Query(s)`,
        actionLabel: isAuthenticated ? 'Search & Book Rides' : 'Continue as Passenger',
        targetPortal: 'passenger' as const,
        icon: Search,
      },
      {
        stageNumber: '03',
        role: 'driver' as const,
        roleLabel: 'Passenger & Captain',
        title: 'Seat Booking & 48-Hour Pending SLA Watchdog',
        description:
          'Seat requests reserve inventory immediately. A background SLA monitor warns both Passengers and Captains if a request stays pending over 48 hours, with 1-click auto-cancel and seat recovery.',
        metricText: `${stats.pendingBookings} Pending Request(s) · ${stats.confirmedBookings} Confirmed Booking(s)`,
        actionLabel: isAuthenticated ? 'Review Booking SLA' : 'Sign In to Book',
        targetPortal: activePortal === 'driver' ? ('driver' as const) : ('passenger' as const),
        icon: Clock,
      },
      {
        stageNumber: '04',
        role: 'passenger' as const,
        roleLabel: 'Passenger & Captain',
        title: 'Real-Time Pickup Messenger & 1-Hour Departure Reminder',
        description:
          'Passengers and Captains coordinate exact pickup terminals and luggage via live Firestore messaging while the Passenger Dashboard runs a live countdown timer with a 1-hour browser notification.',
        metricText: `${stats.chatCount} Live Message(s) · 1h Pre-Departure Browser Alert Active`,
        actionLabel: isAuthenticated ? 'Open Pickup Messenger' : 'Sign In to Message',
        targetPortal: activePortal === 'driver' ? ('driver' as const) : ('passenger' as const),
        icon: MessageSquare,
      },
      {
        stageNumber: '05',
        role: 'passenger' as const,
        roleLabel: 'Passenger & Captain',
        title: 'Encrypted Live GPS Telemetry & Family Trip Share',
        description:
          'When the Captain starts the ride, real-time GPS coordinates, speed, and ETA stream exclusively to confirmed passengers, who can generate temporary read-only links for family contacts.',
        metricText: `${stats.activeGpsStreams} Active GPS Stream(s) · Read-Only Family Share Ready`,
        actionLabel: isAuthenticated ? 'Open Live GPS Telemetry' : 'Preview GPS Workflow',
        targetPortal: activePortal === 'driver' ? ('driver' as const) : ('passenger' as const),
        icon: Navigation,
      },
      {
        stageNumber: '06',
        role: 'admin' as const,
        roleLabel: 'Admin & Community',
        title: 'Demand Heatmap Analytics & Verified Community Ratings',
        description:
          'Upon arrival, GPS sharing terminates automatically and both parties exchange 1–5 star reviews. Central Admin monitors high-demand pickup and destination hotspots via the deck.gl HeatmapLayer.',
        metricText: `${stats.completedBookings} Completed Trip(s) · Live Corridor Demand Heatmap`,
        actionLabel: isAuthenticated
          ? isAdmin
            ? 'Open Admin Demand Heatmap'
            : 'Open Ride Ratings'
          : 'Admin Command Portal',
        targetPortal: isAdmin ? ('admin' as const) : ('passenger' as const),
        icon: Flame,
      },
    ],
    [stats, isAuthenticated, activePortal, isAdmin]
  );

  const visibleStages = useMemo(() => {
    if (selectedRoleFilter === 'all') return workflowStages;
    return workflowStages.filter((s) => s.role === selectedRoleFilter);
  }, [workflowStages, selectedRoleFilter]);

  return (
    <section
      id="workflow"
      aria-label="Upgraded End-to-End Platform Workflow"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Top Header & Role Filter Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-mono text-emerald-700 font-semibold uppercase tracking-wide">
            Upgraded 6-Stage Intercity Ride Lifecycle · Real-Time Firestore &amp; Google Maps Pipeline
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
            End-to-End Ride Connect Operational Workflow
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Every stage connects Passenger, Captain, and Admin portals through live Firestore synchronization, Google Maps route &amp; departure visualizations, 48-hour SLA seat recovery, 1-hour departure alerts, and `deck.gl` demand heatmaps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All 6 Stages' },
                { id: 'passenger', label: 'Passenger Flow' },
                { id: 'driver', label: 'Captain Flow' },
                { id: 'admin', label: 'Admin & Heatmap' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRoleFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  selectedRoleFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Hide Workflow
            </button>
          )}
        </div>
      </div>

      {/* 6-Stage Interactive Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleStages.map((stage) => {
          const IconComponent = stage.icon;
          return (
            <div
              key={stage.stageNumber}
              className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="font-bold text-emerald-700">STAGE {stage.stageNumber}</span>
                  <span className="text-slate-500">{stage.roleLabel}</span>
                </div>

                <div className="flex items-start gap-2.5">
                  <IconComponent className="w-4 h-4 text-slate-800 shrink-0 mt-1" />
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{stage.title}</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{stage.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
                <div className="text-[11px] font-mono text-slate-700 font-medium">
                  {stage.metricText}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isAuthenticated) {
                      onSwitchPortal(stage.targetPortal);
                      if (onClose) onClose();
                    } else if (onLoginRole) {
                      onLoginRole(stage.targetPortal);
                    }
                  }}
                  className="w-full inline-flex items-center justify-between px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <span>{stage.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
