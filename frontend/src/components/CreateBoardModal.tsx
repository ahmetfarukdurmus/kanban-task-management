import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { BoardRequest, BoardType, OrganizationDto } from '@/types';
import { boardApi } from '@/api/boardApi';
import { useAuth } from '@/contexts/AuthContext';
import { organizationService } from '@/services/organizationService';

interface Props {
  isOpen:                 boolean;
  onClose:                () => void;
  onBoardCreated:         () => void;
  defaultDepartmentName?: string;
}

const TEMPLATES: {
  type: BoardType;
  title: string;
  desc: string;
  columns: string[];
}[] = [
  {
    type: 'STANDARD',
    title: 'Standart Kanban',
    desc: 'Genel görev ve süreç yönetimi için standart 4 aşamalı iş akışı',
    columns: ['To Do', 'In Progress', 'In Review', 'Done'],
  },
  {
    type: 'INTEGRATION',
    title: 'Entegrasyon & API',
    desc: 'API, veri eşleme (mapping) ve canlıya alma entegrasyon süreçleri için',
    columns: ['Backlog', 'Analiz & Mapping', 'Geliştirme', 'Sandbox Test', 'Canlıya Alındı'],
  },
  {
    type: 'QA_TEST',
    title: 'Test & QA',
    desc: 'Kalite güvence, test doğrulama ve hata yönetim döngüsü için',
    columns: ['Backlog', 'Geliştirme', 'Teste Hazır', 'Test Ediliyor', 'Tamamlandı'],
  },
];

export default function CreateBoardModal({
  isOpen,
  onClose,
  onBoardCreated,
  defaultDepartmentName,
}: Props) {
  const { user, isSuperAdmin } = useAuth();

  const [form, setForm]                   = useState<BoardRequest>({
    name: '',
    description: '',
    organizationId: undefined,
    boardType: 'STANDARD',
  });
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [loadingOrgs, setLoadingOrgs]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: '',
        description: '',
        organizationId: undefined,
        boardType: 'STANDARD',
      });

      if (isSuperAdmin) {
        setLoadingOrgs(true);
        organizationService
          .getAll()
          .then((orgs) => {
            setOrganizations(orgs);
            if (orgs.length > 0) {
              const matchingOrg = defaultDepartmentName
                ? orgs.find((o) => o.name.toLowerCase() === defaultDepartmentName.toLowerCase())
                : null;
              const initialOrgId = matchingOrg ? matchingOrg.id : orgs[0].id;
              setForm((prev) => ({ ...prev, organizationId: initialOrgId }));
            }
          })
          .catch(() => { /* fallback */ })
          .finally(() => setLoadingOrgs(false));
      }
    }
  }, [isOpen, isSuperAdmin, defaultDepartmentName]);

  if (!isOpen) return null;

  const selectedTemplate = TEMPLATES.find((t) => t.type === (form.boardType || 'STANDARD')) || TEMPLATES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const payload: BoardRequest = {
        name:           form.name.trim(),
        description:    form.description?.trim() || undefined,
        organizationId: isSuperAdmin ? form.organizationId : (user?.organizationId ? user.organizationId : undefined),
        boardType:      form.boardType || 'STANDARD',
      };
      await boardApi.create(payload);
      onBoardCreated();
      toast.success('Yeni pano başarıyla oluşturuldu.');
      setForm({ name: '', description: '', organizationId: undefined, boardType: 'STANDARD' });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Pano oluşturulamadı.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-lg">
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

          {/* Super Admin: Organizasyon Seçimi */}
          {isSuperAdmin && (
            <div>
              <label htmlFor="board-org" className="field-label font-semibold text-slate-700">
                Organizasyon Seçimi <span className="text-rose-500">*</span>
              </label>
              <select
                id="board-org"
                disabled={loadingOrgs}
                value={form.organizationId ?? ''}
                onChange={(e) => {
                  const selectedId = Number(e.target.value);
                  setForm((prev) => ({ ...prev, organizationId: selectedId }));
                }}
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

          {/* Pano Adı */}
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

          {/* Pano Türü / Şablonu Seçimi */}
          <div>
            <label htmlFor="board-type" className="field-label font-semibold text-slate-700">
              Pano Türü / Çalışma Şablonu <span className="text-rose-500">*</span>
            </label>
            <select
              id="board-type"
              value={form.boardType || 'STANDARD'}
              onChange={(e) => setForm({ ...form, boardType: e.target.value as BoardType })}
              className="field font-semibold text-slate-800"
              required
            >
              <option value="STANDARD">Standart Kanban (To Do, In Progress, Done)</option>
              <option value="INTEGRATION">Entegrasyon & API (Analiz, Geliştirme, Test, Canlı)</option>
              <option value="QA_TEST">Test & QA (Geliştirme, Teste Hazır, Test Ediliyor, Tamamlandı)</option>
            </select>

            {/* Template Information & Columns Preview */}
            <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-xs text-slate-600 font-medium">
                {selectedTemplate.desc}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Otomatik Kolonlar:
                </span>
                {selectedTemplate.columns.map((colTitle, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-[11px] font-semibold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs"
                  >
                    {idx + 1}. {colTitle}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label htmlFor="board-desc" className="field-label font-semibold text-slate-700">
              Açıklama <span className="text-slate-400 font-normal text-[11px]">(Opsiyonel)</span>
            </label>
            <textarea
              id="board-desc"
              rows={2}
              maxLength={500}
              placeholder="Bu pano ne amaçla kullanılıyor?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field resize-none"
            />
          </div>

          {/* Buttons */}
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
