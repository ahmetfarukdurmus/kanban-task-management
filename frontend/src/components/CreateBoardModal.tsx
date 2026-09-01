import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { BoardRequest, OrganizationDto } from '@/types';
import { boardApi } from '@/api/boardApi';
import { useAuth } from '@/contexts/AuthContext';
import { organizationService } from '@/services/organizationService';

interface Props {
  isOpen:         boolean;
  onClose:        () => void;
  onBoardCreated: () => void;
}

export default function CreateBoardModal({ isOpen, onClose, onBoardCreated }: Props) {
  const { user, isAdmin } = useAuth();
  const isSuperAdmin = isAdmin && !user?.organizationId && !user?.organizationName;

  const [form, setForm]                   = useState<BoardRequest>({ name: '', description: '', organizationId: undefined });
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [loadingOrgs, setLoadingOrgs]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && isSuperAdmin) {
      setLoadingOrgs(true);
      organizationService
        .getAll()
        .then((orgs) => {
          setOrganizations(orgs);
          if (orgs.length > 0 && !form.organizationId) {
            setForm((prev) => ({ ...prev, organizationId: orgs[0].id }));
          }
        })
        .catch(() => { /* fallback */ })
        .finally(() => setLoadingOrgs(false));
    }
  }, [isOpen, isSuperAdmin]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await boardApi.create({
        name:           form.name.trim(),
        description:    form.description?.trim(),
        organizationId: isSuperAdmin ? form.organizationId : undefined,
      });
      onBoardCreated();
      toast.success('Yeni pano başarıyla oluşturuldu.');
      setForm({ name: '', description: '', organizationId: undefined });
      onClose();
    } catch {
      toast.error('Pano oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                <rect x="3" y="3" width="7" height="18" rx="1.5" />
                <rect x="14" y="3" width="7" height="11" rx="1.5" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-slate-800">Yeni Pano Oluştur</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-slate-400 hover:text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Super Admin: Departman Seçimi */}
          {isSuperAdmin && (
            <div>
              <label htmlFor="board-org" className="field-label font-semibold text-slate-700">
                Hangi Departman İçin? <span className="text-rose-500">*</span>
              </label>
              <select
                id="board-org"
                disabled={loadingOrgs}
                value={form.organizationId ?? ''}
                onChange={(e) => setForm({ ...form, organizationId: Number(e.target.value) })}
                className="field font-semibold text-slate-800"
                required
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} {org.description ? `(${org.description})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="board-name" className="field-label font-semibold text-slate-700">
              Pano Adı <span className="text-rose-500">*</span>
            </label>
            <input
              id="board-name"
              ref={nameRef}
              autoFocus
              required
              maxLength={100}
              placeholder="Örn: 2026 Q3 Bütçe Planı veya Operasyon Takibi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="board-desc" className="field-label font-semibold text-slate-700">Açıklama</label>
            <textarea
              id="board-desc"
              rows={3}
              maxLength={500}
              placeholder="Bu pano ne amaçla kullanılıyor?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="btn-primary flex-1 py-2.5 font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Oluşturuluyor…
                </span>
              ) : 'Pano Oluştur'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
