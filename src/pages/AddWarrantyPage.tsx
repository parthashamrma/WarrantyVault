import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import {
  calculateExpiryDate,
  formatDate,
  validateDocumentFile,
  getWarrantyStatus,
} from '../lib/warrantyUtils';
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
  HelpCircle,
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

export const AddWarrantyPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Documents
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
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

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const validFiles: File[] = [];
    const errs: string[] = [];

    files.forEach((file) => {
      const check = validateDocumentFile(file);
      if (check.valid) {
        validFiles.push(file);
      } else if (check.error) {
        errs.push(`${file.name}: ${check.error}`);
      }
    });

    setAttachedFiles((prev) => [...prev, ...validFiles]);
    setFileErrors(errs);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Product name is required.';
    }

    if (!purchaseDate) {
      errs.purchaseDate = 'Purchase date is required.';
    }

    if (!durationMonths || durationMonths <= 0) {
      errs.durationMonths = 'Duration must be greater than 0 months.';
    }

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

      navigate(`/warranties/${created.id}`);
    } catch (err: any) {
      console.error('Failed to create warranty:', err);
      setServerError(err.message || 'Failed to save warranty entry');
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
          Store product details, automatically calculate expiry dates, and attach private proof of purchase.
        </p>
      </div>

      {serverError && (
        <div className="p-4 border border-[var(--r)] bg-[var(--r)]/10 text-[var(--r)] text-xs font-mono rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Product Information */}
        <div className="vault-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-2xl text-[var(--ink)]">1. Product Information</h3>
            <span className="font-mono text-xs text-[var(--mut)] uppercase tracking-wider">Step 1 of 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="productName" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Product Name <span className="text-[var(--r)]">*</span>
              </label>
              <input
                id="productName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. LG Front-Load Washer, Sony Headphones, MacBook Pro"
                className="vault-input"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-[var(--r)] text-xs font-mono mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="brand" className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1.5">
                Brand / Manufacturer
              </label>
              <input
                id="brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Apple, Sony, LG, Dell"
                className="vault-input"
              />
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

            <div>
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

        {/* Step 3: Private Document Attachments */}
        <div className="vault-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <div>
              <h3 className="font-serif text-2xl text-[var(--ink)]">3. Attach Documents</h3>
              <p className="text-xs text-[var(--mut)] font-mono mt-0.5">
                Stored in private bucket "warranty-docs" • Signed URLs only • Max 5MB per file
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
              Drop invoices, receipts, or warranty cards here
            </p>
            <p className="text-xs font-mono text-[var(--mut)] mt-1">
              or click to browse from device (PDF, PNG, JPG up to 5 MB)
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

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">
                Attached Files ({attachedFiles.length})
              </h4>
              <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded bg-[var(--bg)]">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-[var(--g)] shrink-0" />
                      <span className="truncate text-[var(--ink)] font-medium">{file.name}</span>
                      <span className="text-[var(--mut)]">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-[var(--r)] hover:opacity-80 p-1 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
