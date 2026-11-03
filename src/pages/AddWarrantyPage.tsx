import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { vaultApi } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  calculateExpiryDate,
  formatDate,
  validateDocumentFile,
  getWarrantyStatus,
  verifyWarrantyDocumentAuthenticity,
  DocumentAuthenticityResult,
} from '../lib/warrantyUtils';
import {
  validateProductName,
  validateBrand,
  VERIFIED_BRANDS,
} from '../lib/validation';
import { StatusBadge } from '../components/StatusBadge';
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Shield,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Award,
} from 'lucide-react';

const CATEGORIES = [
  'Appliances',
  'Audio',
  'Cameras',
  'Gaming',
  'Home & Garden',
  'Laptops',
  'Phones',
  'Tools',
  'Vehicles',
  'Watches',
  'General',
];

const POPULAR_BRANDS = [
  'Apple',
  'Sony',
  'LG',
  'Samsung',
  'Dell',
  'HP',
  'Bose',
  'Dyson',
  'Asus',
  'Nintendo',
  'Google',
  'Logitech',
];

export const AddWarrantyPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Product Fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [category, setCategory] = useState('General');

  // Warranty Fields
  const [purchaseDate, setPurchaseDate] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [coverageNotes, setCoverageNotes] = useState('');

  // Auto-calculated Expiry Date
  const [calculatedExpiry, setCalculatedExpiry] = useState('');

  // Documents & Authenticity Verification Map
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [authMap, setAuthMap] = useState<Record<string, DocumentAuthenticityResult>>({});
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  // Form State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Recalculate expiry whenever purchaseDate or durationMonths changes
  useEffect(() => {
    if (purchaseDate && durationMonths > 0) {
      const exp = calculateExpiryDate(purchaseDate, Number(durationMonths));
      setCalculatedExpiry(exp);
    } else {
      setCalculatedExpiry('');
    }
  }, [purchaseDate, durationMonths]);

  // Handle dropping files with strict authenticity verification
  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const validFiles: File[] = [];
    const errs: string[] = [];
    const newAuthMap: Record<string, DocumentAuthenticityResult> = { ...authMap };

    files.forEach((file) => {
      // 1. Basic format & size check
      const basicCheck = validateDocumentFile(file);
      if (!basicCheck.valid) {
        errs.push(`${file.name}: ${basicCheck.error}`);
        return;
      }

      // 2. Strict warranty authenticity check
      const authCheck = verifyWarrantyDocumentAuthenticity(file, {
        brand: brand || undefined,
        productName: name || undefined,
        serialNo: serialNo || undefined,
      });

      if (authCheck.valid && authCheck.auth) {
        validFiles.push(file);
        newAuthMap[file.name] = authCheck.auth;
        toast.success(`Authenticity Verified: ${authCheck.auth.documentType} accepted.`);
      } else {
        const msg =
          authCheck.error ||
          `"${file.name}" failed authenticity verification. Only genuine warranty cards or tax invoices are accepted.`;
        errs.push(`${file.name}: ${msg}`);
        toast.error(`Authentication Rejected: "${file.name}" is not a recognized warranty card or invoice.`);
      }
    });

    setAttachedFiles((prev) => [...prev, ...validFiles]);
    setAuthMap(newAuthMap);
    setFileErrors(errs);
  };

  const removeFile = (index: number) => {
    const fileToRemove = attachedFiles[index];
    if (fileToRemove) {
      setAuthMap((prev) => {
        const updated = { ...prev };
        delete updated[fileToRemove.name];
        return updated;
      });
    }
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    // 1. Brand validation (warranties must be tied to an authentic manufacturer)
    const brandCheck = validateBrand(brand);
    if (!brandCheck.valid && brandCheck.error) {
      errs.brand = brandCheck.error;
    }

    // 2. Product name validation (random strings / keyboard smashes disallowed)
    const nameCheck = validateProductName(name, brand);
    if (!nameCheck.valid && nameCheck.error) {
      errs.name = nameCheck.error;
    }

    // 3. Purchase date
    if (!purchaseDate) {
      errs.purchaseDate = 'Purchase date is required.';
    }

    // 4. Duration
    if (!durationMonths || durationMonths <= 0) {
      errs.durationMonths = 'Duration must be greater than 0 months.';
    }

    // 5. Expiry
    if (!calculatedExpiry) {
      errs.expiry = 'Could not calculate a valid expiry date.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    if (!user) {
      setServerError('Please sign in to save a warranty entry.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await vaultApi.createWarrantyWithProduct(
        user.id,
        {
          name: name.trim(),
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          serial_no: serialNo.trim() || undefined,
          category,
        },
        {
          purchase_date: purchaseDate,
          duration_months: Number(durationMonths),
          expiry_date: calculatedExpiry,
          coverage_notes: coverageNotes.trim() || undefined,
        },
        attachedFiles
      );

      toast.success(`Registered "${created.product.name}" in vault.`);
      navigate(`/warranties/${created.id}`);
    } catch (err: any) {
      logger.error('Failed to create warranty:', err);
      setServerError(err.message || 'Failed to save warranty entry');
      toast.error(err.message || 'Failed to save warranty entry');
      setSubmitting(false);
    }
  };

  const previewStatus = calculatedExpiry ? getWarrantyStatus(calculatedExpiry) : 'Active';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <div>
        <Link
          to="/warranties"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[var(--mut)] hover:text-[var(--ink)] mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Vault
        </Link>
        <div className="eyebrow mb-1">New Vault Entry</div>
        <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)] leading-tight">
          Register Product & Warranty
        </h1>
        <p className="text-xs sm:text-sm text-[var(--mut)] mt-1 font-sans">
          Store authentic brand warranties, calculate expiry dates, and attach verified proof of purchase.
        </p>
      </div>

      {serverError && (
        <div className="p-4 border border-[var(--r)] bg-[var(--r)]/10 text-[var(--r)] text-xs font-mono rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Product & Brand Information */}
        <div className="vault-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-2xl text-[var(--ink)]">1. Product Information</h3>
            <span className="font-mono text-xs text-[var(--mut)] uppercase tracking-wider">Step 1 of 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand Selection & Verification */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="brand" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)]">
                  Manufacturer / Brand <span className="text-[var(--r)]">*</span>
                </label>
                <span className="text-[11px] font-mono text-[var(--g)] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Brands
                </span>
              </div>

              {/* Quick Verified Brand Buttons */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {POPULAR_BRANDS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBrand(b);
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.brand;
                        return copy;
                      });
                    }}
                    className={`px-2.5 py-1 text-xs font-mono rounded border transition cursor-pointer ${
                      brand.toLowerCase() === b.toLowerCase()
                        ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)] font-bold'
                        : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--ink)]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>

              <input
                id="brand"
                type="text"
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  if (errors.brand) {
                    const chk = validateBrand(e.target.value);
                    if (chk.valid) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.brand;
                        return copy;
                      });
                    }
                  }
                }}
                onBlur={() => {
                  const chk = validateBrand(brand);
                  if (!chk.valid && chk.error) {
                    setErrors((prev) => ({ ...prev, brand: chk.error || 'Invalid brand.' }));
                  }
                }}
                placeholder="Select above or type genuine brand (e.g. Apple, Sony, LG, Dell)"
                className="vault-input"
                aria-invalid={!!errors.brand}
              />
              {errors.brand && <p className="text-[var(--r)] text-xs font-mono mt-1">{errors.brand}</p>}
            </div>

            {/* Authentic Brand Presets */}
            {brand && VERIFIED_BRANDS[brand] && (
              <div className="sm:col-span-2 p-3 bg-[var(--bg2)]/50 border border-[var(--line)] rounded space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--ink)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--g)]" />
                  <span>Authentic {brand} models (click to fill product name):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VERIFIED_BRANDS[brand].map((modelPreset) => (
                    <button
                      key={modelPreset}
                      type="button"
                      onClick={() => {
                        setName(modelPreset);
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.name;
                          return copy;
                        });
                      }}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--ink)] cursor-pointer transition ${
                        name === modelPreset ? 'ring-2 ring-[var(--g)] font-bold' : ''
                      }`}
                    >
                      + {modelPreset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product Name */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="productName" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)]">
                  Product Name <span className="text-[var(--r)]">*</span>
                </label>
                <span className="text-[11px] font-mono text-[var(--mut)]">
                  No random strings or keyboard smashes
                </span>
              </div>
              <input
                id="productName"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    const chk = validateProductName(e.target.value, brand);
                    if (chk.valid) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.name;
                        return copy;
                      });
                    }
                  }
                }}
                onBlur={() => {
                  const chk = validateProductName(name, brand);
                  if (!chk.valid && chk.error) {
                    setErrors((prev) => ({ ...prev, name: chk.error || 'Invalid product name.' }));
                  }
                }}
                placeholder="e.g. LG Front-Load Washer, Sony Headphones, MacBook Pro"
                className="vault-input"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-[var(--r)] text-xs font-mono mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="category" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="vault-input"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="model" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Model Number
              </label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. WM4000HBA or A2991"
                className="vault-input"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="serialNo" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Serial Number
              </label>
              <input
                id="serialNo"
                type="text"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="e.g. SN-89472-X"
                className="vault-input"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Warranty Terms & Auto-Calculation */}
        <div className="vault-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-2xl text-[var(--ink)]">2. Warranty Terms & Expiry</h3>
            <span className="font-mono text-xs text-[var(--mut)] uppercase tracking-wider">Step 2 of 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="purchaseDate" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Purchase Date <span className="text-[var(--r)]">*</span>
              </label>
              <input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="vault-input"
                aria-invalid={!!errors.purchaseDate}
              />
              {errors.purchaseDate && (
                <p className="text-[var(--r)] text-xs font-mono mt-1">{errors.purchaseDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="durationMonths" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Duration (in months) <span className="text-[var(--r)]">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="durationMonths"
                  type="number"
                  min="1"
                  max="120"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(parseInt(e.target.value) || 0)}
                  className="vault-input"
                  aria-invalid={!!errors.durationMonths}
                />
                <button
                  type="button"
                  onClick={() => setDurationMonths(12)}
                  className={`btn sm !px-3 font-mono text-xs ${durationMonths === 12 ? '' : 'o'}`}
                >
                  12m
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMonths(24)}
                  className={`btn sm !px-3 font-mono text-xs ${durationMonths === 24 ? '' : 'o'}`}
                >
                  24m
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMonths(36)}
                  className={`btn sm !px-3 font-mono text-xs ${durationMonths === 36 ? '' : 'o'}`}
                >
                  36m
                </button>
              </div>
              {errors.durationMonths && (
                <p className="text-[var(--r)] text-xs font-mono mt-1">{errors.durationMonths}</p>
              )}
            </div>

            {/* Live Expiry Calculation Display */}
            <div className="sm:col-span-2 p-5 bg-[var(--bg)] border-2 border-[var(--ink)] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--mut)] block mb-1">
                  Computed Expiry Date (Automated)
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-3xl text-[var(--ink)]">
                    {calculatedExpiry ? formatDate(calculatedExpiry) : '—'}
                  </span>
                  {calculatedExpiry && <StatusBadge status={previewStatus} />}
                </div>
                <p className="text-[11px] font-mono text-[var(--mut)] mt-1">
                  Purchase Date + {durationMonths} months. The expiry date itself is the final day covered.
                </p>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Coverage Notes / Policy Details (Optional)
              </label>
              <textarea
                rows={3}
                value={coverageNotes}
                onChange={(e) => setCoverageNotes(e.target.value)}
                placeholder="e.g. Motor covered for 10 years, parts & labor for 1 year. Free accidental handling in first 30 days."
                className="vault-input resize-y"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Authentic Warranty Cards & Documents */}
        <div className="vault-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-2xl text-[var(--ink)]">3. Attach Authentic Warranty Cards</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[var(--g)]/10 text-[var(--g)] border border-[var(--g)]/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Authenticity Protected
                </span>
              </div>
              <p className="text-xs text-[var(--mut)] font-mono mt-0.5">
                Only genuine manufacturer warranty cards, guarantee certificates, or retail tax invoices accepted.
              </p>
            </div>
            <span className="font-mono text-xs text-[var(--mut)] uppercase tracking-wider">Step 3 of 3</span>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-[var(--ink)] p-8 rounded text-center bg-[var(--bg)] hover:bg-[var(--bg2)] transition relative">
            <input
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={handleFileDrop}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <UploadCloud className="w-10 h-10 text-[var(--ink)] mx-auto mb-3 opacity-75" />
            <p className="font-serif text-xl text-[var(--ink)]">
              Drop genuine warranty cards, guarantee slips, or retail invoices
            </p>
            <p className="text-xs font-mono text-[var(--mut)] mt-1">
              or click to browse from device (PDF, PNG, JPG up to 5 MB) • Verified and cryptographically sealed
            </p>
          </div>

          {/* File Validation Errors */}
          {fileErrors.length > 0 && (
            <div className="p-3 bg-[var(--r)]/10 border border-[var(--r)] rounded text-xs font-mono text-[var(--r)] space-y-1">
              {fileErrors.map((err, idx) => (
                <div key={idx}>⚠️ {err}</div>
              ))}
            </div>
          )}

          {/* Attached Files List with Authenticity Verification Badges */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">
                Attached & Verified Documents ({attachedFiles.length})
              </h4>
              <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded bg-[var(--bg)]">
                {attachedFiles.map((file, idx) => {
                  const auth = authMap[file.name];
                  return (
                    <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-[var(--g)] shrink-0" />
                          <span className="truncate text-[var(--ink)] font-semibold">{file.name}</span>
                          <span className="text-[var(--mut)] text-[11px]">
                            ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        </div>
                        {auth && (
                          <div className="flex flex-wrap items-center gap-2 pl-6">
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--g)] font-bold">
                              <ShieldCheck className="w-3 h-3 text-[var(--g)]" />
                              AUTHENTIC {auth.documentType.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-[var(--mut)]">
                              Seal ID: <strong className="text-[var(--ink)]">{auth.verificationId}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-[var(--r)] hover:opacity-80 p-1 cursor-pointer self-end sm:self-center"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link to="/warranties" className="btn o sm !text-xs">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn !py-3 !px-6 text-xs cursor-pointer"
          >
            {submitting ? 'Locking into Vault...' : 'Save & Secure Warranty'}
          </button>
        </div>
      </form>
    </div>
  );
};
