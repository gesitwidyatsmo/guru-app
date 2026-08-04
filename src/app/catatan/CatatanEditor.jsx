'use client';

import { useState, useEffect,  useRef } from 'react';
import Swal from 'sweetalert2';

const WARNA_OPTIONS = [
  { key: 'cream',  label: 'Cream',  bg: '#FFF5F0', text: '#0D0D0D' },
  { key: 'yellow', label: 'Kuning', bg: '#F5C518', text: '#0D0D0D' },
  { key: 'teal',   label: 'Teal',   bg: '#00A693', text: '#FFFFFF' },
  { key: 'orange', label: 'Orange', bg: '#E8451A', text: '#FFFFFF' },
  { key: 'peach',  label: 'Peach',  bg: '#FFE8DC', text: '#0D0D0D' },
  { key: 'blue',   label: 'Biru',   bg: '#2F80ED', text: '#FFFFFF' },
];
const getWarna = (key) => WARNA_OPTIONS.find((w) => w.key === key) || WARNA_OPTIONS[0];

export default function CatatanEditor({ catatan, onClose, onSave, isSaving }) {
  const [form, setForm] = useState({ judul: '', isi: '', warna: 'cream' });
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [hapusFoto, setHapusFoto] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (catatan) {
      setForm({ judul: catatan.judul || '', isi: catatan.isi || '', warna: catatan.warna || 'cream' });
      setFotoPreview(catatan.foto_url || null);
    } else {
      setForm({ judul: '', isi: '', warna: 'cream' });
      setFotoPreview(null);
    }
    setFotoFile(null);
    setHapusFoto(false);
  }, [catatan]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [form.isi]);

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({ icon: 'error', title: 'Ukuran Terlalu Besar', text: 'Ukuran foto maksimal 5 MB.' });
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
    setHapusFoto(false);
  };

  const handleHapusFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    setHapusFoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePlaceholderClick = (featureName) => {
    Swal.fire({
      icon: 'info',
      title: 'Segera Hadir',
      text: `Fitur ${featureName} masih dalam tahap pengembangan.`,
      confirmButtonColor: '#0D0D0D'
    });
  };

  const selectedWarna = getWarna(form.warna);
  const charCount = form.isi.length;
  const dateStr = catatan ? (catatan.updated_at || catatan.created_at) : new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  }).replace('pukul', '').trim();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: selectedWarna.bg, color: selectedWarna.text,
      display: 'flex', flexDirection: 'column',
      transition: 'background-color 0.3s ease'
    }}>
      {/* 1. TOP NAVBAR */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.25rem', borderBottom: `1px solid ${selectedWarna.text}20`
      }}>
        <button onClick={onClose} disabled={isSaving} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: selectedWarna.text }}>
          ←
        </button>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => handlePlaceholderClick('Share')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: selectedWarna.text }} title="Share">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
          
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPalette(!showPalette)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: selectedWarna.text }} title="Warna">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.4-.5-.9-.5-1.4 0-1.2.9-2.2 2.1-2.2h1.6c3.1 0 5.6-2.5 5.6-5.6 0-5.4-4.5-10-10-10z"/></svg>
            </button>
            
            {showPalette && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                background: '#fff', border: '2px solid #0D0D0D', borderRadius: '12px',
                padding: '0.5rem', display: 'flex', gap: '0.5rem', boxShadow: '4px 4px 0 #0D0D0D',
                zIndex: 10
              }}>
                {WARNA_OPTIONS.map((w) => (
                  <button key={w.key} onClick={() => { setForm({ ...form, warna: w.key }); setShowPalette(false); }}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%', background: w.bg,
                      border: form.warna === w.key ? '2px solid #0D0D0D' : '1px solid #ddd',
                      cursor: 'pointer'
                    }} title={w.label}
                  />
                ))}
              </div>
            )}
          </div>
          
          <button onClick={() => handlePlaceholderClick('Menu Lainnya')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: selectedWarna.text }} title="Menu Lainnya">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          
          <button onClick={() => onSave(form, fotoFile, hapusFoto, catatan?.foto_url || null)} disabled={isSaving}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: selectedWarna.text, fontWeight: 'bold' }} title="Simpan">
            {isSaving ? (
              <span style={{ fontSize: '0.875rem' }}>⏰</span>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* 2. AREA KONTEN (SCROLLABLE) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        
        {/* Input Judul */}
        <input
          type="text"
          placeholder="Judul"
          value={form.judul}
          onChange={(e) => setForm({ ...form, judul: e.target.value })}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '2rem', fontWeight: 800, color: selectedWarna.text,
            width: '100%', marginBottom: '0.5rem',
            fontFamily: 'inherit'
          }}
        />
        
        {/* Info Meta */}
        <div style={{
          fontSize: '0.75rem', opacity: 0.6, marginBottom: '1.5rem',
          display: 'flex', gap: '0.5rem', fontWeight: 500
        }}>
          <span>{formattedDate}</span>
          <span>|</span>
          <span>{charCount} karakter</span>
        </div>
        
        {/* Textarea Isi */}
        <textarea
          ref={textareaRef}
          placeholder="Mulai mengetik..."
          value={form.isi}
          onChange={(e) => setForm({ ...form, isi: e.target.value })}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '1rem', color: selectedWarna.text,
            width: '100%', minHeight: '150px', resize: 'none',
            fontFamily: 'inherit', lineHeight: 1.6
          }}
        />

        {/* Mindmap Placeholder Button (seperti di screenshot) */}
        {form.isi.length === 0 && !fotoPreview && (
          <div style={{ marginTop: '0.5rem' }}>
            <button onClick={() => handlePlaceholderClick('Pemetaan Pikiran')}
              style={{
                background: `${selectedWarna.text}10`, color: selectedWarna.text,
                border: 'none', borderRadius: '20px', padding: '0.5rem 1rem',
                fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Buat pemetaan pikiran
            </button>
          </div>
        )}

        {/* Area Foto (jika ada lampiran) */}
        {fotoPreview && (
          <div style={{ position: 'relative', marginTop: '1.5rem', marginBottom: '1rem', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${selectedWarna.text}30` }}>
            <img src={fotoPreview} alt="Lampiran" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block', backgroundColor: 'rgba(0,0,0,0.05)' }} />
            <button onClick={handleHapusFoto}
              style={{
                position: 'absolute', top: '0.5rem', right: '0.5rem',
                background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                borderRadius: '50%', width: '30px', height: '30px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1rem'
              }} title="Hapus Foto">
              ï
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM TOOLBAR */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1.5rem', borderTop: `1px solid ${selectedWarna.text}20`,
        background: selectedWarna.bg,
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))'
      }}>
        <button onClick={() => handlePlaceholderClick('Voice Note')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: selectedWarna.text }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColow" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7ay3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </button>
        
        {/* Tombol Lampirkan Foto */}
        <button onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: selectedWarna.text }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleFotoChange} />
        
        <button onClick={() => handlePlaceholderClick('Draw/Scribble')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: selectedWarna.text }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22s5-3 10-3 10 3 10 3"/><path d="M8 12c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6Z"/><path d="M8 12a3 3 0 0 1-3 3"/></svg>
        </button>
        
        <button onClick={() => handlePlaceholderClick('Task/Checkbox')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: selectedWarna.text }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </button>
        
        <button onClick={() => handlePlaceholderClick('Format Teks')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: selectedWarna.text }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>
        </button>
      </div>

    </div>
  );
}
