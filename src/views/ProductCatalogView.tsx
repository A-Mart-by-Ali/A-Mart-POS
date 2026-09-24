import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Barcode,
  SlidersHorizontal,
  Printer,
  Edit2,
  AlertCircle,
  CheckCircle,
  X,
  Tag,
  Boxes,
  ArrowUpDown,
  PlusCircle,
  Trash2,
  Sparkles,
  ClipboardPaste,
  Layers,
  PackagePlus,
  Copy,
  RotateCcw,
  Check,
  Wand2
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import {
  getProductsWithStock,
  getCategories,
  getSuppliers,
  addProduct,
  addProductsBulk,
  updateProduct,
  adjustStock,
  ProductWithStock,
  NewProductPayload,
  getVariationPresets,
  VariationPresetGroup,
  subscribeInventoryChanges
} from '../services/inventoryService';
import { Category, Supplier, Product, AdjustmentType } from '../types/database';
import { isAdmin as checkIsAdmin, getCurrentUser } from '../services/authService';

interface ProductCatalogViewProps {
  isAdmin?: boolean;
}

export interface VariationRowItem {
  id: string;
  variantLabel: string;
  name: string;
  sku: string;
  barcode: string;
  cost_price: number | '';
  selling_price: number | '';
  initial_stock: number | '';
  unit: string;
  min_stock_level: number;
}

