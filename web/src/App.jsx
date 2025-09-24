import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import UsersAdmin from "./pages/UsersAdmin.jsx";
import ShiftSummary from "./pages/ShiftSummary.jsx";
import Profile from "./pages/Profile.jsx";
import Home from "./pages/Home.jsx";

// ==============================================
// Frontend conectado a API + Exportar a PDF + Visor de Fotos (modal)
// - VITE_API_BASE_URL (http://localhost:8081/api o 8082 según .env.local)
// - Auth real (JWT access en memoria + refresh httpOnly)
// - CRUD de Reportes
// - Subida a Cloudinary si el backend tiene firma activa
// - Botón "Exportar PDF" en Paso 5 (Resumen)
// - NUEVO: Click en fotos -> visor modal con Anterior/Siguiente + botón Cerrar (arriba izquierda)
// ==============================================

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api";
let accessToken = null; // en memoria; refresh via cookie httpOnly

async function apiFetch(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const fetchOpts = { ...options, headers, credentials: "include" };
  if (!fetchOpts.cache) fetchOpts.cache = "no-store";
  const res = await fetch(`${API}${path}`, fetchOpts);
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
  return data.user; // {id, username, role}
}

async function authSetupAdmin(username, password, fullName) {
  const res = await fetch(`${API}/auth/setup-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, fullName }),
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

async function authRefresh() {
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.access;
  return data.user;
}

async function authStatus() {
  const res = await fetch(`${API}/auth/status`, { credentials: 'include' });
  if (!res.ok) return { usersExist: true };
  return res.json();
}

async function listReports({ owner } = {}) {
  const q = new URLSearchParams();
  if (owner) q.set("owner", owner);
  const res = await apiFetch(`/reports?${q.toString()}`);
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

async function listUsers() {
  const res = await apiFetch(`/users`);
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) throw new Error('No se pudo listar usuarios');
  return res.json();
}

async function updateUserProfile(id, payload) {
  const res = await apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (res.status === 409) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'Usuario en uso');
  }
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo actualizar usuario');
  }
  return res.json();
}

async function deleteUserAccount(id) {
  const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo eliminar usuario');
  }
  return res.json();
}

async function createUserAccount(payload) {
  const res = await apiFetch(`/users`, { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo crear usuario');
  }
  return res.json();
}

async function updateSelfProfile(payload) {
  const res = await apiFetch(`/users/me`, { method: 'PATCH', body: JSON.stringify(payload) });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo actualizar perfil');
  }
  return res.json();
}

async function changeOwnPassword(payload) {
  const res = await apiFetch(`/users/me/password`, { method: 'PATCH', body: JSON.stringify(payload) });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo actualizar la contraseña');
  }
  return res.json();
}

async function fetchUsersOverview() {
  const res = await apiFetch(`/users/overview`);
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) throw new Error('No se pudo obtener el resumen de usuarios');
  return res.json();
}

async function listSummaries(params = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.owner) q.set('owner', params.owner);
  const res = await apiFetch(`/summaries?${q.toString()}`);
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) throw new Error('No se pudo cargar el resumen');
  return res.json();
}

async function createSummaryEntry(payload) {
  const res = await apiFetch(`/summaries`, { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo crear la novedad');
  }
  return res.json();
}

async function deleteSummaryEntry(id) {
  const res = await apiFetch(`/summaries/${id}`, { method: 'DELETE' });
  if (res.status === 401) throw new Error('Sesión expirada');
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data?.error || 'No se pudo eliminar la novedad');
  }
  return res.json();
}

// Firma + subida a Cloudinary (si está configurado). Si falla, devolvemos null para cada archivo.
async function getSignature(folder) {
  const ts = Math.floor(Date.now() / 1000);
  const res = await apiFetch(`/upload/signature`, { method: "POST", body: JSON.stringify({ timestamp: ts, folder }) });
  if (!res.ok) return null;
  return { ...(await res.json()), timestamp: ts };
}
async function uploadToCloudinary(files, { cloudName, apiKey, signature, timestamp, folder }) {
  async function uploadOne(file) {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("folder", folder);
    form.append("signature", signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: form });
    if (!res.ok) return null;
    const data = await res.json();
    return data.secure_url || data.url || null;
  }
  const out = [];
  for (const f of files) out.push(await uploadOne(f));
  return out;
}

// =================== UI Helpers ===================
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const horaActual = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

const TIPOS = ["Seguridad","Calidad","Medio Ambiente","Mantención","Producción","Logística","Otros"];
const SEVERIDADES = ["Baja","Media","Alta","Crítica"];
const AREAS = ["STC", "STR", "Aguas", "Espesadores 410"];
const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'tratamiento', label: 'En tratamiento' },
  { value: 'concluido', label: 'Concluido' }
];
const ESTADO_LABEL = ESTADOS.reduce((acc, it) => ({ ...acc, [it.value]: it.label }), {});
const ESTADO_COLOR = {
  pendiente: 'bg-slate-600',
  tratamiento: 'bg-amber-500',
  concluido: 'bg-emerald-600'
};

const steps = [
  { id: 1, title: "Datos básicos" },
  { id: 2, title: "Clasificación y descripción" },
  { id: 3, title: "Acciones y responsables" },
  { id: 4, title: "Evidencias (fotos)" },
  { id: 5, title: "Revisión" },
];

function Badge({ children, color = "bg-indigo-600" }) {
  return <span className={`inline-flex items-center rounded-full ${color} text-white px-2 py-0.5 text-xs font-semibold`}>{children}</span>;
}
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

/* ----------------- Visor de fotos (modal, no pantalla completa) ----------------- */
function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  if (!photos || !photos.length) return null;
  const photo = photos[index] || photos[0];
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-5xl w-full">
        <button onClick={onClose} className="absolute left-3 top-3 text-white/90 bg-gray-800 hover:bg-gray-700 rounded-full w-9 h-9 grid place-items-center" aria-label="Cerrar">×</button>
        <div className="flex items-center gap-3 p-4">
          <button onClick={onPrev} className="shrink-0 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-10 h-10" aria-label="Anterior">‹</button>
          <div className="flex-1 overflow-hidden">
            <img src={photo.url} alt="Evidencia" className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain" />
            {photo.nota && <div className="text-xs text-gray-300 mt-2 text-center px-2">{photo.nota}</div>}
          </div>
          <button onClick={onNext} className="shrink-0 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-10 h-10" aria-label="Siguiente">›</button>
        </div>
      </div>
    </div>
  );
}
function FotosGrid({ fotos, uploading, onNota, onRemove, canEdit, onPreview }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {fotos.map((f, idx) => (
        <div key={idx} className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden">
          <img src={f.url} alt={`Foto ${idx+1}`} className="w-full h-40 object-cover cursor-zoom-in" onClick={()=>onPreview?.(idx)} />
          <div className="p-2">
            <TextInput value={f.nota||""} onChange={(e)=>onNota(idx, e.target.value)} disabled={!canEdit} placeholder="Nota/Comentario" />
            <button onClick={()=>onRemove(idx)} disabled={!canEdit} className="mt-2 w-full text-sm bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg py-1">Eliminar</button>
          </div>
        </div>
      ))}
      {uploading && <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-gray-700 text-gray-400">Subiendo…</div>}
    </div>
  );
}

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
  sapAviso: "",
  status: "pendiente",
  fotos: [], // {url, nota}
  ownerId: null,
  ownerName: "",
});

function LoginScreen({ usersExist, onSetupAdmin, onLogin, error }) {
  const [tab, setTab] = useState(usersExist ? "login" : "setup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  return (
    <div className="max-w-md mx-auto bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-4">
        {!usersExist && (
          <button className={`px-3 py-1.5 rounded-lg text-sm ${tab==='setup'? 'bg-indigo-600 text-white':'bg-gray-800 text-gray-200'}`} onClick={()=>setTab('setup')}>Configurar admin</button>
        )}
        <button className={`px-3 py-1.5 rounded-lg text-sm ${tab==='login'? 'bg-indigo-600 text-white':'bg-gray-800 text-gray-200'}`} onClick={()=>{ setTab('login'); setFullName(''); }}>Iniciar sesión</button>
      </div>
      {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
      <Campo label="Usuario" required><TextInput value={username} onChange={(e)=>setUsername(e.target.value)} className="text-center" /></Campo>
      <Campo label="Contraseña" required><TextInput type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="text-center" /></Campo>
      {tab==='setup' && (
        <>
          <Campo label="Nombre completo" required><TextInput value={fullName} onChange={(e)=>setFullName(e.target.value)} className="text-center" /></Campo>
          <button onClick={()=>onSetupAdmin(username,password,fullName)} className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm">Crear superusuario</button>
        </>
      )}
      {tab==='login' && <button onClick={()=>onLogin(username,password)} className="w-full px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Entrar</button>}
    </div>
  );
}

// ===== Utilidades para PDF =====
async function dataURLFromURL(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url; // ya es base64
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve)=>{ const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.readAsDataURL(blob); });
  } catch { return null; }
}

async function exportReportPDF(r) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40; const pageW = doc.internal.pageSize.getWidth(); const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const addTitle = (t) => { doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.text(t, margin, y); y += 22; };
  const addKV = (left, right) => { doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.text(left, margin, y); doc.text(right, pageW/2, y); y += 16; };
  const addSection = (title, body) => {
    if (!body) return; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(title, margin, y); y += 14; doc.setFont('helvetica','normal');
    const lines = doc.splitTextToSize(body, pageW - margin*2);
    for (const line of lines) { if (y > pageH - margin) { doc.addPage(); y = margin; } doc.text(line, margin, y); y += 14; }
    y += 6;
  };
  const addBadge = (label) => { const w = doc.getTextWidth(label)+14; const h=18; if (y > pageH - margin) { doc.addPage(); y = margin; }
    doc.setFillColor(76, 29, 149); // indigo-900
    doc.roundedRect(pageW - margin - w, margin-4, w, h, 6, 6, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text(label, pageW - margin - w + 7, margin + 9);
    doc.setTextColor(0,0,0);
  };

  addTitle('Reporte de Desviaciones');
  addBadge(r.severidad || '-');
  addKV(`Folio: ${r.folio || '-'}`, `Fecha/Hora: ${(r.fecha||'-')} ${(r.hora||'')}`);
  addKV(`Propietario: ${r.ownerName || '-'}`, `Tipo: ${r.tipo || '-'}`);
  addKV(`Área: ${r.area || '-'}`, `Ubicación: ${r.ubicacion || '-'}`);
  y += 8;

  addSection('Descripción', r.descripcion);
  addSection('Causas', r.causas);
  addSection('Acciones / Contención', r.acciones);
  addSection('Responsable', r.responsable);
  if (r.compromiso) addSection('Fecha compromiso', r.compromiso);
  if (r.tags) addSection('Tags', r.tags);

  // Evidencias
  if (r.fotos && r.fotos.length) {
    if (y > pageH - margin - 24) { doc.addPage(); y = margin; }
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Evidencias', margin, y); y += 14;

    const cellW = (pageW - margin*2 - 20) / 3; // 3 por fila
    const cellH = 110;
    for (let i=0;i<r.fotos.length;i++) {
      if (y > pageH - margin - cellH) { doc.addPage(); y = margin; }
      const col = i % 3; if (col === 0 && i>0) y += cellH + 20;
      const x = margin + col * (cellW + 10);
      const f = r.fotos[i];
      const dataUrl = await dataURLFromURL(f.url);
      if (dataUrl) {
        try { doc.addImage(dataUrl, 'JPEG', x, y, cellW, cellH, undefined, 'FAST'); } catch {
          try { doc.addImage(dataUrl, 'PNG', x, y, cellW, cellH, undefined, 'FAST'); } catch {}
        }
      }
    }
    y += cellH + 10;
  }

  const nombre = (r.folio || `reporte_${Date.now()}`).replace(/[^A-Za-z0-9_\-]/g,'_') + '.pdf';
  doc.save(nombre);
}

function AppInner() {
  const [currentUser, setCurrentUser] = useState(null); // {id, username, role}
  const [authError, setAuthError] = useState("");
  const [usersExist, setUsersExist] = useState(true);

  const [items, setItems] = useState([]); // lista de reportes
  const [onlyMine, setOnlyMine] = useState(false);

  const [form, setForm] = useState(emptyReport());
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [pendingRedirect, setPendingRedirect] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await authStatus();
        if (!cancelled) setUsersExist(Boolean(status?.usersExist));
      } catch (e) {
        console.warn('No se pudo obtener estado de usuarios', e);
      }

      try {
        const user = await authRefresh();
        if (user) {
          if (!cancelled) setCurrentUser(user);
          return;
        }
      } catch (e) {
        console.warn('Refresh falló', e);
      }
      accessToken = null;
      if (!cancelled) setCurrentUser(null);
    })().finally(() => {
      if (!cancelled) setBooting(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-xl text-sm transition ${
      isActive
        ? "bg-indigo-600 text-white shadow"
        : "bg-gray-800/70 text-gray-200 hover:bg-gray-700/80"
    }`;

  const fetchUsersList = useCallback(() => listUsers(), []);
  const updateUserFn = useCallback((id, payload) => updateUserProfile(id, payload), []);
  const deleteUserFn = useCallback((id) => deleteUserAccount(id), []);
  const createUserFn = useCallback((payload) => createUserAccount(payload), []);
  const listSummariesFn = useCallback((params) => listSummaries(params), []);
  const createSummaryFn = useCallback((payload) => createSummaryEntry(payload), []);
  const deleteSummaryFn = useCallback((id) => deleteSummaryEntry(id), []);
  const updateSelfProfileFn = useCallback((payload) => updateSelfProfile(payload), []);
  const changePasswordFn = useCallback((payload) => changeOwnPassword(payload), []);
  const fetchOverviewFn = useCallback(() => fetchUsersOverview(), []);

  // NUEVO: visor de fotos
  const [viewer, setViewer] = useState({ open: false, index: 0 });
  const openViewer = (i) => setViewer({ open: true, index: i || 0 });
  const closeViewer = () => setViewer((v) => ({ ...v, open: false }));
  const prevPhoto = () => setViewer((v) => {
    const len = form.fotos?.length || 0; if (!len) return v; return { ...v, index: (v.index - 1 + len) % len };
  });
  const nextPhoto = () => setViewer((v) => {
    const len = form.fotos?.length || 0; if (!len) return v; return { ...v, index: (v.index + 1) % len };
  });
  useEffect(()=>{
    if (!viewer.open) return; const onKey = (e)=>{ if (e.key==='Escape') closeViewer(); if (e.key==='ArrowLeft') prevPhoto(); if (e.key==='ArrowRight') nextPhoto(); };
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey);
  }, [viewer.open, form.fotos?.length]);
  useEffect(()=>{
    if (location.pathname !== '/reportes' && viewer.open) {
      setViewer((v)=>({ ...v, open: false }));
    }
  }, [location.pathname, viewer.open]);

  const canEdit = useMemo(()=>{
    if (!currentUser) return false;
    if (!form._id) return true; // nuevo
    return currentUser.role === 'admin' || form.ownerId === currentUser.id;
  }, [currentUser, form._id, form.ownerId]);

  useEffect(()=>{
    if (!currentUser) return;
    (async()=>{
      const list = await listReports({ owner: currentUser.role==='admin' && !onlyMine ? undefined : 'me' });
      setItems(list);
    })();
  }, [currentUser, onlyMine]);

  const handleSetupAdmin = async (u,p,name) => {
    try {
      const user = await authSetupAdmin(u,p,name);
      setCurrentUser(user);
      setAuthError("");
      setUsersExist(true);
      setPendingRedirect(true);
    } catch(e) {
      setAuthError(e.message || 'Error');
      try {
        const status = await authStatus();
        setUsersExist(Boolean(status?.usersExist));
      } catch {}
    }
  };
  const handleLogin = async (u,p) => {
    try {
      const user = await authLogin(u,p);
      setCurrentUser(user);
      setAuthError("");
      setUsersExist(true);
      setPendingRedirect(true);
    } catch(e) {
      setAuthError(e.message || 'Error');
    }
  };
  const handleLogout = async ()=>{
    await authLogout();
    setCurrentUser(null);
    setForm(emptyReport());
    setItems([]);
    setUsersExist(true);
    setPendingRedirect(false);
    navigate('/', { replace: true });
  };

  const handleProfileUpdate = async (payload) => {
    const updated = await updateSelfProfileFn(payload);
    setCurrentUser((prev) => prev ? { ...prev, ...updated } : updated);
    return updated;
  };

  const handlePasswordChange = async (payload) => {
    await changePasswordFn(payload);
  };

  useEffect(() => {
    if (pendingRedirect && currentUser) {
      navigate('/', { replace: true });
      setPendingRedirect(false);
    }
  }, [pendingRedirect, currentUser, navigate]);

  const validarStep = (s) => {
    if (s === 1) return Boolean(form.fecha && form.hora);
    if (s === 2) return Boolean(form.tipo && form.severidad && String(form.descripcion||"").trim().length >= 10);
    return true;
  };

  async function saveReport() {
    if (!currentUser) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.fotos?.length) {
        const looksLocal = payload.fotos.some((f)=>f.url?.startsWith("data:"));
        if (looksLocal) {
          alert("Las fotos locales se omitirán al guardar mientras no esté configurado Cloudinary.");
          payload.fotos = payload.fotos.filter(f=>!f.url?.startsWith("data:"));
        }
      }
      let saved;
      if (!form._id) saved = await createReport(payload); else saved = await updateReport(form._id, payload);
      setForm((prev) => {
        const base = emptyReport();
        const merged = { ...base, ...prev, ...saved };
        merged.status = merged.status || prev.status || base.status;
        return merged;
      });
      const list = await listReports({ owner: currentUser.role==='admin' && !onlyMine ? undefined : 'me' });
      setItems(list); alert("Guardado ✔");
    } catch (e) { console.error(e); alert("No se pudo guardar"); }
    finally { setSaving(false); }
  }

  async function onFilesSelected(list) {
    if (!list?.length) return; setUploading(true);
    try {
      const folder = `desviaciones/${currentUser?.username || 'anon'}`;
      const sig = await getSignature(folder);
      if (sig && sig.cloudName && sig.apiKey && sig.signature) {
        const urls = await uploadToCloudinary(Array.from(list), sig);
        const fotos = urls.filter(Boolean).map((url)=>({ url, nota: "" }));
        if (fotos.length) setForm((f)=>({ ...f, fotos: [...(f.fotos||[]), ...fotos] })); else alert("No se pudieron subir las imágenes (Cloudinary)");
      } else {
        for (const file of list) {
          const data = await new Promise((resolve)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(file); });
          setForm((f)=>({ ...f, fotos: [...(f.fotos||[]), { url: String(data), nota: "(local: no se guardará)" }] }));
        }
        alert("Cloudinary no está configurado: las fotos se muestran localmente y no se guardarán en la DB.");
      }
    } finally { setUploading(false); }
  }

  function onLoadReport(it) {
    const base = emptyReport();
    setForm({ ...base, ...it });
    setStep(1);
  }
  async function onDeleteReport(it) {
    if (!confirm(`¿Eliminar ${it.folio}?`)) return;
    try {
      await deleteReport(it._id);
      setForm(emptyReport());
      const list = await listReports({ owner: currentUser.role==='admin' && !onlyMine ? undefined : 'me' });
      setItems(list);
    } catch (e) {
      console.error(e);
      alert(e.message || 'No se pudo eliminar');
    }
  }

  const filtered = useMemo(()=> items, [items]);

  if (booting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 flex items-center justify-center">
        <div className="px-4 py-3 bg-gray-900/70 border border-gray-800 rounded-2xl text-sm text-gray-300">
          Validando sesión…
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 flex items-center justify-center text-center">
        <div className="max-w-4xl w-full mx-auto p-6">
          <h1 className="text-3xl font-bold text-white mb-4">Reporte de Desviaciones</h1>
          <LoginScreen
            usersExist={usersExist}
            onSetupAdmin={handleSetupAdmin}
            onLogin={handleLogin}
            error={authError}
          />
        </div>
      </div>
    );
  }

  const reportPage = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulario */}
      <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-5">
          {steps.map((s,i)=>{
            const active = step===s.id; const done = s.id<step;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${active? 'bg-white text-gray-900 border-white': done? 'bg-green-600 text-white border-green-600':'bg-gray-700 text-gray-200 border-gray-600'}`}>{done? '✓': s.id}</div>
                <div className={`text-sm ${active? 'text-white':'text-gray-300'}`}>{s.title}</div>
                {i<steps.length-1 && <div className="w-8 h-px bg-gray-600 mx-2"/>}
              </div>
            );
          })}
        </div>

        {step===1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Folio generado">
              <TextInput value={form.folio} readOnly disabled className="cursor-not-allowed opacity-80" title="El folio se genera automáticamente" />
            </Campo>
            <Campo label="Número de aviso SAP">
              <TextInput value={form.sapAviso||""} onChange={(e)=>canEdit && setForm({...form, sapAviso:e.target.value})} disabled={!canEdit} placeholder="Ej: 50012345" />
            </Campo>
            <Campo label="Reportante"><TextInput value={form.reportante} onChange={(e)=>canEdit && setForm({...form, reportante:e.target.value})} disabled={!canEdit} /></Campo>
            <Campo label="Fecha" required><TextInput type="date" value={form.fecha} onChange={(e)=>canEdit && setForm({...form, fecha:e.target.value})} disabled={!canEdit} /></Campo>
            <Campo label="Hora" required><TextInput type="time" value={form.hora} onChange={(e)=>canEdit && setForm({...form, hora:e.target.value})} disabled={!canEdit} /></Campo>
            <Campo label="Área"><Select value={form.area} onChange={(e)=>canEdit && setForm({...form, area:e.target.value})} disabled={!canEdit}><option value="">Seleccione área…</option>{AREAS.map(a=> <option key={a} value={a}>{a}</option>)}</Select></Campo>
            <div className="md:col-span-2"><Campo label="Ubicación específica"><TextInput value={form.ubicacion} onChange={(e)=>canEdit && setForm({...form, ubicacion:e.target.value})} disabled={!canEdit} /></Campo></div>
          </div>
        )}

        {step===2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Tipo" required><Select value={form.tipo} onChange={(e)=>canEdit && setForm({...form, tipo:e.target.value})} disabled={!canEdit}>{TIPOS.map(t=> <option key={t} value={t}>{t}</option>)}</Select></Campo>
            <Campo label="Severidad" required><Select value={form.severidad} onChange={(e)=>canEdit && setForm({...form, severidad:e.target.value})} disabled={!canEdit}>{SEVERIDADES.map(s=> <option key={s} value={s}>{s}</option>)}</Select></Campo>
            <div className="md:col-span-2"><Campo label="Descripción (≥10)" required><TextArea value={form.descripcion} onChange={(e)=>canEdit && setForm({...form, descripcion:e.target.value})} disabled={!canEdit} placeholder="Describe la desviación…"/></Campo></div>
            <div className="md:col-span-2"><Campo label="Causas"><TextArea value={form.causas} onChange={(e)=>canEdit && setForm({...form, causas:e.target.value})} disabled={!canEdit} /></Campo></div>
            <div className="md:col-span-2"><Campo label="Tags"><TextInput value={form.tags} onChange={(e)=>canEdit && setForm({...form, tags:e.target.value})} disabled={!canEdit} /></Campo></div>
          </div>
        )}

        {step===3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Campo label="Estado del reporte">
              <Select value={form.status||'pendiente'} onChange={(e)=>canEdit && setForm({...form, status:e.target.value})} disabled={!canEdit}>
                {ESTADOS.map((opt)=> <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </Select>
            </Campo>
            <div className="md:col-span-2"><Campo label="Acciones / contención"><TextArea value={form.acciones} onChange={(e)=>canEdit && setForm({...form, acciones:e.target.value})} disabled={!canEdit} /></Campo></div>
            <Campo label="Responsable"><TextInput value={form.responsable} onChange={(e)=>canEdit && setForm({...form, responsable:e.target.value})} disabled={!canEdit} /></Campo>
            <Campo label="Fecha compromiso"><TextInput type="date" value={form.compromiso||""} onChange={(e)=>canEdit && setForm({...form, compromiso:e.target.value})} disabled={!canEdit} /></Campo>
          </div>
        )}

        {step===4 && (
          <div>
            <div className={`border-2 border-dashed rounded-2xl p-6 text-center ${canEdit? 'border-gray-700 bg-gray-900/40':'border-gray-800 bg-gray-900/20'}`}>
              <p className="text-sm text-gray-300">Selecciona imágenes (sube a Cloudinary si está configurado)</p>
              <div className="mt-2">
                <label className={`inline-block cursor-pointer px-4 py-2 rounded-xl text-white text-sm ${canEdit? 'bg-gray-700 hover:bg-gray-600':'bg-gray-700/60 cursor-not-allowed'}`}>
                  Elegir imágenes
                  <input type="file" accept="image/*" multiple className="hidden" disabled={!canEdit} onChange={(e)=>onFilesSelected(e.target.files)} />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">Si Cloudinary no está configurado, solo se verán localmente y no se guardarán.</p>
            </div>

            {form.fotos?.length>0 && (
              <div className="mt-4">
                <FotosGrid fotos={form.fotos} uploading={uploading} onNota={(i,nota)=>setForm(f=>{ const arr=[...(f.fotos||[])]; arr[i]={...arr[i], nota}; return {...f, fotos:arr}; })} onRemove={(i)=>setForm(f=>({ ...f, fotos: (f.fotos||[]).filter((_,idx)=>idx!==i) }))} canEdit={canEdit} onPreview={openViewer} />
              </div>
            )}
          </div>
        )}

        {step===5 && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Resumen</h3>
              <div className="flex items-center gap-2">
                <Badge color={{'Baja':'bg-emerald-600','Media':'bg-amber-500','Alta':'bg-orange-600','Crítica':'bg-red-600'}[form.severidad]||'bg-indigo-600'}>{form.severidad}</Badge>
                <Badge color={ESTADO_COLOR[form.status] || 'bg-slate-600'}>{ESTADO_LABEL[form.status] || 'Pendiente'}</Badge>
                <button onClick={()=>exportReportPDF(form)} className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs">Exportar PDF</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Folio</div><div className="text-white font-medium">{form.folio}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Fecha/Hora</div><div className="text-white font-medium">{form.fecha} {form.hora}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Propietario</div><div className="text-white font-medium">{form.ownerName||'—'}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Área/Ubicación</div><div className="text-white font-medium">{form.area||'—'} {form.ubicacion? `• ${form.ubicacion}`:''}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Tipo</div><div className="text-white font-medium">{form.tipo}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Tags</div><div className="text-white font-medium">{form.tags||'—'}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Estado</div><div className="text-white font-medium">{ESTADO_LABEL[form.status] || 'Pendiente'}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400">Número aviso SAP</div><div className="text-white font-medium">{form.sapAviso || '—'}</div></div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400 text-sm mb-1">Descripción</div><div className="text-gray-100 whitespace-pre-wrap">{form.descripcion||'—'}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400 text-sm mb-1">Causas</div><div className="text-gray-100 whitespace-pre-wrap">{form.causas||'—'}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400 text-sm mb-1">Acciones</div><div className="text-gray-100 whitespace-pre-wrap">{form.acciones||'—'}</div></div>
              <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700"><div className="text-gray-400 text-sm mb-1">Responsable/Compromiso</div><div className="text-gray-100 whitespace-pre-wrap">{(form.responsable||'—')+(form.compromiso? `
Fecha compromiso: ${form.compromiso}`:'')}</div></div>
            </div>
            {form.fotos?.length>0 && (
              <div className="mt-4">
                <div className="text-white font-semibold mb-2">Evidencias</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {form.fotos.map((f,i)=> (
                    <figure key={i} className="bg-gray-800/60 rounded-xl overflow-hidden border border-gray-700">
                      <img src={f.url} alt={`Foto ${i+1}`} onClick={()=>openViewer(i)} className="w-full h-40 object-cover cursor-zoom-in" />
                      {f.nota && <figcaption className="text-xs text-gray-300 p-2">{f.nota}</figcaption>}
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1} className={`px-4 py-2 rounded-xl text-sm ${step===1? 'bg-gray-700/60 text-gray-400 cursor-not-allowed':'bg-gray-700 hover:bg-gray-600 text-white'}`}>Atrás</button>
          <div className="flex items-center gap-2">
            {step<5 && <button onClick={()=>setStep(s=>Math.min(5,s+1))} disabled={!validarStep(step)} className={`px-4 py-2 rounded-xl text-sm ${!validarStep(step)? 'bg-indigo-600/50 text-white/70 cursor-not-allowed':'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>Siguiente</button>}
            {step===5 && <button disabled={!canEdit||saving} onClick={saveReport} className={`px-4 py-2 rounded-xl text-sm ${!canEdit? 'bg-gray-600/60 cursor-not-allowed text-white/70':'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>{saving? 'Guardando…':'Guardar'}</button>}
          </div>
        </div>
      </div>

      {/* Listado */}
      <aside className="space-y-6">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Reportes</h3>
            <label className="text-xs text-gray-300 inline-flex items-center gap-1">
              <input type="checkbox" className="accent-indigo-600" checked={onlyMine} onChange={(e)=>setOnlyMine(e.target.checked)} /> Solo míos
            </label>
          </div>
          <div className="mt-2 max-h-[420px] overflow-auto pr-1 space-y-2">
                {filtered.map((it)=> (
                  <div key={it._id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap"><span className="text-white font-semibold text-sm">{it.folio}</span><Badge>{it.severidad}</Badge><Badge color={ESTADO_COLOR[it.status] || 'bg-slate-600'}>{ESTADO_LABEL[it.status] || 'Pendiente'}</Badge></div>
                  <div className="text-xs text-gray-300 mt-1 flex flex-wrap gap-2"><span>{it.fecha} {it.hora}</span><span>• {it.tipo}</span><span>• {it.area||'(sin área)'}</span><span>• {it.ownerName||'—'}</span></div>
                  <div className="text-xs text-gray-400 line-clamp-2 mt-1">{it.descripcion}</div>
                </div>
                <div className="flex flex-col gap-2 w-28">
                  <button onClick={()=>onLoadReport(it)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-1">Abrir</button>
                  <button onClick={()=>onDeleteReport(it)} disabled={!(currentUser.role==='admin' || it.ownerId===currentUser.id)} className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg py-1">Eliminar</button>
                </div>
              </div>
            ))}
            {filtered.length===0 && <div className="text-sm text-gray-400">No hay resultados.</div>}
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Consejos</h3>
          <ul className="list-disc pl-5 text-xs text-gray-300 space-y-1">
            <li>Click en una foto para ampliarla. Usa ← → o los botones para navegar. Cierra con × (arriba izquierda) o Esc.</li>
            <li>El token de acceso se renueva con cookie httpOnly (no verás el refresh).</li>
            <li>Solo el propietario edita su reporte; admin edita todo.</li>
            <li>Para fotos reales, configura Cloudinary en el backend.</li>
            <li>Usa "Exportar PDF" en el Paso 5 para descargar el reporte con fotos.</li>
          </ul>
        </div>
      </aside>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Reporte de Desviaciones</h1>
              <p className="text-sm text-gray-400">Conectado a API • {API}</p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <NavLink to="/" className={navLinkClass}>Inicio</NavLink>
              <NavLink to="/reportes" className={navLinkClass}>Reportes</NavLink>
              <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
              <NavLink to="/resumen-turno" className={navLinkClass}>Resumen de turno</NavLink>
              <NavLink to="/perfil" className={navLinkClass}>Perfil</NavLink>
              {currentUser.role === 'admin' && (
                <NavLink to="/usuarios" className={navLinkClass}>Usuarios</NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-300 bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2">
              Sesión: <span className="font-semibold text-white">{currentUser.fullName ? `${currentUser.fullName} • ${currentUser.username}` : currentUser.username}</span> <span className="text-xs text-gray-400">({currentUser.role==='admin'?'superusuario':'usuario'})</span>
            </div>
            <button onClick={handleLogout} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm shadow">Cerrar sesión</button>
          </div>
        </header>

        <Routes>
          <Route
            path="/"
            element={
              <Home
                currentUser={currentUser}
                onAuthError={handleLogout}
                onFetchOverview={fetchOverviewFn}
              />
            }
          />
          <Route path="/reportes" element={reportPage} />
          <Route path="/dashboard" element={<Dashboard apiFetch={apiFetch} onAuthError={handleLogout} currentUser={currentUser} />} />
          <Route
            path="/resumen-turno"
            element={
              <ShiftSummary
                currentUser={currentUser}
                areas={AREAS}
                onAuthError={handleLogout}
                onFetchSummaries={listSummariesFn}
                onCreateSummary={createSummaryFn}
                onDeleteSummary={deleteSummaryFn}
                onUploadSignature={getSignature}
                onUploadFiles={uploadToCloudinary}
                dataURLFromURL={dataURLFromURL}
              />
            }
          />
          <Route
            path="/perfil"
            element={
              <Profile
                currentUser={currentUser}
                onAuthError={handleLogout}
                onUpdateProfile={handleProfileUpdate}
                onChangePassword={handlePasswordChange}
                onUploadSignature={getSignature}
                onUploadFiles={uploadToCloudinary}
              />
            }
          />
          <Route
            path="/usuarios"
            element={
              currentUser.role === 'admin'
                ? (
                  <UsersAdmin
                    currentUser={currentUser}
                    onAuthError={handleLogout}
                    onFetchUsers={fetchUsersList}
                    onCreateUser={createUserFn}
                    onUpdateUser={updateUserFn}
                    onDeleteUser={deleteUserFn}
                  />
                )
                : <Navigate to="/" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {location.pathname === "/" && viewer.open && (
        <Lightbox
          photos={form.fotos}
          index={viewer.index}
          onClose={closeViewer}
          onPrev={prevPhoto}
          onNext={nextPhoto}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
