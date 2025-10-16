import { useEffect, useMemo, useState } from 'react';

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

export default function ReportsView({ apiFetch, onAuthError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (query.trim()) search.set('q', query.trim());
    if (onlyMine) search.set('owner', 'me');
    if (status) search.set('status', status);
    search.set('limit', '200');
    return search.toString();
  }, [query, status, onlyMine]);

  useEffect(() => {
    let abort = false;
    async function fetchReports() {
      setLoading(true);
      try {
        const res = await apiFetch(`/reports?${params}`);
        if (abort) return;
        if (res.status === 401) {
          setError('Sesión expirada. Vuelve a iniciar sesión.');
          onAuthError?.();
          setItems([]);
          return;
        }
        if (!res.ok) {
          setError('No se pudo cargar la lista de reportes.');
          setItems([]);
          return;
        }
        const data = await res.json();
        if (!abort) {
          setItems(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (err) {
        if (!abort) {
          console.error(err);
          setError('Error de red al cargar los reportes.');
          setItems([]);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    fetchReports();
    return () => {
      abort = true;
    };
  }, [apiFetch, onAuthError, params]);

  const filteredItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = new Date(`${a.fecha || ''}T${(a.hora || '00:00')}:00`);
      const dateB = new Date(`${b.fecha || ''}T${(b.hora || '00:00')}:00`);
      return dateB - dateA;
    });
  }, [items]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 text-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Historial de reportes</h1>
          <p className="text-sm text-gray-400">Consulta toda la información de los reportes registrados.</p>
        </div>
        <div className="text-sm text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-1.5">
          Mostrando {filteredItems.length} reportes
        </div>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Buscar</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="folio, área, descripción, responsable…"
            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="tratamiento">En tratamiento</option>
            <option value="concluido">Concluido</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-2 w-full justify-between">
            <span>Solo mis reportes</span>
            <input
              type="checkbox"
              className="accent-indigo-600"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 text-red-200 border border-red-700/60 rounded-xl px-4 py-2 text-sm shadow-inner shadow-red-900/40">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-300">
          Cargando reportes…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-400">
          No se encontraron reportes con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((report) => {
            const statusInfo = STATUS_META[report.status] || STATUS_META.pendiente;
            const severityColor = SEVERITY_COLOR[report.severidad] || 'bg-indigo-600';
            return (
              <article key={report._id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 shadow-lg shadow-black/10 space-y-4">
                <header className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-semibold text-white font-mono">{report.folio}</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${statusInfo.badge}`}>
                      {statusInfo.label}
                    </span>
                    <span className={`inline-flex items-center rounded-full ${severityColor} text-white px-2.5 py-1 text-xs font-semibold`}>
                      {report.severidad || '—'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">{report.fecha} · {report.hora}</div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <InfoBox label="Área">{report.area || '—'}</InfoBox>
                  <InfoBox label="Ubicación">{report.ubicacion || '—'}</InfoBox>
                  <InfoBox label="Tipo">{report.tipo || '—'}</InfoBox>
                  <InfoBox label="Reportante">{report.reportante || report.ownerName || '—'}</InfoBox>
                  <InfoBox label="Responsable">{report.responsable || '—'}</InfoBox>
                  <InfoBox label="Fecha compromiso">{report.compromiso || '—'}</InfoBox>
                  <InfoBox label="Número SAP">{report.sapAviso || '—'}</InfoBox>
                  <InfoBox label="Tags">{report.tags || '—'}</InfoBox>
                </div>

                <DetailBlock title="Descripción">{report.descripcion || '—'}</DetailBlock>
                <DetailBlock title="Causas">{report.causas || '—'}</DetailBlock>
                <DetailBlock title="Acciones / contención">{report.acciones || '—'}</DetailBlock>

                {report.fotos?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Evidencias</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {report.fotos.map((photo, idx) => (
                        <figure key={idx} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
                          <a href={photo.url} target="_blank" rel="noopener noreferrer">
                            <img src={photo.url} alt={`Evidencia ${idx + 1}`} className="w-full h-36 object-cover" />
                          </a>
                          {photo.nota && (
                            <figcaption className="text-xs text-gray-300 p-2 border-t border-gray-700/60">
                              {photo.nota}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  </div>
                )}

                <footer className="flex flex-wrap items-center gap-3 text-xs text-gray-400 border-t border-gray-800 pt-3">
                  <span>Creado por: <strong className="text-white font-semibold">{report.ownerName || '—'}</strong></span>
                  <span>Estado interno: {report.status || 'pendiente'}</span>
                  <span>ID: {report._id}</span>
                </footer>
              </article>
            );
          })}
        </div>
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
