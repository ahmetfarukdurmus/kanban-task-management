import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { BoardRequest, BoardType, OrganizationDto, TaskTypeDto } from '@/types';
import { boardApi } from '@/api/boardApi';
import { useAuth } from '@/contexts/AuthContext';
import { organizationService } from '@/services/organizationService';
import { taskTypeService } from '@/services/taskTypeService';

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
    taskTypeId: undefined,
  });
  const [organizations, setOrganizations] = useState<OrganizationDto[]>([]);
  const [taskTypes, setTaskTypes]         = useState<TaskTypeDto[]>([]);
  const [loadingOrgs, setLoadingOrgs]     = useState(false);
  const [loadingTypes, setLoadingTypes]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: '',
        description: '',
        organizationId: undefined,
        boardType: 'STANDARD',
        taskTypeId: undefined,
      });

      // Load task types for workflow selection
      setLoadingTypes(true);
      taskTypeService
        .getAll()
        .then((types) => setTaskTypes(types))
        .catch(() => { /* fallback */ })
        .finally(() => setLoadingTypes(false));

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
  const selectedTaskType = taskTypes.find((t) => t.id === form.taskTypeId);

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
        taskTypeId:     form.taskTypeId || undefined,
      };
      await boardApi.create(payload);
      onBoardCreated();
      toast.success('Yeni board başarıyla oluşturuldu.');
      setForm({ name: '', description: '', organizationId: undefined, boardType: 'STANDARD', taskTypeId: undefined });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Board oluşturulamadı.';
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
            <h2 className="text-base font-bold text-slate-800">Yeni Board Oluştur</h2>
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

          {/* Board Adı */}
          <div>
            <label htmlFor="board-name" className="field-label font-semibold text-slate-700">
              Board Adı <span className="text-rose-500">*</span>
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

          {/* İş Akışı / Görev Tipi (Workflow / Task Type) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="board-workflow" className="field-label font-semibold text-slate-700 mb-0">
                İş Akışı / Görev Tipi (Workflow)
              </label>
              <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                İş Akışı Entegrasyonu
              </span>
            </div>
            <select
              id="board-workflow"
              disabled={loadingTypes}
              value={form.taskTypeId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({ ...prev, taskTypeId: val ? Number(val) : undefined }));
              }}
              className="field font-semibold text-slate-800"
            >
              <option value="">-- Standart Şablon (Board Türüne Göre) --</option>
              {taskTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.columns && t.columns.length > 0 ? `(${t.columns.length} aşamalı iş akışı)` : ''} {t.rules && t.rules.length > 0 ? `• ${t.rules.length} geçiş kuralı` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Board Türü / Şablonu Seçimi (sadece özel görev tipi seçilmediğinde veya genel kategori olarak) */}
          {!selectedTaskType && (
            <div>
              <label htmlFor="board-type" className="field-label font-semibold text-slate-700">
                Varsayılan Board Şablonu <span className="text-rose-500">*</span>
              </label>
              <select
                id="board-type"
                value={form.boardType || 'STANDARD'}
                onChange={(e) => setForm({ ...form, boardType: e.target.value as BoardType })}
                className="field font-semibold text-slate-800"
                required
              >
                <option value="STANDARD">Standart Kanban (To Do, In Progress, In Review, Done)</option>
                <option value="INTEGRATION">Entegrasyon & API (Backlog, Analiz & Mapping, Geliştirme, Sandbox, Canlı)</option>
                <option value="QA_TEST">Test & QA (Backlog, Geliştirme, Teste Hazır, Test Ediliyor, Tamamlandı)</option>
              </select>
            </div>
          )}

          {/* Workflow & Columns Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                {selectedTaskType ? (
                  <>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedTaskType.colorHex || '#3B82F6' }}
                    />
                    Seçilen İş Akışı: {selectedTaskType.name}
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    {selectedTemplate.title}
                  </>
                )}
              </span>
              {selectedTaskType?.rules && selectedTaskType.rules.length > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {selectedTaskType.rules.length} Geçiş Kuralı Tanımlı
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 font-medium">
              {selectedTaskType
                ? 'Bu boarddaki görevler otomatik olarak bu görev tipine bağlanacak ve aşağıdaki aşamalardan geçecektir.'
                : selectedTemplate.desc}
            </p>

            {/* Columns List Preview */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Oluşturulacak Kolonlar:
              </span>
              {selectedTaskType && selectedTaskType.columns && selectedTaskType.columns.length > 0 ? (
                selectedTaskType.columns
                  .sort((a, b) => (a.position || 0) - (b.position || 0))
                  .map((col, idx) => (
                    <span
                      key={col.id || idx}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border shadow-2xs"
                      style={{
                        backgroundColor: col.colorHex ? `${col.colorHex}12` : '#FFFFFF',
                        color: col.colorHex || '#1E293B',
                        borderColor: col.colorHex ? `${col.colorHex}35` : '#E2E8F0',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: col.colorHex || '#64748B' }}
                      />
                      {idx + 1}. {col.title}
                    </span>
                  ))
              ) : (
                selectedTemplate.columns.map((colTitle, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-[11px] font-semibold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs"
                  >
                    {idx + 1}. {colTitle}
                  </span>
                ))
              )}
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
              placeholder="Bu board ne amaçla kullanılıyor?"
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
              ) : 'Board Oluştur'}
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
