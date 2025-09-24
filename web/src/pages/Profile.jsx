import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function Profile({
  currentUser,
  onAuthError,
  onUpdateProfile,
  onChangePassword,
  onUploadSignature,
  onUploadFiles,
}) {
  if (!currentUser) return <Navigate to="/" replace />;

  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [photoUrl, setPhotoUrl] = useState(currentUser.photoUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setFullName(currentUser.fullName || '');
    setPhotoUrl(currentUser.photoUrl || '');
  }, [currentUser.fullName, currentUser.photoUrl]);

  function hasProfileChanges() {
    return (
      (fullName || '') !== (currentUser.fullName || '') ||
      (photoUrl || '') !== (currentUser.photoUrl || '')
    );
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!hasProfileChanges()) {
      setProfileMessage('No hay cambios para guardar');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    setProfileMessage('');
    try {
      const updated = await onUpdateProfile({
        fullName: fullName.trim(),
        photoUrl: photoUrl.trim(),
      });
      setProfileMessage('Perfil actualizado');
      setProfileError('');
      setFullName(updated.fullName || '');
      setPhotoUrl(updated.photoUrl || '');
    } catch (err) {
      console.error(err);
      const msg = err.message || 'No se pudo actualizar el perfil';
      setProfileError(msg);
      if ((msg || '').toLowerCase().includes('expirada')) onAuthError?.();
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePhotoSelect(fileList) {
    if (!fileList?.length) return;
    const file = fileList[0];
    try {
      const folder = `perfil/${currentUser?.username || 'usuario'}`;
      const sig = await onUploadSignature(folder);
      if (sig && sig.cloudName && sig.apiKey && sig.signature) {
        const urls = await onUploadFiles([file], sig);
        const url = urls.find(Boolean);
        if (url) {
          setPhotoUrl(url);
          setProfileMessage('Foto cargada, recuerda guardar cambios');
          setProfileError('');
        } else {
          alert('No se pudo subir la imagen (Cloudinary)');
        }
      } else {
        const data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        setPhotoUrl(String(data));
        alert('Cloudinary no está configurado: la imagen se guardará incrustada.');
      }
    } catch (err) {
      console.error(err);
      setProfileError('No se pudo procesar la imagen');
    }
  }

  function handleRemovePhoto() {
    setPhotoUrl('');
    setProfileMessage('Foto eliminada, recuerda guardar cambios');
    setProfileError('');
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    const current = passwords.current.trim();
    const next = passwords.next.trim();
    const confirm = passwords.confirm.trim();
    if (!current || !next) {
      setPasswordError('Completa las contraseñas');
      return;
    }
    if (next.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (next !== confirm) {
      setPasswordError('La confirmación no coincide');
      return;
    }

    setSavingPassword(true);
    try {
      await onChangePassword({ currentPassword: current, newPassword: next });
      setPasswordMessage('Contraseña actualizada');
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (err) {
      console.error(err);
      const msg = err.message || 'No se pudo actualizar la contraseña';
      setPasswordError(msg);
      if ((msg || '').toLowerCase().includes('expirada')) onAuthError?.();
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 text-gray-100">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
        <p className="text-sm text-gray-400">Actualiza tu información personal y credenciales.</p>
      </header>

      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Información personal</h2>
        {profileError && <div className="text-sm text-red-400 bg-red-900/30 border border-red-700/60 rounded-xl px-3 py-2">{profileError}</div>}
        {profileMessage && !profileError && <div className="text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-3 py-2">{profileMessage}</div>}
        <form onSubmit={handleProfileSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Usuario</label>
            <input value={currentUser.username} disabled className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Nombre completo</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-2">Fotografía</label>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">Sin foto</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { handlePhotoSelect(e.target.files); e.target.value = ''; }}
                  className="block w-full text-sm text-gray-300"
                />
                {photoUrl && <button type="button" onClick={handleRemovePhoto} className="text-xs text-red-300 hover:text-red-200">Quitar foto</button>}
              </div>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile || !hasProfileChanges()}
              className={`px-4 py-2 rounded-xl text-sm ${savingProfile || !hasProfileChanges() ? 'bg-emerald-600/60 text-white/70 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
            >
              {savingProfile ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Cambiar contraseña</h2>
        {passwordError && <div className="text-sm text-red-400 bg-red-900/30 border border-red-700/60 rounded-xl px-3 py-2">{passwordError}</div>}
        {passwordMessage && !passwordError && <div className="text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-3 py-2">{passwordMessage}</div>}
        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Contraseña actual</label>
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords((prev) => ({ ...prev, current: e.target.value }))}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={passwords.next}
              onChange={(e) => setPasswords((prev) => ({ ...prev, next: e.target.value }))}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-400 uppercase font-semibold mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((prev) => ({ ...prev, confirm: e.target.value }))}
              className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className={`px-4 py-2 rounded-xl text-sm ${savingPassword ? 'bg-indigo-600/60 text-white/70 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
            >
              {savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
