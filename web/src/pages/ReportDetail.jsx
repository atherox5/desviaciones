import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const STATUS_META = {
  pendiente: { label: 'Pendiente', badge: 'border-slate-600 bg-slate-800/70 text-slate-200' },
  tratamiento: { label: 'En tratamiento', badge: 'border-amber-500/60 bg-amber-500/10 text-amber-200' },
  concluido: { label: 'Concluido', badge: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' },
};

const SEVERITY_COLOR = {
  Baja: 'bg-emerald-600',
  Media: 'bg-amber-500',
  Alta: 'bg-orange-600',
  Crítica: 'bg-red-600',
};

async function dataURLFromURL(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function exportReportPDF(r) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const addTitle = (t) => { doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(t, margin, y); y += 22; };
  const addKV = (left, right) => { doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text(left, margin, y); doc.text(right, pageW / 2, y); y += 16; };
  const addSection = (title, body) => {
    if (!body) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(body, pageW - margin * 2);
    for (const line of lines) {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 14;
    }
    y += 6;
  };
  const addBadge = (label) => {
    const w = doc.getTextWidth(label) + 14;
    const h = 18;
    if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setFillColor(76, 29, 149);
    doc.roundedRect(pageW - margin - w, margin - 4, w, h, 6, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(label, pageW - margin - w + 7, margin + 9);
    doc.setTextColor(0, 0, 0);
  };

  addTitle('Reporte de Desviaciones');
  addBadge(r.severidad || '-');
  addKV(`Folio: ${r.folio || '-'}`, `Fecha/Hora: ${r.fecha || '-'} ${r.hora || ''}`);
  addKV(`Propietario: ${r.ownerName || '-'}`, `Tipo: ${r.tipo || '-'}`);
  addKV(`Área: ${r.area || '-'}`, `Ubicación: ${r.ubicacion || '-'}`);
  y += 8;

  addSection('Descripción', r.descripcion);
  addSection('Causas', r.causas);
  addSection('Acciones / contención', r.acciones);
  addSection('Responsable', r.responsable);
  if (r.compromiso) addSection('Fecha compromiso', r.compromiso);
  if (r.tags) addSection('Tags', r.tags);

  if (r.fotos && r.fotos.length) {
    if (y > pageH - margin - 24) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Evidencias', margin, y);
    y += 14;

    const cellW = (pageW - margin * 2 - 12) / 2;
    const cellH = 110;
    for (let i = 0; i < r.fotos.length; i += 1) {
      if (y > pageH - margin - cellH) { doc.addPage(); y = margin; }
      const col = i % 2;
      if (col === 0 && i > 0) y += cellH + 16;
      const x = margin + col * (cellW + 12);
      const f = r.fotos[i];
      const dataUrl = await dataURLFromURL(f.url);
      if (dataUrl) {
        try { doc.addImage(dataUrl, 'JPEG', x, y, cellW, cellH, undefined, 'FAST'); } catch {
          try { doc.addImage(dataUrl, 'PNG', x, y, cellW, cellH, undefined, 'FAST'); } catch { /* ignore */ }
        }
      }
    }
    y += cellH + 10;
  }

  const nombre = (r.folio || `reporte_${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '_') + '.pdf';
  doc.save(nombre);
}

export default function ReportDetail({ apiFetch, onAuthError, onEdit, currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      setLoading(true);
      try {
        const res = await apiFetch(`/reports/${id}`);
        if (cancelled) return;
        if (res.status === 401) {
          setError('Sesión expirada. Vuelve a iniciar sesión.');
          onAuthError?.();
          setReport(null);
          return;
        }
        if (!res.ok) {
          setError('No se encontró el reporte solicitado.');
          setReport(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setReport(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('Error de red al cargar el reporte.');
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReport();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, id, onAuthError]);

  const goBack = () => {
    navigate('/reportes');
  };

  const handleEdit = () => {
    if (report && onEdit) {
      onEdit(report);
    }
  };

  const canEdit = report && currentUser && (currentUser.role === 'admin' || report.ownerId === currentUser.id);

  const statusInfo = STATUS_META[report?.status] || STATUS_META.pendiente;
  const severityColor = SEVERITY_COLOR[report?.severidad] || 'bg-indigo-600';

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6 text-gray-100">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          className="px-3 py-2 rounded-xl bg-gray-800/70 hover:bg-gray-700 text-sm text-gray-100 border border-gray-700"
        >
          ← Volver a reportes
        </button>
        <button
          onClick={() => navigate('/reportes/historial')}
          className="px-3 py-2 rounded-xl bg-gray-800/40 hover:bg-gray-700/80 text-sm text-gray-200 border border-gray-700"
        >
          Ver historial
        </button>
        {report && canEdit && (
          <button
            onClick={handleEdit}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm border border-indigo-500"
          >
            Editar reporte
          </button>
        )}
        {report && (
          <button
            onClick={() => exportReportPDF(report)}
            className="px-3 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm border border-fuchsia-500"
          >
            Descargar PDF
          </button>
        )}
      </div>

      {loading && (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-300">
          Cargando reporte…
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-900/40 text-red-200 border border-red-700/60 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && report && (
        <article className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-lg shadow-black/10 space-y-5">
          <header className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-white font-mono">{report.folio}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${statusInfo.badge}`}>
                {statusInfo.label}
              </span>
              <span className={`inline-flex items-center rounded-full ${severityColor} text-white px-2.5 py-1 text-xs font-semibold`}>
                {report.severidad || '—'}
              </span>
            </div>
            <div className="text-sm text-gray-400">{report.fecha} · {report.hora}</div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <InfoBox label="Área">{report.area || '—'}</InfoBox>
            <InfoBox label="Ubicación">{report.ubicacion || '—'}</InfoBox>
            <InfoBox label="Tipo">{report.tipo || '—'}</InfoBox>
            <InfoBox label="Reportante">{report.reportante || report.ownerName || '—'}</InfoBox>
            <InfoBox label="Responsable">{report.responsable || '—'}</InfoBox>
            <InfoBox label="Fecha compromiso">{report.compromiso || '—'}</InfoBox>
            <InfoBox label="Número SAP">{report.sapAviso || '—'}</InfoBox>
            <InfoBox label="Tags">{report.tags || '—'}</InfoBox>
          </section>

          <DetailBlock title="Descripción">{report.descripcion || '—'}</DetailBlock>
          <DetailBlock title="Causas">{report.causas || '—'}</DetailBlock>
          <DetailBlock title="Acciones / contención">{report.acciones || '—'}</DetailBlock>

          {report.fotos?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white mb-2">Evidencias</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {report.fotos.map((photo, idx) => (
                  <figure key={idx} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                    <a href={photo.url} target="_blank" rel="noopener noreferrer">
                      <img src={photo.url} alt={`Evidencia ${idx + 1}`} className="w-full h-40 object-cover" />
                    </a>
                    {photo.nota && (
                      <figcaption className="text-xs text-gray-300 p-2 border-t border-gray-700/60">
                        {photo.nota}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          <footer className="flex flex-wrap items-center gap-3 text-xs text-gray-400 border-t border-gray-800 pt-3">
            <span>Creado por: <strong className="text-white font-semibold">{report.ownerName || '—'}</strong></span>
            <span>Estado interno: {report.status || 'pendiente'}</span>
            <span>ID: {report._id}</span>
          </footer>
        </article>
      )}
    </div>
  );
}

function InfoBox({ label, children }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</div>
      <div className="text-gray-100">{children}</div>
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3 text-sm text-gray-100 whitespace-pre-wrap">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">{title}</div>
      {children}
    </div>
  );
}
