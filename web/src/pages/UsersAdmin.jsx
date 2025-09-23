import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function UsersAdmin({ currentUser, onAuthError, onFetchUsers, onUpdateUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    (async () => {
      await loadUsers();
    })();
  }, [currentUser?.role, onFetchUsers]);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await onFetchUsers();
      setUsers(data);
      setError('');
    } catch (e) {
      console.error(e);
      setError(e.message || 'No se pudo cargar usuarios');
      if ((e.message || '').toLowerCase().includes('expirada')) onAuthError?.();
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) return <Navigate to="/" replace />;
  if (currentUser.role !== 'admin') return <Navigate to="/" replace />;

  function startEdit(user) {
    setEditing({
      id: user.id,
      username: user.username,
      role: user.role,
      password: '',
      original: { username: user.username, role: user.role },
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    const payload = {};
    const username = editing.username.trim();
    if (username && username !== editing.original.username) payload.username = username;
    if (editing.role !== editing.original.role) payload.role = editing.role;
    const password = editing.password.trim();
    if (password) payload.password = password;

    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }

    try {
      const updated = await onUpdateUser(editing.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditing(null);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo actualizar usuario');
      if ((err.message || '').toLowerCase().includes('expirada')) onAuthError?.();
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 text-gray-100">
      <div>
        <h1 className="text-2xl font-bold text-white">Administración de usuarios</h1>
        <p className="text-sm text-gray-400">Gestiona cuentas, roles y restablece contraseñas.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 text-red-200 border border-red-700/60 rounded-xl px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl shadow-lg shadow-black/10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Usuarios registrados</h2>
          <span className="text-xs text-gray-400">{users.length} usuarios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800/60 text-gray-300 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-2">Usuario</th>
                <th className="text-left px-4 py-2">Rol</th>
                <th className="text-left px-4 py-2">Creado</th>
                <th className="text-left px-4 py-2">Actualizado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="text-gray-200">
                  <td className="px-4 py-2 font-medium text-white">{user.username}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${user.role === 'admin' ? 'bg-indigo-600/50 text-indigo-100 border border-indigo-500/60' : 'bg-gray-700/70 text-gray-100 border border-gray-600/60'}`}>
                      {user.role === 'admin' ? 'Superusuario' : 'Usuario'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(user.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{new Date(user.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => startEdit(user)}
                      className="text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-400" colSpan={5}>
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-4 text-center text-gray-400" colSpan={5}>
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3 shadow-inner shadow-black/20">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Editar usuario</h3>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Usuario</label>
            <input
              value={editing.username}
              onChange={(e) => setEditing((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Rol</label>
            <select
              value={editing.role}
              onChange={(e) => setEditing((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">Usuario</option>
              <option value="admin">Superusuario</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={editing.password}
              onChange={(e) => setEditing((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Dejar en blanco para mantener la actual"
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={cancelEdit} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm text-white">Cancelar</button>
            <button type="submit" className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm text-white">Guardar cambios</button>
          </div>
        </form>
      )}
    </div>
  );
}
