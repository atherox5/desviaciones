import { useEffect, useMemo, useState } from 'react';

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const toISODate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function TextInput(props) {
  return <input {...props} className={`w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 ${props.className || ''}`} />;
}

function TextArea(props) {
  return <textarea {...props} className={`w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[96px] disabled:opacity-60 ${props.className || ''}`} />;
}

function Select(props) {
  return <select {...props} className={`w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 ${props.className || ''}`}>{props.children}</select>;
}

const AREA_LOCATIONS = {
  Aguas: [
    'Área 410',
    'Estación Fija',
    'Dren Quillayes',
    'Choapa 1',
    'Choapa2',
    'Choapa 3',
    'Recirculación 2',
    'Acueducto',
    'Sentina Muro de cola',
    'Pozos 7 y 8 Cuncumen',
    'Cubeta',
    'Bocatomas',
    'Rios',
    'Otros',
    'Pozos ABQ.',
  ],
  STR: [
    'Novedades reelevantes',
    'Harneros lineales y válvulas de dardo',
    'Bombas de impulsión de relaves y agua de sello STR 36"',
    "Válvulas STR 36\" y ZM's",
    'Estanques y Agitadores TK-002 / 003',
    'Estanque y Agitador TK-1004',
    'Válvulas STR 28"',
    'Bombas de impulsión de relaves y agua de sello STR 28"',
    'Cajón y bomba de recuperación de agua de rechazo harneros',
  ],
  STC: [
    'Novedades relevantes',
    'Bombas PD (Geho), centrífugas de carga y válvulas compresores',
    'Estanques y agitadores TK-020 / 021 PP007 ST-015 ST-500',
    'Estaanques TK-115 / 116 PP225/226/227',
    'Piscinas de emergencias',
    'Bombas de descarga TK-711',
  ],
  'Espesadores 410': [
    'Novedades relevantes',
    'Espesadores de relave',
    'Válvulas de descarga espesadores',
    'Bombas de floculante',
    'Estanques de floculante y sistema de preparación',
    'Cajón distribuidor ST-077',
    'Bodega de floculante',
  ],
};

function Label({ title, children, required }) {
  return (
    <label className="block text-left">
      <span className="block text-sm text-gray-300 mb-1">{title}{required && <span className="text-red-400"> *</span>}</span>
      {children}
    </label>
  );
}

