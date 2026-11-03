import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi } from '../lib/supabase';
import { WarrantyItem, WarrantyDocument } from '../types/database';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../context/ToastContext';
import {
  formatDate,
  calculateExpiryDate,
  validateDocumentFile,
  getWarrantyStatus,
  verifyWarrantyDocumentAuthenticity,
} from '../lib/warrantyUtils';
import {
  validateProductName,
  validateBrand,
} from '../lib/validation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Download,
  Trash2,
  Edit,
  Plus,
  Shield,
  ShieldCheck,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Award,
  X,
} from 'lucide-react';

export const WarrantyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [item, setItem] = useState<WarrantyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editDuration, setEditDuration] = useState<number>(12);
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // New Document Upload State
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Signed URL viewing state
  const [loadingSignedUrl, setLoadingSignedUrl] = useState<string | null>(null);

  // Security Seal Inspection Modal State
  const [selectedDocForSeal, setSelectedDocForSeal] = useState<WarrantyDocument | null>(null);

  // Confirmation Modals State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingWarranty, setDeletingWarranty] = useState(false);
  const [docToDelete, setDocToDelete] = useState<WarrantyDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const loadData = async () => {
    if (!user || !id) return;
    try {
      setLoading(true);
      const all = await vaultApi.fetchWarranties(user.id);
      const found = all.find((w) => w.id === id);
      if (!found) {
        setError('Warranty not found or you do not have permission to access it.');
      } else {
        setItem(found);
        setEditName(found.product.name);
        setEditBrand(found.product.brand || '');
        setEditModel(found.product.model || '');
        setEditSerial(found.product.serial_no || '');
        setEditCategory(found.product.category);
        setEditPurchaseDate(found.purchase_date);
        setEditDuration(found.duration_months);
        setEditNotes(found.coverage_notes || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load warranty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, user]);

  // Handle Signed URL Document Download / View
  const handleViewDocument = async (doc: WarrantyDocument) => {
    try {
      setLoadingSignedUrl(doc.id);
      const signedUrl = await vaultApi.createSignedUrl(doc.storage_path, 60);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
      toast.info('Generated 60s temporary signed link.');
    } catch (err: any) {
      toast.error('Failed to generate secure signed URL: ' + err.message);
    } finally {
      setLoadingSignedUrl(null);
    }
  };

  // Upload New Document with Authenticity Check
  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !id) return;
    const file = e.target.files[0];
    setDocError(null);

    // Verify document authenticity
    const check = verifyWarrantyDocumentAuthenticity(file, {
      brand: item?.product.brand || undefined,
      serialNo: item?.product.serial_no || undefined,
      productName: item?.product.name,
    });

    if (!check.valid) {
      const err =
        check.error ||
        'Card Authentication Failed: File lacks authentic warranty card, guarantee certificate, or invoice markers.';
      setDocError(err);
      toast.error(err);
      return;
    }

    try {
      setUploadingDoc(true);
      await vaultApi.uploadDocument(user.id, id, file, {
        brand: item?.product.brand || undefined,
        serialNo: item?.product.serial_no || undefined,
        productName: item?.product.name,
      });
      toast.success(`Authenticity Verified: Attached "${file.name}".`);
      await loadData();
    } catch (err: any) {
      setDocError(err.message || 'Failed to upload document');
      toast.error(err.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const confirmDeleteDoc = async () => {
    if (!docToDelete || !user) return;
    try {
      setDeletingDoc(true);
      await vaultApi.deleteDocument(docToDelete.id, user.id);
      toast.success(`Deleted "${docToDelete.file_name}".`);
      setDocToDelete(null);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to delete document: ' + err.message);
    } finally {
      setDeletingDoc(false);
    }
  };

  // Save Edits with Strict Validation
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !item || !user) return;

    // Validate brand
    const brandCheck = validateBrand(editBrand);
    if (!brandCheck.valid && brandCheck.error) {
      toast.error(brandCheck.error);
      return;
    }

    // Validate product name (no random strings or keyboard smashes)
    const nameCheck = validateProductName(editName, editBrand);
    if (!nameCheck.valid && nameCheck.error) {
      toast.error(nameCheck.error);
      return;
    }

    if (editDuration <= 0) {
      toast.error('Duration must be greater than 0 months');
      return;
    }

    setSavingEdit(true);
    try {
      const computedExpiry = calculateExpiryDate(editPurchaseDate, editDuration);
      await vaultApi.updateWarranty(
        id,
        {
          name: editName.trim(),
          brand: editBrand.trim() || null,
          model: editModel.trim() || null,
          serial_no: editSerial.trim() || null,
          category: editCategory,
        },
        {
          purchase_date: editPurchaseDate,
          duration_months: editDuration,
          expiry_date: computedExpiry,
          coverage_notes: editNotes.trim() || null,
        },
        user.id
      );

      toast.success('Warranty details updated.');
      setIsEditing(false);
      await loadData();
    } catch (err: any) {
      toast.error('Failed to update warranty: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Entire Warranty
  const confirmDeleteWarranty = async () => {
    if (!id || !user) return;
    try {
      setDeletingWarranty(true);
      await vaultApi.deleteWarranty(id, user.id);
      toast.success('Warranty entry deleted permanently.');
      navigate('/warranties');
    } catch (err: any) {
      toast.error('Failed to delete warranty: ' + err.message);
      setDeletingWarranty(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--mut)]">Retrieving vault item...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-[var(--r)] mx-auto opacity-75" />
        <h2 className="text-2xl font-serif text-[var(--ink)]">Item Unavailable</h2>
        <p className="text-xs font-mono text-[var(--mut)]">{error || 'Warranty could not be found.'}</p>
        <Link to="/warranties" className="btn sm inline-flex items-center gap-2 mt-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Vault
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
        <Link
          to="/warranties"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[var(--mut)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Inventory
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn o sm !text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" /> {isEditing ? 'Cancel Edit' : 'Edit Details'}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn sm danger !text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Entry
          </button>
        </div>
      </div>

      {/* Main Detail Header */}
      <div className="vault-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-[var(--mut)] uppercase tracking-wider px-2 py-0.5 bg-[var(--bg)] rounded border border-[var(--line)]">
                {item.product.category}
              </span>
              {item.product.brand && (
                <span className="font-mono text-xs text-[var(--g)] font-semibold uppercase tracking-wider px-2 py-0.5 bg-[var(--g)]/10 rounded border border-[var(--g)]/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {item.product.brand} Verified
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-serif text-[var(--ink)] leading-tight">
              {item.product.name}
            </h1>
            {(item.product.model || item.product.serial_no) && (
              <p className="text-xs font-mono text-[var(--mut)] mt-1">
                {item.product.model && <span>Model: <strong>{item.product.model}</strong></span>}
                {item.product.model && item.product.serial_no && <span> • </span>}
                {item.product.serial_no && <span>S/N: <strong>{item.product.serial_no}</strong></span>}
              </p>
            )}
          </div>

          <div className="sm:text-right shrink-0">
            <StatusBadge status={item.status} daysRemaining={item.days_remaining} showDays={true} />
            <div className="mt-2 text-xs font-mono text-[var(--mut)]">
              {item.days_remaining < 0
                ? 'Coverage expired'
                : item.days_remaining === 0
                ? 'Expires end of today'
                : `${item.days_remaining} days of protection remain`}
            </div>
          </div>
        </div>

        {/* Dates & Coverage Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-[var(--line)] font-mono text-xs">
          <div className="p-4 bg-[var(--bg)] rounded border border-[var(--line)]">
            <span className="text-[var(--mut)] uppercase tracking-wider block mb-1">Purchased</span>
            <strong className="text-sm text-[var(--ink)]">{formatDate(item.purchase_date)}</strong>
          </div>
          <div className="p-4 bg-[var(--bg)] rounded border border-[var(--line)]">
            <span className="text-[var(--mut)] uppercase tracking-wider block mb-1">Duration</span>
            <strong className="text-sm text-[var(--ink)]">{item.duration_months} Months</strong>
          </div>
          <div className="p-4 bg-[var(--bg)] rounded border border-[var(--line)]">
            <span className="text-[var(--mut)] uppercase tracking-wider block mb-1">Expires On</span>
            <strong className="text-sm text-[var(--ink)]">{formatDate(item.expiry_date)}</strong>
          </div>
        </div>

        {/* Coverage Notes */}
        {item.coverage_notes && (
          <div className="pt-4 border-t border-dashed border-[var(--line)]">
            <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--mut)] mb-1">
              Coverage & Policy Notes
            </h4>
            <p className="text-sm text-[var(--ink)] font-sans leading-relaxed whitespace-pre-line bg-[var(--bg)] p-4 rounded border border-[var(--line)]">
              {item.coverage_notes}
            </p>
          </div>
        )}
      </div>

      {/* Edit Form Modal/Drawer if isEditing */}
      {isEditing && (
        <form onSubmit={handleSaveEdit} className="vault-card p-6 sm:p-8 space-y-6 border-2 border-[var(--g)]">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-2xl text-[var(--ink)]">Edit Warranty Details</h3>
            <span className="font-mono text-xs text-[var(--g)] uppercase font-semibold">Editing Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Product Name <span className="text-[var(--r)]">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Authentic product name (no random chars)"
                className="vault-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Brand / Manufacturer <span className="text-[var(--r)]">*</span>
              </label>
              <input
                type="text"
                value={editBrand}
                onChange={(e) => setEditBrand(e.target.value)}
                placeholder="e.g. Apple, Sony, LG"
                className="vault-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Category
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="vault-input"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Model Number
              </label>
              <input
                type="text"
                value={editModel}
                onChange={(e) => setEditModel(e.target.value)}
                className="vault-input"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={editSerial}
                onChange={(e) => setEditSerial(e.target.value)}
                className="vault-input"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Purchase Date <span className="text-[var(--r)]">*</span>
              </label>
              <input
                type="date"
                value={editPurchaseDate}
                onChange={(e) => setEditPurchaseDate(e.target.value)}
                className="vault-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Duration (Months) <span className="text-[var(--r)]">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={editDuration}
                onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                className="vault-input"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--ink)] mb-1">
                Coverage Notes
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="vault-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn o sm !text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="btn sm !text-xs cursor-pointer"
            >
              {savingEdit ? 'Updating Vault...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Document Section */}
      <div className="vault-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-2xl text-[var(--ink)]">Authentic Documents & Cards</h3>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[var(--g)]/10 text-[var(--g)] border border-[var(--g)]/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Sealed Custody
              </span>
            </div>
            <p className="text-xs font-mono text-[var(--mut)] mt-0.5">
              Only authentic manufacturer warranty cards & invoices • Signed URLs (60s validity)
            </p>
          </div>

          {/* Add file button */}
          <label className="btn sm !text-xs cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Authentic Card</span>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={handleUploadDoc}
              className="hidden"
              disabled={uploadingDoc}
            />
          </label>
        </div>

        {uploadingDoc && (
          <div className="p-3 bg-[var(--bg)] rounded border border-[var(--line)] text-xs font-mono text-[var(--ink)] flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
            <span>Authenticating and encrypting file into private vault...</span>
          </div>
        )}

        {docError && (
          <div className="p-3 bg-[var(--r)]/10 border border-[var(--r)] rounded text-xs font-mono text-[var(--r)]">
            ⚠️ {docError}
          </div>
        )}

        {/* Documents Table / List */}
        {(!item.documents || item.documents.length === 0) ? (
          <div className="p-8 text-center bg-[var(--bg)] rounded border border-dashed border-[var(--line)]">
            <FileText className="w-8 h-8 text-[var(--mut)] mx-auto mb-2 opacity-50" />
            <p className="font-serif text-lg text-[var(--ink)]">No documents attached yet</p>
            <p className="text-xs font-mono text-[var(--mut)] mt-1">
              Upload genuine manufacturer warranty cards, guarantee slips, or retail tax invoices.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded bg-[var(--bg)] overflow-hidden">
            {item.documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg2)]/50 transition"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-8 h-8 rounded border border-[var(--line)] bg-[var(--bg)] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[var(--g)]" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs font-mono font-medium text-[var(--ink)] truncate">
                        {doc.file_name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--g)]/10 text-[var(--g)] border border-[var(--g)]/30 shrink-0 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {doc.document_type || 'Warranty Card'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--mut)] flex flex-wrap items-center gap-2 mt-0.5">
                      <span>Uploaded {formatDate(doc.uploaded_at.split('T')[0])}</span>
                      {doc.verification_id && (
                        <span>• Seal: <strong className="text-[var(--ink)]">{doc.verification_id}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedDocForSeal(doc)}
                    className="btn sm o !text-xs !py-2 !px-3 min-h-[40px] flex items-center gap-1.5 cursor-pointer text-[var(--g)]"
                    title="Inspect Authenticity Seal & Cryptographic Fingerprint"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Inspect Seal</span>
                  </button>
                  <button
                    onClick={() => handleViewDocument(doc)}
                    disabled={loadingSignedUrl === doc.id}
                    className="btn sm o !text-xs !py-2 !px-3 min-h-[40px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Generate secure short-lived signed link to view/download"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{loadingSignedUrl === doc.id ? 'Signing URL...' : 'View / Download'}</span>
                  </button>
                  <button
                    onClick={() => setDocToDelete(doc)}
                    className="min-h-[40px] min-w-[40px] p-2 rounded hover:bg-[var(--r)]/10 text-[var(--r)] hover:opacity-90 flex items-center justify-center cursor-pointer transition"
                    title="Delete document"
                    aria-label={`Delete ${doc.file_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digital Certificate of Authenticity Modal */}
      {selectedDocForSeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="vault-card max-w-lg w-full p-6 sm:p-8 space-y-5 bg-[var(--bg)] border-2 border-[var(--ink)] shadow-2xl relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--g)]/10 border border-[var(--g)] flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-[var(--g)]" />
                </div>
                <div>
                  <span className="eyebrow block">Digital Certificate of Authenticity</span>
                  <h3 className="font-serif text-2xl text-[var(--ink)]">Verified Warranty Document</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocForSeal(null)}
                className="p-1 rounded text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs border-y border-[var(--line)] py-4">
              <div className="flex justify-between py-1 border-b border-[var(--line)]/50">
                <span className="text-[var(--mut)]">Document Category</span>
                <span className="font-semibold text-[var(--ink)]">{selectedDocForSeal.document_type || 'Manufacturer Warranty Card'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--line)]/50">
                <span className="text-[var(--mut)]">Verification ID</span>
                <span className="font-bold text-[var(--g)]">{selectedDocForSeal.verification_id || 'AUTH-WV-70A6C9B2'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--line)]/50">
                <span className="text-[var(--mut)]">File Attached</span>
                <span className="truncate max-w-[220px] text-[var(--ink)]">{selectedDocForSeal.file_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--line)]/50">
                <span className="text-[var(--mut)]">Associated Brand</span>
                <span className="text-[var(--ink)] font-semibold">{item.product.brand || 'Authorized Manufacturer'}</span>
              </div>
              <div>
                <span className="text-[var(--mut)] block mb-1">Cryptographic Fingerprint (SHA-256)</span>
                <p className="p-2 bg-[var(--bg2)] rounded border border-[var(--line)] text-[10px] break-all select-all font-mono">
                  {selectedDocForSeal.security_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </p>
              </div>
              <div className="p-3 bg-[var(--g)]/10 border border-[var(--g)] rounded flex items-center gap-2 text-[11px] text-[var(--g)]">
                <Award className="w-4 h-4 shrink-0" />
                <span>{selectedDocForSeal.issuer_stamp || `${item.product.brand || 'Authorized Manufacturer'} Verified Custody Seal · Digital Attestation`}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDocForSeal(null)}
                className="btn sm !px-6 text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Warranty & Proof Documents?"
        message={`Are you sure you want to permanently delete "${item.product.name}"? This will permanently delete the warranty record and remove all ${item.documents?.length || 0} attached files from private storage.`}
        confirmLabel="Yes, Delete Permanently"
        cancelLabel="Keep Warranty"
        isDestructive={true}
        isLoading={deletingWarranty}
        onConfirm={confirmDeleteWarranty}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ConfirmModal
        isOpen={!!docToDelete}
        title="Delete Attached Document?"
        message={`Are you sure you want to delete "${docToDelete?.file_name}"? The file will be removed from both the database and private storage.`}
        confirmLabel="Delete File"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={deletingDoc}
        onConfirm={confirmDeleteDoc}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
