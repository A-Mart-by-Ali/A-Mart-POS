import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  Mail,
  User,
  CreditCard,
  Plus,
  Search,
  Edit2,
  MapPin,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getSuppliers,
  addSupplier,
  updateSupplier,
  subscribeInventoryChanges
} from '../services/inventoryService';
import { Supplier, ActiveStatus } from '../types/database';

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  payment_terms: string;
  opening_balance: number;
  status: ActiveStatus;
  notes: string;
}

const initialFormData: SupplierFormData = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  payment_terms: 'Net 30 Days',
  opening_balance: 0,
  status: 'active',
  notes: ''
};

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    const unsubscribe = subscribeInventoryChanges(() => {
      fetchSuppliers();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const totalPayable = suppliers.reduce((acc, s) => acc + (s.current_balance || 0), 0);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone && s.phone.includes(search)) ||
    (s.notes && s.notes.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormData(initialFormData);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      payment_terms: supplier.payment_terms || 'Net 30 Days',
      opening_balance: supplier.opening_balance || 0,
      status: supplier.status || 'active',
      notes: supplier.notes || ''
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Please enter a valid vendor or company name.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          payment_terms: formData.payment_terms.trim() || undefined,
          status: formData.status,
          notes: formData.notes.trim() || undefined
        });
      } else {
        await addSupplier({
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          payment_terms: formData.payment_terms.trim() || undefined,
          opening_balance: Number(formData.opening_balance || 0),
          current_balance: Number(formData.opening_balance || 0),
          status: formData.status,
          notes: formData.notes.trim() || undefined
        });
      }

      setIsModalOpen(false);
      await fetchSuppliers();
    } catch (err: any) {
      console.error('Failed to save supplier:', err);
      setErrorMsg(err.message || 'Failed to save vendor. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-mart-800" />
            <span>Suppliers & Vendors</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage vendors, suppliers, and balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-slate-200 px-5 py-2.5 rounded-full shadow-xs flex items-center gap-3">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Balance Due:</span>
            <span className="text-base font-black font-mono text-mart-900">
              Rs. {totalPayable.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow-mart"
          >
            <Plus className="w-4 h-4 text-mart-200" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search suppliers by name, representative, phone, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && suppliers.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm animate-pulse space-y-3">
              <div className="h-5 bg-slate-200 rounded-full w-1/3"></div>
              <div className="h-3 bg-slate-100 rounded-full w-1/2"></div>
              <div className="h-12 bg-slate-50 rounded-xl"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 text-mart-900 mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">
              {search ? 'No matching vendors found' : 'No vendors registered yet'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {search
                ? `No suppliers matched "${search}". Try searching by another name or contact.`
                : 'Add your first supplier or distributor to track purchase orders, stock receiving, and consignments.'}
            </p>
          </div>
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-all"
            >
              Clear Search Query
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-6 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm cursor-pointer transition-all inline-flex items-center gap-2 hover:shadow-mart"
            >
              <Plus className="w-4 h-4 text-mart-200" />
              <span>Add Your First Vendor</span>
            </button>
          )}
        </div>
      )}

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(supplier => (
          <div
            key={supplier.id}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 hover:border-mart-700/40 transition-all group"
          >
            
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 group-hover:text-mart-900 transition-colors">
                  {supplier.name}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {supplier.notes || 'Registered Mart Supplier'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                  supplier.status === 'active'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {supplier.status}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(supplier)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-mart-900 hover:bg-orange-50 transition-all cursor-pointer"
                  title="Edit Vendor Details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
              <div className="flex items-center space-x-2 text-slate-600">
                <User className="w-3.5 h-3.5 text-mart-700 flex-shrink-0" />
                <span className="truncate">{supplier.contact_person || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-mart-700 flex-shrink-0" />
                <span className="font-mono truncate">{supplier.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-mart-700 flex-shrink-0" />
                <span className="truncate">{supplier.email || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <CreditCard className="w-3.5 h-3.5 text-mart-700 flex-shrink-0" />
                <span className="truncate">{supplier.payment_terms || 'Standard Terms'}</span>
              </div>
              {supplier.address && (
                <div className="col-span-2 flex items-center space-x-2 text-slate-600 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-mart-700 flex-shrink-0" />
                  <span className="truncate">{supplier.address}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Outstanding Payable Balance:</span>
              <strong className="text-sm font-extrabold font-mono text-mart-900">
                Rs. {(supplier.current_balance || 0).toLocaleString()}
              </strong>
            </div>

          </div>
        ))}
      </div>

      {/* ADD / EDIT VENDOR MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="xl"
        icon={<Building2 className="w-5 h-5 text-mart-900" />}
        title={editingSupplier ? 'Edit Vendor' : 'Add Vendor'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Vendor Name */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. National Foods Ltd, Nestle Pakistan, Unilever"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
              />
            </div>

            {/* Contact Person & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Mehmood"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0300-1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 font-mono"
                />
              </div>
            </div>

            {/* Email & Payment Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="vendor@distributor.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Payment Terms
                </label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-slate-700"
                >
                  <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                  <option value="Net 7 Days">Net 7 Days</option>
                  <option value="Net 15 Days">Net 15 Days</option>
                  <option value="Net 30 Days">Net 30 Days</option>
                  <option value="Weekly Cheque">Weekly Cheque</option>
                  <option value="100% Advance">100% Advance</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Address
              </label>
              <input
                type="text"
                placeholder="e.g. Warehouse 4B, Korangi Industrial Area, Karachi"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
              />
            </div>

            {/* Opening Balance (only when adding new) & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!editingSupplier ? (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                    Opening Balance (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                    Current Balance (Rs.)
                  </label>
                  <div className="px-4 py-2.5 rounded-full border border-slate-100 bg-slate-100/70 text-sm font-mono font-bold text-mart-900">
                    Rs. {(editingSupplier.current_balance || 0).toLocaleString()}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ActiveStatus })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-slate-700"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Supplies Dairy, Beverage drinks distributor, Wholesale grains"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 font-semibold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-mart"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              <span>{editingSupplier ? 'Update Vendor' : 'Save Vendor'}</span>
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