export default function ShiftSummary({
  currentUser,
  areas,
  onAuthError,
  onFetchSummaries,
  onCreateSummary,
  onUpdateSummary,
  onDeleteSummary,
  onUploadSignature,
  onUploadFiles,
  dataURLFromURL,
}) {
  const areaOptions = Array.isArray(areas) ? areas : [];
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const sevenDaysAgoISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  }, []);

  const [fromDate, setFromDate] = useState(sevenDaysAgoISO);
  const [toDate, setToDate] = useState(todayISO);

  const [form, setForm] = useState({ fecha: hoyISO(), area: '', ubicacion: '', novedades: '', fotos: [] });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const locationOptions = AREA_LOCATIONS[form.area] || null;
  const canEditDetails = Boolean(form.area) && (!locationOptions || Boolean(form.ubicacion));
  const [editing, setEditing] = useState(null);
  const isEditing = Boolean(editing);

  const resetForm = () => setForm({ fecha: hoyISO(), area: '', ubicacion: '', novedades: '', fotos: [] });
  const [lastDeleted, setLastDeleted] = useState(null);

  useEffect(() => {
    if (editing && !entries.some((it) => it._id === editing._id)) {
      setEditing(null);
      resetForm();
    }
  }, [entries, editing]);

  useEffect(() => {
    setForm((prev) => {
      const options = AREA_LOCATIONS[prev.area] || null;
      if (!options) return prev;
      if (!prev.ubicacion || options.includes(prev.ubicacion)) return prev;
      return { ...prev, ubicacion: '' };
    });
  }, [form.area]);

  useEffect(() => {
    (async () => {
      await loadEntries();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  async function loadEntries() {
    setLoading(true);
    try {
      const data = await onFetchSummaries({ from: fromDate, to: toDate });
      setEntries(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudieron cargar las novedades');
      if ((e.message || '').toLowerCase().includes('expirada')) onAuthError?.();
    } finally {
      setLoading(false);
    }
  }

  async function handleFilesSelected(fileList) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const folder = `resumen/${currentUser?.username || 'anon'}`;
      const sig = await onUploadSignature(folder);
      if (sig && sig.cloudName && sig.apiKey && sig.signature) {
        const urls = await onUploadFiles(Array.from(fileList), sig);
        const fotos = urls.filter(Boolean).map((url) => ({ url, nota: '' }));
        if (fotos.length) {
          setForm((prev) => ({ ...prev, fotos: [...(prev.fotos || []), ...fotos] }));
        } else {
          alert('No se pudieron subir las imágenes (Cloudinary).');
        }
      } else {
        for (const file of fileList) {
          const data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
          setForm((prev) => ({ ...prev, fotos: [...(prev.fotos || []), { url: String(data), nota: '(local: no se guardará)' }] }));
        }
        alert('Cloudinary no está configurado: las fotos se mostrarán localmente y no se guardarán en la base de datos.');
      }
    } finally {
      setUploading(false);
    }
  }

  function updateFotoNota(idx, nota) {
    setForm((prev) => {
      const copy = [...(prev.fotos || [])];
      copy[idx] = { ...copy[idx], nota };
      return { ...prev, fotos: copy };
    });
  }

  function removeFoto(idx) {
    setForm((prev) => {
      const copy = [...(prev.fotos || [])];
      copy.splice(idx, 1);
      return { ...prev, fotos: copy };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.area) {
      setError('Selecciona un área');
      return;
    }
    if (locationOptions && !form.ubicacion) {
      setError('Selecciona una ubicación específica');
      return;
    }
    if (!canEditDetails) {
      setError('Completa el área y ubicación antes de registrar.');
      return;
    }
    if (!form.novedades || form.novedades.trim().length < 5) {
      setError('Describe las novedades (mínimo 5 caracteres).');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fecha: form.fecha,
        area: form.area,
        ubicacion: form.ubicacion || '',
        novedades: form.novedades,
        fotos: (form.fotos || []).filter((f) => typeof f.url === 'string' && f.url.startsWith('http')),
      };

      if (form.fotos?.some((f) => f.url?.startsWith('data:'))) {
        alert('Las fotos locales no se guardarán en la base de datos mientras no esté configurado Cloudinary.');
      }

      if (isEditing) {
        await onUpdateSummary(editing._id, payload);
        setEditing(null);
        setError('');
        resetForm();
      } else {
        await onCreateSummary(payload);
        resetForm();
        setError('');
      }
      setLastDeleted(null);
      await loadEntries();
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo registrar la novedad');
      if ((e.message || '').toLowerCase().includes('expirada')) onAuthError?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry) {
    if (!entry) return;
    if (!confirm(`¿Eliminar novedad del ${entry.fecha} - ${entry.area}?`)) return;
    try {
      await onDeleteSummary(entry._id);
      setEntries((prev) => prev.filter((it) => it._id !== entry._id));
      setError('');
      if (editing?._id === entry._id) {
        setEditing(null);
        resetForm();
      }
      setLastDeleted({ entry, timestamp: Date.now() });
      await loadEntries();
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo eliminar la novedad');
      if ((e.message || '').toLowerCase().includes('expirada')) onAuthError?.();
    }
  }

  function handleEdit(entry) {
    if (!entry) return;
    setEditing(entry);
    setForm({
      fecha: entry.fecha || hoyISO(),
      area: entry.area || '',
      ubicacion: entry.ubicacion || '',
      novedades: entry.novedades || '',
      fotos: entry.fotos ? entry.fotos.map((f) => ({ ...f })) : [],
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    resetForm();
    setError('');
  }

  async function handleUndoDelete() {
    if (!lastDeleted) return;
    const { entry } = lastDeleted;
    const payload = {
      fecha: entry.fecha,
      area: entry.area,
      ubicacion: entry.ubicacion || '',
      novedades: entry.novedades || '',
      fotos: (entry.fotos || []).filter((f) => f?.url).map((f) => ({ url: f.url, nota: f.nota || '' })),
    };
    try {
      await onCreateSummary(payload);
      setLastDeleted(null);
      await loadEntries();
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo deshacer la eliminación');
      if ((e.message || '').toLowerCase().includes('expirada')) onAuthError?.();
    }
  }

  const locationPriority = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const key = entry.ubicacion?.trim() || 'Sin ubicación específica';
      const list = AREA_LOCATIONS[entry.area] || [];
      const idx = list.findIndex((loc) => loc === entry.ubicacion);
      const value = idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
      if (!map.has(key) || value < map.get(key)) map.set(key, value);
    }
    return map;
  }, [entries]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const keyA = a.ubicacion?.trim() || 'Sin ubicación específica';
      const keyB = b.ubicacion?.trim() || 'Sin ubicación específica';
      const priA = locationPriority.get(keyA) ?? Number.MAX_SAFE_INTEGER;
      const priB = locationPriority.get(keyB) ?? Number.MAX_SAFE_INTEGER;
      if (priA !== priB) return priA - priB;
      const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
      const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
      if (dateA !== dateB) return dateA - dateB; // más antiguo primero
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });
  }, [entries, locationPriority]);

  const groupedByLocation = useMemo(() => {
    const map = new Map();
    for (const entry of sortedEntries) {
      const key = entry.ubicacion?.trim() || 'Sin ubicación específica';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const priA = locationPriority.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
      const priB = locationPriority.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
      if (priA !== priB) return priA - priB;
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base' });
    });
  }, [sortedEntries, locationPriority]);

  async function exportPDF() {
    if (!entries?.length) {
      alert('No hay novedades para exportar.');
      return;
    }
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = margin;

    const uniqueAreas = [...new Set(entries.map((e) => e.area).filter(Boolean))];
    const areaLabel = uniqueAreas.length === 1 ? uniqueAreas[0] : 'Varias áreas';
    const operatorName = entries[0]?.ownerFullName || entries[0]?.ownerName || currentUser?.fullName || currentUser?.username || '—';

    const ensureSpace = (needed = 40) => {
      if (y > pageH - margin - needed) {
        doc.addPage();
        y = margin;
      }
    };

    const addLine = (text, opts = {}) => {
      const size = opts.size || 8;
      const leading = opts.leading || 11;
      const bold = opts.bold || false;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, pageW - margin * 2);
      for (const line of lines) {
        ensureSpace(leading + 4);
        doc.text(line, margin, y);
        y += leading;
      }
    };

    const title = `Resumen semanal de novedades ${areaLabel}`.trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, pageW / 2, y, { align: 'center' });
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Turno: ${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`, pageW / 2, y, { align: 'center' });
    y += 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Operador: ${operatorName}`, pageW / 2, y, { align: 'center' });
    y += 18;

    y += 6;

    for (const [ubicacionLabel, items] of groupedByLocation) {
      ensureSpace(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${ubicacionLabel}`, margin, y);
      y += 14;

      for (const entry of items) {
        ensureSpace(70);
        addLine(entry.novedades || '—', { size: 8, leading: 12 });
        y += 9;

        if (entry.fotos?.length) {
          const cellW = (pageW - margin * 2 - 20) / 3;
          const cellH = 110;
          ensureSpace(cellH + 36);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text('Registro fotográfico:', margin, y);
          y += 16;

          for (let i = 0; i < entry.fotos.length; i++) {
            if (y > pageH - margin - cellH) {
              doc.addPage();
              y = margin;
            }
            const col = i % 3;
            if (col === 0 && i > 0) y += cellH + 20;
            const x = margin + col * (cellW + 10);
            const foto = entry.fotos[i];
            const dataUrl = await dataURLFromURL(foto.url);
            if (dataUrl) {
              try {
                doc.addImage(dataUrl, 'JPEG', x, y, cellW, cellH, undefined, 'FAST');
              } catch (error) {
                try {
                  doc.addImage(dataUrl, 'PNG', x, y, cellW, cellH, undefined, 'FAST');
                } catch {
                  // ignore if fails
                }
              }
            }
          }
          y += cellH + 20;
        }
        y += 8;
      }
    }

    const fileName = `resumen_${fromDate}_al_${toDate}.pdf`.replace(/[^A-Za-z0-9_\-]/g, '_');
    doc.save(fileName);
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 text-gray-100">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-white">Resumen de turno</h1>
        <p className="text-sm text-gray-400">Registra novedades diarias por área y genera un documento semanal.</p>
      </header>

      {error && (
        <div className="bg-red-900/40 text-red-200 border border-red-700/60 rounded-xl px-4 py-2 text-sm text-center">
          {error}
        </div>
      )}
      {lastDeleted && (
        <div className="bg-amber-900/30 border border-amber-600/50 text-amber-100 rounded-2xl px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>Se eliminó una novedad de {lastDeleted.entry.area}. ¿Deshacer?</span>
          <button onClick={handleUndoDelete} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-lg text-xs font-semibold">Deshacer</button>
        </div>
      )}

      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4 text-center">Nueva novedad</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Label title="Fecha" required>
            <TextInput type="date" value={form.fecha} onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))} required />
          </Label>
          <Label title="Área" required>
            <Select value={form.area} onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))} required>
              <option value="">Seleccione área…</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </Select>
          </Label>
          <div className="md:col-span-2">
            <Label title="Ubicación específica" required={Boolean(locationOptions)}>
              {form.area ? (
                <Select
                  value={form.ubicacion}
                  onChange={(e) => setForm((prev) => ({ ...prev, ubicacion: e.target.value }))}
                  required={Boolean(locationOptions)}
                >
                  <option value="">Seleccione ubicación…</option>
                  {(locationOptions || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              ) : (
                <TextInput value="" disabled placeholder="Selecciona un área para ver ubicaciones" />
              )}
            </Label>
          </div>
          <div className="md:col-span-2">
            <Label title="Novedades / hallazgos" required>
              <TextArea
                value={form.novedades}
                onChange={(e) => setForm((prev) => ({ ...prev, novedades: e.target.value }))}
                placeholder={canEditDetails ? 'Describe las novedades del turno…' : 'Selecciona área y ubicación para habilitar'}
                required
                disabled={!canEditDetails}
              />
            </Label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-300 mb-1">Registro fotográfico</label>
            <input
              type="file"
              multiple
              accept="image/*"
              disabled={!canEditDetails}
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
              className="w-full text-sm text-gray-300 disabled:opacity-60"
            />
            {uploading && <p className="text-xs text-gray-400 mt-2">Subiendo archivos…</p>}
          {form.fotos?.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {form.fotos.map((foto, idx) => (
                <div key={idx} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                  <img src={foto.url} alt={`Foto ${idx + 1}`} className="w-full h-40 object-cover" />
                  <div className="p-2 space-y-2">
                    <TextInput value={foto.nota || ''} onChange={(e) => updateFotoNota(idx, e.target.value)} placeholder="Nota" />
                    <button type="button" onClick={() => removeFoto(idx)} className="w-full text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg py-1">Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          {isEditing && (
            <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-xl text-sm bg-gray-700 hover:bg-gray-600 text-white">
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !canEditDetails}
            className={`px-4 py-2 rounded-xl text-sm ${(saving || !canEditDetails) ? 'bg-emerald-600/60 text-white/70 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {saving ? 'Guardando…' : isEditing ? 'Actualizar novedad' : 'Agregar al resumen'}
          </button>
        </div>
      </form>
    </section>

      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Historial del periodo</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Desde</label>
              <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Hasta</label>
              <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <button onClick={loadEntries} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm text-white">Actualizar</button>
            <button onClick={exportPDF} className="px-3 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-sm text-white">Generar PDF</button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400">Cargando novedades…</div>
        ) : sortedEntries.length === 0 ? (
          <div className="text-sm text-gray-400">No hay registros en el rango seleccionado.</div>
        ) : (
          <div className="space-y-5">
            {groupedByLocation.map(([ubicacionLabel, items]) => (
              <div key={ubicacionLabel} className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{ubicacionLabel}</h3>
                {items.map((entry) => {
                  const canManage = currentUser?.role === 'admin' || String(entry.ownerId) === String(currentUser?.id);
                  const isCurrentEditing = editing?._id === entry._id;
                  return (
                    <article key={entry._id} className={`bg-gray-800/60 border ${isCurrentEditing ? 'border-indigo-500' : 'border-gray-700'} rounded-2xl p-4`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-white font-semibold text-base">{entry.area}</h4>
                          <p className="text-xs text-gray-400">{formatDisplayDate(entry.fecha)} · {entry.ownerName || currentUser?.username || '—'}</p>
                          {isCurrentEditing && <span className="text-xs text-indigo-300">Editando…</span>}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(entry)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1">Editar</button>
                            <button onClick={() => handleDelete(entry)} className="text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-1">Eliminar</button>
                          </div>
                        )}
                      </div>
                      {entry.ubicacion && (
                        <p className="text-xs text-gray-400 mt-2">Ubicación: {entry.ubicacion}</p>
                      )}
                      <p className="text-sm text-gray-200 mt-3 whitespace-pre-wrap">{entry.novedades}</p>
                      {entry.fotos?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {entry.fotos.map((foto, idx) => (
                            <figure key={idx} className="bg-gray-900/40 border border-gray-700 rounded-xl overflow-hidden">
                              <img src={foto.url} alt={`Foto ${idx + 1}`} className="w-full h-32 object-cover" />
                              {foto.nota && <figcaption className="text-xs text-gray-300 px-2 py-1">{foto.nota}</figcaption>}
                            </figure>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
