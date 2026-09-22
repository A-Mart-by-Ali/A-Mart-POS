import React, { useState, useEffect } from 'react';
import {
  Building2,
  Phone,
  Mail,
  User,
  CreditCard,
  DollarSign,
  Plus,
  Search,
  CheckCircle,
  FileText
} from 'lucide-react';
import { getSuppliers } from '../services/inventoryService';
import { Supplier } from '../types/database';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSuppliers();
        setSuppliers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalPayable = suppliers.reduce((acc, s) => acc + (s.current_balance || 0), 0);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone && s.phone.includes(search))
  );

  return (
    <div className="space-y-6 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-mart-800" />
            <span>Suppliers & Accounts Payable</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage distributor relationships, payment terms, and outstanding consignment liabilities.
          </p>
        </div>

        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-xs flex items-center gap-3">
          <span className="text-xs text-slate-500 uppercase font-bold">Total Accounts Payable:</span>
          <span className="text-base font-black font-mono text-mart-900">
            Rs. {totalPayable.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search suppliers by name, representative, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(supplier => (
          <div key={supplier.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 hover:border-mart-700/40 transition-all">
            
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">{supplier.name}</h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {supplier.notes || 'Registered Mart Supplier'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                {supplier.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
              <div className="flex items-center space-x-2 text-slate-600">
                <User className="w-3.5 h-3.5 text-mart-700" />
                <span>{supplier.contact_person || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Phone className="w-3.5 h-3.5 text-mart-700" />
                <span className="font-mono">{supplier.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-mart-700" />
                <span className="truncate">{supplier.email || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <CreditCard className="w-3.5 h-3.5 text-mart-700" />
                <span>{supplier.payment_terms || 'Standard Terms'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Outstanding Payable Balance:</span>
              <strong className="text-sm font-extrabold font-mono text-mart-900">
                Rs. {supplier.current_balance.toLocaleString()}
              </strong>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
