'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { swalConfirmDelete, swalSuccess, swalError } from '@/lib/swal';

const WARNA_OPTIONS = [
  { key: 'cream',  label: 'Cream',  bg: '#FFF5F0', text: '#0D0D0D' },
  { key: 'yellow', label: 'Kuning', bg: '#F5C518', text: '#0D0D0D' },
  { key: 'teal',   label: 'Teal',   bg: '#00A693', text: '#FFFFFF' },
  { key: 'orange', label: 'Orange', bg: '#E8451A', text: '#FFFFFF' },
  { key: 'peach',  label: 'Peach',  bg: '#FFE8DC', text: '#0D0D0D' },
  { key: 'blue',   label: 'Biru',   bg: '#2F80ED', text: '#FFFFFF' },
];

const getWarna = (key) => WARNA_OPTIONS.find((w) => w.key === key) || WARNA_OPTIONS[0];

const formatRelative = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Komponen Lightbox Foto
function FotoViewer({ url, onClose }) {
  // ⚠️ useEffect HARUS di atas early return (Rules of Hooks)
  useEffect(() => {
    if (!url) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="foto-viewer-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,13,13,0.92)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      {/* Tombol tutup */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: '#E8451A', color: '#fff',
          border: '2px solid #fff', borderRadius: '12px',
          width: '40px', height: '40px', fontSize: '1.25rem',
          fontWeight: 900, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '3px 3px 0 #fff', zIndex: 1,
        }}
        title="Tutup (Esc)"
      >×</button>

      {/* Foto */}
      <div
        className="foto-viewer-img-wrap"
        style={{
          maxWidth: '100%', maxHeight: '90vh',
          border: '3px solid #fff',
          borderRadius: '16px',
          boxShadow: '8px 8px 0px 0px rgba(255,255,255,0.25)',
          overflow: 'hidden',
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="Foto lampiran catatan"
          style={{
            display: 'block',
            maxWidth: '90vw',
            maxHeight: '85vh',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Hint */}
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.75rem', fontWeight: 600 }}>
        Klik di luar foto atau tekan Esc untuk menutup
      </p>
    </div>
  );
}

// Komponen Card
function CatatanCard({ catatan, onEdit, onDelete, onTogglePin, onViewFoto }) {
  const w = getWarna(catatan.warna);
  return (
    <div
      style={{ background: w.bg, color: w.text, border: '2px solid #0D0D0D', borderRadius: '16px', boxShadow: '4px 4px 0px 0px #0D0D0D', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease', position: 'relative', minHeight: '160px', wordBreak: 'break-word', overflow: 'hidden' }}
      className="catatan-card"
      onClick={() => onEdit(catatan)}
    >
      {/* Thumbnail foto */}
      {catatan.foto_url && (
        <div style={{ width: '100%', height: '110px', overflow: 'hidden', borderBottom: '2px solid #0D0D0D', flexShrink: 0, position: 'relative' }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={catatan.foto_url}
            alt="Lampiran"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
          {/* Tombol lihat full */}
          <button
            onClick={(e) => { e.stopPropagation(); onViewFoto(catatan.foto_url); }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              background: 'rgba(13,13,13,0)', border: 'none', cursor: 'zoom-in',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            className="foto-zoom-btn"
            title="Lihat foto penuh"
          >
            <span className="foto-zoom-icon" style={{ background: '#0D0D0D', color: '#fff', borderRadius: '10px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 800, opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔍 Lihat
            </span>
          </button>
        </div>
      )}

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
        {catatan.pinned && (
          <span style={{ position: 'absolute', top: catatan.foto_url ? '6px' : '-10px', right: '14px', fontSize: '1.3rem', filter: 'drop-shadow(1px 1px 0 #0D0D0D)' }}>
            📌
          </span>
        )}

        <p style={{ fontWeight: 800, fontSize: '0.9375rem', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {catatan.judul || <em style={{ opacity: 0.5 }}>Tanpa judul</em>}
        </p>
        <p style={{ fontSize: '0.8125rem', opacity: 0.8, flex: 1, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: catatan.foto_url ? 2 : 3, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>
          {catatan.isi || <em style={{ opacity: 0.5 }}>Tidak ada isi...</em>}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.4rem', borderTop: `1.5px solid ${w.text}20` }}
          onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 600 }}>
            {catatan.foto_url && <span style={{ marginRight: '4px' }}>🖼️</span>}
            {formatRelative(catatan.updated_at || catatan.created_at)}
          </span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={() => onTogglePin(catatan)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 3px', opacity: catatan.pinned ? 1 : 0.35 }} title={catatan.pinned ? 'Lepas pin' : 'Sematkan'}>📌</button>
            <button onClick={() => onDelete(catatan.id, catatan.foto_url)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 3px', opacity: 0.45 }} title="Hapus">🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import CatatanEditor from './CatatanEditor';

function EmptyState({ onAdd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', gap: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '5rem', lineHeight: 1, filter: 'drop-shadow(4px 4px 0 #0D0D0D)' }}>📝</div>
      <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', textTransform: 'uppercase' }}>Belum Ada Catatan</h3>
      <p style={{ margin: 0, color: '#555', maxWidth: '280px', fontWeight: 500 }}>Simpan ide, pengingat, atau refleksi harian kamu di sini.</p>
      <button className="neo-btn-primary" onClick={onAdd} style={{ marginTop: '0.5rem' }}>+ Buat Catatan Pertama</button>
    </div>
  );
}

export default function CatatanPage() {
  const router = useRouter();
  const [catatan, setCatatan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [authUid, setAuthUid] = useState('');
  const [search, setSearch] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fotoViewerUrl, setFotoViewerUrl] = useState(null);

  useEffect(() => {
    const init = async () => {
      let currentUid = '';
      let currentAuthUid = '';

      // 1. Coba baca identitas dan data dari cache IndexedDB dulu
      try {
        const { getAll, getUserSession } = await import('@/lib/offlineDb');
        const [cachedUser, cachedNotes] = await Promise.all([
          getUserSession(),
          getAll('catatan'),
        ]);

        if (cachedUser) {
          currentUid = cachedUser.id || cachedUser.id_user || '';
          currentAuthUid = cachedUser.auth_id || cachedUser.id || '';
          setUserId(currentUid);
          setAuthUid(currentAuthUid);
        }

        if (cachedNotes && cachedNotes.length > 0) {
          const userNotes = cachedNotes.filter((c) => !currentUid || c.user_id === currentUid);
          setCatatan(userNotes);
          setLoading(false);
        }
      } catch (e) {
        console.warn('Error reading cached notes:', e);
      }

      // 2. Jika online, sinkronkan profil dan data dari API
      if (typeof window !== 'undefined' && window.navigator.onLine) {
        try {
          const resAuth = await fetch('/api/auth/me');
          if (resAuth.ok) {
            const authData = await resAuth.json();
            if (authData.user) {
              currentUid = authData.user.id;
              currentAuthUid = authData.user.id;
              setUserId(currentUid);
              setAuthUid(currentAuthUid);
            }
          }

          const resNotes = await fetch('/api/catatan');
          if (resNotes.ok) {
            const notesData = await resNotes.json();
            if (Array.isArray(notesData)) {
              setCatatan(notesData);
              try {
                const { bulkPut } = await import('@/lib/offlineDb');
                bulkPut('catatan', notesData);
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn('Network fetch notes error, using offline cache:', err);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.navigator.onLine) {
        const res = await fetch('/api/catatan');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCatatan(data);
            const { bulkPut } = await import('@/lib/offlineDb');
            bulkPut('catatan', data);
            return;
          }
        }
      }

      const { getAll } = await import('@/lib/offlineDb');
      const allCached = await getAll('catatan');
      const filtered = (allCached || []).filter((c) => !userId || c.user_id === userId);
      setCatatan(filtered);
    } catch (e) {
      console.warn('Refresh notes error:', e);
    }
  }, [userId]);

  // Upload foto ke Supabase Storage
  const uploadFoto = async (supabase, file, catatanId) => {
    const ext = file.name.split('.').pop();
    const path = `${authUid}/${catatanId}.${ext}`;
    const { error } = await supabase.storage.from('catatan-foto').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from('catatan-foto').getPublicUrl(path);
    return data.publicUrl;
  };

  // Hapus foto dari Storage
  const deleteFotoFromStorage = async (supabase, fotoUrl) => {
    if (!fotoUrl) return;
    try {
      const urlObj = new URL(fotoUrl);
      const pathParts = urlObj.pathname.split('/catatan-foto/');
      if (pathParts.length > 1) {
        await supabase.storage.from('catatan-foto').remove([pathParts[1]]);
      }
    } catch (e) {
      console.warn('Gagal hapus foto dari storage:', e);
    }
  };

  const handleSave = async (form, fotoFile, hapusFoto, oldFotoUrl) => {
    if (!form.judul.trim() && !form.isi.trim() && !fotoFile && !editTarget?.foto_url) {
      swalError('Catatan Kosong', 'Isi judul, isi catatan, atau lampirkan foto terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

    try {
      const noteId = editTarget ? editTarget.id : 'note_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      let foto_url = editTarget?.foto_url || null;

      if (hapusFoto) foto_url = null;

      // Jika ada file foto baru
      if (fotoFile) {
        if (isOffline) {
          // Convert to base64 preview for offline viewing
          foto_url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(fotoFile);
          });
        } else {
          try {
            const supabase = createClient();
            foto_url = await uploadFoto(supabase, fotoFile, noteId);
          } catch (uploadErr) {
            console.warn('Upload foto storage gagal, simpan offline:', uploadErr);
          }
        }
      }

      const notePayload = {
        id: noteId,
        user_id: userId,
        judul: form.judul,
        isi: form.isi,
        warna: form.warna,
        pinned: editTarget ? editTarget.pinned : false,
        foto_url,
        updated_at: new Date().toISOString(),
        created_at: editTarget ? editTarget.created_at : new Date().toISOString(),
      };

      if (isOffline) {
        const { putItem } = await import('@/lib/offlineDb');
        const { enqueueAction } = await import('@/lib/syncEngine');

        await putItem('catatan', notePayload);
        await enqueueAction({
          type: 'CATATAN',
          endpoint: '/api/catatan',
          method: editTarget ? 'PUT' : 'POST',
          payload: notePayload,
          description: `Catatan: ${form.judul || 'Tanpa judul'}`,
        });

        if (editTarget) {
          setCatatan((prev) => prev.map((c) => (c.id === noteId ? notePayload : c)));
        } else {
          setCatatan((prev) => [notePayload, ...prev]);
        }

        setIsEditorOpen(false);
        setEditTarget(null);
        swalSuccess(editTarget ? 'Catatan Diperbarui!' : 'Catatan Tersimpan!', 'Disimpan di perangkat dan akan disinkronkan saat online.');
      } else {
        const res = await fetch('/api/catatan', {
          method: editTarget ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notePayload),
        });

        if (res.ok) {
          const { putItem } = await import('@/lib/offlineDb');
          await putItem('catatan', notePayload);
          setIsEditorOpen(false);
          setEditTarget(null);
          await refresh();
          swalSuccess(editTarget ? 'Catatan Diperbarui!' : 'Catatan Tersimpan!', '');
        } else {
          throw new Error('Gagal menyimpan di server');
        }
      }
    } catch (err) {
      console.warn('Gagal online save, fallback ke offline queue:', err);
      try {
        const { putItem } = await import('@/lib/offlineDb');
        const { enqueueAction } = await import('@/lib/syncEngine');

        const fallbackId = editTarget ? editTarget.id : 'note_' + Math.random().toString(36).substring(2, 9);
        const fallbackPayload = {
          id: fallbackId,
          user_id: userId,
          judul: form.judul,
          isi: form.isi,
          warna: form.warna,
          pinned: editTarget ? editTarget.pinned : false,
          foto_url: editTarget?.foto_url || null,
          updated_at: new Date().toISOString(),
          created_at: editTarget ? editTarget.created_at : new Date().toISOString(),
        };

        await putItem('catatan', fallbackPayload);
        await enqueueAction({
          type: 'CATATAN',
          endpoint: '/api/catatan',
          method: editTarget ? 'PUT' : 'POST',
          payload: fallbackPayload,
          description: `Catatan: ${form.judul || 'Tanpa judul'}`,
        });

        setIsEditorOpen(false);
        setEditTarget(null);
        await refresh();
        swalSuccess('Tersimpan Offline!', 'Catatan aman di perangkat dan akan disinkronkan saat koneksi pulih.');
      } catch (fallbackErr) {
        swalError('Gagal Menyimpan', err.message || 'Coba lagi sebentar.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, fotoUrl) => {
    const result = await swalConfirmDelete('Hapus Catatan?', 'Catatan dan foto lampirannya tidak bisa dikembalikan.');
    if (!result.isConfirmed) return;

    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

    try {
      const { deleteItem } = await import('@/lib/offlineDb');
      const { enqueueAction } = await import('@/lib/syncEngine');

      await deleteItem('catatan', id);
      setCatatan((prev) => prev.filter((c) => c.id !== id));

      if (isOffline) {
        await enqueueAction({
          type: 'CATATAN_DELETE',
          endpoint: `/api/catatan?id=${id}`,
          method: 'DELETE',
          payload: { id },
          description: `Hapus Catatan ID ${id}`,
        });
        swalSuccess('Terhapus Lokal!', 'Catatan dihapus dari perangkat.');
      } else {
        const res = await fetch(`/api/catatan?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal hapus di server');
        swalSuccess('Terhapus!', 'Catatan berhasil dihapus.');
      }
    } catch (err) {
      console.warn('Gagal online delete, fallback ke queue:', err);
      try {
        const { enqueueAction } = await import('@/lib/syncEngine');
        await enqueueAction({
          type: 'CATATAN_DELETE',
          endpoint: `/api/catatan?id=${id}`,
          method: 'DELETE',
          payload: { id },
          description: `Hapus Catatan ID ${id}`,
        });
        swalSuccess('Terhapus Lokal!', 'Catatan dihapus dari perangkat.');
      } catch (e) {
        swalError('Gagal Menghapus', err.message || 'Coba lagi.');
      }
    }
  };

  const handleTogglePin = async (item) => {
    const updated = { ...item, pinned: !item.pinned, updated_at: new Date().toISOString() };
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

    try {
      const { putItem } = await import('@/lib/offlineDb');
      const { enqueueAction } = await import('@/lib/syncEngine');

      await putItem('catatan', updated);
      setCatatan((prev) => prev.map((c) => (c.id === item.id ? updated : c)));

      if (isOffline) {
        await enqueueAction({
          type: 'CATATAN',
          endpoint: '/api/catatan',
          method: 'PUT',
          payload: updated,
          description: `Pin Catatan: ${item.judul || ''}`,
        });
      } else {
        await fetch('/api/catatan', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      }
    } catch (err) {
      console.warn('Gagal toggle pin online:', err);
    }
  };

  const handleOpenEdit = (item) => { setEditTarget(item); setIsEditorOpen(true); };
  const handleOpenNew = () => { setEditTarget(null); setIsEditorOpen(true); };
  const handleViewFoto = (url) => setFotoViewerUrl(url);
  const handleCloseFotoViewer = () => setFotoViewerUrl(null);
  const handleCloseEditor = () => { if (!isSaving) { setIsEditorOpen(false); setEditTarget(null); } };

  const q = search.toLowerCase();
  const filtered = catatan.filter((c) => (c.judul || '').toLowerCase().includes(q) || (c.isi || '').toLowerCase().includes(q));
  const pinnedList = filtered.filter((c) => c.pinned);
  const unpinnedList = filtered.filter((c) => !c.pinned);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF5F0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <p style={{ fontWeight: 700 }}>Memuat catatan...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .catatan-card:hover { transform: translate(-2px,-2px) !important; box-shadow: 6px 6px 0px 0px #0D0D0D !important; }
        .catatan-card:active { transform: translate(2px,2px) !important; box-shadow: 2px 2px 0px 0px #0D0D0D !important; }
        .foto-zoom-btn:hover { background: rgba(13,13,13,0.45) !important; }
        .foto-zoom-btn:hover .foto-zoom-icon { opacity: 1 !important; }
        @keyframes fvFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes fvSlideUp { from { opacity:0; transform: scale(0.92); } to { opacity:1; transform: scale(1); } }
        .foto-viewer-overlay { animation: fvFadeIn 0.2s ease; }
        .foto-viewer-img-wrap { animation: fvSlideUp 0.2s ease; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#FFF5F0', paddingBottom: '5rem' }}>
        {/* Header */}
        <div style={{ background: '#0D0D0D', color: '#FFF5F0', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 100, borderBottom: '3px solid #0D0D0D' }}>
          <Link href="/" style={{ color: '#FFF5F0', textDecoration: 'none', fontWeight: 900, fontSize: '1.25rem' }}>←</Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📝 Catatan Saya</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6, fontWeight: 600 }}>{catatan.length} catatan tersimpan</p>
          </div>
          <button className="neo-btn-primary" onClick={handleOpenNew} style={{ background: '#E8451A', border: '2px solid #FFF5F0', padding: '0.5rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
            + Tambah
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '1rem 1.5rem 0' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.5, pointerEvents: 'none' }}>🔍</span>
            <input className="neo-input neo-input-with-icon" type="text" placeholder="Cari catatan..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {catatan.length === 0 ? (
            <EmptyState onAdd={handleOpenNew} />
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#777' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔍</div>
              <p style={{ fontWeight: 700 }}>Tidak ada catatan yang cocok dengan &quot;{search}&quot;</p>
            </div>
          ) : (
            <>
              {pinnedList.length > 0 && (
                <section style={{ marginBottom: '1.75rem' }}>
                  <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555' }}>
                    📌 Disematkan ({pinnedList.length})
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                    {pinnedList.map((c) => <CatatanCard key={c.id} catatan={c} onEdit={handleOpenEdit} onDelete={handleDelete} onTogglePin={handleTogglePin} onViewFoto={handleViewFoto} />)}
                  </div>
                </section>
              )}
              {unpinnedList.length > 0 && (
                <section>
                  {pinnedList.length > 0 && (
                    <h2 style={{ margin: '0 0 0.875rem', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555' }}>
                      📋 Semua Catatan ({unpinnedList.length})
                    </h2>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                    {unpinnedList.map((c) => <CatatanCard key={c.id} catatan={c} onEdit={handleOpenEdit} onDelete={handleDelete} onTogglePin={handleTogglePin} onViewFoto={handleViewFoto} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={handleOpenNew}
          style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', width: '56px', height: '56px', borderRadius: '16px', background: '#E8451A', color: '#fff', border: '2px solid #0D0D0D', boxShadow: '4px 4px 0px 0px #0D0D0D', fontSize: '1.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s ease, box-shadow 0.15s ease', zIndex: 200 }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = '6px 6px 0px 0px #0D0D0D'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '4px 4px 0px 0px #0D0D0D'; }}
          title="Tambah Catatan Baru"
        >
          +
        </button>
      </div>

      {isEditorOpen && (
        <CatatanEditor
          catatan={editTarget}
          onClose={handleCloseEditor}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      <FotoViewer url={fotoViewerUrl} onClose={handleCloseFotoViewer} />
    </>
  );
}
