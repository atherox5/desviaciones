import React, { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api";
let accessToken = null;

// ==================== API helpers ====================
async function apiFetch(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(`${API}${path}`, { ...options, headers, credentials: "include" });
  if (res.status === 401 && retry) {
    const r = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
    if (r.ok) {
      const data = await r.json();
      accessToken = data.access;
      return apiFetch(path, options, false);
    }
  }
  return res;
}

async function authLogin(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const data = await res.json();
  accessToken = data.access;
  return data.user;
}

async function authRegister(username, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo registrar");
  return res.json();
}

async function authSetupAdmin(username, password) {
  const res = await fetch(`${API}/auth/setup-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo crear admin");
  const data = await res.json();
  accessToken = data.access;
  return data.user;
}

async function authLogout() {
  await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
  accessToken = null;
}

async function listReports({ owner, q } = {}) {
  const params = new URLSearchParams();
  if (owner) params.set("owner", owner);
  if (q) params.set("q", q);
  const res = await apiFetch(`/reports?${params.toString()}`);
  if (!res.ok) throw new Error("No se pudo listar");
  return res.json();
}
async function createReport(payload) {
  const res = await apiFetch(`/reports`, { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("No se pudo crear");
  return res.json();
}
async function updateReport(id, payload) {
  const res = await apiFetch(`/reports/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("No se pudo actualizar");
  return res.json();
}
async function deleteReport(id) {
  const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("No se pudo eliminar");
  return res.json();
}

// =================== UI Helpers ===================
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const horaActual = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

const TIPOS = ["Seguridad","Calidad","Medio Ambiente","Mantención","Producción","Logística","Otros"];
const SEVERIDADES = ["Baja","Media","Alta","Crítica"];
const AREAS = ["Planta Concentradora","Líneas STR 28\"","Líneas STR 36\"","Chancado","Espesadores","Relaves","Mantenimiento","Operaciones Mina"];

function Campo({ label, required, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-300 mb-1">{label}{required && <span className="text-red-400"> *</span>}</span>
      {children}
    </label>
  );
}
function TextInput(props) { return <input {...props} className={`w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 ${props.className||""}`} /> }
function TextArea(props) { return <textarea {...props} className={`w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[88px] disabled:opacity-60 ${props.className||""}`} /> }
function Select(props) { return <select {...props} className={`w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 ${props.className||""}`}>{props.children}</select> }

const emptyReport = () => ({
  _id: null,
  folio: `DESV-${String(new Date().getFullYear()).slice(-2)}${pad2(new Date().getMonth()+1)}${pad2(new Date().getDate())}-01`,
  fecha: hoyISO(),
  hora: horaActual(),
  reportante: "",
  area: "",
  ubicacion: "",
  tipo: TIPOS[0],
  severidad: SEVERIDADES[1],
  descripcion: "",
  causas: "",
  acciones: "",
  responsable: "",
  compromiso: "",
  tags: "",
  fotos: [],
  ownerId: null,
  ownerName: "",
});

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [form, setForm] = useState(emptyReport());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  useEffect(()=>{
    if (!currentUser) return;
    (async()=>{
      const list = await listReports({
        owner: currentUser.role==='admin' && !onlyMine ? undefined : 'me',
        q: search
      });
      setItems(list);
    })();
  }, [currentUser, onlyMine, search]);

  async function saveReport() {
    if (!currentUser) return;
    setSaving(true);
    try {
      let saved; if (!form._id) saved = await createReport(form); else saved = await updateReport(form._id, form);
      setForm(saved);
      const list = await listReports({ owner: currentUser.role==='admin' && !onlyMine ? undefined : 'me', q: search });
      setItems(list); alert("Guardado ✔");
    } catch { alert("No se pudo guardar"); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(()=>{
    return items.filter(it=>{
      if (filterDate && it.fecha !== filterDate) return false;
      if (filterYear && !it.fecha.startsWith(filterYear+"-")) return false;
      if (filterMonth) {
        const m = String(filterMonth).padStart(2,"0");
        if (!it.fecha.slice(5,7).includes(m)) return false;
      }
      return true;
    });
  }, [items, filterDate, filterYear, filterMonth]);

  if (!currentUser) {
    return <div className="text-white p-4">Inicia sesión para continuar…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-4">
          <Campo label="Folio"><TextInput value={form.folio} disabled /></Campo>
          <Campo label="Reportante"><TextInput value={form.reportante} onChange={(e)=>setForm({...form, reportante:e.target.value})} /></Campo>
          <Campo label="Fecha"><TextInput type="date" value={form.fecha} onChange={(e)=>setForm({...form, fecha:e.target.value})} /></Campo>
          <Campo label="Hora"><TextInput type="time" value={form.hora} onChange={(e)=>setForm({...form, hora:e.target.value})} /></Campo>
          <div className="mt-6">
            <button onClick={saveReport} disabled={saving} className="px-4 py-2 bg-emerald-600 rounded">{saving? "Guardando…":"Guardar"}</button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-gray-800 rounded-xl p-4">
            <input type="text" placeholder="Buscar..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full mb-3 px-3 py-2 rounded bg-gray-700" />
            <div className="flex gap-2 mb-3">
              <input type="date" value={filterDate} onChange={(e)=>setFilterDate(e.target.value)} className="bg-gray-700 px-2 py-1 rounded"/>
              <input type="number" min="2020" max="2100" placeholder="Año" value={filterYear} onChange={(e)=>setFilterYear(e.target.value)} className="bg-gray-700 px-2 py-1 rounded w-20"/>
              <select value={filterMonth} onChange={(e)=>setFilterMonth(e.target.value)} className="bg-gray-700 px-2 py-1 rounded">
                <option value="">Mes</option>
                {Array.from({length:12},(_,i)=>(<option key={i+1} value={i+1}>{i+1}</option>))}
              </select>
            </div>
            <div className="max-h-[420px] overflow-auto space-y-2">
              {filtered.map((it)=>(
                <div key={it._id} className="bg-gray-700 rounded p-2">
                  <div className="font-semibold">{it.folio}</div>
                  <div className="text-xs">{it.fecha} {it.hora} • {it.tipo} • {it.area}</div>
                  <div className="text-xs text-gray-300">{it.descripcion}</div>
                </div>
              ))}
              {filtered.length===0 && <div className="text-sm text-gray-400">No hay resultados.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}