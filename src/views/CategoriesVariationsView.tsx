import React, { useState, useEffect } from 'react';
import {
  Tags,
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Layers,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Check,
  Package
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getProductsWithStock,
  getVariationPresets,
  saveVariationPresets,
  VariationPresetGroup,
  DEFAULT_VARIATION_PRESETS,
  subscribeInventoryChanges
} from '../services/inventoryService';
import { Category } from '../types/database';

export const CategoriesVariationsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'categories' | 'variations'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Category Modal states
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catActive, setCatActive] = useState(true);
  const [catSubmitting, setCatSubmitting] = useState(false);

  // Variation Presets state
  const [presets, setPresets] = useState<VariationPresetGroup[]>(getVariationPresets());
  const [newOptionText, setNewOptionText] = useState<Record<string, string>>({});
  const [savePresetToast, setSavePresetToast] = useState(false);

  const loadData = async () => {
    try {
      const [cats, prods] = await Promise.all([
        getAllCategories(),
        getProductsWithStock()
      ]);
      setCategories(cats);

      // Count products per category
      const counts: Record<string, number> = {};
      prods.forEach(p => {
        if (p.category_id) {
          counts[p.category_id] = (counts[p.category_id] || 0) + 1;
        }
      });
      setProductCounts(counts);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeInventoryChanges(loadData);
    return () => unsub();
  }, []);

  const openAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatDesc('');
    setCatActive(true);
    setIsCatModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatActive(cat.is_active);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setCatSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: catName.trim(),
          description: catDesc.trim() || undefined,
          is_active: catActive
        });
      } else {
        await addCategory({
          name: catName.trim(),
          description: catDesc.trim() || undefined,
          is_active: catActive
        });
      }
      setIsCatModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const count = productCounts[cat.id] || 0;
    if (count > 0) {
      if (!window.confirm(`Warning: ${count} products are currently linked to "${cat.name}". Are you sure you want to delete this category?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
        return;
      }
    }

    try {
      await deleteCategory(cat.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  // Variation Preset actions
  const handleAddOption = (groupId: string) => {
    const val = (newOptionText[groupId] || '').trim();
    if (!val) return;

    const updated = presets.map(g => {
      if (g.id === groupId && !g.options.includes(val)) {
        return { ...g, options: [...g.options, val] };
      }
      return g;
    });

    setPresets(updated);
    saveVariationPresets(updated);
    setNewOptionText({ ...newOptionText, [groupId]: '' });
    showToast();
  };

  const handleRemoveOption = (groupId: string, optionToRemove: string) => {
    const updated = presets.map(g => {
      if (g.id === groupId) {
        return { ...g, options: g.options.filter(opt => opt !== optionToRemove) };
      }
      return g;
    });

    setPresets(updated);
    saveVariationPresets(updated);
    showToast();
  };

  const handleResetPresets = () => {
    if (window.confirm('Reset all size and packaging variations to supermarket defaults?')) {
      setPresets(DEFAULT_VARIATION_PRESETS);
      saveVariationPresets(DEFAULT_VARIATION_PRESETS);
      showToast();
    }
  };

  const showToast = () => {
    setSavePresetToast(true);
    setTimeout(() => setSavePresetToast(false), 2500);
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Tags className="w-6 h-6 text-mart-900" />
            <span>Categories & Product Variations</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage product categories and unit sizes.
          </p>
        </div>

        {activeTab === 'categories' ? (
          <button
            onClick={openAddCategory}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow-mart"
          >
            <Plus className="w-4 h-4 text-mart-200" />
            <span>Add Category</span>
          </button>
        ) : (
          <button
            onClick={handleResetPresets}
            className="flex items-center space-x-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Defaults</span>
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'border-mart-900 text-mart-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tags className="w-4 h-4" />
          <span>Categories ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('variations')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'variations'
              ? 'border-mart-900 text-mart-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Sizes & Units</span>
        </button>
      </div>

      {/* TAB 1: CATEGORIES MANAGER */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          
          {/* Search Bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search categories by name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium px-2">
              Showing {filteredCategories.length} categories
            </span>
          </div>

          {/* Categories Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400">
              Loading categories...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
              <Tags className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-semibold text-slate-700">No categories found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create categories to organize your supermarket products into departments like Dairy, Beverages, Spices, Bakery, and Household.
              </p>
              <button
                onClick={openAddCategory}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-mart-900 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Category</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map(cat => {
                const count = productCounts[cat.id] || 0;
                return (
                  <div
                    key={cat.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-mart-50 text-mart-900 flex items-center justify-center font-bold text-xs">
                            {cat.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm leading-tight">{cat.name}</h3>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {count} {count === 1 ? 'product' : 'products'}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            cat.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {cat.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      {cat.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:text-mart-900 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 text-slate-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: VARIATION UNITS & SIZE PRESETS */}
      {activeTab === 'variations' && (
        <div className="space-y-5">
          
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 space-y-1">
              <div className="font-bold">How Size & Packaging Variations Work in A-Mart:</div>
              <p className="text-emerald-800">
                Products like Milk, Flour, Rice, Sugar, and Biscuits come in various sizes (e.g. 250ml vs 1L, or 1kg vs 5kg).
                These presets power the <strong>Product Variation Generator</strong> in the Catalog, allowing you to generate multi-size variants with distinct barcodes, prices, and stock balances with a single click.
              </p>
            </div>
          </div>

          {/* Presets Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {presets.map(group => (
              <div
                key={group.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{group.name}</h3>
                    <span className="text-[11px] text-slate-400">
                      Standard Unit: <strong className="text-slate-700">{group.unit}</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                    {group.options.length} sizes
                  </span>
                </div>

                {/* Chips */}
                <div className="flex flex-wrap gap-2">
                  {group.options.map(option => (
                    <span
                      key={option}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors"
                    >
                      <span>{option}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(group.id, option)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new option input */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Add size (e.g. ${group.id === 'volume' ? '750ml' : group.id === 'weight' ? '750g' : 'Box of 24'})...`}
                    value={newOptionText[group.id] || ''}
                    onChange={(e) => setNewOptionText({ ...newOptionText, [group.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption(group.id);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-full border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-mart-800 bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddOption(group.id)}
                    className="px-3.5 py-1.5 rounded-full bg-mart-900 text-white text-xs font-semibold hover:bg-mart-800 cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Toast */}
          {savePresetToast && (
            <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg animate-bounce z-50">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Variation size presets updated successfully</span>
            </div>
          )}

        </div>
      )}

      {/* ADD / EDIT CATEGORY MODAL */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        size="md"
        icon={<Tags className="w-5 h-5 text-mart-900" />}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Dairy & Eggs, Beverages, Spices & Herbs"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-medium"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Brief details about what items belong to this category..."
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={catActive}
                onChange={(e) => setCatActive(e.target.checked)}
                className="rounded text-mart-800 focus:ring-mart-800"
              />
              <span className="text-slate-700 font-medium text-xs">
                Active Category
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={catSubmitting || !catName.trim()}
              className="px-5 py-2 rounded-full bg-mart-900 text-white hover:bg-mart-800 font-semibold cursor-pointer transition-all shadow-sm hover:shadow-mart disabled:opacity-50"
            >
              {catSubmitting ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