const generateVariantSku = (baseName: string, variantLabel: string): string => {
  const baseClean = (baseName || 'PROD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const basePart = (baseClean.length >= 3 ? baseClean.substring(0, 4) : (baseClean + 'ITEM').substring(0, 4));
  
  const varClean = (variantLabel || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const varPart = varClean.length > 0 ? varClean.substring(0, 6) : 'VAR';
  
  const rand = Math.floor(100 + Math.random() * 900);
  return `${basePart}-${varPart}-${rand}`;
};

const generateRandomBarcode = (): string => {
  return '20' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

export const cleanBaseProductName = (name: string): string => {
  if (!name) return '';
  return name
    .replace(/\s*[-–—/]\s*\d+(\.\d+)?\s*(ml|l|litre|litres|liter|liters|g|gm|gram|grams|kg|kgs|pcs|pack|packs|boxes)\b/gi, '')
    .replace(/\s+\d+(\.\d+)?\s*(ml|l|litre|litres|liter|liters|g|gm|gram|grams|kg|kgs|pcs|pack|packs|boxes)\b/gi, '')
    .trim();
};

interface BulkRow {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  supplier_id: string;
  cost_price: number | '';
  selling_price: number | '';
  initial_stock: number | '';
  unit: string;
  min_stock_level: number;
}

const createEmptyBulkRow = (): BulkRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name: '',
  sku: '',
  barcode: '',
  category_id: '',
  supplier_id: '',
  cost_price: '',
  selling_price: '',
  initial_stock: 0,
  unit: 'pcs',
  min_stock_level: 10
});

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({ isAdmin: propIsAdmin }) => {
  const isUserAdmin = propIsAdmin !== undefined ? propIsAdmin : checkIsAdmin(getCurrentUser());
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [quickAddStockProduct, setQuickAddStockProduct] = useState<ProductWithStock | null>(null);
  const [quickAddQty, setQuickAddQty] = useState<number | ''>(10);
  const [quickAddReason, setQuickAddReason] = useState('Restock / Quick add');
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<ProductWithStock | null>(null);
  const [printLabelProduct, setPrintLabelProduct] = useState<ProductWithStock | null>(null);

  // Single Product Form state
  const [newProduct, setNewProduct] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '',
    supplier_id: '',
    unit: 'pcs',
    cost_price: 0,
    selling_price: 0,
    initial_stock: 0,
    min_stock_level: 10,
    max_stock_level: 100,
    tax_rate: 0,
    allow_negative_stock: false,
    expiry_tracked: false,
    is_active: true
  });

  // Mode selection inside Add Product modal
  const [addMode, setAddMode] = useState<'single' | 'variations'>('single');

  // Variation builder state
  const [presetGroups, setPresetGroups] = useState<VariationPresetGroup[]>(getVariationPresets());
  const [selectedPresetGroup, setSelectedPresetGroup] = useState<string>('volume');
  const [baseVariantName, setBaseVariantName] = useState('');
  const [baseVariantCategory, setBaseVariantCategory] = useState('');
  const [baseVariantSupplier, setBaseVariantSupplier] = useState('');
  const [baseVariantUnit, setBaseVariantUnit] = useState('litres');
  const [baseVariantCost, setBaseVariantCost] = useState<number | ''>('');
  const [baseVariantPrice, setBaseVariantPrice] = useState<number | ''>('');
  const [baseVariantExpiry, setBaseVariantExpiry] = useState(false);
  const [customVariantText, setCustomVariantText] = useState('');
  const [variationRows, setVariationRows] = useState<VariationRowItem[]>([]);
  const [variationSubmitting, setVariationSubmitting] = useState(false);

  // Quick Add Variation Modal State (for non-tech users from product row)
  const [quickVarProduct, setQuickVarProduct] = useState<ProductWithStock | null>(null);
  const [quickVarPresetGroup, setQuickVarPresetGroup] = useState<string>('volume');
  const [quickVarLabel, setQuickVarLabel] = useState<string>('');
  const [quickVarCustomLabel, setQuickVarCustomLabel] = useState<string>('');
  const [quickVarName, setQuickVarName] = useState<string>('');
  const [quickVarSku, setQuickVarSku] = useState<string>('');
  const [quickVarBarcode, setQuickVarBarcode] = useState<string>('');
  const [quickVarCostPrice, setQuickVarCostPrice] = useState<number | ''>('');
  const [quickVarSellingPrice, setQuickVarSellingPrice] = useState<number | ''>('');
  const [quickVarStock, setQuickVarStock] = useState<number | ''>(12);
  const [quickVarUnit, setQuickVarUnit] = useState<string>('pcs');
  const [quickVarSubmitting, setQuickVarSubmitting] = useState(false);
  const [quickVarToast, setQuickVarToast] = useState<string | null>(null);

  // Bulk Quick Add Form state
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    createEmptyBulkRow(),
    createEmptyBulkRow(),
    createEmptyBulkRow(),
    createEmptyBulkRow(),
    createEmptyBulkRow()
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [adjustData, setAdjustData] = useState({
    type: 'manual' as AdjustmentType,
    quantity_change: 0,
    reason: ''
  });

  const loadCatalog = async () => {
    try {
      const [prods, cats, sups] = await Promise.all([
        getProductsWithStock(),
        getCategories(),
        getSuppliers()
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err) {
      console.error('Error loading catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    const unsub = subscribeInventoryChanges(loadCatalog);
    return () => unsub();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));

    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;

    const matchesStock =
      stockFilter === 'all' ||
      p.stock_status === stockFilter;

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addProduct(newProduct);
      setIsAddModalOpen(false);
      setNewProduct({
        sku: '',
        barcode: '',
        name: '',
        category_id: '',
        supplier_id: '',
        unit: 'pcs',
        cost_price: 0,
        selling_price: 0,
        initial_stock: 0,
        min_stock_level: 10,
        max_stock_level: 100,
        tax_rate: 0,
        allow_negative_stock: false,
        expiry_tracked: false,
        is_active: true
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add product');
    }
  };

  // Helper when switching preset group
  const handleSelectPresetGroup = (groupId: string) => {
    setSelectedPresetGroup(groupId);
    const grp = presetGroups.find(g => g.id === groupId);
    if (grp) {
      setBaseVariantUnit(grp.unit);
    }
  };

  // Toggle or add a variation by option label
  const handleTogglePresetVariation = (opt: string, defaultUnit?: string) => {
    const existingIndex = variationRows.findIndex(r => r.variantLabel.toLowerCase() === opt.toLowerCase());
    if (existingIndex >= 0) {
      setVariationRows(prev => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      const unit = defaultUnit || baseVariantUnit || 'pcs';
      const label = opt.trim();
      const fullName = baseVariantName.trim() ? `${baseVariantName.trim()} - ${label}` : label;
      const newRow: VariationRowItem = {
        id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        variantLabel: label,
        name: fullName,
        sku: generateVariantSku(baseVariantName, label),
        barcode: '',
        cost_price: baseVariantCost !== '' ? baseVariantCost : '',
        selling_price: baseVariantPrice !== '' ? baseVariantPrice : '',
        initial_stock: 0,
        unit: unit,
        min_stock_level: 10
      };
      setVariationRows(prev => [...prev, newRow]);
    }
  };

  // Add custom variation
  const handleAddCustomVariation = () => {
    if (!customVariantText.trim()) return;
    const label = customVariantText.trim();
    if (variationRows.some(r => r.variantLabel.toLowerCase() === label.toLowerCase())) {
      alert(`Variation "${label}" is already added.`);
      return;
    }
    const fullName = baseVariantName.trim() ? `${baseVariantName.trim()} - ${label}` : label;
    const newRow: VariationRowItem = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      variantLabel: label,
      name: fullName,
      sku: generateVariantSku(baseVariantName, label),
      barcode: '',
      cost_price: baseVariantCost !== '' ? baseVariantCost : '',
      selling_price: baseVariantPrice !== '' ? baseVariantPrice : '',
      initial_stock: 0,
      unit: baseVariantUnit || 'pcs',
      min_stock_level: 10
    };
    setVariationRows(prev => [...prev, newRow]);
    setCustomVariantText('');
  };

  // Add all variations of the active preset group
  const handleAddAllPresetVariations = () => {
    const activeGrp = presetGroups.find(g => g.id === selectedPresetGroup);
    if (!activeGrp) return;

    setVariationRows(prev => {
      const existingLabels = new Set(prev.map(r => r.variantLabel.toLowerCase()));
      const toAdd: VariationRowItem[] = [];

      for (const opt of activeGrp.options) {
        if (!existingLabels.has(opt.toLowerCase())) {
          const label = opt.trim();
          const fullName = baseVariantName.trim() ? `${baseVariantName.trim()} - ${label}` : label;
          toAdd.push({
            id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            variantLabel: label,
            name: fullName,
            sku: generateVariantSku(baseVariantName, label),
            barcode: '',
            cost_price: baseVariantCost !== '' ? baseVariantCost : '',
            selling_price: baseVariantPrice !== '' ? baseVariantPrice : '',
            initial_stock: 0,
            unit: activeGrp.unit || baseVariantUnit || 'pcs',
            min_stock_level: 10
          });
        }
      }
      return [...prev, ...toAdd];
    });
  };

  // Sync names with base name
  const handleSyncVariantNames = () => {
    if (!baseVariantName.trim()) {
      alert('Please enter a Base Product Name first to sync names.');
      return;
    }
    setVariationRows(prev =>
      prev.map(r => ({
        ...r,
        name: `${baseVariantName.trim()} - ${r.variantLabel}`
      }))
    );
  };

  // Apply default prices to all rows
  const handleApplyBasePricesToAll = () => {
    if (baseVariantCost === '' && baseVariantPrice === '') {
      alert('Please specify a default Cost Price or Selling Price in Base Info first.');
      return;
    }
    setVariationRows(prev =>
      prev.map(r => ({
        ...r,
        cost_price: baseVariantCost !== '' ? baseVariantCost : r.cost_price,
        selling_price: baseVariantPrice !== '' ? baseVariantPrice : r.selling_price
      }))
    );
  };

  // Auto generate barcodes for rows that don't have one
  const handleAutoGenerateVariantBarcodes = () => {
    setVariationRows(prev =>
      prev.map(r => ({
        ...r,
        barcode: r.barcode.trim() || generateRandomBarcode()
      }))
    );
  };

  // Update specific row
  const handleUpdateVariationRow = (id: string, updates: Partial<VariationRowItem>) => {
    setVariationRows(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Remove specific row
  const handleRemoveVariationRow = (id: string) => {
    setVariationRows(prev => prev.filter(r => r.id !== id));
  };

  // Submit variations
  const handleCreateVariations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseVariantName.trim()) {
      alert('Please enter a Base Product Name.');
      return;
    }
    if (!baseVariantCategory) {
      alert('Please select a Category.');
      return;
    }
    if (variationRows.length === 0) {
      alert('Please select at least one variation (e.g. 250ml, 1 Litre, or 500g).');
      return;
    }

    for (let i = 0; i < variationRows.length; i++) {
      const row = variationRows[i];
      if (!row.name.trim()) {
        alert(`Variation #${i + 1} (${row.variantLabel}) needs a product name.`);
        return;
      }
      if (row.selling_price === '' || Number(row.selling_price) < 0) {
        alert(`Please specify a valid selling price for "${row.name}".`);
        return;
      }
    }

    setVariationSubmitting(true);
    try {
      const payloads: NewProductPayload[] = variationRows.map(v => ({
        name: v.name.trim(),
        sku: v.sku.trim() || generateVariantSku(baseVariantName, v.variantLabel),
        barcode: v.barcode.trim() || undefined,
        category_id: baseVariantCategory || undefined,
        supplier_id: baseVariantSupplier || undefined,
        cost_price: Number(v.cost_price) || 0,
        selling_price: Number(v.selling_price) || 0,
        unit: v.unit || baseVariantUnit || 'pcs',
        initial_stock: Number(v.initial_stock) || 0,
        min_stock_level: Number(v.min_stock_level) || 10,
        max_stock_level: 100,
        tax_rate: 0,
        allow_negative_stock: false,
        expiry_tracked: baseVariantExpiry,
        is_active: true
      }));

      const res = await addProductsBulk(payloads);
      await loadCatalog();
      setIsAddModalOpen(false);

      // Reset variation builder
      setBaseVariantName('');
      setBaseVariantCost('');
      setBaseVariantPrice('');
      setVariationRows([]);

      alert(`Successfully created ${res.count} product variations with inventory stock!`);
    } catch (err: any) {
      console.error('Failed to create variations:', err);
      alert(err.message || 'Failed to create product variations.');
    } finally {
      setVariationSubmitting(false);
    }
  };

  // Quick Add Variation Handlers (for non-tech users from product row)
  const openQuickAddVariation = (p: ProductWithStock) => {
    const baseClean = cleanBaseProductName(p.name);
    
    // Auto-detect best preset group based on unit or product name
    let detectedGroup = 'volume';
    const lowerName = p.name.toLowerCase();
    if (p.unit === 'litres' || /ml|l|litre|water|milk|juice|beverage|drink|oil|coke|pepsi/.test(lowerName)) {
      detectedGroup = 'volume';
    } else if (p.unit === 'kg' || /g|kg|gram|flour|atta|rice|sugar|pulse|dal|masala|tea|powder/.test(lowerName)) {
      detectedGroup = 'weight';
    } else if (p.unit === 'packs' || p.unit === 'boxes' || /pack|box|carton|roll/.test(lowerName)) {
      detectedGroup = 'packaging';
    } else {
      detectedGroup = 'volume';
    }

    setPresetGroups(getVariationPresets());
    setQuickVarProduct(p);
    setQuickVarPresetGroup(detectedGroup);
    setQuickVarLabel('');
    setQuickVarCustomLabel('');
    setQuickVarName(`${baseClean}`);
    setQuickVarSku('');
    setQuickVarBarcode(generateRandomBarcode());
    setQuickVarCostPrice(p.cost_price || '');
    setQuickVarSellingPrice(p.selling_price || '');
    setQuickVarStock(12);
    setQuickVarUnit(p.unit || 'pcs');
  };

  const handleSelectQuickVarOption = (opt: string, unitForOption?: string) => {
    if (!quickVarProduct) return;
    const baseClean = cleanBaseProductName(quickVarProduct.name);
    setQuickVarLabel(opt);
    setQuickVarName(`${baseClean} ${opt}`);
    setQuickVarSku(generateVariantSku(baseClean, opt));
    if (unitForOption) {
      setQuickVarUnit(unitForOption);
    }
  };

  const handleApplyCustomQuickVarLabel = () => {
    if (!quickVarProduct || !quickVarCustomLabel.trim()) return;
    const opt = quickVarCustomLabel.trim();
    const baseClean = cleanBaseProductName(quickVarProduct.name);
    setQuickVarLabel(opt);
    setQuickVarName(`${baseClean} ${opt}`);
    setQuickVarSku(generateVariantSku(baseClean, opt));
    setQuickVarCustomLabel('');
  };

  const handleSetQuickVarStock = (qty: number) => {
    setQuickVarStock(qty);
  };

  const handleSaveQuickVariation = async (keepOpenForNext: boolean) => {
    if (!quickVarProduct) return;
    if (!quickVarName.trim()) {
      alert('Please provide a name for this variation (e.g. Olpers Milk 250ml).');
      return;
    }
    if (quickVarSellingPrice === '' || Number(quickVarSellingPrice) < 0) {
      alert('Please enter a valid selling price.');
      return;
    }

    setQuickVarSubmitting(true);
    try {
      const payload: NewProductPayload = {
        name: quickVarName.trim(),
        sku: quickVarSku.trim() || generateVariantSku(quickVarProduct.name, quickVarLabel || 'VAR'),
        barcode: quickVarBarcode.trim() || undefined,
        category_id: quickVarProduct.category_id || undefined,
        supplier_id: quickVarProduct.supplier_id || undefined,
        unit: quickVarUnit || quickVarProduct.unit || 'pcs',
        cost_price: Number(quickVarCostPrice) || 0,
        selling_price: Number(quickVarSellingPrice) || 0,
        initial_stock: Math.max(0, Number(quickVarStock) || 0),
        min_stock_level: quickVarProduct.min_stock_level || 10,
        max_stock_level: 100,
        tax_rate: quickVarProduct.tax_rate || 0,
        allow_negative_stock: false,
        expiry_tracked: quickVarProduct.expiry_tracked || false,
        is_active: true
      };

      await addProduct(payload);
      await loadCatalog();

      const createdName = payload.name;
      const createdStock = payload.initial_stock;

      setQuickVarToast(`Variation "${createdName}" successfully added with ${createdStock} units in stock!`);
      setTimeout(() => setQuickVarToast(null), 5000);

      if (keepOpenForNext) {
        const baseClean = cleanBaseProductName(quickVarProduct.name);
        setQuickVarLabel('');
        setQuickVarName(`${baseClean}`);
        setQuickVarSku('');
        setQuickVarBarcode(generateRandomBarcode());
        setQuickVarStock(12);
      } else {
        setQuickVarProduct(null);
      }
    } catch (err: any) {
      console.error('Failed to create variation:', err);
      alert(err.message || 'Failed to create variation.');
    } finally {
      setQuickVarSubmitting(false);
    }
  };

  // Quick Add Stock Handlers for Existing Products
  const openQuickAddStock = (p: ProductWithStock) => {
    setQuickAddStockProduct(p);
    setQuickAddQty(10);
    setQuickAddReason('Restock / Quick add');
  };

  const handleConfirmQuickAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddStockProduct) return;
    const qty = Number(quickAddQty);
    if (!qty || qty <= 0) {
      alert('Please enter a valid positive quantity to add.');
      return;
    }

    setQuickAddSubmitting(true);
    try {
      await adjustStock({
        type: 'manual',
        reason: quickAddReason.trim() || 'Quick stock restock',
        items: [
          {
            product_id: quickAddStockProduct.id,
            quantity_change: qty
          }
        ]
      });
      setQuickAddStockProduct(null);
    } catch (err: any) {
      alert(err.message || 'Failed to add stock');
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const handleDuplicateProduct = (p: ProductWithStock) => {
    setNewProduct({
      sku: `${p.sku}-COPY`,
      barcode: '',
      name: `${p.name} (Copy)`,
      category_id: p.category_id || '',
      supplier_id: p.supplier_id || '',
      unit: p.unit || 'pcs',
      cost_price: p.cost_price || 0,
      selling_price: p.selling_price || 0,
      initial_stock: 0,
      min_stock_level: p.min_stock_level || 10,
      max_stock_level: p.max_stock_level || 100,
      tax_rate: p.tax_rate || 0,
      allow_negative_stock: p.allow_negative_stock || false,
      expiry_tracked: p.expiry_tracked || false,
      is_active: true
    });
    setIsAddModalOpen(true);
  };

  // Bulk Add Handlers
  const handleBulkRowChange = (index: number, field: keyof BulkRow, value: any) => {
    setBulkRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddBulkRow = () => {
    setBulkRows(prev => [...prev, createEmptyBulkRow()]);
  };

  const handleRemoveBulkRow = (index: number) => {
    if (bulkRows.length <= 1) {
      setBulkRows([createEmptyBulkRow()]);
      return;
    }
    setBulkRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoGenerateSKUs = () => {
    setBulkRows(prev =>
      prev.map((row, idx) => {
        if (!row.sku.trim() && row.name.trim()) {
          const prefix = row.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'SKU';
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
          return {
            ...row,
            sku: `${prefix}-${rand}-${idx + 1}`
          };
        }
        return row;
      })
    );
  };

  const handleApplyCategoryToAll = (catId: string) => {
    if (!catId) return;
    setBulkRows(prev => prev.map(row => ({ ...row, category_id: catId })));
  };

  const handleApplySupplierToAll = (supId: string) => {
    if (!supId) return;
    setBulkRows(prev => prev.map(row => ({ ...row, supplier_id: supId })));
  };

  const handleApplyPastedData = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.trim().split(/\r?\n/);
    const newRows: BulkRow[] = [];

    lines.forEach((line) => {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length > 0 && parts[0]?.trim()) {
        const name = parts[0]?.trim() || '';
        const sku = parts[1]?.trim() || '';
        const barcode = parts[2]?.trim() || '';
        const costStr = parts[3] ? parts[3].replace(/[^0-9.]/g, '') : '';
        const sellStr = parts[4] ? parts[4].replace(/[^0-9.]/g, '') : '';
        const stockStr = parts[5] ? parts[5].replace(/[^0-9.]/g, '') : '';

        const costPrice = costStr !== '' ? Number(costStr) : '';
        const sellPrice = sellStr !== '' ? Number(sellStr) : '';
        const stock = stockStr !== '' ? Number(stockStr) : 0;

        newRows.push({
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name,
          sku,
          barcode,
          category_id: categories.length > 0 ? categories[0].id : '',
          supplier_id: suppliers.length > 0 ? suppliers[0].id : '',
          cost_price: isNaN(costPrice as number) ? '' : costPrice,
          selling_price: isNaN(sellPrice as number) ? '' : sellPrice,
          initial_stock: isNaN(stock as number) ? 0 : stock,
          unit: 'pcs',
          min_stock_level: 10
        });
      }
    });

    if (newRows.length > 0) {
      setBulkRows(newRows);
      setPasteText('');
      setShowPasteArea(false);
    }
  };

  const handleSaveBulkProducts = async () => {
    const activeRows = bulkRows.filter(
      r => r.name.trim() !== '' || r.sku.trim() !== '' || r.barcode.trim() !== ''
    );

    if (activeRows.length === 0) {
      alert('Please fill in at least one product row with a Name.');
      return;
    }

    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      if (!row.name.trim()) {
        alert(`Row #${i + 1} is missing a Product Name.`);
        return;
      }
      if (!row.category_id) {
        alert(`Row #${i + 1} (${row.name}) is missing a Category.`);
        return;
      }
      if (row.selling_price === '' || Number(row.selling_price) < 0) {
        alert(`Row #${i + 1} (${row.name}) must have a valid selling price.`);
        return;
      }
    }

    setBulkSubmitting(true);
    try {
      const payload = activeRows.map((row, idx) => {
        const sku = row.sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
        return {
          name: row.name.trim(),
          sku,
          barcode: row.barcode.trim() || undefined,
          category_id: row.category_id,
          supplier_id: row.supplier_id || undefined,
          unit: row.unit || 'pcs',
          cost_price: Number(row.cost_price) || 0,
          selling_price: Number(row.selling_price) || 0,
          min_stock_level: Number(row.min_stock_level) || 10,
          max_stock_level: 100,
          tax_rate: 0,
          allow_negative_stock: false,
          expiry_tracked: false,
          is_active: true,
          initial_stock: Math.max(0, Number(row.initial_stock) || 0)
        };
      });

      const res = await addProductsBulk(payload);
      setIsBulkModalOpen(false);
      setBulkRows([
        createEmptyBulkRow(),
        createEmptyBulkRow(),
        createEmptyBulkRow(),
        createEmptyBulkRow(),
        createEmptyBulkRow()
      ]);
      alert(`Successfully added ${res.count} products to the catalog with initial stock!`);
    } catch (err: any) {
      console.error('Bulk add error:', err);
      alert(err.message || 'Failed to bulk add products');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdjustProduct || adjustData.quantity_change === 0) return;

    try {
      await adjustStock({
        type: adjustData.type,
        reason: adjustData.reason || `Quick ${adjustData.type} adjustment from catalog`,
        items: [
          {
            product_id: quickAdjustProduct.id,
            quantity_change: Number(adjustData.quantity_change)
          }
        ]
      });
      setQuickAdjustProduct(null);
      setAdjustData({ type: 'manual', quantity_change: 0, reason: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  return (
    <div className="space-y-5 pb-10">
      
      {/* Quick Variation Success Toast Notification */}
      {quickVarToast && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-xs">{quickVarToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setQuickVarToast(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isUserAdmin ? 'Product Catalog' : 'Product List'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage store products, prices, and stock balances.
          </p>
        </div>

        {isUserAdmin && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setBulkRows([
                  createEmptyBulkRow(),
                  createEmptyBulkRow(),
                  createEmptyBulkRow(),
                  createEmptyBulkRow(),
                  createEmptyBulkRow()
                ]);
                setShowPasteArea(false);
                setPasteText('');
                setIsBulkModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow"
              title="Add multiple products in a spreadsheet grid"
            >
              <PlusCircle className="w-4 h-4 text-emerald-200" />
              <span>Quick Bulk Add</span>
            </button>

            <button
              onClick={() => {
                setPresetGroups(getVariationPresets());
                setAddMode('variations');
                setIsAddModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-sm transition-all cursor-pointer hover:shadow"
              title="Add a product with multiple sizes, weights, or packaging variations"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>+ Variations</span>
            </button>

            <button
              onClick={() => {
                setPresetGroups(getVariationPresets());
                setAddMode('single');
                setIsAddModalOpen(true);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-mart-200" />
              <span>Add New Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Product Name, SKU, or Scan Barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-slate-700"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Filter Badges */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
            {(['all', 'in_stock', 'low_stock', 'out_of_stock'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStockFilter(filter)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  stockFilter === filter
                    ? 'bg-white text-mart-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter.replace('_', ' ')}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Category</th>
                {isUserAdmin && <th className="py-3 px-3 text-right">Cost Price</th>}
                <th className="py-3 px-3 text-right">Selling Price</th>
                {isUserAdmin && <th className="py-3 px-3 text-right">Margin %</th>}
                <th className="py-3 px-4 text-center">Stock Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isUserAdmin ? 8 : 6} className="py-12 text-center text-slate-400">
                    Loading catalog items...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isUserAdmin ? 8 : 6} className="py-12 text-center text-slate-400">
                    No products match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const margin = p.selling_price > 0
                    ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100)
                    : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{p.sku}</span>
                          {p.expiry_tracked && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-sans">
                              Perishable
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {p.barcode || '-'}
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {p.category_name || '-'}
                      </td>

                      {isUserAdmin && (
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          Rs. {p.cost_price.toLocaleString()}
                        </td>
                      )}

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {p.selling_price.toLocaleString()}
                      </td>

                      {isUserAdmin && (
                        <td className="py-3 px-3 text-right font-mono font-semibold text-orange-700">
                          {margin}%
                        </td>
                      )}

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          {isUserAdmin ? (
                            <button
                              type="button"
                              onClick={() => openQuickAddStock(p)}
                              className="group inline-flex items-center gap-1.5 cursor-pointer"
                              title="Click to Quick Add Stock"
                            >
                              <span
                                className={`px-2.5 py-1 rounded-full font-bold text-xs transition-transform group-hover:scale-105 ${
                                  p.stock_status === 'out_of_stock'
                                    ? 'bg-rose-100 text-rose-800'
                                    : p.stock_status === 'low_stock'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {p.current_stock} {p.unit}
                              </span>
                              <span className="p-0.5 rounded-full bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                                <Plus className="w-3 h-3" />
                              </span>
                            </button>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                                p.stock_status === 'out_of_stock'
                                  ? 'bg-rose-100 text-rose-800'
                                  : p.stock_status === 'low_stock'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {p.current_stock} {p.unit}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Min: {p.min_stock_level}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isUserAdmin && (
                            <>
                              <button
                                onClick={() => openQuickAddStock(p)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                                title="Quick Add Stock for this product"
                              >
                                <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Add Stock</span>
                              </button>

                              <button
                                onClick={() => openQuickAddVariation(p)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                                title="Quick Add Size / Packaging Variation for this product"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>+ Variation</span>
                              </button>

                              <button
                                onClick={() => handleDuplicateProduct(p)}
                                className="p-2 rounded-full text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-all cursor-pointer"
                                title="Duplicate / Clone Product"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setQuickAdjustProduct(p);
                                  setAdjustData({ type: 'manual', quantity_change: 0, reason: '' });
                                }}
                                className="p-2 rounded-full text-slate-500 hover:text-mart-900 hover:bg-mart-50 border border-slate-200 transition-all cursor-pointer"
                                title="Stock Adjustments (Damage / Expiry / Count)"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setPrintLabelProduct(p)}
                            className="p-2 rounded-full text-slate-500 hover:text-mart-900 hover:bg-mart-50 border border-slate-200 transition-all cursor-pointer"
                            title="Print Shelf Tag"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PRODUCT MODAL (Single Product or Variations) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size={addMode === 'variations' ? '6xl' : '2xl'}
        icon={addMode === 'variations' ? <Sparkles className="w-5 h-5 text-indigo-600" /> : <Boxes className="w-5 h-5 text-mart-900" />}
        title={addMode === 'variations' ? "Add Product Variations" : "Add New Product"}
      >
        {/* Mode Selector Tabs */}
        <div className="flex items-center border-b border-slate-200 mb-5 gap-2">
          <button
            type="button"
            onClick={() => setAddMode('single')}
            className={`pb-3 px-4 font-semibold text-xs transition-colors border-b-2 flex items-center space-x-2 cursor-pointer ${
              addMode === 'single'
                ? 'border-mart-900 text-mart-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Single Product</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPresetGroups(getVariationPresets());
              setAddMode('variations');
            }}
            className={`pb-3 px-4 font-semibold text-xs transition-colors border-b-2 flex items-center space-x-2 cursor-pointer ${
              addMode === 'variations'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Multiple Sizes / Variations</span>
            {variationRows.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {variationRows.length}
              </span>
            )}
          </button>
        </div>

        {addMode === 'single' ? (
          <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Olpers Milk 1L"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Code (SKU) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DAI-MLK-002"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono text-sm bg-slate-50/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Barcode</label>
                <input
                  type="text"
                  placeholder="Scan or enter barcode"
                  value={newProduct.barcode}
                  onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono text-sm bg-slate-50/50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                <select
                  required
                  value={newProduct.category_id}
                  onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-sm"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Supplier</label>
                <select
                  value={newProduct.supplier_id}
                  onChange={(e) => setNewProduct({ ...newProduct, supplier_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-sm"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Cost Price (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProduct.cost_price}
                  onChange={(e) => setNewProduct({ ...newProduct, cost_price: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono text-sm bg-slate-50/50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sale Price (Rs.) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newProduct.selling_price}
                  onChange={(e) => setNewProduct({ ...newProduct, selling_price: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono font-bold text-sm bg-slate-50/50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                <select
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 bg-slate-50/50 text-sm"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="litres">Litres</option>
                  <option value="packs">Packs</option>
                  <option value="boxes">Boxes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Low Stock Alert</label>
                <input
                  type="number"
                  min="0"
                  value={newProduct.min_stock_level}
                  onChange={(e) => setNewProduct({ ...newProduct, min_stock_level: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-mart-800/20 focus:border-mart-800 font-mono text-sm bg-slate-50/50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Starting Stock
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newProduct.initial_stock}
                  onChange={(e) => setNewProduct({ ...newProduct, initial_stock: Math.max(0, Number(e.target.value)) })}
                  className="w-full px-4 py-2.5 rounded-full border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono text-sm bg-emerald-50/30 font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center space-x-6 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newProduct.expiry_tracked}
                  onChange={(e) => setNewProduct({ ...newProduct, expiry_tracked: e.target.checked })}
                  className="rounded text-mart-800 focus:ring-mart-800"
                />
                <span className="text-slate-700 font-medium text-xs">Expires / Perishable</span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-full bg-mart-900 text-white hover:bg-mart-800 font-semibold shadow-sm cursor-pointer transition-all hover:shadow-mart"
              >
                Save Product
              </button>
            </div>

          </form>
        ) : (
          /* VARIATION BUILDER FORM */
          <form onSubmit={handleCreateVariations} className="space-y-4 text-xs">
            {/* Card 1: Base Product Information */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-xs flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>Base Details</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="font-semibold text-slate-700 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Olpers Pure Milk, Shan Biryani Masala"
                    value={baseVariantName}
                    onChange={(e) => setBaseVariantName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                  <select
                    required
                    value={baseVariantCategory}
                    onChange={(e) => setBaseVariantCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white text-xs"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Supplier</label>
                  <select
                    value={baseVariantSupplier}
                    onChange={(e) => setBaseVariantSupplier(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white text-xs"
                  >
                    <option value="">Select Supplier (Optional)</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={baseVariantUnit}
                    onChange={(e) => setBaseVariantUnit(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 bg-white text-xs"
                  >
                    <option value="litres">Litres / ml</option>
                    <option value="kg">Kilograms / g</option>
                    <option value="packs">Packs</option>
                    <option value="boxes">Boxes / Cartons</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={baseVariantCost}
                    onChange={(e) => setBaseVariantCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sale Price (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={baseVariantPrice}
                    onChange={(e) => setBaseVariantPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono text-xs bg-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={baseVariantExpiry}
                      onChange={(e) => setBaseVariantExpiry(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 font-medium text-xs">Expires / Perishable</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Card 2: Size / Variation Selection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800 text-xs flex items-center space-x-2">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <span>Sizes & Packs</span>
                </div>
                
                {/* Preset group tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {presetGroups.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => handleSelectPresetGroup(grp.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedPresetGroup === grp.id
                          ? 'bg-white text-indigo-700 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {grp.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Options Chips & Custom Input */}
              {(() => {
                const activeGrp = presetGroups.find(g => g.id === selectedPresetGroup);
                if (!activeGrp) return null;
                return (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">Sizes:</span>
                      {activeGrp.options.map((opt) => {
                        const isAdded = variationRows.some(r => r.variantLabel.toLowerCase() === opt.toLowerCase());
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleTogglePresetVariation(opt, activeGrp.unit)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title={isAdded ? 'Remove' : 'Add'}
                          >
                            {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{opt}</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={handleAddAllPresetVariations}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Add All</span>
                      </button>
                    </div>

                    {/* Custom variation entry */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-500">Custom Size:</span>
                      <input
                        type="text"
                        placeholder="e.g. 750ml, 400g, Family Pack"
                        value={customVariantText}
                        onChange={(e) => setCustomVariantText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomVariation();
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomVariation}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Card 3: Generated Variations Matrix Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Prices & Stock</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-200">
                    {variationRows.length} {variationRows.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {variationRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncVariantNames}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Update item names"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>Sync Names</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyBasePricesToAll}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Fill all rows with base price"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Fill Prices</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAutoGenerateVariantBarcodes}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                      title="Generate barcodes"
                    >
                      <Barcode className="w-3 h-3 text-slate-400" />
                      <span>Barcodes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVariationRows([])}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  </div>
                )}
              </div>

              {variationRows.length === 0 ? (
                <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <PackagePlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No sizes added yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click any size preset above to add items.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Item Name *</th>
                        <th className="py-2.5 px-3">Item Code *</th>
                        <th className="py-2.5 px-3">Barcode</th>
                        <th className="py-2.5 px-3 text-right">Cost (Rs.)</th>
                        <th className="py-2.5 px-3 text-right">Sale Price (Rs.) *</th>
                        <th className="py-2.5 px-3 text-center">Starting Stock</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {variationRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 font-semibold text-indigo-700 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 font-mono text-[11px]">
                              {row.variantLabel}
                            </span>
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              value={row.name}
                              onChange={(e) => handleUpdateVariationRow(row.id, { name: e.target.value })}
                              placeholder="e.g. Olpers Milk 250ml"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-xs"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              value={row.sku}
                              onChange={(e) => handleUpdateVariationRow(row.id, { sku: e.target.value })}
                              placeholder="Code"
                              className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <div className="flex items-center space-x-1">
                              <input
                                type="text"
                                value={row.barcode}
                                onChange={(e) => handleUpdateVariationRow(row.id, { barcode: e.target.value })}
                                placeholder="Barcode"
                                className="w-32 px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateVariationRow(row.id, { barcode: generateRandomBarcode() })}
                                title="Generate barcode"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={row.cost_price}
                              onChange={(e) => handleUpdateVariationRow(row.id, { cost_price: e.target.value === '' ? '' : Number(e.target.value) })}
                              className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-right text-xs"
                            />
                          </td>

                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={row.selling_price}
                              onChange={(e) => handleUpdateVariationRow(row.id, { selling_price: e.target.value === '' ? '' : Number(e.target.value) })}
                              className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-900 text-right text-xs bg-slate-50/50"
                            />
                          </td>

                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={row.initial_stock}
                              onChange={(e) => handleUpdateVariationRow(row.id, { initial_stock: Math.max(0, Number(e.target.value)) })}
                              className="w-20 px-2 py-1.5 rounded-lg border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-emerald-800 text-center text-xs bg-emerald-50/40"
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariationRow(row.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {variationRows.length > 0 && (
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 px-1">
                  <span>
                    Total Stock: <strong className="text-slate-800 font-mono">{variationRows.reduce((acc, r) => acc + (Number(r.initial_stock) || 0), 0)} units</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer / Save */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {variationRows.length === 0
                  ? 'Add at least 1 size to proceed'
                  : `${variationRows.length} items ready`}
              </span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={variationRows.length === 0 || variationSubmitting}
                  className="px-6 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-semibold shadow-sm cursor-pointer transition-all hover:shadow flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {variationSubmitting
                      ? 'Saving...'
                      : `Save ${variationRows.length} Variations`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* QUICK BULK ADD MODAL */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        size="6xl"
        icon={<Layers className="w-5 h-5 text-emerald-700" />}
        title="Quick Bulk Add Products"
      >
        <div className="space-y-4 text-xs">
          
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoGenerateSKUs}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                title="Fill empty codes with generated numbers"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Auto Item Codes</span>
              </button>

              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-slate-500 font-medium">Category:</span>
                <select
                  onChange={(e) => handleApplyCategoryToAll(e.target.value)}
                  defaultValue=""
                  className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Apply to All...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {suppliers.length > 0 && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <span className="text-slate-500 font-medium">Supplier:</span>
                  <select
                    onChange={(e) => handleApplySupplierToAll(e.target.value)}
                    defaultValue=""
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Apply to All...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPasteArea(!showPasteArea)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-slate-600" />
              <span>{showPasteArea ? 'Hide Paste' : 'Paste from Excel'}</span>
            </button>
          </div>

          {/* Paste from Excel Dropdown Area */}
          {showPasteArea && (
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                  <ClipboardPaste className="w-4 h-4 text-amber-700" />
                  Paste Table Data
                </span>
                <span className="text-[11px] text-slate-500">
                  Order: <strong>Name | Code | Barcode | Cost | Price | Stock</strong>
                </span>
              </div>
              <textarea
                rows={3}
                placeholder="Copy rows from Excel or Google Sheets and paste (Ctrl+V) here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteArea(false)}
                  className="px-3 py-1 text-slate-500 hover:text-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyPastedData}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold shadow-xs"
                >
                  Populate Table
                </button>
              </div>
            </div>
          )}

          {/* Multi-Row Entry Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center text-slate-400">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Product Name *</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Item Code *</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Barcode</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Category *</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Supplier</th>
                    <th className="py-2.5 px-3 min-w-[100px] text-right">Cost (Rs.)</th>
                    <th className="py-2.5 px-3 min-w-[110px] text-right">Sale Price (Rs.) *</th>
                    <th className="py-2.5 px-3 min-w-[105px] text-right bg-emerald-50 text-emerald-900">Starting Stock</th>
                    <th className="py-2.5 px-3 min-w-[90px]">Unit</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bulkRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="e.g. Olpers 1L"
                          value={row.name}
                          onChange={(e) => handleBulkRowChange(idx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="Auto / SKU"
                          value={row.sku}
                          onChange={(e) => handleBulkRowChange(idx, 'sku', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="Scan / code"
                          value={row.barcode}
                          onChange={(e) => handleBulkRowChange(idx, 'barcode', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <select
                          value={row.category_id}
                          onChange={(e) => handleBulkRowChange(idx, 'category_id', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-white"
                        >
                          <option value="">Select...</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2 px-2">
                        <select
                          value={row.supplier_id}
                          onChange={(e) => handleBulkRowChange(idx, 'supplier_id', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-white"
                        >
                          <option value="">None</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={row.cost_price}
                          onChange={(e) => handleBulkRowChange(idx, 'cost_price', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-right rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={row.selling_price}
                          onChange={(e) => handleBulkRowChange(idx, 'selling_price', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-right rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-slate-900 text-xs"
                        />
                      </td>

                      <td className="py-2 px-2 bg-emerald-50/50">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={row.initial_stock}
                          onChange={(e) => handleBulkRowChange(idx, 'initial_stock', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          className="w-full px-2.5 py-1.5 text-right rounded-lg border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-emerald-900 text-xs bg-white"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <select
                          value={row.unit}
                          onChange={(e) => handleBulkRowChange(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-white"
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="litres">ltr</option>
                          <option value="packs">packs</option>
                          <option value="boxes">boxes</option>
                        </select>
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBulkRow(idx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAddBulkRow}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-full border border-dashed border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 font-semibold cursor-pointer transition-all self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Row</span>
            </button>

            <div className="flex items-center justify-end space-x-3">
              <span className="text-slate-400 text-xs">
                {bulkRows.filter(r => r.name.trim()).length} of {bulkRows.length} rows ready
              </span>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSubmitting}
                onClick={handleSaveBulkProducts}
                className="px-6 py-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-sm cursor-pointer transition-all hover:shadow-md disabled:opacity-50"
              >
                {bulkSubmitting ? 'Saving...' : 'Save Products'}
              </button>
            </div>
          </div>

        </div>
      </Modal>

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      <Modal
        isOpen={!!quickAdjustProduct}
        onClose={() => setQuickAdjustProduct(null)}
        size="md"
        icon={<SlidersHorizontal className="w-5 h-5 text-mart-900" />}
        title="Adjust Stock"
        subtitle={quickAdjustProduct?.name}
      >
        {quickAdjustProduct && (
          <form onSubmit={handleQuickAdjust} className="space-y-4 text-xs">
            
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-500 font-medium">Current Stock:</span>
              <span className="font-extrabold text-slate-900 text-sm font-mono">
                {quickAdjustProduct.current_stock} {quickAdjustProduct.unit}
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Adjustment Type</label>
              <select
                value={adjustData.type}
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value as AdjustmentType })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-medium bg-slate-50/50 text-sm"
              >
                <option value="damage">Damage (Deduction)</option>
                <option value="expiry">Expiry (Deduction)</option>
                <option value="manual">Manual Adjustment</option>
                <option value="stock_count">Stock Count</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Quantity Change (+ or -)
              </label>
              <input
                type="number"
                required
                value={adjustData.quantity_change}
                onChange={(e) => setAdjustData({ ...adjustData, quantity_change: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 font-mono text-sm font-bold bg-slate-50/50"
              />
              <div className="mt-1.5 text-[11px] text-slate-500 flex justify-between px-2">
                <span>New Stock:</span>
                <strong className="text-mart-900 font-mono font-bold">
                  {quickAdjustProduct.current_stock + Number(adjustData.quantity_change)} {quickAdjustProduct.unit}
                </strong>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Reason *</label>
              <input
                type="text"
                required
                placeholder="e.g. Damaged, counted, etc."
                value={adjustData.reason}
                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-slate-200 bg-slate-50/50 text-sm"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setQuickAdjustProduct(null)}
                className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-mart-900 text-white hover:bg-mart-800 font-semibold cursor-pointer transition-all shadow-sm hover:shadow-mart"
              >
                Update Stock
              </button>
            </div>

          </form>
        )}
      </Modal>

      {/* PRINT SHELF LABEL MODAL */}
      <Modal
        isOpen={!!printLabelProduct}
        onClose={() => setPrintLabelProduct(null)}
        size="sm"
        icon={<Printer className="w-5 h-5 text-mart-900" />}
        title="Shelf Label Preview"
      >
        {printLabelProduct && (
          <div className="flex flex-col items-center justify-center">
            <div className="w-full border-2 border-dashed border-slate-300 p-4 rounded-2xl bg-white text-center shadow-xs">
              <div className="text-[10px] uppercase font-black text-mart-900 tracking-widest mb-1">
                A-MART SUPERMARKET
              </div>
              <div className="font-bold text-sm text-slate-900 line-clamp-2">
                {printLabelProduct.name}
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
                Rs. {printLabelProduct.selling_price.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Unit: {printLabelProduct.unit} | SKU: {printLabelProduct.sku}
              </div>

              {/* Simulated Barcode */}
              <div className="mt-3 flex flex-col items-center">
                <div className="flex items-center justify-center space-x-0.5 h-10 w-44 bg-slate-900 p-1 rounded-lg">
                  <div className="w-1 bg-white h-full"></div>
                  <div className="w-0.5 bg-white h-full"></div>
                  <div className="w-1.5 bg-white h-full"></div>
                  <div className="w-0.5 bg-white h-full"></div>
                  <div className="w-1.5 bg-white h-full"></div>
                  <div className="w-2 bg-white h-full"></div>
                  <div className="w-0.5 bg-white h-full"></div>
                  <div className="w-1.5 bg-white h-full"></div>
                  <div className="w-1 bg-white h-full"></div>
                </div>
                <span className="font-mono text-[11px] font-bold tracking-widest text-slate-700 mt-1">
                  {printLabelProduct.barcode || '896400000000'}
                </span>
              </div>
            </div>

            <div className="mt-5 w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrintLabelProduct(null)}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 rounded-full bg-mart-900 text-white text-xs font-semibold hover:bg-mart-800 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm hover:shadow-mart"
              >
                <Printer className="w-4 h-4 text-mart-200" />
                <span>Print Label</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* QUICK ADD STOCK MODAL (FOR EXISTING PRODUCT) */}
      <Modal
        isOpen={!!quickAddStockProduct}
        onClose={() => setQuickAddStockProduct(null)}
        size="md"
        icon={<PackagePlus className="w-5 h-5 text-emerald-600" />}
        title="Quick Add Stock"
        subtitle={quickAddStockProduct?.name}
      >
        {quickAddStockProduct && (
          <form onSubmit={handleConfirmQuickAddStock} className="space-y-4 text-xs">
            {/* Current Balance Display */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Current Stock</span>
                <span className="font-extrabold text-slate-900 text-base font-mono">
                  {quickAddStockProduct.current_stock} {quickAddStockProduct.unit}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Item Code</span>
                <span className="font-mono text-slate-700 font-semibold">{quickAddStockProduct.sku}</span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Quick Add:
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 5, 10, 25, 50, 100].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuickAddQty((prev) => (Number(prev) || 0) + num)}
                    className="py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 font-mono font-bold text-xs transition-colors cursor-pointer"
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Quantity to Add *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  placeholder="0"
                  value={quickAddQty}
                  onChange={(e) => setQuickAddQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono text-base font-bold bg-emerald-50/20 text-slate-900"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-slate-400">
                  {quickAddStockProduct.unit}
                </span>
              </div>
            </div>

            {/* Realtime Projected Stock Preview */}
            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-emerald-900">
              <span className="font-medium text-xs">New Total Stock:</span>
              <span className="font-extrabold text-sm font-mono">
                {quickAddStockProduct.current_stock + (Number(quickAddQty) || 0)} {quickAddStockProduct.unit}
                {Number(quickAddQty) > 0 && (
                  <span className="text-emerald-600 text-xs font-normal ml-1">
                    (+{Number(quickAddQty)})
                  </span>
                )}
              </span>
            </div>

            {/* Note */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Received shipment"
                value={quickAddReason}
                onChange={(e) => setQuickAddReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Submit & Cancel */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setQuickAddStockProduct(null)}
                className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickAddSubmitting || !quickAddQty || Number(quickAddQty) <= 0}
                className="px-5 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 font-semibold cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {quickAddSubmitting ? 'Updating...' : `Add Stock (+${quickAddQty || 0})`}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* QUICK ADD VARIATION MODAL (FOR NON-TECH USERS) */}
      <Modal
        isOpen={!!quickVarProduct}
        onClose={() => setQuickVarProduct(null)}
        size="2xl"
        icon={<Sparkles className="w-5 h-5 text-indigo-600" />}
        title={quickVarProduct ? `Quick Add Variation for "${cleanBaseProductName(quickVarProduct.name)}"` : 'Quick Add Variation'}
      >
        {quickVarProduct && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveQuickVariation(false);
            }}
            className="space-y-4 text-xs"
          >
            {/* Base Product Info Pill */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-500">Base:</span>
                <span className="font-bold text-slate-900 text-xs">{quickVarProduct.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-medium">
                  {quickVarProduct.category_name || 'General'}
                </span>
                {quickVarProduct.supplier_name && (
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-medium">
                    {quickVarProduct.supplier_name}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold font-mono">
                  Price: Rs. {quickVarProduct.selling_price}
                </span>
              </div>
            </div>

            {/* Select Size Preset */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800 text-xs">Select Size:</span>

                {/* Preset group tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
                  {presetGroups.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => {
                        setQuickVarPresetGroup(grp.id);
                        setQuickVarUnit(grp.unit);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        quickVarPresetGroup === grp.id
                          ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {grp.name.split('/')[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chips */}
              {(() => {
                const activeGrp = presetGroups.find(g => g.id === quickVarPresetGroup);
                if (!activeGrp) return null;
                return (
                  <div className="space-y-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeGrp.options.map((opt) => {
                        const isSelected = quickVarLabel.toLowerCase() === opt.toLowerCase();
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelectQuickVarOption(opt, activeGrp.unit)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                            }`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom variation input */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-medium text-slate-500">Custom:</span>
                      <input
                        type="text"
                        placeholder="e.g. 750ml, Family Pack"
                        value={quickVarCustomLabel}
                        onChange={(e) => setQuickVarCustomLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyCustomQuickVarLabel();
                          }
                        }}
                        className="px-3 py-1 rounded-xl border border-slate-200 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCustomQuickVarLabel}
                        className="px-3 py-1 rounded-xl bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Details & Price */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <span className="font-bold text-slate-800 text-xs block">Details & Price:</span>

              {/* Product Name */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={quickVarName}
                  onChange={(e) => setQuickVarName(e.target.value)}
                  placeholder="e.g. Olpers Milk 250ml"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-bold text-slate-900 text-xs bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* SKU */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Item Code (SKU)</label>
                  <input
                    type="text"
                    required
                    value={quickVarSku}
                    onChange={(e) => setQuickVarSku(e.target.value)}
                    placeholder="Auto SKU"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono text-xs bg-slate-50/50"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Barcode</label>
                    <button
                      type="button"
                      onClick={() => setQuickVarBarcode(generateRandomBarcode())}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center space-x-0.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={quickVarBarcode}
                    onChange={(e) => setQuickVarBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono text-xs bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Cost Price */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={quickVarCostPrice}
                    onChange={(e) => setQuickVarCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono text-xs"
                  />
                </div>

                {/* Selling Price */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sale Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={quickVarSellingPrice}
                    onChange={(e) => setQuickVarSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 font-mono font-bold text-slate-900 text-xs bg-indigo-50/20"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={quickVarUnit}
                    onChange={(e) => setQuickVarUnit(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="litres">Litres / ml</option>
                    <option value="kg">Kilograms / g</option>
                    <option value="packs">Packs</option>
                    <option value="boxes">Boxes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Starting Stock */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
              <span className="font-bold text-emerald-900 text-xs block">Starting Stock:</span>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={quickVarStock}
                  onChange={(e) => setQuickVarStock(Math.max(0, Number(e.target.value)))}
                  className="w-32 px-3.5 py-2 rounded-xl border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono font-bold text-emerald-900 text-sm bg-white"
                />

                {/* Preset Stock Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[0, 6, 12, 24, 48, 100].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => handleSetQuickVarStock(qty)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        quickVarStock === qty
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {qty === 0 ? '0' : qty === 12 ? '12 (1 Dozen)' : qty === 24 ? '24 (1 Carton)' : `${qty}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setQuickVarProduct(null)}
                className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={quickVarSubmitting}
                  onClick={() => handleSaveQuickVariation(true)}
                  className="px-4 py-2 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer transition-colors"
                  title="Save and add another size"
                >
                  Save & Add Another
                </button>

                <button
                  type="submit"
                  disabled={quickVarSubmitting}
                  className="px-5 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 font-semibold shadow-sm cursor-pointer transition-all hover:shadow flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{quickVarSubmitting ? 'Saving...' : 'Save Variation'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};
