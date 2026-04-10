import { useState, useRef } from 'react';

export default function ImageUploader({ value, onChange, className = '' }) {
  const [mode, setMode] = useState('url'); // 'url' | 'upload'
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum 5MB.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error);
      }
      const data = await res.json();
      onChange(data.url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) uploadFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  return (
    <div className={className}>
      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer border-none transition-colors ${mode === 'url' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer border-none transition-colors ${mode === 'upload' ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted hover:bg-gray-200'}`}
        >
          Upload
        </button>
      </div>

      {mode === 'url' ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.jpg or /uploads/file.jpg"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-red-50' : 'border-gray-200 hover:border-gray-300'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          {uploading ? (
            <p className="text-sm text-text-muted">Uploading...</p>
          ) : (
            <>
              <p className="text-sm text-text-muted">Drag & drop or click to upload</p>
              <p className="text-[10px] text-gray-400 mt-1">JPEG, PNG, GIF, WebP, SVG — max 5MB</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {/* Preview */}
      {value && (
        <div className="mt-2 flex items-center gap-2">
          <img
            src={value}
            alt="Preview"
            className="h-12 w-12 object-cover rounded border border-gray-200"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="text-xs text-text-muted truncate flex-1">{value}</span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
