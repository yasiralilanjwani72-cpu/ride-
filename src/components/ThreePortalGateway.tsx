import React from 'react';
import { UserRole } from '../types';
import {
  Users,
  Car,
  ShieldCheck,
  Navigation,
  Wallet,
  MessageSquare,
  Flame,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface ThreePortalGatewayProps {
  isAuthenticated: boolean;
  activePortal: 'passenger' | 'driver' | 'admin';
  isAdmin: boolean;
  userEmail?: string;
  onSelectPortal: (portal: 'passenger' | 'driver' | 'admin') => void;
  onLoginForPortal: (role: UserRole) => void;
}

export default function ThreePortalGateway({
  isAuthenticated,
  activePortal,
  isAdmin,
  userEmail,
  onSelectPortal,
  onLoginForPortal,
}: ThreePortalGatewayProps) {
  const portals = [
    {
      id: 'passenger' as const,
      number: 'PORTAL 01',
      title: 'Passenger Portal',
      subtitle: 'Intercity Ride Search, Seat Booking & Live GPS Tracking',
      icon: Users,
      accentText: 'text-emerald-700',
      borderActive: 'border-emerald-600 ring-2 ring-emerald-500/20',
      buttonStyle: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      features: [
        'Search intercity routes with interactive Google Maps departure pins',
        'Inspect verified Captain profiles, vehicle photos & community reviews',
        'Real-time Pickup & Ride Messenger and 1-hour departure countdown alert',
        'Ride Wallet balance, instant escrow checkout & temporary family share links',
      ],
      ctaUnauth: 'Passenger Portal Login',
      ctaAuth: activePortal === 'passenger' ? 'Active: Passenger Portal ✓' : 'Enter Passenger Portal →',
    },
    {
      id: 'driver' as const,
      number: 'PORTAL 02',
      title: 'Driver / Captain Portal',
      subtitle: 'Route Publishing, Seat Requests, Live GPS Broadcast & Earnings',
      icon: Car,
      accentText: 'text-slate-900',
      borderActive: 'border-slate-900 ring-2 ring-slate-900/15',
      buttonStyle: 'bg-slate-900 hover:bg-slate-800 text-white',
      features: [
        'Submit CNIC, Driving License & Vehicle Registration for Admin verification',
        'Publish intercity highway rides with custom stops, seats & per-seat fares',
        'Confirm passenger seat requests (48h SLA) & coordinate pickup via live chat',
        'Broadcast real-time highway GPS telemetry & withdraw Ride Wallet earnings',
      ],
      ctaUnauth: 'Driver Portal Login',
      ctaAuth: activePortal === 'driver' ? 'Active: Driver Portal ✓' : 'Enter Driver Portal →',
    },
    {
      id: 'admin' as const,
      number: 'PORTAL 03',
      title: 'Admin Command Portal',
      subtitle: 'Driver Verification, Route Demand Heatmap & Emergency Response',
      icon: ShieldCheck,
      accentText: 'text-rose-700',
      borderActive: 'border-rose-600 ring-2 ring-rose-500/20',
      buttonStyle: 'bg-rose-600 hover:bg-rose-700 text-white',
      features: [
        'Emergency Response (SOS) command center with live Google Maps pinpoint',
        'High-demand pickup & destination Google Maps + deck.gl HeatmapLayer',
        'Inspect protected Captain CNIC/License documents & approve verifications',
        'Centralized user moderation, live ride telemetry monitor & security audit logs',
      ],
      ctaUnauth: 'Admin Portal Login',
      ctaAuth: activePortal === 'admin' ? 'Active: Admin Portal ✓' : 'Enter Admin Portal →',
    },
  ];

  return (
    <section
      id="three-portals"
      aria-label="Three Dedicated Platform Portals"
      className="space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-emerald-700 font-semibold uppercase tracking-wider">
            THREE DEDICATED ROLE WORKSPACES · UNIFIED FIRESTORE BACKEND
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Select Your Dedicated Ride Connect Portal
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Dedicated login and workspace environments for <strong>Passengers</strong>,{' '}
            <strong>Drivers / Captains</strong>, and <strong>Platform Administrators</strong>.
          </p>
        </div>

        {isAuthenticated && userEmail && (
          <div className="text-xs font-mono text-slate-500 bg-white border border-slate-200 rounded-lg px-3.5 py-2">
            Authenticated Session: <strong className="text-slate-900">{userEmail}</strong>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {portals.map((p) => {
          const Icon = p.icon;
          const isCurrent = isAuthenticated && activePortal === p.id;
          const isRestrictedAdmin = isAuthenticated && p.id === 'admin' && !isAdmin;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border p-6 flex flex-col justify-between space-y-6 transition-all ${
                isCurrent ? p.borderActive : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-mono font-bold ${p.accentText}`}>
                    {p.number}
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-900">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 font-display">
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {p.subtitle}
                  </p>
                </div>

                <ul className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-700">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => onLoginForPortal(p.id)}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${p.buttonStyle}`}
                  >
                    <span>{p.ctaUnauth}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : isRestrictedAdmin ? (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-mono">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Restricted to Authorized Admin Account</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPortal(p.id)}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      isCurrent
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                        : p.buttonStyle
                    }`}
                  >
                    <span>{p.ctaAuth}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
