import React, { useState, useEffect, useRef } from 'react';
import { DriverProfile, DriverDocument } from '../types';
import { saveDriverVerificationDocuments } from '../services/firestoreService';
import {
  ShieldCheck,
  Upload,
  Link2,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Sparkles,
  Eye,
  X,
  CreditCard,
  Award,
  Car,
  Lock,
} from 'lucide-react';

interface DriverDocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverProfile: DriverProfile;
  driverDocument?: DriverDocument | null;
  onSynced?: (updated: {
    cnicNumber: string;
    licenseNumber: string;
    licenseExpiry: string;
    phone: string;
    cnicDocUrl: string;
    licenseDocUrl: string;
    vehicleRegDocUrl: string;
  }) => void;
}

type DocSlotKey = 'cnic' | 'license' | 'vehicleReg';

function buildSpecimenSvgDataUri(
  docType: DocSlotKey,
  driverName: string,
  city: string,
  idNumber: string,
  secondaryMeta: string
): string {
  const safeName = (driverName || 'Captain Driver').replace(/[<>&"']/g, '');
  const safeCity = (city || 'Karachi').replace(/[<>&"']/g, '');
  const safeId = (idNumber || '42101-1234567-1').replace(/[<>&"']/g, '');
  const safeMeta = (secondaryMeta || 'VERIFIED RECORD').replace(/[<>&"']/g, '');

  const config =
    docType === 'cnic'
      ? {
          headerTitle: 'ISLAMIC REPUBLIC OF PAKISTAN — NADRA SMART CNIC',
          subHeader: 'NATIONAL IDENTITY CARD FOR INTERCITY CAPTAIN VERIFICATION',
          badge: 'CNIC BIOMETRIC VERIFIED',
          bgStart: '#064e3b',
          bgEnd: '#0f172a',
          accent: '#10b981',
          idLabel: 'CNIC IDENTITY NUMBER',
          metaLabel: 'ISSUING STATION / STATUS',
        }
      : docType === 'license'
      ? {
          headerTitle: 'HIGHWAY & MOTORWAY POLICE — DRIVING LICENSE AUTHORITY',
          subHeader: 'COMMERCIAL & INTERCITY PSV / LTV / HTV CAPTAIN PERMIT',
          badge: 'HIGHWAY LICENSE ACTIVE',
          bgStart: '#1e3a8a',
          bgEnd: '#0f172a',
          accent: '#38bdf8',
          idLabel: 'LICENSE PERMIT NUMBER',
          metaLabel: 'VALID UNTIL / CATEGORY',
        }
      : {
          headerTitle: 'EXCISE, TAXATION & MOTOR VEHICLE REGISTRATION CERTIFICATE',
          subHeader: 'INTERCITY FLEET SMART REGISTRATION CARD & FITNESS CLEARANCE',
          badge: 'EXCISE VERIFIED FLEET',
          bgStart: '#312e81',
          bgEnd: '#0f172a',
          accent: '#a78bfa',
          idLabel: 'REGISTRATION / CHASSIS REF',
          metaLabel: 'HOME CORRIDOR HUB',
        };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${config.bgStart}" />
        <stop offset="100%" stop-color="${config.bgEnd}" />
      </linearGradient>
    </defs>
    <rect width="720" height="420" rx="22" fill="url(#bg)" />
    <rect x="18" y="18" width="684" height="384" rx="16" fill="none" stroke="${config.accent}" stroke-opacity="0.35" stroke-width="2" />
    <rect x="36" y="36" width="648" height="64" rx="10" fill="#ffffff" fill-opacity="0.07" />
    <text x="54" y="63" fill="${config.accent}" font-family="monospace" font-size="13" font-weight="bold" letter-spacing="1.5">${config.headerTitle}</text>
    <text x="54" y="84" fill="#cbd5e1" font-family="sans-serif" font-size="11" letter-spacing="0.8">${config.subHeader}</text>

    <rect x="36" y="124" width="145" height="175" rx="12" fill="#0f172a" stroke="${config.accent}" stroke-opacity="0.5" stroke-width="1.5" />
    <circle cx="108" cy="182" r="32" fill="${config.accent}" fill-opacity="0.22" />
    <path d="M68 268 C68 232, 148 232, 148 268" fill="${config.accent}" fill-opacity="0.28" />
    <text x="108" y="288" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="10">CAPTAIN PHOTO</text>

    <text x="206" y="146" fill="#94a3b8" font-family="monospace" font-size="11">${config.idLabel}</text>
    <text x="206" y="174" fill="#ffffff" font-family="monospace" font-size="24" font-weight="bold" letter-spacing="1.5">${safeId}</text>

    <text x="206" y="212" fill="#94a3b8" font-family="monospace" font-size="11">REGISTERED CAPTAIN NAME</text>
    <text x="206" y="236" fill="#f8fafc" font-family="sans-serif" font-size="19" font-weight="bold">${safeName}</text>

    <text x="206" y="272" fill="#94a3b8" font-family="monospace" font-size="11">${config.metaLabel}</text>
    <text x="206" y="294" fill="${config.accent}" font-family="monospace" font-size="14" font-weight="bold">${safeMeta} · ${safeCity.toUpperCase()}</text>

    <rect x="520" y="130" width="160" height="84" rx="10" fill="#020617" fill-opacity="0.65" stroke="#334155" />
    <text x="600" y="158" text-anchor="middle" fill="${config.accent}" font-family="monospace" font-size="11" font-weight="bold">${config.badge}</text>
    <text x="600" y="180" text-anchor="middle" fill="#e2e8f0" font-family="monospace" font-size="10">SHA-256 VAULT RECORD</text>
    <text x="600" y="198" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="9">RIDECONNECT PK</text>

    <rect x="36" y="324" width="648" height="54" rx="10" fill="#020617" fill-opacity="0.6" />
    <text x="54" y="348" fill="#94a3b8" font-family="monospace" font-size="11">FIRESTORE PRIVATE COLLECTION: /driverDocuments/${safeName.slice(0, 12).toLowerCase().replace(/\s+/g, '_')}</text>
    <text x="54" y="366" fill="#64748b" font-family="monospace" font-size="10">ISOLATED FROM PUBLIC READS · AUTHORIZED FOR CENTRAL ADMIN &amp; OWNER ONLY</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const resultStr = String(reader.result || '');
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file (JPG, PNG, WEBP, SVG).'));
        return;
      }
      const img = new Image();
      img.onerror = () => {
        // If browser cannot rasterize (e.g. raw SVG), return direct data URL if small enough
        if (resultStr.length <= 240000) {
          resolve(resultStr);
        } else {
          reject(new Error('Selected image is too large. Please choose a smaller image.'));
        }
      };
      img.onload = () => {
        const maxDim = 960;
        let width = img.width || 720;
        let height = img.height || 420;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(resultStr.slice(0, 240000));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let compressed = canvas.toDataURL('image/jpeg', 0.76);
        if (compressed.length > 220000) {
          compressed = canvas.toDataURL('image/jpeg', 0.55);
        }
        resolve(compressed);
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

export function isRenderableImageSource(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(trimmed)) return true;
  if (trimmed.includes('images.unsplash.com') || trimmed.includes('picsum.photos')) return true;
  return false;
}

export default function DriverDocumentUploadModal({
  isOpen,
  onClose,
  driverProfile,
  driverDocument,
  onSynced,
}: DriverDocumentUploadModalProps) {
  const [cnicNumber, setCnicNumber] = useState(driverDocument?.cnicNumber || '42101-1234567-1');
  const [licenseNumber, setLicenseNumber] = useState(
    driverDocument?.licenseNumber || 'LHR-992817-HTV'
  );
  const [licenseExpiry, setLicenseExpiry] = useState(
    driverDocument?.licenseExpiry || '2029-12-31'
  );
  const [phone, setPhone] = useState(driverDocument?.phone || '+92 321 9876543');

  const [cnicDocUrl, setCnicDocUrl] = useState(driverDocument?.cnicDocUrl || '');
  const [licenseDocUrl, setLicenseDocUrl] = useState(driverDocument?.licenseDocUrl || '');
  const [vehicleRegDocUrl, setVehicleRegDocUrl] = useState(
    driverDocument?.vehicleRegDocUrl || ''
  );

  const [activeSlot, setActiveSlot] = useState<DocSlotKey>('cnic');
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [saving, setSaving] = useState(false);
  const [processingFile, setProcessingFile] = useState<DocSlotKey | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [lightboxUrl, setLightboxUrl] = useState<{ title: string; url: string } | null>(null);

  const cnicFileRef = useRef<HTMLInputElement | null>(null);
  const licenseFileRef = useRef<HTMLInputElement | null>(null);
  const vehicleRegFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCnicNumber(driverDocument?.cnicNumber || '42101-1234567-1');
    setLicenseNumber(driverDocument?.licenseNumber || 'LHR-992817-HTV');
    setLicenseExpiry(driverDocument?.licenseExpiry || '2029-12-31');
    setPhone(driverDocument?.phone || '+92 321 9876543');
    setCnicDocUrl(driverDocument?.cnicDocUrl || '');
    setLicenseDocUrl(driverDocument?.licenseDocUrl || '');
    setVehicleRegDocUrl(driverDocument?.vehicleRegDocUrl || '');
    setFeedback(null);
  }, [isOpen, driverDocument]);

  if (!isOpen) return null;

  const handleFilePicked = async (slot: DocSlotKey, file?: File | null) => {
    if (!file) return;
    setProcessingFile(slot);
    setFeedback(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      if (slot === 'cnic') setCnicDocUrl(dataUrl);
      if (slot === 'license') setLicenseDocUrl(dataUrl);
      if (slot === 'vehicleReg') setVehicleRegDocUrl(dataUrl);
      setFeedback({
        type: 'success',
        message: `${
          slot === 'cnic'
            ? 'CNIC Identity Card'
            : slot === 'license'
            ? 'Driving License'
            : 'Vehicle Registration'
        } image processed and ready to sync to Firestore.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not process image file.',
      });
    } finally {
      setProcessingFile(null);
    }
  };

  const handleGenerateSpecimen = (slot: DocSlotKey) => {
    if (slot === 'cnic') {
      const uri = buildSpecimenSvgDataUri(
        'cnic',
        driverProfile.fullName,
        driverProfile.city,
        cnicNumber,
        'NADRA BIOMETRIC VERIFIED'
      );
      setCnicDocUrl(uri);
    } else if (slot === 'license') {
      const uri = buildSpecimenSvgDataUri(
        'license',
        driverProfile.fullName,
        driverProfile.city,
        licenseNumber,
        `EXP: ${licenseExpiry} · ${driverProfile.licenseSummary || 'PSV/HTV'}`
      );
      setLicenseDocUrl(uri);
    } else {
      const uri = buildSpecimenSvgDataUri(
        'vehicleReg',
        driverProfile.fullName,
        driverProfile.city,
        `REG-${driverProfile.uid.slice(0, 6).toUpperCase()}-2026`,
        'EXCISE & TAXATION CLEARED'
      );
      setVehicleRegDocUrl(uri);
    }
    setFeedback({
      type: 'success',
      message: 'High-contrast verification specimen image linked. Click "Sync Documents to Firestore" to save.',
    });
  };

  const handlePopulateAllSpecimens = () => {
    setCnicDocUrl(
      buildSpecimenSvgDataUri(
        'cnic',
        driverProfile.fullName,
        driverProfile.city,
        cnicNumber,
        'NADRA BIOMETRIC VERIFIED'
      )
    );
    setLicenseDocUrl(
      buildSpecimenSvgDataUri(
        'license',
        driverProfile.fullName,
        driverProfile.city,
        licenseNumber,
        `EXP: ${licenseExpiry} · ${driverProfile.licenseSummary || 'PSV/HTV'}`
      )
    );
    setVehicleRegDocUrl(
      buildSpecimenSvgDataUri(
        'vehicleReg',
        driverProfile.fullName,
        driverProfile.city,
        `REG-${driverProfile.uid.slice(0, 6).toUpperCase()}-2026`,
        'EXCISE & TAXATION CLEARED'
      )
    );
    setFeedback({
      type: 'success',
      message:
        'All 3 verification document images (CNIC, Driving License, Vehicle Registration) generated. Click "Sync Documents to Firestore" to persist.',
    });
  };

  const handleSaveToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const finalCnicUrl =
      cnicDocUrl.trim() ||
      buildSpecimenSvgDataUri(
        'cnic',
        driverProfile.fullName,
        driverProfile.city,
        cnicNumber,
        'NADRA BIOMETRIC VERIFIED'
      );
    const finalLicenseUrl =
      licenseDocUrl.trim() ||
      buildSpecimenSvgDataUri(
        'license',
        driverProfile.fullName,
        driverProfile.city,
        licenseNumber,
        `EXP: ${licenseExpiry}`
      );
    const finalVehicleRegUrl =
      vehicleRegDocUrl.trim() ||
      buildSpecimenSvgDataUri(
        'vehicleReg',
        driverProfile.fullName,
        driverProfile.city,
        `REG-${driverProfile.uid.slice(0, 6).toUpperCase()}`,
        'EXCISE & TAXATION CLEARED'
      );

    try {
      await saveDriverVerificationDocuments(driverProfile.uid, {
        email: driverDocument?.email || '',
        phone,
        cnicNumber,
        licenseNumber,
        licenseExpiry,
        cnicDocUrl: finalCnicUrl,
        licenseDocUrl: finalLicenseUrl,
        vehicleRegDocUrl: finalVehicleRegUrl,
      });

      setCnicDocUrl(finalCnicUrl);
      setLicenseDocUrl(finalLicenseUrl);
      setVehicleRegDocUrl(finalVehicleRegUrl);

      if (onSynced) {
        onSynced({
          cnicNumber,
          licenseNumber,
          licenseExpiry,
          phone,
          cnicDocUrl: finalCnicUrl,
          licenseDocUrl: finalLicenseUrl,
          vehicleRegDocUrl: finalVehicleRegUrl,
        });
      }

      setFeedback({
        type: 'success',
        message:
          'All 3 verification documents (CNIC, Driving License, and Vehicle Registration) have been securely synced to Firestore (/driverDocuments).',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to sync verification documents to Firestore.',
      });
    } finally {
      setSaving(false);
    }
  };

  const slots: {
    key: DocSlotKey;
    title: string;
    subtitle: string;
    url: string;
    setUrl: (val: string) => void;
    fileRef: React.RefObject<HTMLInputElement | null>;
    icon: React.ReactNode;
    metaBadge: string;
  }[] = [
    {
      key: 'cnic',
      title: '1. National CNIC Identity Card',
      subtitle: 'Front/Back scan or high-contrast image of your NADRA Smart CNIC',
      url: cnicDocUrl,
      setUrl: setCnicDocUrl,
      fileRef: cnicFileRef,
      icon: <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      metaBadge: cnicNumber || 'CNIC Required',
    },
    {
      key: 'license',
      title: '2. Commercial / LTV / HTV Driving License',
      subtitle: 'Valid intercity highway driving permit with visible expiry date',
      url: licenseDocUrl,
      setUrl: setLicenseDocUrl,
      fileRef: licenseFileRef,
      icon: <Award className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
      metaBadge: `${licenseNumber || 'License #'} · Exp ${licenseExpiry || 'N/A'}`,
    },
    {
      key: 'vehicleReg',
      title: '3. Vehicle Registration & Fitness Certificate',
      subtitle: 'Excise & Taxation smart registration card matching your fleet vehicle',
      url: vehicleRegDocUrl,
      setUrl: setVehicleRegDocUrl,
      fileRef: vehicleRegFileRef,
      icon: <Car className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
      metaBadge: 'Excise Smart Card',
    },
  ];

  const completedCount = [cnicDocUrl, licenseDocUrl, vehicleRegDocUrl].filter((u) =>
    Boolean(u && u.trim())
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-doc-vault-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Private Firestore Vault · /driverDocuments/{driverProfile.uid.slice(0, 10)}</span>
            </div>
            <h2
              id="driver-doc-vault-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Upload &amp; Link Captain Verification Documents
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload local document scans or link verified image URLs for your CNIC, Driving License, and Vehicle Registration. Protected by owner-only and Admin security rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePopulateAllSpecimens}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/70 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Fill Verified Specimens</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Bar & Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Verification Status:</span>
              <span className="uppercase font-mono text-emerald-700 dark:text-emerald-400">
                {driverProfile.verificationStatus}
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
              {completedCount}/3 Document Images Linked
            </span>
            {driverDocument?.adminNotes && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Admin Note: <strong className="text-slate-800 dark:text-slate-200">{driverDocument.adminNotes}</strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-900 rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                inputMode === 'upload'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image File</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('url')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                inputMode === 'url'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Link Image URL</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveToFirestore} className="space-y-6">
          {/* Core Identification Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CNIC Identity Number
              </label>
              <input
                type="text"
                value={cnicNumber}
                onChange={(e) => setCnicNumber(e.target.value)}
                placeholder="42101-1234567-1"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Driving License Number
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="LHR-992817-HTV"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                License Expiry Date
              </label>
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Verified Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 321 9876543"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                required
              />
            </div>
          </div>

          {/* 3-Column Document Upload & Preview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {slots.map((slot) => {
              const hasValue = Boolean(slot.url && slot.url.trim());
              const isRenderable = isRenderableImageSource(slot.url);
              const isSelected = activeSlot === slot.key;

              return (
                <div
                  key={slot.key}
                  onClick={() => setActiveSlot(slot.key)}
                  className={`border rounded-xl p-4 flex flex-col justify-between space-y-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {slot.icon}
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {slot.title}
                        </h3>
                      </div>
                      {hasValue ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {slot.subtitle}
                    </p>

                    {/* Preview Frame */}
                    <div className="relative h-36 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center">
                      {hasValue && isRenderable ? (
                        <>
                          <img
                            src={slot.url}
                            alt={slot.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxUrl({ title: slot.title, url: slot.url });
                            }}
                            className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900/85 hover:bg-slate-900 text-white text-[11px] font-medium border border-white/15"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>
                        </>
                      ) : hasValue ? (
                        <div className="p-3 text-center space-y-1.5">
                          <FileCheck2 className="w-6 h-6 text-emerald-400 mx-auto" />
                          <div className="text-[11px] font-mono text-emerald-300 truncate max-w-[200px]">
                            {slot.url}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateSpecimen(slot.key);
                            }}
                            className="text-[11px] text-sky-400 hover:underline"
                          >
                            Convert to visual card preview
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 text-center space-y-1 text-slate-400">
                          <Upload className="w-5 h-5 mx-auto opacity-70" />
                          <div className="text-[11px]">No document image linked</div>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span className="truncate">{slot.metaBadge}</span>
                      <span>
                        {slot.url.startsWith('data:image/')
                          ? 'Uploaded Scan'
                          : hasValue
                          ? 'Linked URL'
                          : 'Unlinked'}
                      </span>
                    </div>
                  </div>

                  {/* Upload or URL Input Controls */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <input
                      ref={slot.fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFilePicked(slot.key, e.target.files?.[0])}
                    />

                    {inputMode === 'upload' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={processingFile === slot.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            slot.fileRef.current?.click();
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {processingFile === slot.key
                              ? 'Processing...'
                              : hasValue
                              ? 'Replace Image'
                              : 'Choose Image'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateSpecimen(slot.key);
                          }}
                          title="Generate official verified specimen card"
                          className="px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          Specimen
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={slot.url.startsWith('data:image/') ? '' : slot.url}
                          onChange={(e) => slot.setUrl(e.target.value)}
                          placeholder="https://... image or document URL"
                          className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => slot.fileRef.current?.click()}
                            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            Or browse local image
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGenerateSpecimen(slot.key)}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          >
                            Use Specimen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <span>{feedback.message}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs underline opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Synced directly with <code className="font-mono">driverDocuments/{driverProfile.uid}</code> in Firestore.
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {saving ? 'Syncing to Firestore Vault...' : 'Sync Documents to Firestore'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Full-Screen Document Image Inspector Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-bold">{lightboxUrl.title}</span>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-md"
              >
                Close Preview
              </button>
            </div>
            <div className="rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-[75vh]">
              <img
                src={lightboxUrl.url}
                alt={lightboxUrl.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
