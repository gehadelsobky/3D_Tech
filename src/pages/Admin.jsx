import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';
import { useGiftSettings } from '../context/GiftSettingsContext';
import { categories } from '../data/products';

const emptyProduct = {
  name: '',
  category: 'usb',
  images: [''],
  description: '',
  features: [''],
  brandingOptions: [''],
  moq: 50,
  leadTime: '7-10 business days',
  priceRange: '',
  priceMin: '',
  priceMax: '',
  leadDays: '',
  tags: [],
  notes: '',
};

// Build a reverse map: tag → list of gift types that use it
function buildTagGiftMap(giftTagMap) {
  const map = {};
  Object.entries(giftTagMap || {}).forEach(([giftType, tags]) => {
    tags.forEach((tag) => {
      if (!map[tag]) map[tag] = [];
      map[tag].push(giftType);
    });
  });
  return map;
}

function TagPicker({ form, setForm, settings, inputClass }) {
  const [customTag, setCustomTag] = useState('');

  const giftTags = useMemo(() => {
    if (!settings?.giftTagMap) return [];
    const allTags = Object.values(settings.giftTagMap).flat();
    return [...new Set(allTags)].sort();
  }, [settings]);

  const tagGiftMap = useMemo(() => buildTagGiftMap(settings?.giftTagMap), [settings]);

  const formTags = form.tags || [];
  const customTags = formTags.filter((t) => !giftTags.includes(t));

  const toggleTag = (tag) => {
    setForm((prev) => {
      const current = prev.tags || [];
      if (current.includes(tag)) {
        return { ...prev, tags: current.filter((t) => t !== tag) };
      }
      return { ...prev, tags: [...current, tag] };
    });
  };

  const addCustom = () => {
    const tag = customTag.trim().toLowerCase();
    if (tag && !formTags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...(prev.tags || []), tag] }));
    }
    setCustomTag('');
  };

  const removeCustom = (tag) => {
    setForm((prev) => ({ ...prev, tags: (prev.tags || []).filter((t) => t !== tag) }));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-2">Tags (Gift Finder)</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {giftTags.map((tag) => {
          const active = formTags.includes(tag);
          const usedIn = tagGiftMap[tag] || [];
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              title={usedIn.length ? `Used in: ${usedIn.join(', ')}` : ''}
              className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer border transition-colors ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-muted border-gray-200 hover:border-primary hover:text-primary'
              }`}
            >
              {tag}
              {usedIn.length > 0 && (
                <span className={`ml-1 text-[10px] ${active ? 'text-red-200' : 'text-text-muted/60'}`}>
                  ({usedIn.length})
                </span>
              )}
            </button>
          );
        })}
      </div>
      {giftTags.length > 0 && (
        <p className="text-[10px] text-text-muted mb-3">Click to toggle. Number shows how many gift types use this tag. Hover for details.</p>
      )}

      {/* Custom tags */}
      {customTags.length > 0 && (
        <div className="mb-2">
          <label className="block text-[10px] text-text-muted mb-1">Custom tags:</label>
          <div className="flex flex-wrap gap-1">
            {customTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-text text-xs rounded-full">
                {tag}
                <button type="button" onClick={() => removeCustom(tag)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm leading-none">&times;</button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          className={'flex-1 ' + inputClass}
          placeholder="Add custom tag..."
        />
        <button type="button" onClick={addCustom} className="px-3 py-2 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Add</button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { user, logout } = useAuth();
  const { settings, updateSettings } = useGiftSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Gift settings local state
  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // ---- Products Tab Handlers ----
  const startAdd = () => {
    setEditing('new');
    setForm({ ...emptyProduct, features: [''], brandingOptions: [''], images: [''], tags: [] });
  };

  const startEdit = (product) => {
    setEditing(product.id);
    setForm({
      ...product,
      priceMin: product.priceMin ?? '',
      priceMax: product.priceMax ?? '',
      leadDays: product.leadDays ?? '',
      tags: product.tags?.length ? product.tags : [],
    });
  };

  const cancel = () => {
    setEditing(null);
    setForm(null);
    setError('');
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field, index, value) => {
    setForm((prev) => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field, index) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const cleaned = {
        ...form,
        moq: Number(form.moq),
        priceMin: form.priceMin !== '' ? Number(form.priceMin) : null,
        priceMax: form.priceMax !== '' ? Number(form.priceMax) : null,
        leadDays: form.leadDays !== '' ? Number(form.leadDays) : null,
        features: form.features.filter((f) => f.trim()),
        brandingOptions: form.brandingOptions.filter((b) => b.trim()),
        images: form.images.filter((i) => i.trim()),
        tags: form.tags.filter((t) => t.trim()),
      };
      if (!cleaned.images.length) {
        cleaned.images = ['https://images.unsplash.com/photo-1586953208270-767889fa9b0e?w=600&h=400&fit=crop'];
      }
      if (editing === 'new') {
        await addProduct(cleaned);
      } else {
        await updateProduct(editing, cleaned);
      }
      cancel();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message || 'Failed to delete product');
    }
  };

  // ---- Gift Settings Tab Handlers ----
  const startEditSettings = () => {
    setSettingsForm(JSON.parse(JSON.stringify(settings)));
  };

  const cancelSettings = () => {
    setSettingsForm(null);
    setSettingsError('');
  };

  // Settings form helpers
  const updateSimpleList = (key, index, value) => {
    setSettingsForm((prev) => {
      const arr = [...prev[key]];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  };

  const addSimpleListItem = (key) => {
    setSettingsForm((prev) => ({ ...prev, [key]: [...prev[key], ''] }));
  };

  const removeSimpleListItem = (key, index) => {
    setSettingsForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const updateObjectList = (key, index, field, value) => {
    setSettingsForm((prev) => {
      const arr = [...prev[key]];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [key]: arr };
    });
  };

  const addObjectListItem = (key, defaultObj) => {
    setSettingsForm((prev) => ({ ...prev, [key]: [...prev[key], defaultObj] }));
  };

  const removeObjectListItem = (key, index) => {
    setSettingsForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const updateMapTags = (mapKey, name, tagIndex, value) => {
    setSettingsForm((prev) => {
      const map = { ...prev[mapKey] };
      const tags = [...(map[name] || [])];
      tags[tagIndex] = value;
      map[name] = tags;
      return { ...prev, [mapKey]: map };
    });
  };

  const addMapTag = (mapKey, name) => {
    setSettingsForm((prev) => {
      const map = { ...prev[mapKey] };
      map[name] = [...(map[name] || []), ''];
      return { ...prev, [mapKey]: map };
    });
  };

  const removeMapTag = (mapKey, name, tagIndex) => {
    setSettingsForm((prev) => {
      const map = { ...prev[mapKey] };
      map[name] = (map[name] || []).filter((_, i) => i !== tagIndex);
      return { ...prev, [mapKey]: map };
    });
  };

  const toggleMapCategory = (audience, catId) => {
    setSettingsForm((prev) => {
      const map = { ...prev.audienceCategoryMap };
      const cats = [...(map[audience] || [])];
      if (cats.includes(catId)) {
        map[audience] = cats.filter((c) => c !== catId);
      } else {
        map[audience] = [...cats, catId];
      }
      return { ...prev, audienceCategoryMap: map };
    });
  };

  const handleSaveSettings = async () => {
    setSettingsError('');
    setSettingsSaving(true);
    try {
      // Sync map keys: ensure every gift type/audience has an entry
      const synced = { ...settingsForm };
      const otm = { ...synced.giftTagMap };
      synced.giftTypes.forEach((o) => { if (!otm[o]) otm[o] = []; });
      Object.keys(otm).forEach((k) => { if (!synced.giftTypes.includes(k)) delete otm[k]; });
      synced.giftTagMap = otm;

      const acm = { ...synced.audienceCategoryMap };
      synced.audienceTypes.forEach((a) => { if (!acm[a]) acm[a] = []; });
      Object.keys(acm).forEach((k) => { if (!synced.audienceTypes.includes(k)) delete acm[k]; });
      synced.audienceCategoryMap = acm;

      await updateSettings(synced);
      setSettingsForm(null);
    } catch (err) {
      setSettingsError(err.message || 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
  const btnPrimary = 'px-5 py-2 bg-primary text-white font-medium text-sm rounded-lg hover:bg-primary-dark cursor-pointer transition-colors border-none disabled:opacity-50';
  const btnSecondary = 'px-5 py-2 bg-gray-100 text-text-muted font-medium text-sm rounded-lg hover:bg-gray-200 cursor-pointer transition-colors border-none';
  const btnDanger = 'px-2 text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-lg';
  const addBtn = 'text-xs text-primary hover:text-primary-dark bg-transparent border-none cursor-pointer';

  return (
    <main className="bg-surface min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-text">Admin Panel</h1>
            <p className="text-text-muted text-sm mt-1">Logged in as <span className="font-medium">{user?.username}</span></p>
          </div>
          <button onClick={handleLogout} className={btnSecondary}>Logout</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { key: 'products', label: 'Products' },
            { key: 'gift', label: 'Gift Settings' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); cancel(); cancelSettings(); }}
              className={`px-4 py-2 text-sm font-medium rounded-md cursor-pointer border-none transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-text shadow-sm'
                  : 'bg-transparent text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== PRODUCTS TAB ==================== */}
        {activeTab === 'products' && (
          <>
            <div className="flex justify-end mb-4">
              {!editing && <button onClick={startAdd} className={btnPrimary}>+ Add Product</button>}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}

            {form && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
                <h2 className="font-semibold text-text mb-4">
                  {editing === 'new' ? 'Add New Product' : 'Edit Product'}
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Product Name</label>
                      <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Category</label>
                      <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} className={'w-full bg-white ' + inputClass}>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
                    <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={3} className={'w-full resize-none ' + inputClass} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">MOQ</label>
                      <input type="number" value={form.moq} onChange={(e) => handleChange('moq', e.target.value)} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Lead Time</label>
                      <input type="text" value={form.leadTime} onChange={(e) => handleChange('leadTime', e.target.value)} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Price Range</label>
                      <input type="text" value={form.priceRange} onChange={(e) => handleChange('priceRange', e.target.value)} className={'w-full ' + inputClass} placeholder="e.g. EGP 290 - EGP 350 per unit" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Price Min (EGP)</label>
                      <input type="number" value={form.priceMin} onChange={(e) => handleChange('priceMin', e.target.value)} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Price Max (EGP)</label>
                      <input type="number" value={form.priceMax} onChange={(e) => handleChange('priceMax', e.target.value)} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Lead Days</label>
                      <input type="number" value={form.leadDays} onChange={(e) => handleChange('leadDays', e.target.value)} className={'w-full ' + inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Notes</label>
                    <input type="text" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} className={'w-full ' + inputClass} />
                  </div>
                  {[
                    { field: 'images', label: 'Image URLs' },
                    { field: 'features', label: 'Features' },
                    { field: 'brandingOptions', label: 'Branding Options' },
                  ].map(({ field, label }) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
                      {form[field].map((val, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                          <input type="text" value={val} onChange={(e) => handleArrayChange(field, i, e.target.value)} className={'flex-1 ' + inputClass} />
                          {form[field].length > 1 && <button onClick={() => removeArrayItem(field, i)} className={btnDanger}>&times;</button>}
                        </div>
                      ))}
                      <button onClick={() => addArrayItem(field)} className={addBtn}>+ Add {label.slice(0, -1)}</button>
                    </div>
                  ))}
                  {/* Smart Tag Picker */}
                  <TagPicker form={form} setForm={setForm} settings={settings} inputClass={inputClass} />
                  <div className="flex gap-3 pt-2">
                    <button onClick={save} disabled={saving} className={btnPrimary}>
                      {saving ? 'Saving...' : editing === 'new' ? 'Add Product' : 'Save Changes'}
                    </button>
                    <button onClick={cancel} className={btnSecondary}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-text">{products.length} Products</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center gap-4 px-6 py-4">
                    <img src={product.images?.[0] || 'https://images.unsplash.com/photo-1586953208270-767889fa9b0e?w=600&h=400&fit=crop'} alt={product.name} className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text text-sm truncate">{product.name}</div>
                      <div className="text-xs text-text-muted capitalize">{product.category} &middot; MOQ: {product.moq} &middot; {product.priceRange}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(product)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>
                      {confirmDelete === product.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(product.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 cursor-pointer border-none transition-colors">Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-xs font-medium text-text-muted bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer border-none transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(product.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ==================== GIFT SETTINGS TAB ==================== */}
        {activeTab === 'gift' && settings && (
          <>
            {settingsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{settingsError}</div>
            )}

            {!settingsForm ? (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button onClick={startEditSettings} className={btnPrimary}>Edit Settings</button>
                </div>

                {/* Gift Types + Tags */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Gift Types &amp; Tag Mappings</h3>
                  <div className="space-y-3">
                    {settings.giftTypes?.map((occ) => (
                      <div key={occ} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="font-medium text-sm text-text min-w-[180px]">{occ}</span>
                        <div className="flex flex-wrap gap-1">
                          {(settings.giftTagMap?.[occ] || []).map((tag) => (
                            <span key={tag} className="px-2 py-0.5 bg-red-50 text-primary text-xs rounded-full">{tag}</span>
                          ))}
                          {!(settings.giftTagMap?.[occ] || []).length && <span className="text-xs text-text-muted italic">No tags</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audiences + Categories */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Audiences &amp; Category Mappings</h3>
                  <div className="space-y-3">
                    {settings.audienceTypes?.map((aud) => (
                      <div key={aud} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="font-medium text-sm text-text min-w-[180px]">{aud}</span>
                        <div className="flex flex-wrap gap-1">
                          {(settings.audienceCategoryMap?.[aud] || []).map((catId) => {
                            const cat = categories.find((c) => c.id === catId);
                            return <span key={catId} className="px-2 py-0.5 bg-blue-50 text-accent text-xs rounded-full">{cat ? `${cat.icon} ${cat.name}` : catId}</span>;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Budget + Quantity + Delivery */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Budget Ranges</h3>
                  <div className="space-y-2">
                    {settings.budgetRanges?.map((b) => (
                      <div key={b.label} className="text-sm text-text">{b.label} <span className="text-text-muted">(min: {b.min}, max: {b.max >= 999999 ? '∞' : b.max})</span></div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-text mb-4">Quantity Ranges</h3>
                    {settings.quantityRanges?.map((q) => <div key={q} className="text-sm text-text">{q}</div>)}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-text mb-4">Delivery Timeframes</h3>
                    {settings.deliveryTimeframes?.map((d) => (
                      <div key={d.label} className="text-sm text-text">{d.label} <span className="text-text-muted">({d.days >= 999999 ? '∞' : d.days} days)</span></div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ---- Edit Mode ---- */
              <div className="space-y-6">
                {/* Gift Types */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Gift Types</h3>
                  {settingsForm.giftTypes.map((occ, i) => (
                    <div key={i} className="mb-4 p-3 bg-surface rounded-lg">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text" value={occ}
                          onChange={(e) => {
                            const oldName = settingsForm.giftTypes[i];
                            updateSimpleList('giftTypes', i, e.target.value);
                            if (oldName !== e.target.value) {
                              setSettingsForm((prev) => {
                                const map = { ...prev.giftTagMap };
                                if (map[oldName] !== undefined) {
                                  map[e.target.value] = map[oldName];
                                  delete map[oldName];
                                }
                                return { ...prev, giftTagMap: map };
                              });
                            }
                          }}
                          className={'flex-1 ' + inputClass} placeholder="Gift type name"
                        />
                        {settingsForm.giftTypes.length > 1 && (
                          <button onClick={() => {
                            const name = settingsForm.giftTypes[i];
                            removeSimpleListItem('giftTypes', i);
                            setSettingsForm((prev) => {
                              const map = { ...prev.giftTagMap };
                              delete map[name];
                              return { ...prev, giftTagMap: map };
                            });
                          }} className={btnDanger}>&times;</button>
                        )}
                      </div>
                      <div className="ml-2">
                        <label className="text-xs text-text-muted">Tags for this gift type:</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(settingsForm.giftTagMap?.[occ] || []).map((tag, ti) => (
                            <div key={ti} className="flex gap-1 items-center">
                              <input type="text" value={tag} onChange={(e) => updateMapTags('giftTagMap', occ, ti, e.target.value)}
                                className="px-2 py-1 border border-gray-200 rounded text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary/20" />
                              <button onClick={() => removeMapTag('giftTagMap', occ, ti)} className="text-red-400 hover:text-red-600 text-sm bg-transparent border-none cursor-pointer">&times;</button>
                            </div>
                          ))}
                          <button onClick={() => addMapTag('giftTagMap', occ)} className={addBtn}>+ tag</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addSimpleListItem('giftTypes')} className={addBtn}>+ Add Gift Type</button>
                </div>

                {/* Audience Types */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Audience Types</h3>
                  {settingsForm.audienceTypes.map((aud, i) => (
                    <div key={i} className="mb-4 p-3 bg-surface rounded-lg">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text" value={aud}
                          onChange={(e) => {
                            const oldName = settingsForm.audienceTypes[i];
                            updateSimpleList('audienceTypes', i, e.target.value);
                            if (oldName !== e.target.value) {
                              setSettingsForm((prev) => {
                                const map = { ...prev.audienceCategoryMap };
                                if (map[oldName] !== undefined) {
                                  map[e.target.value] = map[oldName];
                                  delete map[oldName];
                                }
                                return { ...prev, audienceCategoryMap: map };
                              });
                            }
                          }}
                          className={'flex-1 ' + inputClass} placeholder="Audience type"
                        />
                        {settingsForm.audienceTypes.length > 1 && (
                          <button onClick={() => {
                            const name = settingsForm.audienceTypes[i];
                            removeSimpleListItem('audienceTypes', i);
                            setSettingsForm((prev) => {
                              const map = { ...prev.audienceCategoryMap };
                              delete map[name];
                              return { ...prev, audienceCategoryMap: map };
                            });
                          }} className={btnDanger}>&times;</button>
                        )}
                      </div>
                      <div className="ml-2">
                        <label className="text-xs text-text-muted">Categories for this audience:</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {categories.map((cat) => {
                            const checked = (settingsForm.audienceCategoryMap?.[aud] || []).includes(cat.id);
                            return (
                              <label key={cat.id} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer border transition-colors ${
                                checked ? 'bg-blue-50 border-blue-200 text-accent' : 'bg-white border-gray-200 text-text-muted'
                              }`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleMapCategory(aud, cat.id)} className="sr-only" />
                                {cat.icon} {cat.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addSimpleListItem('audienceTypes')} className={addBtn}>+ Add Audience Type</button>
                </div>

                {/* Budget Ranges */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Budget Ranges</h3>
                  {settingsForm.budgetRanges.map((b, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <input type="text" value={b.label} onChange={(e) => updateObjectList('budgetRanges', i, 'label', e.target.value)} className={'flex-1 ' + inputClass} placeholder="Label" />
                      <input type="number" value={b.min} onChange={(e) => updateObjectList('budgetRanges', i, 'min', Number(e.target.value))} className={'w-24 ' + inputClass} placeholder="Min" />
                      <input type="number" value={b.max} onChange={(e) => updateObjectList('budgetRanges', i, 'max', Number(e.target.value))} className={'w-24 ' + inputClass} placeholder="Max" />
                      {settingsForm.budgetRanges.length > 1 && <button onClick={() => removeObjectListItem('budgetRanges', i)} className={btnDanger}>&times;</button>}
                    </div>
                  ))}
                  <button onClick={() => addObjectListItem('budgetRanges', { label: '', min: 0, max: 0 })} className={addBtn}>+ Add Budget Range</button>
                </div>

                {/* Quantity Ranges */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Quantity Ranges</h3>
                  {settingsForm.quantityRanges.map((q, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input type="text" value={q} onChange={(e) => updateSimpleList('quantityRanges', i, e.target.value)} className={'flex-1 ' + inputClass} placeholder="e.g. 50 - 100 units" />
                      {settingsForm.quantityRanges.length > 1 && <button onClick={() => removeSimpleListItem('quantityRanges', i)} className={btnDanger}>&times;</button>}
                    </div>
                  ))}
                  <button onClick={() => addSimpleListItem('quantityRanges')} className={addBtn}>+ Add Range</button>
                </div>

                {/* Delivery Timeframes */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-4">Delivery Timeframes</h3>
                  {settingsForm.deliveryTimeframes.map((d, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <input type="text" value={d.label} onChange={(e) => updateObjectList('deliveryTimeframes', i, 'label', e.target.value)} className={'flex-1 ' + inputClass} placeholder="Label" />
                      <input type="number" value={d.days} onChange={(e) => updateObjectList('deliveryTimeframes', i, 'days', Number(e.target.value))} className={'w-24 ' + inputClass} placeholder="Days" />
                      {settingsForm.deliveryTimeframes.length > 1 && <button onClick={() => removeObjectListItem('deliveryTimeframes', i)} className={btnDanger}>&times;</button>}
                    </div>
                  ))}
                  <button onClick={() => addObjectListItem('deliveryTimeframes', { label: '', days: 0 })} className={addBtn}>+ Add Timeframe</button>
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-3">
                  <button onClick={handleSaveSettings} disabled={settingsSaving} className={btnPrimary}>
                    {settingsSaving ? 'Saving...' : 'Save All Settings'}
                  </button>
                  <button onClick={cancelSettings} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
