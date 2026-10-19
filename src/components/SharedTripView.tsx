import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TripShare, LiveLocation } from '../types';
import LiveRideMap from './LiveRideMap';
import {
  ShieldCheck,
  Navigation,
  Clock,
  MapPin,
  Car,
  User,
  Lock,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

interface SharedTripViewProps {
  shareId: string;
  onExitReadOnlyView: () => void;
}

export default function SharedTripView({ shareId, onExitReadOnlyView }: SharedTripViewProps) {
  const [tripShare, setTripShare] = useState<TripShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);

    const unsub = onSnapshot(
      doc(db, 'tripShares', shareId),
      (snap) => {
        if (!snap.exists()) {
          setTripShare(null);
          setErrorMsg('This shared trip link was not found or has been revoked by the passenger.');
        } else {
          const data = snap.data() as Omit<TripShare, 'id'>;
          setTripShare({ id: snap.id, ...data });
        }
        setLoading(false);
      },
      () => {
        setTripShare(null);
        setErrorMsg(
          'This temporary trip link is no longer active or has been revoked by the passenger.'
        );
        setLoading(false);
      }
    );

    return () => unsub();
  }, [shareId]);

  const isExpired = tripShare
    ? new Date(tripShare.expiresAtIso).getTime() < Date.now()
    : false;
  const isRevoked = tripShare?.status === 'revoked';

  const liveLocationForMap: LiveLocation | null = tripShare
    ? {
        rideId: tripShare.rideId,
        driverUid: 'readonly_shared_driver',
        driverName: tripShare.driverName,
        vehicleName: tripShare.vehicleName,
        lat: tripShare.lat,
        lng: tripShare.lng,
        heading: 45,
        speedKmh: tripShare.speedKmh,
        distanceRemainingKm: tripShare.distanceRemainingKm,
        etaMinutes: tripShare.etaMinutes,
        pickupLocation: tripShare.pickupLocation,
        destinationLocation: tripShare.destinationLocation,
        pickupLat: tripShare.pickupLat,
        pickupLng: tripShare.pickupLng,
        destLat: tripShare.destLat,
        destLng: tripShare.destLng,
        active: !isRevoked && !isExpired,
        rideStatus: 'in_progress',
        confirmedPassengerUids: [tripShare.passengerUid],
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Read-Only Emergency Contact Header */}
      <header className="bg-slate-900 text-white px-6 py-4 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-display tracking-tight">
                  Ride Connect — Live Shared Trip
                </span>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Read-Only Family & Emergency Link
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time encrypted GPS telemetry shared directly by the passenger
              </p>
            </div>
          </div>

          <button
            onClick={onExitReadOnlyView}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Open Ride Connect App</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
            <div className="text-sm font-bold text-slate-900">
              Connecting to Live Shared Trip Stream...
            </div>
            <p className="text-xs text-slate-500 font-mono">Share Token: {shareId}</p>
          </div>
        ) : errorMsg || !tripShare || isRevoked || isExpired ? (
          <div className="bg-white border border-rose-200 rounded-xl p-10 text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-slate-900">
                {isExpired
                  ? 'Temporary Shared Trip Link Has Expired'
                  : isRevoked
                  ? 'Shared Trip Link Was Revoked by Passenger'
                  : 'Shared Trip Link Unavailable'}
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                {errorMsg ||
                  'For passenger privacy and security, temporary trip links automatically expire after their validity window or when the passenger revokes access.'}
              </p>
            </div>
            <button
              onClick={onExitReadOnlyView}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Return to Ride Connect
            </button>
          </div>
        ) : (
          <>
            {/* Passenger & Trip Summary Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono uppercase font-semibold text-emerald-700">
                      ● LIVE TELEMETRY ACTIVE
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500">
                      Prepared for: <strong className="text-slate-800">{tripShare.contactLabel}</strong>
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {tripShare.passengerName}&apos;s Intercity Ride: {tripShare.fromCity} → {tripShare.toCity}
                  </h1>
                </div>

                <div className="text-left sm:text-right font-mono text-xs space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-slate-600">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Temporary Read-Only Link</span>
                  </div>
                  <div className="text-slate-500">
                    Expires: {new Date(tripShare.expiresAtIso).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 4-Column Ride & Captain Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Passenger & Captain</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{tripShare.passengerName}</div>
                  <div className="text-slate-600">
                    Captain: <span className="font-semibold text-slate-800">{tripShare.driverName} ✓</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    <span>Verified Vehicle</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{tripShare.vehicleName}</div>
                  <div className="text-emerald-700 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Admin Inspected & Verified</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pickup & Destination</span>
                  </div>
                  <div className="font-semibold text-slate-900 truncate" title={tripShare.pickupLocation}>
                    From: {tripShare.pickupLocation}
                  </div>
                  <div className="text-slate-600 truncate" title={tripShare.destinationLocation}>
                    To: {tripShare.destinationLocation}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1 font-mono tabular-nums">
                  <div className="text-slate-500 font-sans flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Schedule & Live GPS</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    {tripShare.departureDate} | {tripShare.departureTime}
                  </div>
                  <div className="text-emerald-700 font-semibold">
                    {tripShare.lat.toFixed(4)}° N, {tripShare.lng.toFixed(4)}° E
                  </div>
                </div>
              </div>
            </div>

            {/* Live Google Map Telemetry View */}
            {liveLocationForMap && <LiveRideMap liveLocation={liveLocationForMap} />}
          </>
        )}
      </main>
    </div>
  );
}
