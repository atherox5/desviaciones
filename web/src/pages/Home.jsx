import { useEffect, useMemo, useState } from 'react';

function Avatar({ src, alt }) {
  if (src) {
    return <img src={src} alt={alt} className="w-20 h-20 rounded-full object-cover border border-gray-700" />;
  }
  const initials = (alt || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
  return (
    <div className="w-20 h-20 rounded-full bg-indigo-600/40 border border-indigo-500/60 text-indigo-100 flex items-center justify-center text-xl font-semibold">
      {initials}
    </div>
  );
}

export default function Home({ currentUser, onAuthError, onFetchReports }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!onFetchReports) {
        setReports([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await onFetchReports();
        if (cancelled) return;
        setReports(Array.isArray(data) ? data : []);
        setError('');
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        const msg = e?.message || 'No se pudo cargar tus reportes';
        setError(msg);
        setReports([]);
        if (msg.toLowerCase().includes('expirada')) onAuthError?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [onFetchReports, onAuthError, currentUser?.id]);

  const stats = useMemo(() => {
    const total = reports.length;
    const concluded = reports.filter((r) => r.status === 'concluido').length;
    const inTreatment = reports.filter((r) => r.status === 'tratamiento').length;
    const pending = reports.filter((r) => r.status === 'pendiente').length;
    return { total, concluded, inTreatment, pending };
  }, [reports]);

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const dateA = new Date(`${a.fecha || ''}T${(a.hora || '00:00')}:00`);
      const dateB = new Date(`${b.fecha || ''}T${(b.hora || '00:00')}:00`);
      return dateB - dateA;
    });
  }, [reports]);

  const STATUS_META = {
    pendiente: { label: 'Pendiente', badge: 'bg-slate-700/70 text-slate-200 border border-slate-600/70' },
    tratamiento: { label: 'En tratamiento', badge: 'bg-amber-500/20 text-amber-200 border border-amber-500/60' },
    concluido: { label: 'Concluido', badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/60' },
  };

  const SEVERITY_COLOR = {
    Baja: 'bg-emerald-600',
    Media: 'bg-amber-500',
    Alta: 'bg-orange-600',
    Crítica: 'bg-red-600',
  };

  const displayName = currentUser?.fullName?.trim() ? currentUser.fullName : currentUser?.username || 'Usuario';
  const roleLabel = currentUser?.role === 'admin' ? 'Superusuario' : 'Usuario';

  const statCards = [
    { label: 'Reportes creados', value: stats.total },
    { label: 'Pendientes', value: stats.pending },
    { label: 'En tratamiento', value: stats.inTreatment },
    { label: 'Concluidos', value: stats.concluded },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 text-gray-100">
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={currentUser?.photoUrl} alt={displayName} />
          <div>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            <div className="text-sm text-gray-400">{currentUser?.username}</div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{roleLabel}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
          {statCards.map((card) => (
            <div key={card.label} className="bg-gray-800/70 border border-gray-700 rounded-xl px-4 py-3 text-center">
              <div className="text-xs uppercase text-gray-400 tracking-wide">{card.label}</div>
              <div className="text-xl font-semibold text-white mt-1">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="bg-red-900/30 border border-red-700/60 text-red-200 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Mis reportes</h2>
            <p className="text-sm text-gray-400">Revisa y edita únicamente los reportes que creaste.</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-1.5">
            Mostrando {sortedReports.length} registros
          </div>
        </header>

        {loading ? (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-300">
            Cargando tus reportes…
          </div>
        ) : sortedReports.length === 0 ? (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-400">
            Aún no registras reportes. ¡Crea el primero desde la sección “Nuevo reporte”!
          </div>
        ) : (
          <div className="space-y-4">
            {sortedReports.map((report) => {
              const statusInfo = STATUS_META[report.status] || STATUS_META.pendiente;
              const severity = SEVERITY_COLOR[report.severidad] || 'bg-indigo-600';
              const summary = String(report.descripcion || '').trim();
              return (
                <article key={report._id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 shadow-lg shadow-black/10 space-y-4">
                  <header className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-semibold text-white font-mono">{report.folio || 'Sin folio'}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.badge}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`inline-flex items-center rounded-full ${severity} text-white px-2.5 py-1 text-xs font-semibold`}>
                        {report.severidad || '—'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">{report.fecha || '—'} · {report.hora || '—'}</div>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                    <Info label="Área">{report.area || '—'}</Info>
                    <Info label="Ubicación">{report.ubicacion || '—'}</Info>
                    <Info label="Tipo">{report.tipo || '—'}</Info>
                    <Info label="Responsable">{report.responsable || '—'}</Info>
                    <Info label="Número SAP">{report.sapAviso || '—'}</Info>
                    <Info label="Fecha compromiso">{report.compromiso || '—'}</Info>
                  </div>

                  {summary && (
                    <div className="text-sm text-gray-200 bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Descripción</div>
                      <p className="leading-relaxed">{summary}</p>
                    </div>
                  )}

                  <footer className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">ID: {report._id}</div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</div>
      <div className="text-white font-medium">{children}</div>
    </div>
  );
}
