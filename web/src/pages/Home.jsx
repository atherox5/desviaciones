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

export default function Home({ currentUser, onAuthError, onFetchOverview }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await onFetchOverview?.();
        setItems(Array.isArray(data) ? data : []);
        setError('');
      } catch (e) {
        console.error(e);
        const msg = e?.message || 'No se pudo cargar el resumen';
        setError(msg);
        if (msg.toLowerCase().includes('expirada')) onAuthError?.();
      } finally {
        setLoading(false);
      }
    })();
  }, [onFetchOverview, onAuthError, currentUser?.id]);

  const visibleItems = useMemo(() => items.filter((it) => it.role !== 'admin'), [items]);

  const totals = useMemo(() => {
    return visibleItems.reduce((acc, it) => {
      acc.reports += it.reports?.total || 0;
      acc.concluded += it.reports?.concluded || 0;
      acc.summaries += it.summaries || 0;
      return acc;
    }, { reports: 0, concluded: 0, summaries: 0 });
  }, [visibleItems]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 text-gray-100">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-white">Panel inicial</h1>
        <p className="text-sm text-gray-400">Visión general del avance de reportes y resúmenes.</p>
      </header>

      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-xs uppercase text-gray-400">Reportes concluidos / totales</div>
          <div className="text-2xl font-semibold text-white mt-2">{totals.concluded} / {totals.reports}</div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-xs uppercase text-gray-400">Porcentaje global de cumplimiento</div>
          <div className="text-2xl font-semibold text-white mt-2">
            {totals.reports ? Math.round((totals.concluded * 10000) / totals.reports) / 100 : 0}%
          </div>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
          <div className="text-xs uppercase text-gray-400">Resúmenes de turno creados</div>
          <div className="text-2xl font-semibold text-white mt-2">{totals.summaries}</div>
        </div>
      </section>

      {error && (
        <div className="bg-red-900/30 border border-red-700/60 text-red-200 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Cargando información…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleItems.map((user) => {
            const total = user.reports?.total || 0;
            const concluded = user.reports?.concluded || 0;
            const percent = total ? Math.round((concluded * 1000) / total) / 10 : 0;
            return (
              <article key={user.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar src={user.photoUrl} alt={user.fullName || user.username} />
                  <div>
                    <div className="text-base font-semibold text-white">{user.fullName || user.username}</div>
                    <div className="text-xs text-gray-400">{user.username} · {user.role === 'admin' ? 'Superusuario' : 'Usuario'}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  <div className="flex items-center justify-between mb-1">
                    <span>Avance reportes</span>
                    <span className="text-white font-medium">{percent}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Concluidos: {concluded} / {total}</div>
                </div>
                <div className="text-sm text-gray-300">
                  Resúmenes creados: <span className="text-white font-semibold">{user.summaries}</span>
                </div>
              </article>
            );
          })}
          {items.length === 0 && !loading && (
            <div className="text-sm text-gray-400 col-span-full">No hay usuarios registrados.</div>
          )}
          {items.length > 0 && visibleItems.length === 0 && !loading && (
            <div className="text-sm text-gray-400 col-span-full">No hay usuarios registrados.</div>
          )}
        </div>
      )}
    </div>
  );
}
