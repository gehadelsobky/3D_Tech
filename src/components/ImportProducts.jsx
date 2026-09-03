import { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

const fill = (template, values) =>
  Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), template);

/** Uploads a file to an endpoint that expects multipart form data. */
async function postFile(path, file, extra = {}) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(extra).forEach(([k, v]) => body.append(k, v));

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    body,
  });
  const data = await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ImportProducts({ onImported }) {
  const { t } = useLanguage();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const reset = () => {
    setFile(null); setReport(null); setError(''); setDone(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const downloadTemplate = async () => {
    const res = await fetch('/api/import/products/template', {
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
    });
    if (!res.ok) { setError('Could not download the template'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = 'products-import-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const validate = async () => {
    setBusy(true); setError(''); setReport(null);
    try {
      setReport(await postFile('/import/products/preview', file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true); setError('');
    try {
      const result = await postFile('/import/products', file, { fingerprint: report.fingerprint });
      setDone(result.imported);
      setReport(null);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const box = 'bg-white rounded-xl border border-gray-100 p-6';
  const btn = 'px-5 py-2 font-medium text-sm rounded-lg cursor-pointer border-none transition-colors';

  if (done !== null) {
    return (
      <div className={box}>
        <p className="text-green-700 font-medium mb-4">{fill(t('productImport.done'), { count: done })}</p>
        <button onClick={reset} className={`${btn} bg-gray-100 text-text-muted hover:bg-gray-200`}>
          {t('productImport.importAnother')}
        </button>
      </div>
    );
  }

  return (
    <div className={`${box} space-y-4`}>
      <div>
        <h3 className="font-semibold text-text">{t('productImport.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('productImport.intro')}</p>
      </div>

      <button onClick={downloadTemplate} className={`${btn} bg-blue-50 text-accent hover:bg-blue-100`}>
        {t('productImport.downloadTemplate')}
      </button>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div>
        <label htmlFor="import-products-file" className="block text-xs font-medium text-text-muted mb-1">
          {t('productImport.chooseFile')}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="import-products-file"
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setReport(null); setError(''); }}
            className="text-sm"
          />
          <button
            onClick={validate}
            disabled={!file || busy}
            className={`${btn} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`}
          >
            {busy && !report ? t('productImport.validating') : t('productImport.validate')}
          </button>
        </div>
      </div>

      {report && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-text">
            {fill(t('productImport.summary'), {
              total: report.rowCount, valid: report.validCount, errors: report.errors.length,
            })}
          </p>

          {report.unknownColumns.map((column) => (
            <p key={column} className="text-xs text-amber-700">
              ⚠ {fill(t('productImport.unknownColumn'), { column })}
            </p>
          ))}

          {report.errors.length > 0 && (
            <div className="max-h-56 overflow-y-auto space-y-1">
              {report.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">
                  ✗ {t('productImport.rowLabel')} {e.row} · <span className="font-mono">{e.column}</span> · {e.message}
                </p>
              ))}
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {report.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">
                  ⚠ {t('productImport.rowLabel')} {w.row} · {w.message}
                </p>
              ))}
            </div>
          )}

          {report.preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">{t('productImport.previewTitle')}</p>
              {report.preview.map((p, i) => (
                <p key={i} className="text-xs text-text-muted">
                  {p.name} · {p.category} · MOQ {p.moq}
                </p>
              ))}
            </div>
          )}

          {report.validCount === 0 && (
            <p className="text-sm text-red-700">{t('productImport.nothingValid')}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={reset} className={`${btn} bg-gray-100 text-text-muted hover:bg-gray-200`}>
              {t('productImport.cancel')}
            </button>
            <button
              onClick={runImport}
              disabled={busy || report.validCount === 0}
              className={`${btn} bg-primary text-white hover:bg-primary-dark disabled:opacity-50`}
            >
              {busy ? t('productImport.importing')
                    : fill(t('productImport.importAction'), { count: report.validCount })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
