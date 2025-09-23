import { useEffect, useMemo, useState } from 'react';

const EMPTY_STATS = { total: 0, byStatus: { pendiente: 0, tratamiento: 0, concluido: 0 }, compliance: 0 };

function Donut({ value = 0 }) {
  // value: 0..100
  const r = 36, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32">
      <circle cx="50" cy="50" r={r} strokeWidth="12" fill="none" className="stroke-gray-700" />
      <circle cx="50" cy="50" r={r} strokeWidth="12" fill="none"
        className="stroke-emerald-400 -rotate-90 origin-center drop-shadow"
        strokeDasharray={c} strokeDashoffset={off}/>
      <text x="50" y="54" textAnchor="middle" className="fill-gray-100 text-xl font-bold">{value}%</text>
    </svg>
  );
}

export default function Dashboard({ apiFetch, onAuthError }) {
  const [items, setItems] = useState([]);
  const [period, setPeriod] = useState('day');       // 'day' | 'month' | 'year'
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [stats, setStats] = useState(EMPTY_STATS);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', '50');
    if (query) p.set('q', query);
    if (period === 'day') p.set('day', date);
    if (period === 'month') p.set('month', month);
    if (period === 'year') p.set('year', year);
    return p.toString();
  }, [period, date, month, year, query]);

  async function requestJSON(path, options = undefined, fallback) {
    try {
      const res = await apiFetch(path, options);
      if (res.status === 401) {
        setError('Sesión expirada. Vuelve a iniciar sesión.');
        onAuthError?.();
        return fallback;
      }
      if (!res.ok) {
        setError('No se pudo cargar la información del dashboard.');
        return fallback;
      }
      const data = await res.json();
      setError('');
      return data;
    } catch (err) {
      console.error(err);
      setError('Error de red al consultar el dashboard.');
      return fallback;
    }
  }

  async function fetchList() {
    const data = await requestJSON(`/reports?${params}`, undefined, []);
    setItems(Array.isArray(data) ? data : []);
  }
  async function fetchStats() {
    const data = await requestJSON(`/reports/stats/summary?${params}`, undefined, EMPTY_STATS);
    setStats({
      total: data?.total ?? 0,
      compliance: data?.compliance ?? 0,
      byStatus: {
        pendiente: data?.byStatus?.pendiente ?? 0,
        tratamiento: data?.byStatus?.tratamiento ?? 0,
        concluido: data?.byStatus?.concluido ?? 0,
      },
    });
  }

  useEffect(() => { fetchList(); fetchStats(); }, [params]);

  async function changeStatus(id, next) {
    const res = await apiFetch(`/reports/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next })
    });
    if (res.status === 401) {
      setError('Sesión expirada. Vuelve a iniciar sesión.');
      onAuthError?.();
      return;
    }
    if (!res.ok) {
      setError('No se pudo actualizar el estado.');
      return;
    }
    setError('');
    fetchList();
    fetchStats();
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 text-gray-100">
      <h1 className="text-2xl font-bold text-white">Panel de Reportes</h1>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 bg-gray-900/60 border border-gray-800 rounded-2xl p-4 shadow-inner shadow-black/10">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Periodo</label>
          <select
            value={period}
            onChange={e=>setPeriod(e.target.value)}
            className="bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="day">Día</option>
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>
        {period === 'day' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Día</label>
            <input
              type="date"
              value={date}
              onChange={e=>setDate(e.target.value)}
              className="bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        {period === 'month' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Mes</label>
            <input
              type="month"
              value={month}
              onChange={e=>setMonth(e.target.value)}
              className="bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        {period === 'year' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Año</label>
            <input
              type="number"
              value={year}
              onChange={e=>setYear(e.target.value)}
              className="bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
            />
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">Buscar</label>
          <input
            placeholder="folio, área, descripción…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            className="bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 text-red-200 border border-red-700/60 rounded-xl px-4 py-2 text-sm shadow-inner shadow-red-900/40">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 shadow-lg shadow-black/10 flex items-center gap-4">
          <Donut value={stats.compliance || 0} />
          <div>
            <div className="text-lg font-semibold text-white">% Cumplimiento</div>
            <div className="text-sm text-gray-400">Concluidos / Total</div>
            <div className="text-sm mt-2 text-gray-300">
              Total: <span className="font-semibold text-white">{stats.total}</span> · Pend: <span className="font-semibold text-amber-200">{stats.byStatus?.pendiente||0}</span> · Trat: <span className="font-semibold text-sky-200">{stats.byStatus?.tratamiento||0}</span> · Concl: <span className="font-semibold text-emerald-200">{stats.byStatus?.concluido||0}</span>
            </div>
          </div>
        </div>
        {/* puedes añadir más tarjetas si quieres (por área, tipo, severidad, etc.) */}
      </div>

      {/* Lista */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 shadow-lg shadow-black/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Últimos reportes</h2>
          <span className="text-sm text-gray-400">{items.length} resultados</span>
        </div>
        <div className="divide-y divide-gray-800/80">
          {items.map(r => (
            <div key={r._id} className="py-3 flex flex-wrap items-center gap-3 text-sm text-gray-200">
              <div className="w-28 font-mono text-indigo-200">{r.folio}</div>
              <div className="w-28 text-xs text-gray-400">{r.fecha} {r.hora}</div>
              <div className="flex-1 min-w-[220px]">
                <div className="font-medium text-white">{r.tipo} · {r.severidad}</div>
                <div className="text-gray-400 text-xs md:text-sm line-clamp-1">{r.descripcion}</div>
              </div>
              <span
                className={
                  'px-2 py-1 text-xs font-semibold rounded-full border transition ' +
                  (r.status === 'concluido'
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                    : r.status === 'tratamiento'
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                      : 'border-slate-500/60 bg-slate-500/10 text-slate-200')
                }
              >
                {r.status || 'pendiente'}
              </span>

              {/* Controles de estado (el dueño podrá cambiarlo; el backend valida) */}
              {['pendiente','tratamiento'].includes(r.status || 'pendiente') && (
                <div className="flex gap-2 ml-2">
                  {r.status === 'pendiente' && (
                    <>
                      <button
                        onClick={()=>changeStatus(r._id,'tratamiento')}
                        className="text-xs border border-amber-500/60 text-amber-200 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition"
                      >
                        → Tratamiento
                      </button>
                      <button
                        onClick={()=>changeStatus(r._id,'concluido')}
                        className="text-xs border border-emerald-500/60 text-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition"
                      >
                        ✔ Concluir
                      </button>
                    </>
                  )}
                  {r.status === 'tratamiento' && (
                    <button
                      onClick={()=>changeStatus(r._id,'concluido')}
                      className="text-xs border border-emerald-500/60 text-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition"
                    >
                      ✔ Concluir
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
