import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../context/ProductContext';
import { useAuth } from '../context/AuthContext';
import { useGiftSettings } from '../context/GiftSettingsContext';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../lib/api';
import { usePageContent } from '../context/PageContentContext';
import { useCategories } from '../context/CategoryContext';
import ImageUploader from '../components/ImageUploader';

// Download CSV helper
function downloadCSV(endpoint, filename) {
  const token = localStorage.getItem('auth_token');
  fetch(`/api/export/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || `${endpoint}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
}

const emptyProduct = {
  name: '',
  nameAr: '',
  category: 'usb',
  images: [''],
  description: '',
  descriptionAr: '',
  features: [''],
  featuresAr: [''],
  brandingOptions: [''],
  brandingOptionsAr: [''],
  moq: 50,
  leadTime: '7-10 business days',
  leadTimeAr: '',
  priceRange: '',
  priceRangeAr: '',
  priceMin: '',
  priceMax: '',
  leadDays: '',
  tags: [],
  notes: '',
  notesAr: '',
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
  const { user, logout, hasPermission, isSuperAdmin, changePassword, updateProfile, refreshUser } = useAuth();
  const { settings, updateSettings } = useGiftSettings();
  const { categories, refreshCategories } = useCategories();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [newSubmissionCount, setNewSubmissionCount] = useState(0);
  const [adminProductSearch, setAdminProductSearch] = useState('');

  // Blog state
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogError, setBlogError] = useState('');
  const [blogSaving, setBlogSaving] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [blogForm, setBlogForm] = useState(null);
  const [confirmDeleteBlog, setConfirmDeleteBlog] = useState(null);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Gift settings local state
  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // User management state
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSaving, setUserSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  // Roles management state
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState(null);
  const [permGroups, setPermGroups] = useState([]);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(null);

  // My Account state
  const [showAccount, setShowAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({ email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);

  // Pages editor state
  const { content: allPages, updatePage, refreshPages, pagesMeta } = usePageContent();
  const [pagesList, setPagesList] = useState([]);
  const [editingPage, setEditingPage] = useState(null); // slug
  const [pageForm, setPageForm] = useState(null);
  const [pageError, setPageError] = useState('');
  const [pageSaving, setPageSaving] = useState(false);
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [newPageCreating, setNewPageCreating] = useState(false);

  const CORE_PAGES = ['global', 'home', 'about', 'contact', 'products'];

  const PAGE_LABELS = {
    global: 'Global Settings (Contact Info, Company)',
    home: 'Home Page',
    about: 'About Page',
    contact: 'Contact Page',
    products: 'Products Page',
  };

  useEffect(() => {
    if (hasPermission('pages.edit')) {
      apiGet('/pages').then(setPagesList).catch(() => {});
    }
  }, [hasPermission]);

  const [pageFormAr, setPageFormAr] = useState(null);
  const [showPageAr, setShowPageAr] = useState(false);

  const startEditPage = (slug) => {
    setEditingPage(slug);
    const pageData = JSON.parse(JSON.stringify(allPages[slug] || {}));
    const { _ar, ...enContent } = pageData;
    setPageForm(enContent);
    setPageFormAr(_ar || {});
    setShowPageAr(false);
    setPageError('');
  };

  const cancelPage = () => {
    setEditingPage(null);
    setPageForm(null);
    setPageFormAr(null);
    setShowPageAr(false);
    setPageError('');
  };

  const handlePageFieldChange = (key, value) => {
    setPageForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePageArrayChange = (key, index, value) => {
    setPageForm((prev) => {
      const arr = [...(prev[key] || [])];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  };

  const handlePageArrayObjChange = (key, index, field, value) => {
    setPageForm((prev) => {
      const arr = [...(prev[key] || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [key]: arr };
    });
  };

  const addPageArrayItem = (key, defaultValue) => {
    setPageForm((prev) => ({ ...prev, [key]: [...(prev[key] || []), defaultValue] }));
  };

  const removePageArrayItem = (key, index) => {
    setPageForm((prev) => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== index) }));
  };

  const savePage = async () => {
    setPageError('');
    setPageSaving(true);
    try {
      const dataToSave = { ...pageForm, _ar: pageFormAr || {} };
      await updatePage(editingPage, dataToSave);
      cancelPage();
    } catch (err) {
      setPageError(err.message || 'Failed to save page');
    } finally {
      setPageSaving(false);
    }
  };

  const createNewPage = async () => {
    if (!newPageTitle.trim() || !newPageSlug.trim()) {
      setPageError('Title and slug are required');
      return;
    }
    setPageError('');
    setNewPageCreating(true);
    try {
      await apiPost('/pages', { title: newPageTitle.trim(), slug: newPageSlug.trim() });
      setShowNewPageForm(false);
      setNewPageTitle('');
      setNewPageSlug('');
      const updatedList = await apiGet('/pages');
      setPagesList(updatedList);
      await refreshPages();
    } catch (err) {
      setPageError(err.message || 'Failed to create page');
    } finally {
      setNewPageCreating(false);
    }
  };

  const togglePageVisibility = async (slug, currentHidden) => {
    setPageError('');
    try {
      await apiPatch(`/pages/${slug}/visibility`, { hidden: !currentHidden });
      const updatedList = await apiGet('/pages');
      setPagesList(updatedList);
      await refreshPages();
    } catch (err) {
      setPageError(err.message || 'Failed to update visibility');
    }
  };

  const deletePage = async (slug) => {
    if (!confirm(`Are you sure you want to permanently delete the "${slug}" page?`)) return;
    setPageError('');
    try {
      await apiDelete(`/pages/${slug}`);
      const updatedList = await apiGet('/pages');
      setPagesList(updatedList);
      await refreshPages();
    } catch (err) {
      setPageError(err.message || 'Failed to delete page');
    }
  };

  // ==================== FORMS STATE ====================
  const [formsList, setFormsList] = useState([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState('');
  const [editingForm, setEditingForm] = useState(null); // form object or 'new'
  const [formDef, setFormDef] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [viewingSubmissions, setViewingSubmissions] = useState(null); // form id
  const [submissions, setSubmissions] = useState([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null); // single submission

  const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'date', 'select', 'textarea', 'checkbox'];

  const fetchForms = useCallback(async () => {
    setFormsLoading(true);
    try {
      const data = await apiGet('/forms');
      setFormsList(data);
    } catch (err) {
      setFormsError(err.message);
    } finally {
      setFormsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission('forms.view') && activeTab === 'forms') {
      fetchForms();
    }
  }, [activeTab, hasPermission, fetchForms]);

  // Dashboard stats
  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const data = await apiGet('/dashboard/stats');
      setDashboardStats(data);
    } catch { /* ignore */ }
    finally { setDashboardLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
  }, [activeTab, fetchDashboard]);

  // Fetch new submission count on mount (for badge)
  useEffect(() => {
    if (hasPermission('forms.view')) {
      apiGet('/dashboard/stats').then(data => {
        setNewSubmissionCount(data.newSubmissions || 0);
      }).catch(() => {});
    }
  }, [hasPermission]);

  // Sync badge when dashboard data refreshes
  useEffect(() => {
    if (dashboardStats) setNewSubmissionCount(dashboardStats.newSubmissions || 0);
  }, [dashboardStats]);

  // Blog functions
  const fetchBlog = useCallback(async () => {
    setBlogLoading(true);
    try {
      const data = await apiGet('/blog');
      setBlogPosts(data);
    } catch { setBlogError('Failed to load posts'); }
    finally { setBlogLoading(false); }
  }, []);

  useEffect(() => {
    if (hasPermission('pages.edit') && activeTab === 'blog') fetchBlog();
  }, [activeTab, hasPermission, fetchBlog]);

  const startNewBlog = () => {
    setEditingBlog('new');
    setBlogForm({ title: '', title_ar: '', slug: '', excerpt: '', excerpt_ar: '', content: '', content_ar: '', cover_image: '', author: 'Admin', status: 'draft', tags: [] });
    setBlogError('');
  };

  const startEditBlog = (post) => {
    setEditingBlog(post);
    setBlogForm({ title: post.title, title_ar: post.title_ar || '', slug: post.slug, excerpt: post.excerpt, excerpt_ar: post.excerpt_ar || '', content: post.content, content_ar: post.content_ar || '', cover_image: post.cover_image, author: post.author, status: post.status, tags: post.tags || [] });
    setBlogError('');
  };

  const cancelBlog = () => { setEditingBlog(null); setBlogForm(null); setBlogError(''); };

  const saveBlog = async () => {
    setBlogSaving(true);
    setBlogError('');
    try {
      if (editingBlog === 'new') {
        await apiPost('/blog', blogForm);
      } else {
        await apiPut(`/blog/${editingBlog.id}`, blogForm);
      }
      cancelBlog();
      fetchBlog();
    } catch (err) { setBlogError(err.message); }
    finally { setBlogSaving(false); }
  };

  const deleteBlog = async (id) => {
    try {
      await apiDelete(`/blog/${id}`);
      setConfirmDeleteBlog(null);
      fetchBlog();
    } catch (err) { setBlogError(err.message); }
  };

  const startNewForm = () => {
    setEditingForm('new');
    setFormDef({ name: '', slug: '', description: '', fields: [], settings: { submitButton: 'Submit', successTitle: 'Thank You!', successMessage: 'Your submission has been received.' } });
    setFormsError('');
  };

  const startEditForm = (f) => {
    setEditingForm(f);
    setFormDef({ name: f.name, slug: f.slug, description: f.description, fields: [...f.fields], settings: { ...f.settings }, is_active: f.is_active });
    setFormsError('');
  };

  const cancelForm = () => {
    setEditingForm(null);
    setFormDef(null);
    setFormsError('');
  };

  const saveForm = async () => {
    if (!formDef.name.trim()) { setFormsError('Form name is required'); return; }
    if (!formDef.slug.trim() && editingForm === 'new') { setFormsError('Slug is required'); return; }
    setFormsError('');
    setFormSaving(true);
    try {
      if (editingForm === 'new') {
        await apiPost('/forms', formDef);
      } else {
        await apiPut(`/forms/${editingForm.id}`, formDef);
      }
      cancelForm();
      fetchForms();
    } catch (err) {
      setFormsError(err.message || 'Failed to save form');
    } finally {
      setFormSaving(false);
    }
  };

  const deleteForm = async (id) => {
    if (!confirm('Delete this form and all its submissions?')) return;
    try {
      await apiDelete(`/forms/${id}`);
      fetchForms();
    } catch (err) {
      setFormsError(err.message);
    }
  };

  const addField = () => {
    setFormDef(prev => ({
      ...prev,
      fields: [...prev.fields, { name: '', label: '', type: 'text', required: false, placeholder: '', options: [] }]
    }));
  };

  const updateField = (index, key, value) => {
    setFormDef(prev => {
      const fields = [...prev.fields];
      fields[index] = { ...fields[index], [key]: value };
      // Auto-generate name from label
      if (key === 'label' && !fields[index]._nameEdited) {
        fields[index].name = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      return { ...prev, fields };
    });
  };

  const removeField = (index) => {
    setFormDef(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  };

  const moveField = (index, direction) => {
    setFormDef(prev => {
      const fields = [...prev.fields];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= fields.length) return prev;
      [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
      return { ...prev, fields };
    });
  };

  const loadSubmissions = async (formId, page = 1) => {
    setViewingSubmissions(formId);
    setSubmissionsPage(page);
    setSubmissionsLoading(true);
    try {
      const data = await apiGet(`/forms/${formId}/submissions?page=${page}&limit=15`);
      setSubmissions(data.submissions);
      setSubmissionsTotal(data.total);
    } catch (err) {
      setFormsError(err.message);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const updateSubmissionStatus = async (subId, status) => {
    try {
      await apiPatch(`/forms/submissions/${subId}`, { status });
      loadSubmissions(viewingSubmissions, submissionsPage);
      // Refresh badge count
      apiGet('/dashboard/stats').then(data => setNewSubmissionCount(data.newSubmissions || 0)).catch(() => {});
    } catch (err) {
      setFormsError(err.message);
    }
  };

  const deleteSubmission = async (subId) => {
    if (!confirm('Delete this submission?')) return;
    try {
      await apiDelete(`/forms/submissions/${subId}`);
      loadSubmissions(viewingSubmissions, submissionsPage);
    } catch (err) {
      setFormsError(err.message);
    }
  };

  const closeSubmissions = () => {
    setViewingSubmissions(null);
    setSubmissions([]);
    setViewingSubmission(null);
  };

  // ==================== SMTP SETTINGS STATE ====================
  const [smtpForm, setSmtpForm] = useState({ host: '', port: 587, secure: false, user: '', pass: '', from: '', notifyEmail: '' });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpError, setSmtpError] = useState('');
  const [smtpSuccess, setSmtpSuccess] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const loadSmtp = useCallback(async () => {
    setSmtpLoading(true);
    try {
      const data = await apiGet('/settings/smtp');
      setSmtpForm(prev => ({ ...prev, ...data }));
    } catch {
      // No settings saved yet
    } finally {
      setSmtpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission('settings.smtp') && activeTab === 'settings') {
      loadSmtp();
    }
  }, [activeTab, hasPermission, loadSmtp]);

  const saveSmtp = async () => {
    setSmtpError('');
    setSmtpSuccess('');
    setSmtpSaving(true);
    try {
      await apiPut('/settings/smtp', smtpForm);
      setSmtpSuccess('SMTP settings saved successfully');
    } catch (err) {
      setSmtpError(err.message || 'Failed to save');
    } finally {
      setSmtpSaving(false);
    }
  };

  const testSmtpConnection = async () => {
    setSmtpError('');
    setSmtpSuccess('');
    setSmtpTesting(true);
    try {
      const result = await apiPost('/settings/smtp/test', smtpForm);
      setSmtpSuccess(result.message);
    } catch (err) {
      setSmtpError(err.message || 'Connection failed');
    } finally {
      setSmtpTesting(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo.trim()) { setSmtpError('Enter a recipient email'); return; }
    setSmtpError('');
    setSmtpSuccess('');
    setSendingTest(true);
    try {
      const result = await apiPost('/settings/smtp/test-email', { to: testEmailTo });
      setSmtpSuccess(result.message);
    } catch (err) {
      setSmtpError(err.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  // ==================== LAYOUT (HEADER & FOOTER) STATE ====================
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [layoutForm, setLayoutForm] = useState(null);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutError, setLayoutError] = useState('');
  const [layoutSuccess, setLayoutSuccess] = useState('');

  const { global: globalContent } = usePageContent();

  const startEditLayout = () => {
    setLayoutForm({
      companyName: globalContent.companyName || '3DTech',
      tagline: globalContent.tagline || '',
      logoUrl: globalContent.logoUrl || '/logo.jpeg',
      email: globalContent.email || '',
      phone1: globalContent.phone1 || '',
      phone2: globalContent.phone2 || '',
      location: globalContent.location || 'Cairo, Egypt',
      whyUs: globalContent.whyUs || ['Free design mockup', '24-hour quote turnaround', 'No hidden fees', 'Bulk order discounts', 'Quality guarantee'],
      footerTagline: globalContent.footerTagline || globalContent.tagline || '',
      socialFacebook: globalContent.socialFacebook || '',
      socialInstagram: globalContent.socialInstagram || '',
      socialLinkedin: globalContent.socialLinkedin || '',
      socialTwitter: globalContent.socialTwitter || '',
      headerCta: globalContent.headerCta || 'Request Quote',
    });
    setLayoutEditing(true);
    setLayoutError('');
    setLayoutSuccess('');
  };

  const cancelLayout = () => {
    setLayoutEditing(false);
    setLayoutForm(null);
    setLayoutError('');
  };

  const saveLayout = async () => {
    setLayoutSaving(true);
    setLayoutError('');
    setLayoutSuccess('');
    try {
      const merged = { ...globalContent, ...layoutForm };
      await updatePage('global', merged);
      await refreshPages();
      setLayoutEditing(false);
      setLayoutSuccess('Header & Footer settings saved successfully');
    } catch (err) {
      setLayoutError(err.message || 'Failed to save');
    } finally {
      setLayoutSaving(false);
    }
  };

  const updateLayoutField = (key, value) => setLayoutForm(prev => ({ ...prev, [key]: value }));
  const updateLayoutListItem = (key, i, value) => setLayoutForm(prev => {
    const list = [...(prev[key] || [])];
    list[i] = value;
    return { ...prev, [key]: list };
  });
  const addLayoutListItem = (key) => setLayoutForm(prev => ({ ...prev, [key]: [...(prev[key] || []), ''] }));
  const removeLayoutListItem = (key, i) => setLayoutForm(prev => {
    const list = [...(prev[key] || [])];
    list.splice(i, 1);
    return { ...prev, [key]: list };
  });

  // ==================== CATEGORIES STATE ====================
  const [editingCat, setEditingCat] = useState(null); // category object or 'new'
  const [catForm, setCatForm] = useState(null);
  const [catError, setCatError] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  const startNewCat = () => {
    setEditingCat('new');
    setCatForm({ id: '', name: '', name_ar: '', icon: '', description: '', description_ar: '' });
    setCatError('');
  };

  const startEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({ id: cat.id, name: cat.name, name_ar: cat.name_ar || '', icon: cat.icon, description: cat.description, description_ar: cat.description_ar || '', is_active: cat.is_active });
    setCatError('');
  };

  const cancelCat = () => { setEditingCat(null); setCatForm(null); setCatError(''); };

  const saveCat = async () => {
    if (!catForm.name.trim()) { setCatError('Name is required'); return; }
    setCatError('');
    setCatSaving(true);
    try {
      if (editingCat === 'new') {
        const slug = catForm.id || catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await apiPost('/categories', { ...catForm, id: slug });
      } else {
        await apiPut(`/categories/${editingCat.id}`, catForm);
      }
      cancelCat();
      refreshCategories();
    } catch (err) {
      setCatError(err.message || 'Failed to save');
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCat = async (id) => {
    if (!confirm('Delete this category?')) return;
    setCatError('');
    try {
      await apiDelete(`/categories/${id}`);
      refreshCategories();
    } catch (err) {
      setCatError(err.message || 'Failed to delete');
    }
  };

  const toggleCatActive = async (cat) => {
    try {
      await apiPut(`/categories/${cat.id}`, { ...cat, is_active: cat.is_active ? 0 : 1 });
      refreshCategories();
    } catch (err) {
      setCatError(err.message);
    }
  };

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await apiGet('/users');
      setUsers(data);
    } catch (err) {
      setUserError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const data = await apiGet('/roles');
      setRoles(data);
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const fetchPermGroups = useCallback(async () => {
    try {
      const data = await apiGet('/roles/permissions');
      setPermGroups(data.groups || []);
    } catch { /* ignore if no access */ }
  }, []);

  useEffect(() => {
    if (hasPermission('users.view')) { fetchUsers(); fetchRoles(); }
    if (hasPermission('roles.manage')) { fetchRoles(); fetchPermGroups(); }
  }, [hasPermission, fetchUsers, fetchRoles, fetchPermGroups]);

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

  // ---- User Management Handlers ----
  const startAddUser = () => {
    setEditingUser('new');
    const defaultRole = roles.find(r => r.slug === 'editor') || roles[0];
    setUserForm({ username: '', email: '', password: '', role_id: defaultRole?.id || '' });
    setUserError('');
  };

  const startEditUser = (u) => {
    setEditingUser(u.id);
    setUserForm({ username: u.username, email: u.email || '', password: '', role_id: u.role_id });
    setUserError('');
  };

  const cancelUser = () => {
    setEditingUser(null);
    setUserForm(null);
    setUserError('');
  };

  const saveUser = async () => {
    setUserError('');
    setUserSaving(true);
    try {
      if (editingUser === 'new') {
        await apiPost('/users', userForm);
      } else {
        const body = { username: userForm.username, email: userForm.email, role_id: userForm.role_id };
        if (userForm.password) body.password = userForm.password;
        await apiPut(`/users/${editingUser}`, body);
      }
      cancelUser();
      await fetchUsers();
    } catch (err) {
      setUserError(err.message || 'Failed to save user');
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await apiDelete(`/users/${id}`);
      setConfirmDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      setUserError(err.message || 'Failed to delete user');
    }
  };

  // ---- Roles Management Handlers ----
  const startAddRole = () => {
    setEditingRole('new');
    setRoleForm({ name: '', permissions: [] });
    setRoleError('');
  };

  const startEditRole = (r) => {
    setEditingRole(r.id);
    setRoleForm({ name: r.name, permissions: [...r.permissions] });
    setRoleError('');
  };

  const cancelRole = () => {
    setEditingRole(null);
    setRoleForm(null);
    setRoleError('');
  };

  const toggleRolePerm = (perm) => {
    setRoleForm((prev) => {
      const perms = prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: perms };
    });
  };

  const selectAllPerms = () => {
    const all = permGroups.flatMap(g => g.permissions.map(p => p.key));
    setRoleForm((prev) => ({ ...prev, permissions: all }));
  };

  const deselectAllPerms = () => {
    setRoleForm((prev) => ({ ...prev, permissions: [] }));
  };

  const saveRole = async () => {
    setRoleError('');
    setRoleSaving(true);
    try {
      if (editingRole === 'new') {
        await apiPost('/roles', roleForm);
      } else {
        await apiPut(`/roles/${editingRole}`, roleForm);
      }
      cancelRole();
      await fetchRoles();
      // Refresh own user in case our permissions changed
      await refreshUser();
    } catch (err) {
      setRoleError(err.message || 'Failed to save role');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (id) => {
    try {
      await apiDelete(`/roles/${id}`);
      setConfirmDeleteRole(null);
      await fetchRoles();
    } catch (err) {
      setRoleError(err.message || 'Failed to delete role');
    }
  };

  // ---- My Account Handlers ----
  const openAccount = () => {
    setShowAccount(true);
    setAccountForm({ email: user?.email || '', currentPassword: '', newPassword: '', confirmPassword: '' });
    setAccountError('');
    setAccountSuccess('');
  };

  const closeAccount = () => {
    setShowAccount(false);
    setAccountError('');
    setAccountSuccess('');
  };

  const saveAccount = async () => {
    setAccountError('');
    setAccountSuccess('');
    setAccountSaving(true);
    try {
      // Update email if changed
      if (accountForm.email !== (user?.email || '')) {
        await updateProfile({ email: accountForm.email });
      }
      // Change password if provided
      if (accountForm.newPassword) {
        if (accountForm.newPassword !== accountForm.confirmPassword) {
          setAccountError('New passwords do not match');
          setAccountSaving(false);
          return;
        }
        if (!accountForm.currentPassword) {
          setAccountError('Current password is required');
          setAccountSaving(false);
          return;
        }
        await changePassword(accountForm.currentPassword, accountForm.newPassword);
      }
      setAccountSuccess('Account updated successfully');
      setAccountForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      setAccountError(err.message || 'Failed to update account');
    } finally {
      setAccountSaving(false);
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-text">Admin Panel</h1>
            <p className="text-text-muted text-sm mt-1">
              Logged in as <span className="font-medium">{user?.username}</span>
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-text-muted">{user?.role_name}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={openAccount} className={btnSecondary}>My Account</button>
            <button onClick={handleLogout} className={btnSecondary}>Logout</button>
          </div>
        </div>

        {/* My Account Panel */}
        {showAccount && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text">My Account</h3>
              <button onClick={closeAccount} className="text-text-muted hover:text-text bg-transparent border-none cursor-pointer text-lg">&times;</button>
            </div>
            {accountError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{accountError}</div>}
            {accountSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{accountSuccess}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
                <input type="email" value={accountForm.email} onChange={(e) => setAccountForm(prev => ({ ...prev, email: e.target.value }))} className={'w-full ' + inputClass} placeholder="your@email.com" />
              </div>
              <div></div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Current Password</label>
                <input type="password" value={accountForm.currentPassword} onChange={(e) => setAccountForm(prev => ({ ...prev, currentPassword: e.target.value }))} className={'w-full ' + inputClass} placeholder="Required to change password" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">New Password</label>
                <input type="password" value={accountForm.newPassword} onChange={(e) => setAccountForm(prev => ({ ...prev, newPassword: e.target.value }))} className={'w-full ' + inputClass} placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Confirm New Password</label>
                <input type="password" value={accountForm.confirmPassword} onChange={(e) => setAccountForm(prev => ({ ...prev, confirmPassword: e.target.value }))} className={'w-full ' + inputClass} placeholder="Repeat new password" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={saveAccount} disabled={accountSaving} className={btnPrimary}>{accountSaving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={closeAccount} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            hasPermission('products.view') && { key: 'products', label: 'Products' },
            hasPermission('gift_settings.view') && { key: 'gift', label: 'Gift Settings' },
            hasPermission('users.view') && { key: 'users', label: 'Users' },
            hasPermission('roles.manage') && { key: 'roles', label: 'Roles' },
            hasPermission('pages.edit') && { key: 'pages', label: 'Pages' },
            hasPermission('products.view') && { key: 'categories', label: 'Categories' },
            hasPermission('forms.view') && { key: 'forms', label: 'Forms', badge: newSubmissionCount },
            hasPermission('pages.edit') && { key: 'blog', label: 'Blog' },
            hasPermission('pages.edit') && { key: 'layout', label: 'Header & Footer' },
            hasPermission('settings.smtp') && { key: 'settings', label: 'Settings' },
          ].filter(Boolean).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); cancel(); cancelSettings(); cancelUser(); cancelRole(); cancelPage(); }}
              className={`relative px-4 py-2 text-sm font-medium rounded-md cursor-pointer border-none transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-text shadow-sm'
                  : 'bg-transparent text-text-muted hover:text-text'
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== DASHBOARD TAB ==================== */}
        {activeTab === 'dashboard' && (
          <div>
            {dashboardLoading && !dashboardStats ? (
              <div className="text-center py-12 text-text-muted">Loading dashboard...</div>
            ) : dashboardStats ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                  {[
                    { label: 'Products', value: dashboardStats.totalProducts, color: 'bg-blue-50 text-blue-700', icon: '📦' },
                    { label: 'Categories', value: dashboardStats.totalCategories, color: 'bg-purple-50 text-purple-700', icon: '📂' },
                    { label: 'Users', value: dashboardStats.totalUsers, color: 'bg-green-50 text-green-700', icon: '👥' },
                    { label: 'Forms', value: dashboardStats.totalForms, color: 'bg-yellow-50 text-yellow-700', icon: '📝' },
                    { label: 'Submissions', value: dashboardStats.totalSubmissions, color: 'bg-indigo-50 text-indigo-700', icon: '📩' },
                    { label: 'New', value: dashboardStats.newSubmissions, color: 'bg-red-50 text-red-700', icon: '🔔' },
                  ].map((stat) => (
                    <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
                      <div className="text-2xl mb-1">{stat.icon}</div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-xs font-medium opacity-80">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Submissions */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text">Recent Submissions</h3>
                      {hasPermission('forms.view') && (
                        <button onClick={() => setActiveTab('forms')} className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none">View All</button>
                      )}
                    </div>
                    {dashboardStats.recentSubmissions.length === 0 ? (
                      <p className="text-sm text-text-muted">No submissions yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {dashboardStats.recentSubmissions.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div>
                              <div className="text-sm font-medium text-text">{sub.form_name}</div>
                              <div className="text-xs text-text-muted">
                                {sub.data.name || sub.data.email || Object.values(sub.data).find(v => typeof v === 'string' && v.length > 0) || '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                sub.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                sub.status === 'reviewed' ? 'bg-yellow-100 text-yellow-700' :
                                sub.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{sub.status}</span>
                              <span className="text-xs text-text-muted">{new Date(sub.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Products */}
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-text">Recent Products</h3>
                      {hasPermission('products.view') && (
                        <button onClick={() => setActiveTab('products')} className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none">View All</button>
                      )}
                    </div>
                    {dashboardStats.recentProducts.length === 0 ? (
                      <p className="text-sm text-text-muted">No products yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {dashboardStats.recentProducts.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="text-sm font-medium text-text">{p.name}</div>
                            <span className="text-xs text-text-muted">{new Date(p.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="font-semibold text-text mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    {hasPermission('products.create') && (
                      <button onClick={() => { setActiveTab('products'); setTimeout(() => { const btn = document.querySelector('[data-action="add-product"]'); if(btn) btn.click(); }, 100); }} className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark cursor-pointer border-none transition-colors">+ Add Product</button>
                    )}
                    {hasPermission('forms.view') && (
                      <button onClick={() => setActiveTab('forms')} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer border-none transition-colors">View Submissions</button>
                    )}
                    {hasPermission('pages.edit') && (
                      <button onClick={() => setActiveTab('pages')} className="px-4 py-2 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-800 cursor-pointer border-none transition-colors">Edit Pages</button>
                    )}
                    {hasPermission('pages.edit') && (
                      <button onClick={() => setActiveTab('layout')} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer border-none transition-colors">Edit Layout</button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-text-muted">Failed to load dashboard.</div>
            )}
          </div>
        )}

        {/* ==================== PRODUCTS TAB ==================== */}
        {activeTab === 'products' && (
          <>
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={() => downloadCSV('products', 'products.csv')} className={btnSecondary}>Export CSV</button>
              {!editing && hasPermission('products.create') && <button onClick={startAdd} className={btnPrimary}>+ Add Product</button>}
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
                  {/* Product Images with Upload */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Images</label>
                    {form.images.map((val, i) => (
                      <div key={i} className="mb-3 p-3 bg-surface rounded-lg">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <ImageUploader value={val} onChange={(v) => handleArrayChange('images', i, v)} />
                          </div>
                          {form.images.length > 1 && <button onClick={() => removeArrayItem('images', i)} className={btnDanger + ' mt-1'}>&times;</button>}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addArrayItem('images')} className={addBtn}>+ Add Image</button>
                  </div>
                  {/* Features & Branding Options */}
                  {[
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

                  {/* Arabic Content Section */}
                  <details className="border border-amber-200 rounded-lg bg-amber-50/50">
                    <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-amber-800 select-none">
                      🌐 المحتوى العربي (Arabic Content)
                    </summary>
                    <div className="p-4 space-y-4 border-t border-amber-200" dir="rtl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1">اسم المنتج</label>
                          <input type="text" value={form.nameAr || ''} onChange={(e) => handleChange('nameAr', e.target.value)} className={'w-full ' + inputClass} placeholder="اسم المنتج بالعربي" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1">نطاق السعر</label>
                          <input type="text" value={form.priceRangeAr || ''} onChange={(e) => handleChange('priceRangeAr', e.target.value)} className={'w-full ' + inputClass} placeholder="مثال: 290 - 350 جنيه للقطعة" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">الوصف</label>
                        <textarea value={form.descriptionAr || ''} onChange={(e) => handleChange('descriptionAr', e.target.value)} rows={3} className={'w-full resize-none ' + inputClass} placeholder="وصف المنتج بالعربي" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1">مدة التسليم</label>
                          <input type="text" value={form.leadTimeAr || ''} onChange={(e) => handleChange('leadTimeAr', e.target.value)} className={'w-full ' + inputClass} placeholder="مثال: 7-10 أيام عمل" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1">ملاحظات</label>
                          <input type="text" value={form.notesAr || ''} onChange={(e) => handleChange('notesAr', e.target.value)} className={'w-full ' + inputClass} placeholder="ملاحظات بالعربي" />
                        </div>
                      </div>
                      {/* Arabic Features */}
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">المميزات</label>
                        {(form.featuresAr || ['']).map((val, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input type="text" value={val} onChange={(e) => handleArrayChange('featuresAr', i, e.target.value)} className={'flex-1 ' + inputClass} placeholder="ميزة بالعربي" />
                            {(form.featuresAr || ['']).length > 1 && <button onClick={() => removeArrayItem('featuresAr', i)} className={btnDanger}>&times;</button>}
                          </div>
                        ))}
                        <button onClick={() => addArrayItem('featuresAr')} className={addBtn}>+ إضافة ميزة</button>
                      </div>
                      {/* Arabic Branding Options */}
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">خيارات العلامة التجارية</label>
                        {(form.brandingOptionsAr || ['']).map((val, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input type="text" value={val} onChange={(e) => handleArrayChange('brandingOptionsAr', i, e.target.value)} className={'flex-1 ' + inputClass} placeholder="خيار بالعربي" />
                            {(form.brandingOptionsAr || ['']).length > 1 && <button onClick={() => removeArrayItem('brandingOptionsAr', i)} className={btnDanger}>&times;</button>}
                          </div>
                        ))}
                        <button onClick={() => addArrayItem('brandingOptionsAr')} className={addBtn}>+ إضافة خيار</button>
                      </div>
                    </div>
                  </details>

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
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <h3 className="font-semibold text-text shrink-0">{products.length} Products</h3>
                <input
                  type="text"
                  value={adminProductSearch}
                  onChange={(e) => setAdminProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className={inputClass + ' max-w-xs'}
                />
              </div>
              <div className="divide-y divide-gray-100">
                {products.filter(p => {
                  if (!adminProductSearch.trim()) return true;
                  const q = adminProductSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
                }).map((product) => (
                  <div key={product.id} className="flex items-center gap-4 px-6 py-4">
                    <img src={product.images?.[0] || 'https://images.unsplash.com/photo-1586953208270-767889fa9b0e?w=600&h=400&fit=crop'} alt={product.name} className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text text-sm truncate">{product.name}</div>
                      <div className="text-xs text-text-muted capitalize">{product.category} &middot; MOQ: {product.moq} &middot; {product.priceRange}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {hasPermission('products.edit') && <button onClick={() => startEdit(product)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>}
                      {hasPermission('products.delete') && (confirmDelete === product.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(product.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 cursor-pointer border-none transition-colors">Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-xs font-medium text-text-muted bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer border-none transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(product.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>
                      ))}
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
                  {hasPermission('gift_settings.edit') && <button onClick={startEditSettings} className={btnPrimary}>Edit Settings</button>}
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

        {/* ==================== USERS TAB ==================== */}
        {activeTab === 'users' && hasPermission('users.view') && (
          <>
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={() => downloadCSV('users', 'users.csv')} className={btnSecondary}>Export CSV</button>
              {!editingUser && hasPermission('users.create') && <button onClick={startAddUser} className={btnPrimary}>+ Add User</button>}
            </div>

            {userError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{userError}</div>
            )}

            {/* Add / Edit User Form */}
            {userForm && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
                <h3 className="font-semibold text-text mb-4">{editingUser === 'new' ? 'Add New User' : 'Edit User'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Username</label>
                    <input type="text" value={userForm.username} onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))} className={'w-full ' + inputClass} placeholder="Username (min 3 chars)" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))} className={'w-full ' + inputClass} placeholder="user@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Password{editingUser !== 'new' && ' (leave blank to keep)'}
                    </label>
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))} className={'w-full ' + inputClass} placeholder={editingUser === 'new' ? 'Min 6 characters' : 'Leave blank to keep current'} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Role</label>
                    <select value={userForm.role_id} onChange={(e) => setUserForm((prev) => ({ ...prev, role_id: Number(e.target.value) }))} className={'w-full ' + inputClass}>
                      {roles.filter(r => isSuperAdmin || !r.is_system).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}{r.is_system ? ' (System)' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={saveUser} disabled={userSaving} className={btnPrimary}>
                    {userSaving ? 'Saving...' : editingUser === 'new' ? 'Create User' : 'Update User'}
                  </button>
                  <button onClick={cancelUser} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            )}

            {/* Users List */}
            {usersLoading ? (
              <p className="text-text-muted text-sm">Loading users...</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-text-muted text-left">
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-text-muted">{u.id}</td>
                        <td className="px-4 py-3 font-medium text-text">{u.username}</td>
                        <td className="px-4 py-3 text-text-muted">{u.email || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role_is_system ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {hasPermission('users.edit') && <button onClick={() => startEditUser(u)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>}
                            {hasPermission('users.delete') && u.id !== user.id && (
                              confirmDeleteUser === u.id ? (
                                <div className="flex gap-1">
                                  <button onClick={() => handleDeleteUser(u.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 cursor-pointer border-none transition-colors">Confirm</button>
                                  <button onClick={() => setConfirmDeleteUser(null)} className="px-3 py-1.5 text-xs font-medium text-text-muted bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer border-none transition-colors">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteUser(u.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ==================== ROLES TAB ==================== */}
        {activeTab === 'roles' && hasPermission('roles.manage') && (
          <>
            <div className="flex justify-end mb-4">
              {!editingRole && <button onClick={startAddRole} className={btnPrimary}>+ Add Role</button>}
            </div>

            {roleError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{roleError}</div>
            )}

            {/* Add / Edit Role Form */}
            {roleForm && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
                <h3 className="font-semibold text-text mb-4">{editingRole === 'new' ? 'Add New Role' : 'Edit Role'}</h3>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-text-muted mb-1">Role Name</label>
                  <input type="text" value={roleForm.name} onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))} className={'w-full max-w-sm ' + inputClass} placeholder="e.g. Content Editor" />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-medium text-text-muted">Permissions</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPerms} className={addBtn}>Select All</button>
                      <span className="text-text-muted text-xs">|</span>
                      <button type="button" onClick={deselectAllPerms} className={addBtn}>Deselect All</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {permGroups.map((group) => (
                      <div key={group.label} className={`p-3 rounded-lg ${group.soon ? 'bg-gray-50 opacity-60' : 'bg-surface'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-text">{group.label}</span>
                          {group.soon && <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-text-muted rounded">Coming soon</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.permissions.map((perm) => {
                            const checked = roleForm.permissions.includes(perm.key);
                            return (
                              <label key={perm.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs cursor-pointer border transition-colors ${
                                checked ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-gray-200 text-text-muted hover:border-gray-300'
                              } ${group.soon ? 'pointer-events-none' : ''}`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleRolePerm(perm.key)} className="sr-only" disabled={group.soon} />
                                {perm.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={saveRole} disabled={roleSaving} className={btnPrimary}>
                    {roleSaving ? 'Saving...' : editingRole === 'new' ? 'Create Role' : 'Update Role'}
                  </button>
                  <button onClick={cancelRole} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            )}

            {/* Roles List */}
            {rolesLoading ? (
              <p className="text-text-muted text-sm">Loading roles...</p>
            ) : (
              <div className="space-y-3">
                {roles.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-text">{r.name}</h4>
                          {r.is_system ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">System Role</span>
                          ) : null}
                          <span className="text-xs text-text-muted">{r.userCount} user{r.userCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!r.is_system && (
                          <>
                            <button onClick={() => startEditRole(r)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>
                            {confirmDeleteRole === r.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleDeleteRole(r.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 cursor-pointer border-none transition-colors">Confirm</button>
                                <button onClick={() => setConfirmDeleteRole(null)} className="px-3 py-1.5 text-xs font-medium text-text-muted bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer border-none transition-colors">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteRole(r.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.is_system ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">All Permissions</span>
                      ) : r.permissions.length > 0 ? (
                        r.permissions.map((p) => (
                          <span key={p} className="px-2 py-0.5 bg-blue-50 text-accent text-xs rounded-full">{p}</span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted italic">No permissions</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== PAGES TAB ==================== */}
        {activeTab === 'pages' && hasPermission('pages.edit') && (
          <>
            {pageError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{pageError}</div>
            )}

            {editingPage && pageForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text text-lg">{PAGE_LABELS[editingPage] || editingPage}</h3>
                  <div className="flex gap-3">
                    <button onClick={savePage} disabled={pageSaving} className={btnPrimary}>{pageSaving ? 'Saving...' : 'Save Changes'}</button>
                    <button onClick={cancelPage} className={btnSecondary}>Cancel</button>
                  </div>
                </div>

                {/* Language Toggle */}
                <div className="flex gap-2">
                  <button onClick={() => setShowPageAr(false)} className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer border-none transition-colors ${!showPageAr ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}>
                    🇬🇧 English Content
                  </button>
                  <button onClick={() => setShowPageAr(true)} className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer border-none transition-colors ${showPageAr ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
                    🇸🇦 المحتوى العربي
                  </button>
                </div>

                {!showPageAr ? (
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  {Object.entries(pageForm).map(([key, value]) => {
                    // String fields
                    if (typeof value === 'string') {
                      const isLong = value.length > 100;
                      return (
                        <div key={key}>
                          <label className="block text-xs font-medium text-text-muted mb-1">{key}</label>
                          {isLong ? (
                            <textarea value={value} onChange={(e) => handlePageFieldChange(key, e.target.value)} rows={3} className={'w-full ' + inputClass + ' resize-none'} />
                          ) : (
                            <input type="text" value={value} onChange={(e) => handlePageFieldChange(key, e.target.value)} className={'w-full ' + inputClass} />
                          )}
                        </div>
                      );
                    }
                    // Array of strings
                    if (Array.isArray(value) && value.length >= 0 && (value.length === 0 || typeof value[0] === 'string')) {
                      return (
                        <div key={key}>
                          <label className="block text-xs font-medium text-text-muted mb-2">{key}</label>
                          {value.map((item, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                              <input type="text" value={item} onChange={(e) => handlePageArrayChange(key, i, e.target.value)} className={'flex-1 ' + inputClass} />
                              <button onClick={() => removePageArrayItem(key, i)} className={btnDanger}>&times;</button>
                            </div>
                          ))}
                          <button onClick={() => addPageArrayItem(key, '')} className={addBtn}>+ Add item</button>
                        </div>
                      );
                    }
                    // Array of objects (stats, steps, etc.)
                    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                      const fields = Object.keys(value[0]);
                      return (
                        <div key={key}>
                          <label className="block text-xs font-medium text-text-muted mb-2">{key}</label>
                          {value.map((item, i) => (
                            <div key={i} className="flex gap-2 mb-2 items-start p-3 bg-surface rounded-lg">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fields.map((f) => (
                                  <div key={f}>
                                    <label className="block text-[10px] text-text-muted mb-0.5">{f}</label>
                                    {(item[f] || '').length > 80 ? (
                                      <textarea value={item[f] || ''} onChange={(e) => handlePageArrayObjChange(key, i, f, e.target.value)} rows={2} className={'w-full ' + inputClass + ' resize-none text-xs'} />
                                    ) : (
                                      <input type="text" value={item[f] || ''} onChange={(e) => handlePageArrayObjChange(key, i, f, e.target.value)} className={'w-full ' + inputClass + ' text-xs'} />
                                    )}
                                  </div>
                                ))}
                              </div>
                              <button onClick={() => removePageArrayItem(key, i)} className={btnDanger + ' mt-4'}>&times;</button>
                            </div>
                          ))}
                          <button onClick={() => addPageArrayItem(key, Object.fromEntries(fields.map(f => [f, ''])))} className={addBtn}>+ Add item</button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                ) : (
                <div className="bg-white rounded-xl border border-amber-200 p-6 space-y-4" dir="rtl">
                  <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                    ✏️ أدخل النسخة العربية لكل حقل. الحقول الفارغة ستعرض المحتوى الإنجليزي كبديل.
                  </p>
                  {Object.entries(pageForm).map(([key, value]) => {
                    const arValue = pageFormAr?.[key];
                    // String fields
                    if (typeof value === 'string') {
                      const isLong = value.length > 100;
                      return (
                        <div key={key}>
                          <label className="block text-xs font-medium text-text-muted mb-1">{key} <span className="text-[10px] text-gray-400 font-normal">({typeof value === 'string' && value ? value.slice(0, 40) + '...' : 'فارغ'})</span></label>
                          {isLong ? (
                            <textarea value={arValue || ''} onChange={(e) => setPageFormAr(prev => ({ ...prev, [key]: e.target.value }))} rows={3} className={'w-full ' + inputClass + ' resize-none'} placeholder={`الترجمة العربية لـ ${key}`} />
                          ) : (
                            <input type="text" value={arValue || ''} onChange={(e) => setPageFormAr(prev => ({ ...prev, [key]: e.target.value }))} className={'w-full ' + inputClass} placeholder={`الترجمة العربية لـ ${key}`} />
                          )}
                        </div>
                      );
                    }
                    // Array of strings
                    if (Array.isArray(value) && value.length >= 0 && (value.length === 0 || typeof value[0] === 'string')) {
                      const arArr = arValue || value.map(() => '');
                      return (
                        <div key={key}>
                          <label className="block text-xs font-medium text-text-muted mb-2">{key}</label>
                          {value.map((item, i) => (
                            <div key={i} className="flex gap-2 mb-2 items-center">
                              <span className="text-[10px] text-gray-400 shrink-0 max-w-32 truncate" title={item}>{item || '—'}</span>
                              <input type="text" value={arArr[i] || ''} onChange={(e) => {
                                setPageFormAr(prev => {
                                  const arr = [...(prev?.[key] || value.map(() => ''))];
                                  arr[i] = e.target.value;
                                  return { ...prev, [key]: arr };
                                });
                              }} className={'flex-1 ' + inputClass} placeholder="الترجمة العربية" />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    // Array of objects
                    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                      const fields = Object.keys(value[0]);
                      const arArr = arValue || value.map(() => Object.fromEntries(fields.map(f => [f, ''])));
                      return (
                        <div key={key}>
                          <label className="block text-xs font-medium text-text-muted mb-2">{key}</label>
                          {value.map((item, i) => (
                            <div key={i} className="mb-2 p-3 bg-surface rounded-lg">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fields.map((f) => (
                                  <div key={f}>
                                    <label className="block text-[10px] text-text-muted mb-0.5">{f} <span className="text-gray-400">({(item[f] || '').slice(0, 25)}...)</span></label>
                                    <input type="text" value={arArr[i]?.[f] || ''} onChange={(e) => {
                                      setPageFormAr(prev => {
                                        const arr = [...(prev?.[key] || value.map(() => Object.fromEntries(fields.map(ff => [ff, '']))))];
                                        arr[i] = { ...(arr[i] || {}), [f]: e.target.value };
                                        return { ...prev, [key]: arr };
                                      });
                                    }} className={'w-full ' + inputClass + ' text-xs'} placeholder="بالعربي" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Add New Page button */}
                <div className="flex justify-end">
                  <button onClick={() => { setShowNewPageForm(true); setPageError(''); }} className={btnPrimary}>+ New Page</button>
                </div>

                {/* New Page Form */}
                {showNewPageForm && (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                    <h4 className="font-semibold text-text">Create New Page</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Page Title</label>
                        <input
                          type="text"
                          value={newPageTitle}
                          onChange={(e) => {
                            setNewPageTitle(e.target.value);
                            // Auto-generate slug from title
                            setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                          }}
                          placeholder="e.g. FAQ, Services, Partners"
                          className={'w-full ' + inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">URL Slug</label>
                        <input
                          type="text"
                          value={newPageSlug}
                          onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          placeholder="e.g. faq, services, partners"
                          className={'w-full ' + inputClass}
                        />
                        <p className="text-[10px] text-text-muted mt-1">URL: /page/{newPageSlug || 'slug'}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={createNewPage} disabled={newPageCreating} className={btnPrimary}>{newPageCreating ? 'Creating...' : 'Create Page'}</button>
                      <button onClick={() => { setShowNewPageForm(false); setNewPageTitle(''); setNewPageSlug(''); setPageError(''); }} className={btnSecondary}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Pages List */}
                <div className="space-y-3">
                  {pagesList.map((page) => (
                    <div key={page.slug} className={`bg-white rounded-xl border p-5 flex items-center justify-between ${page.hidden ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-text">{PAGE_LABELS[page.slug] || page.title || page.slug}</h4>
                          {page.is_custom ? (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Custom</span>
                          ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">Core</span>
                          )}
                          {page.hidden ? (
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Hidden</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                          /{page.is_custom ? `page/${page.slug}` : (page.slug === 'global' ? '—' : page.slug)}
                          {' · '}Last updated: {page.updated_at ? new Date(page.updated_at).toLocaleString() : 'Never'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditPage(page.slug)} className="px-4 py-2 text-sm font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>
                        {page.slug !== 'global' && (
                          <button
                            onClick={() => togglePageVisibility(page.slug, page.hidden)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg cursor-pointer border-none transition-colors ${page.hidden ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-orange-700 bg-orange-50 hover:bg-orange-100'}`}
                            title={page.hidden ? 'Show page' : 'Hide page'}
                          >
                            {page.hidden ? 'Show' : 'Hide'}
                          </button>
                        )}
                        {page.is_custom ? (
                          <button
                            onClick={() => deletePage(page.slug)}
                            className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors"
                            title="Delete page permanently"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== CATEGORIES TAB ==================== */}
        {activeTab === 'categories' && hasPermission('products.view') && (
          <>
            {catError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{catError}</div>}

            {editingCat && catForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text text-lg">{editingCat === 'new' ? 'Add Category' : `Edit: ${editingCat.name}`}</h3>
                  <div className="flex gap-3">
                    <button onClick={saveCat} disabled={catSaving} className={btnPrimary}>{catSaving ? 'Saving...' : 'Save'}</button>
                    <button onClick={cancelCat} className={btnSecondary}>Cancel</button>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {editingCat === 'new' && (
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">ID / Slug *</label>
                        <input type="text" value={catForm.id} onChange={(e) => setCatForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className={'w-full ' + inputClass} placeholder="e.g. usb, chargers" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Name *</label>
                      <input type="text" value={catForm.name} onChange={(e) => {
                        setCatForm(prev => ({
                          ...prev,
                          name: e.target.value,
                          ...(editingCat === 'new' && !prev.id ? { id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {})
                        }));
                      }} className={'w-full ' + inputClass} placeholder="e.g. USB & Flash Drives" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Icon (emoji)</label>
                      <input type="text" value={catForm.icon} onChange={(e) => setCatForm(prev => ({ ...prev, icon: e.target.value }))} className={'w-full ' + inputClass} placeholder="e.g. 💾" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
                    <input type="text" value={catForm.description} onChange={(e) => setCatForm(prev => ({ ...prev, description: e.target.value }))} className={'w-full ' + inputClass} placeholder="Brief description of this category" />
                  </div>
                  {/* Arabic fields for category */}
                  <details className="border border-amber-200 rounded-lg bg-amber-50/50 mt-3">
                    <summary className="px-4 py-2 cursor-pointer font-semibold text-xs text-amber-800 select-none">🌐 المحتوى العربي (Arabic Content)</summary>
                    <div className="p-4 space-y-3 border-t border-amber-200" dir="rtl">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">اسم الفئة</label>
                        <input type="text" value={catForm.name_ar || ''} onChange={(e) => setCatForm(prev => ({ ...prev, name_ar: e.target.value }))} className={'w-full ' + inputClass} placeholder="اسم الفئة بالعربي" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">الوصف</label>
                        <input type="text" value={catForm.description_ar || ''} onChange={(e) => setCatForm(prev => ({ ...prev, description_ar: e.target.value }))} className={'w-full ' + inputClass} placeholder="وصف الفئة بالعربي" />
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  {hasPermission('products.create') && <button onClick={startNewCat} className={btnPrimary}>+ Add Category</button>}
                </div>

                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between ${cat.is_active ? 'border-gray-100' : 'border-orange-200 bg-orange-50/30'}`}>
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl">{cat.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-text text-sm">{cat.name}</h4>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-mono">{cat.id}</span>
                            {!cat.is_active && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Inactive</span>}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">{cat.description || 'No description'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasPermission('products.edit') && (
                          <>
                            <button onClick={() => startEditCat(cat)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>
                            <button
                              onClick={() => toggleCatActive(cat)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer border-none transition-colors ${cat.is_active ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                            >
                              {cat.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                        {hasPermission('products.delete') && (
                          <button onClick={() => deleteCat(cat.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <div className="text-center py-10 text-text-muted">No categories yet.</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== FORMS TAB ==================== */}
        {activeTab === 'forms' && hasPermission('forms.view') && (
          <>
            <div className="flex justify-end mb-4">
              <button onClick={() => downloadCSV('submissions', 'submissions.csv')} className={btnSecondary}>Export All Submissions</button>
            </div>
            {formsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formsError}</div>
            )}

            {/* Viewing submissions for a form */}
            {viewingSubmissions ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text text-lg">
                    Submissions — {formsList.find(f => f.id === viewingSubmissions)?.name}
                    <span className="ml-2 text-sm font-normal text-text-muted">({submissionsTotal} total)</span>
                  </h3>
                  <button onClick={closeSubmissions} className={btnSecondary}>Back to Forms</button>
                </div>

                {/* Viewing single submission detail */}
                {viewingSubmission ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-text">Submission #{viewingSubmission.id}</h4>
                      <button onClick={() => setViewingSubmission(null)} className={btnSecondary}>Back to List</button>
                    </div>
                    <div className="text-xs text-text-muted">Submitted: {new Date(viewingSubmission.created_at).toLocaleString()}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(viewingSubmission.data).filter(([k]) => k !== '_hp').map(([key, value]) => (
                        <div key={key} className="bg-surface rounded-lg p-3">
                          <div className="text-[10px] font-medium text-text-muted uppercase tracking-wide mb-1">{key}</div>
                          <div className="text-sm text-text">{value || '—'}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <label className="text-xs font-medium text-text-muted">Status:</label>
                      <select
                        value={viewingSubmission.status}
                        onChange={(e) => updateSubmissionStatus(viewingSubmission.id, e.target.value)}
                        className={inputClass + ' text-xs'}
                      >
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="replied">Replied</option>
                        <option value="archived">Archived</option>
                      </select>
                      <button onClick={() => { deleteSubmission(viewingSubmission.id); setViewingSubmission(null); }} className="text-xs text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer">Delete</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {submissionsLoading ? (
                      <div className="text-center py-10 text-text-muted">Loading submissions...</div>
                    ) : submissions.length === 0 ? (
                      <div className="text-center py-10 text-text-muted">No submissions yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {submissions.map((sub) => (
                          <div key={sub.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-text truncate">{sub.data.name || sub.data.email || `#${sub.id}`}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  sub.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                  sub.status === 'read' ? 'bg-gray-100 text-gray-600' :
                                  sub.status === 'replied' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-500'
                                }`}>{sub.status}</span>
                              </div>
                              <p className="text-xs text-text-muted mt-0.5 truncate">
                                {sub.data.email && `${sub.data.email} · `}{new Date(sub.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-3">
                              <button onClick={() => setViewingSubmission(sub)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none">View</button>
                              <button onClick={() => deleteSubmission(sub.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none">Delete</button>
                            </div>
                          </div>
                        ))}
                        {/* Pagination */}
                        {submissionsTotal > 15 && (
                          <div className="flex justify-center gap-2 pt-3">
                            {Array.from({ length: Math.ceil(submissionsTotal / 15) }, (_, i) => (
                              <button
                                key={i}
                                onClick={() => loadSubmissions(viewingSubmissions, i + 1)}
                                className={`px-3 py-1 text-xs rounded-lg border-none cursor-pointer ${submissionsPage === i + 1 ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
                              >{i + 1}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : editingForm && formDef ? (
              /* Form builder */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text text-lg">{editingForm === 'new' ? 'Create New Form' : `Edit: ${editingForm.name}`}</h3>
                  <div className="flex gap-3">
                    <button onClick={saveForm} disabled={formSaving} className={btnPrimary}>{formSaving ? 'Saving...' : 'Save Form'}</button>
                    <button onClick={cancelForm} className={btnSecondary}>Cancel</button>
                  </div>
                </div>

                {/* Form Details */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Form Name *</label>
                      <input type="text" value={formDef.name} onChange={(e) => {
                        setFormDef(prev => ({
                          ...prev,
                          name: e.target.value,
                          ...(editingForm === 'new' ? { slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {})
                        }));
                      }} className={'w-full ' + inputClass} placeholder="e.g. Quote Request, Contact Form" />
                    </div>
                    {editingForm === 'new' && (
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Slug *</label>
                        <input type="text" value={formDef.slug} onChange={(e) => setFormDef(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} className={'w-full ' + inputClass} placeholder="e.g. quote-request" />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-text-muted mb-1">Description</label>
                      <input type="text" value={formDef.description} onChange={(e) => setFormDef(prev => ({ ...prev, description: e.target.value }))} className={'w-full ' + inputClass} placeholder="Brief description of this form" />
                    </div>
                  </div>
                </div>

                {/* Form Fields Builder */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-text">Fields ({formDef.fields.length})</h4>
                    <button onClick={addField} className={btnPrimary}>+ Add Field</button>
                  </div>

                  {formDef.fields.length === 0 && (
                    <p className="text-center text-text-muted text-sm py-4">No fields yet. Click "+ Add Field" to start building your form.</p>
                  )}

                  {formDef.fields.map((field, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-surface">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">Field {i + 1}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-0.5 bg-gray-200 rounded cursor-pointer border-none disabled:opacity-30">↑</button>
                          <button onClick={() => moveField(i, 1)} disabled={i === formDef.fields.length - 1} className="text-xs px-1.5 py-0.5 bg-gray-200 rounded cursor-pointer border-none disabled:opacity-30">↓</button>
                          <button onClick={() => removeField(i)} className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded cursor-pointer border-none">Remove</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-text-muted mb-0.5">Label *</label>
                          <input type="text" value={field.label} onChange={(e) => updateField(i, 'label', e.target.value)} className={'w-full ' + inputClass + ' text-xs'} placeholder="e.g. Full Name" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted mb-0.5">Field Name</label>
                          <input type="text" value={field.name} onChange={(e) => { updateField(i, 'name', e.target.value); updateField(i, '_nameEdited', true); }} className={'w-full ' + inputClass + ' text-xs'} placeholder="e.g. full_name" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted mb-0.5">Type</label>
                          <select value={field.type} onChange={(e) => updateField(i, 'type', e.target.value)} className={'w-full ' + inputClass + ' text-xs bg-white'}>
                            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-text-muted mb-0.5">Placeholder</label>
                          <input type="text" value={field.placeholder || ''} onChange={(e) => updateField(i, 'placeholder', e.target.value)} className={'w-full ' + inputClass + ' text-xs'} />
                        </div>
                        <div className="flex items-center gap-3 pt-4">
                          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                            <input type="checkbox" checked={field.required || false} onChange={(e) => updateField(i, 'required', e.target.checked)} />
                            Required
                          </label>
                        </div>
                      </div>
                      {field.type === 'select' && (
                        <div>
                          <label className="block text-[10px] text-text-muted mb-0.5">Options (one per line)</label>
                          <textarea
                            value={(field.options || []).join('\n')}
                            onChange={(e) => updateField(i, 'options', e.target.value.split('\n'))}
                            rows={3}
                            className={'w-full ' + inputClass + ' text-xs resize-none'}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Form Settings */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <h4 className="font-semibold text-text">Success Settings</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Submit Button Text</label>
                      <input type="text" value={formDef.settings.submitButton || ''} onChange={(e) => setFormDef(prev => ({ ...prev, settings: { ...prev.settings, submitButton: e.target.value } }))} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Success Title</label>
                      <input type="text" value={formDef.settings.successTitle || ''} onChange={(e) => setFormDef(prev => ({ ...prev, settings: { ...prev.settings, successTitle: e.target.value } }))} className={'w-full ' + inputClass} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-text-muted mb-1">Success Message</label>
                      <textarea value={formDef.settings.successMessage || ''} onChange={(e) => setFormDef(prev => ({ ...prev, settings: { ...prev.settings, successMessage: e.target.value } }))} rows={2} className={'w-full ' + inputClass + ' resize-none'} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Forms list */
              <div className="space-y-4">
                <div className="flex justify-end">
                  {hasPermission('forms.create') && <button onClick={startNewForm} className={btnPrimary}>+ New Form</button>}
                </div>

                {formsLoading ? (
                  <div className="text-center py-10 text-text-muted">Loading forms...</div>
                ) : formsList.length === 0 ? (
                  <div className="text-center py-10 text-text-muted">No forms yet. Create your first form!</div>
                ) : (
                  <div className="space-y-3">
                    {formsList.map((f) => (
                      <div key={f.id} className={`bg-white rounded-xl border p-5 flex items-center justify-between ${f.is_active ? 'border-gray-100' : 'border-orange-200 bg-orange-50/30'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-text">{f.name}</h4>
                            {!f.is_active && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Inactive</span>}
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{f.submission_count || 0} submissions</span>
                          </div>
                          <p className="text-xs text-text-muted mt-1">{f.description || 'No description'} · slug: {f.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => loadSubmissions(f.id)} className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer border-none transition-colors">Submissions</button>
                          {hasPermission('forms.edit') && <button onClick={() => startEditForm(f)} className="px-3 py-2 text-sm font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>}
                          {hasPermission('forms.delete') && <button onClick={() => deleteForm(f.id)} className="px-3 py-2 text-sm font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ==================== BLOG TAB ==================== */}
        {activeTab === 'blog' && hasPermission('pages.edit') && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-text">{blogPosts.length} Blog Posts</h3>
              <div className="flex gap-2">
                <button onClick={() => downloadCSV('blog', 'blog_posts.csv')} className={btnSecondary}>Export CSV</button>
                {!editingBlog && <button onClick={startNewBlog} className={btnPrimary}>+ New Post</button>}
              </div>
            </div>

            {blogError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{blogError}</div>}

            {blogForm && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
                <h2 className="font-semibold text-text mb-4">{editingBlog === 'new' ? 'New Blog Post' : 'Edit Post'}</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Title</label>
                      <input type="text" value={blogForm.title} onChange={(e) => setBlogForm(prev => ({ ...prev, title: e.target.value }))} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Slug (URL)</label>
                      <input type="text" value={blogForm.slug} onChange={(e) => setBlogForm(prev => ({ ...prev, slug: e.target.value }))} className={'w-full ' + inputClass} disabled={editingBlog !== 'new'} placeholder="my-blog-post" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Excerpt (short summary)</label>
                    <textarea value={blogForm.excerpt} onChange={(e) => setBlogForm(prev => ({ ...prev, excerpt: e.target.value }))} rows={2} className={'w-full resize-none ' + inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Content (HTML)</label>
                    <textarea value={blogForm.content} onChange={(e) => setBlogForm(prev => ({ ...prev, content: e.target.value }))} rows={12} className={'w-full resize-y font-mono text-sm ' + inputClass} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Cover Image URL</label>
                      <input type="text" value={blogForm.cover_image} onChange={(e) => setBlogForm(prev => ({ ...prev, cover_image: e.target.value }))} className={'w-full ' + inputClass} placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Author</label>
                      <input type="text" value={blogForm.author} onChange={(e) => setBlogForm(prev => ({ ...prev, author: e.target.value }))} className={'w-full ' + inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Status</label>
                      <select value={blogForm.status} onChange={(e) => setBlogForm(prev => ({ ...prev, status: e.target.value }))} className={'w-full bg-white ' + inputClass}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Tags (comma separated)</label>
                    <input type="text" value={(blogForm.tags || []).join(', ')} onChange={(e) => setBlogForm(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} className={'w-full ' + inputClass} placeholder="3d-printing, corporate-gifts" />
                  </div>
                  {/* Arabic Blog Content */}
                  <details className="border border-amber-200 rounded-lg bg-amber-50/50">
                    <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-amber-800 select-none">🌐 المحتوى العربي (Arabic Content)</summary>
                    <div className="p-4 space-y-4 border-t border-amber-200" dir="rtl">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">عنوان المقال</label>
                        <input type="text" value={blogForm.title_ar || ''} onChange={(e) => setBlogForm(prev => ({ ...prev, title_ar: e.target.value }))} className={'w-full ' + inputClass} placeholder="عنوان المقال بالعربي" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">الملخص</label>
                        <textarea value={blogForm.excerpt_ar || ''} onChange={(e) => setBlogForm(prev => ({ ...prev, excerpt_ar: e.target.value }))} rows={2} className={'w-full resize-none ' + inputClass} placeholder="ملخص قصير بالعربي" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">المحتوى (HTML)</label>
                        <textarea value={blogForm.content_ar || ''} onChange={(e) => setBlogForm(prev => ({ ...prev, content_ar: e.target.value }))} rows={12} className={'w-full resize-y font-mono text-sm ' + inputClass} placeholder="محتوى المقال بالعربي..." />
                      </div>
                    </div>
                  </details>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={saveBlog} disabled={blogSaving} className={btnPrimary}>{blogSaving ? 'Saving...' : 'Save Post'}</button>
                  <button onClick={cancelBlog} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            )}

            {blogLoading ? (
              <div className="text-center py-12 text-text-muted">Loading posts...</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {blogPosts.map((post) => (
                    <div key={post.id} className="flex items-center gap-4 px-6 py-4">
                      {post.cover_image && <img src={post.cover_image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text text-sm truncate">{post.title}</div>
                        <div className="text-xs text-text-muted">{post.author} &middot; {new Date(post.created_at).toLocaleDateString()} &middot;
                          <span className={`ms-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{post.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => startEditBlog(post)} className="px-3 py-1.5 text-xs font-medium text-primary bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Edit</button>
                        {confirmDeleteBlog === post.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => deleteBlog(post.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 cursor-pointer border-none transition-colors">Confirm</button>
                            <button onClick={() => setConfirmDeleteBlog(null)} className="px-3 py-1.5 text-xs font-medium text-text-muted bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer border-none transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteBlog(post.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer border-none transition-colors">Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {blogPosts.length === 0 && !blogLoading && (
                    <div className="px-6 py-12 text-center text-text-muted text-sm">No blog posts yet. Create your first post!</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== LAYOUT (HEADER & FOOTER) TAB ==================== */}
        {activeTab === 'layout' && hasPermission('pages.edit') && (
          <>
            {layoutError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{layoutError}</div>}
            {layoutSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{layoutSuccess}</div>}

            {!layoutEditing ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-text">Header & Footer Settings</h2>
                  <button onClick={startEditLayout} className={btnPrimary}>Edit</button>
                </div>

                {/* Preview - Header */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Header</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Company Name</div>
                      <div className="font-medium text-text">{globalContent.companyName || '3DTech'}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">CTA Button Text</div>
                      <div className="font-medium text-text">{globalContent.headerCta || 'Request Quote'}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Logo</div>
                      <div className="flex items-center gap-3">
                        <img src={globalContent.logoUrl || '/logo.jpeg'} alt="Logo" className="h-10 w-10 object-contain rounded" />
                        <span className="text-sm text-text-muted">{globalContent.logoUrl || '/logo.jpeg'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview - Footer */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Footer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Tagline</div>
                      <div className="text-sm text-text">{globalContent.tagline || '—'}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Location</div>
                      <div className="text-sm text-text">{globalContent.location || 'Cairo, Egypt'}</div>
                    </div>
                  </div>
                </div>

                {/* Preview - Contact Info */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Email</div>
                      <div className="text-sm text-text">{globalContent.email || '—'}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Phone 1</div>
                      <div className="text-sm text-text">{globalContent.phone1 || '—'}</div>
                    </div>
                    <div className="bg-surface rounded-lg p-4">
                      <div className="text-xs text-text-muted mb-1">Phone 2</div>
                      <div className="text-sm text-text">{globalContent.phone2 || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Preview - Social Links */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Social Media Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Facebook', key: 'socialFacebook' },
                      { label: 'Instagram', key: 'socialInstagram' },
                      { label: 'LinkedIn', key: 'socialLinkedin' },
                      { label: 'Twitter / X', key: 'socialTwitter' },
                    ].map((s) => (
                      <div key={s.key} className="bg-surface rounded-lg p-4">
                        <div className="text-xs text-text-muted mb-1">{s.label}</div>
                        <div className="text-sm text-text">{globalContent[s.key] || <span className="text-text-muted italic">Not set</span>}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview - Why Us */}
                <div>
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Why Us (Contact Sidebar)</h3>
                  <div className="bg-surface rounded-lg p-4">
                    <ul className="space-y-1">
                      {(globalContent.whyUs || []).map((item, i) => (
                        <li key={i} className="text-sm text-text flex items-center gap-2">
                          <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-text mb-6">Edit Header & Footer</h2>

                {/* Header Section */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Header</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Company Name</label>
                      <input value={layoutForm.companyName} onChange={(e) => updateLayoutField('companyName', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Header CTA Button Text</label>
                      <input value={layoutForm.headerCta} onChange={(e) => updateLayoutField('headerCta', e.target.value)} className={inputClass} placeholder="Request Quote" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Logo</label>
                    <ImageUploader value={layoutForm.logoUrl} onChange={(v) => updateLayoutField('logoUrl', v)} />
                  </div>
                </div>

                {/* Footer Section */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Footer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Tagline</label>
                      <textarea value={layoutForm.tagline} onChange={(e) => updateLayoutField('tagline', e.target.value)} rows={2} className={inputClass} placeholder="Company tagline shown in footer" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Location</label>
                      <input value={layoutForm.location} onChange={(e) => updateLayoutField('location', e.target.value)} className={inputClass} placeholder="Cairo, Egypt" />
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
                      <input type="email" value={layoutForm.email} onChange={(e) => updateLayoutField('email', e.target.value)} className={inputClass} placeholder="info@3dtecheg.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Phone 1</label>
                      <input value={layoutForm.phone1} onChange={(e) => updateLayoutField('phone1', e.target.value)} className={inputClass} placeholder="+201018559479" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Phone 2</label>
                      <input value={layoutForm.phone2} onChange={(e) => updateLayoutField('phone2', e.target.value)} className={inputClass} placeholder="+201005449959" />
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Social Media Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Facebook URL</label>
                      <input value={layoutForm.socialFacebook} onChange={(e) => updateLayoutField('socialFacebook', e.target.value)} className={inputClass} placeholder="https://facebook.com/3dtech" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Instagram URL</label>
                      <input value={layoutForm.socialInstagram} onChange={(e) => updateLayoutField('socialInstagram', e.target.value)} className={inputClass} placeholder="https://instagram.com/3dtech" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">LinkedIn URL</label>
                      <input value={layoutForm.socialLinkedin} onChange={(e) => updateLayoutField('socialLinkedin', e.target.value)} className={inputClass} placeholder="https://linkedin.com/company/3dtech" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Twitter / X URL</label>
                      <input value={layoutForm.socialTwitter} onChange={(e) => updateLayoutField('socialTwitter', e.target.value)} className={inputClass} placeholder="https://x.com/3dtech" />
                    </div>
                  </div>
                </div>

                {/* Why Us List */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Why Us (Contact Sidebar)</h3>
                  {layoutForm.whyUs.map((item, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input value={item} onChange={(e) => updateLayoutListItem('whyUs', i, e.target.value)} className={inputClass + ' flex-1'} placeholder="Selling point..." />
                      {layoutForm.whyUs.length > 1 && <button onClick={() => removeLayoutListItem('whyUs', i)} className={btnDanger}>&times;</button>}
                    </div>
                  ))}
                  <button onClick={() => addLayoutListItem('whyUs')} className={addBtn}>+ Add Item</button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-gray-100">
                  <button onClick={saveLayout} disabled={layoutSaving} className={btnPrimary}>
                    {layoutSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={cancelLayout} className={btnSecondary}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === 'settings' && hasPermission('settings.smtp') && (
          <>
            {smtpError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{smtpError}</div>}
            {smtpSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{smtpSuccess}</div>}

            {smtpLoading ? (
              <div className="text-center py-10 text-text-muted">Loading settings...</div>
            ) : (
              <div className="space-y-6">
                {/* SMTP Configuration */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <h3 className="font-semibold text-text text-lg">SMTP Email Configuration</h3>
                  <p className="text-xs text-text-muted">Configure your email server to send notifications when form submissions are received.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">SMTP Host *</label>
                      <input type="text" value={smtpForm.host} onChange={(e) => setSmtpForm(prev => ({ ...prev, host: e.target.value }))} className={'w-full ' + inputClass} placeholder="smtp.gmail.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Port *</label>
                        <input type="number" value={smtpForm.port} onChange={(e) => setSmtpForm(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))} className={'w-full ' + inputClass} />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                          <input type="checkbox" checked={smtpForm.secure || false} onChange={(e) => setSmtpForm(prev => ({ ...prev, secure: e.target.checked }))} />
                          SSL/TLS (port 465)
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Username</label>
                      <input type="text" value={smtpForm.user} onChange={(e) => setSmtpForm(prev => ({ ...prev, user: e.target.value }))} className={'w-full ' + inputClass} placeholder="your@email.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Password</label>
                      <input type="password" value={smtpForm.pass} onChange={(e) => setSmtpForm(prev => ({ ...prev, pass: e.target.value }))} className={'w-full ' + inputClass} placeholder="App password or SMTP password" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">From Address</label>
                      <input type="text" value={smtpForm.from} onChange={(e) => setSmtpForm(prev => ({ ...prev, from: e.target.value }))} className={'w-full ' + inputClass} placeholder="3DTech <noreply@3dtecheg.com>" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Notification Email</label>
                      <input type="email" value={smtpForm.notifyEmail} onChange={(e) => setSmtpForm(prev => ({ ...prev, notifyEmail: e.target.value }))} className={'w-full ' + inputClass} placeholder="admin@3dtecheg.com" />
                      <p className="text-[10px] text-text-muted mt-1">Receives form submission notifications</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={saveSmtp} disabled={smtpSaving} className={btnPrimary}>{smtpSaving ? 'Saving...' : 'Save Settings'}</button>
                    <button onClick={testSmtpConnection} disabled={smtpTesting} className={btnSecondary}>{smtpTesting ? 'Testing...' : 'Test Connection'}</button>
                  </div>
                </div>

                {/* Test Email */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <h3 className="font-semibold text-text">Send Test Email</h3>
                  <p className="text-xs text-text-muted">Save your SMTP settings first, then send a test email to verify everything works.</p>
                  <div className="flex gap-3">
                    <input type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} className={inputClass + ' flex-1'} placeholder="recipient@example.com" />
                    <button onClick={sendTestEmail} disabled={sendingTest} className={btnPrimary}>{sendingTest ? 'Sending...' : 'Send Test'}</button>
                  </div>
                </div>

                {/* Common SMTP Presets */}
                <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                  <h3 className="font-semibold text-text">Quick Setup Presets</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
                      { label: 'Outlook', host: 'smtp-mail.outlook.com', port: 587, secure: false },
                      { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, secure: true },
                      { label: 'Zoho', host: 'smtp.zoho.com', port: 465, secure: true },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => setSmtpForm(prev => ({ ...prev, host: preset.host, port: preset.port, secure: preset.secure }))}
                        className="px-3 py-2 text-xs font-medium text-text-muted bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-text-muted">For Gmail, use an App Password (not your regular password). Enable 2FA first, then generate one at myaccount.google.com → Security → App passwords.</p>
                </div>

                {/* Database Backup */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h3 className="font-semibold text-text mb-3">Database Backup</h3>
                  <p className="text-sm text-text-muted mb-4">Download a full backup of the database. Backups are also created automatically on the server.</p>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('auth_token');
                      fetch('/api/backup', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
                        .then(r => { if (!r.ok) throw new Error('Backup failed'); return r.blob(); })
                        .then(blob => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = `backup_${new Date().toISOString().slice(0,10)}.db`;
                          document.body.appendChild(a); a.click(); a.remove();
                          URL.revokeObjectURL(url);
                        })
                        .catch(err => alert(err.message));
                    }}
                    className={btnPrimary}
                  >
                    Download Backup
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
