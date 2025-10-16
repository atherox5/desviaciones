import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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

export default function Home({ currentUser, onAuthError, onFetchReports, onEditReport }) {
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
        const msg = e?.message || 'No se pudo cargar el listado de reportes';
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

  const userReports = useMemo(() => {
    if (!currentUser?.id) return [];
    return reports.filter((r) => r.ownerId && String(r.ownerId) === String(currentUser.id));
  }, [reports, currentUser?.id]);

  const stats = useMemo(() => {
    const total = userReports.length;
    const concluded = userReports.filter((r) => r.status === 'concluido').length;
    const inTreatment = userReports.filter((r) => r.status === 'tratamiento').length;
    const pending = userReports.filter((r) => r.status === 'pendiente').length;
    return { total, concluded, inTreatment, pending };
  }, [userReports]);

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
        <p className="text-xs text-gray-500 md:text-right md:w-auto">Indicadores calculados con tus reportes.</p>
      </section>

      {error && (
        <div className="bg-red-900/30 border border-red-700/60 text-red-200 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Reportes recientes</h2>
            <p className="text-sm text-gray-400">Visualización en modo lectura del feed global de reportes.</p>
          </div>
          <div className="text-xs text-gray-400 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-1.5">
            {sortedReports.length} registros
          </div>
        </header>

        {loading ? (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-300">
            Cargando reportes…
          </div>
        ) : sortedReports.length === 0 ? (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-6 text-center text-sm text-gray-400">
            No se han registrado reportes todavía.
          </div>
        ) : (
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 shadow-lg shadow-black/10">
            <div className="divide-y divide-gray-800/70">
              {sortedReports.map((report) => {
                const statusInfo = STATUS_META[report.status] || STATUS_META.pendiente;
                const severity = SEVERITY_COLOR[report.severidad] || 'bg-indigo-600';
                const summary = String(report.descripcion || '').trim();
                return (
                  <article key={report._id} className="py-4 flex flex-col gap-4 text-sm text-gray-200">
                    <div className="flex-1 flex flex-wrap items-center gap-3">
                      <Link
                        to={`/reportes/${report._id}`}
                        className="font-mono text-indigo-200 text-base hover:text-indigo-100 hover:underline underline-offset-2"
                      >
                        {report.folio || 'Sin folio'}
                      </Link>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.badge}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`inline-flex items-center rounded-full ${severity} text-white px-2.5 py-1 text-xs font-semibold`}>
                        {report.severidad || '—'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {report.fecha || '—'} · {report.hora || '—'}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-300">
                      <Info label="Área">{report.area || '—'}</Info>
                      <Info label="Ubicación">{report.ubicacion || '—'}</Info>
                      <Info label="Responsable">{report.responsable || '—'}</Info>
                      <Info label="Creado por">{report.ownerName || '—'}</Info>
                    </div>
                    {summary && (
                      <div className="max-w-3xl text-xs text-gray-300 leading-relaxed bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Descripción</div>
                        <p>{summary}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>ID: {report._id}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onEditReport?.(report)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <span className="bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2">
      <span className="block text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className="block text-sm text-white font-medium">{children}</span>
    </span>
  );
}
