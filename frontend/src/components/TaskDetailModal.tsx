import { useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type {
  AttachmentDto,
  ColumnResponse,
  CommentDto,
  CustomFieldDto,
  CustomFieldType,
  Priority,
  TaskRequest,
  TaskResponse,
  UserSummary,
} from '@/types';
import { taskApi } from '@/api/taskApi';
import { userService } from '@/services/userService';
import { commentService } from '@/services/commentService';
import { attachmentService } from '@/services/attachmentService';
import { useAuth } from '@/contexts/AuthContext';
import {
  DownloadIcon,
  FileIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlusIcon,
  TrashIcon,
  UploadCloudIcon,
} from './icons';

interface Props {
  task:        TaskResponse | null;
  boardId:     number;
  columns:     ColumnResponse[];
  onClose:     () => void;
  onUpdated:   (task: TaskResponse) => void;
  onDeleted:   (taskId: number, columnId: number) => void;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

const priorityBadge: Record<string, { label: string; className: string }> = {
  HIGH:   { label: 'Yüksek', className: 'badge-high' },
  MEDIUM: { label: 'Orta',   className: 'badge-medium' },
  LOW:    { label: 'Düşük',  className: 'badge-low' },
};

function getAvatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-700' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    { bg: 'bg-violet-100', text: 'text-violet-700' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { bg: 'bg-amber-100', text: 'text-amber-700' },
    { bg: 'bg-rose-100', text: 'text-rose-700' },
    { bg: 'bg-teal-100', text: 'text-teal-700' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function TaskDetailModal({
  task,
  boardId,
  columns,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const { user, isAdmin } = useAuth();

  /* ── Form State ─────────────────────────────────────────────────── */
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]       = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate]         = useState('');
  const [assignee, setAssignee]       = useState('');
  const [columnId, setColumnId]       = useState<number>(0);
  const [customFields, setCustomFields] = useState<CustomFieldDto[]>([]);

  /* ── Custom Field Addition Form State ───────────────────────────── */
  const [showAddField, setShowAddField]   = useState(false);
  const [newFieldName, setNewFieldName]   = useState('');
  const [newFieldType, setNewFieldType]   = useState<CustomFieldType>('TEXT');
  const [newFieldValue, setNewFieldValue] = useState('');

  /* ── Data & Async State ─────────────────────────────────────────── */
  const [users, setUsers]                         = useState<UserSummary[]>([]);
  const [comments, setComments]                   = useState<CommentDto[]>([]);
  const [attachments, setAttachments]             = useState<AttachmentDto[]>([]);
  const [newComment, setNewComment]               = useState('');
  const [loadingComments, setLoadingComments]     = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingFile, setUploadingFile]         = useState(false);
  const [saving, setSaving]                       = useState(false);
  const [deleting, setDeleting]                   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Synchronize with selected task & load fresh data from backend ── */
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setDueDate(task.dueDate ?? '');
      setAssignee(task.assignee ?? '');
      setColumnId(task.columnId);
      setCustomFields(task.customFields || []);
      setNewComment('');
      setShowAddField(false);

      // 1. Fetch fresh users list every time modal opens
      userService
        .getAll()
        .then((data) => setUsers(data))
        .catch(() => { /* fallback */ });

      // 2. Fetch latest task details from backend
      taskApi
        .getTask(boardId, task.columnId, task.id)
        .then((freshTask) => {
          setTitle(freshTask.title);
          setDescription(freshTask.description ?? '');
          setPriority(freshTask.priority);
          setDueDate(freshTask.dueDate ?? '');
          setAssignee(freshTask.assignee ?? '');
          setColumnId(freshTask.columnId);
          setCustomFields(freshTask.customFields || []);
        })
        .catch(() => { /* use prop task as fallback */ });

      // 3. Load comments fresh
      setLoadingComments(true);
      commentService
        .getComments(task.id)
        .then((data) => setComments(data))
        .catch(() => toast.error('Yorumlar yüklenemedi.'))
        .finally(() => setLoadingComments(false));

      // 4. Load attachments fresh
      setLoadingAttachments(true);
      attachmentService
        .getAttachments(task.id)
        .then((data) => setAttachments(data))
        .catch(() => toast.error('Ekler yüklenemedi.'))
        .finally(() => setLoadingAttachments(false));
    }
  }, [task, boardId]);

  if (!task) return null;

  /* ── Custom Field Handlers ──────────────────────────────────────── */
  const handleCustomFieldValueChange = (index: number, value: string) => {
    setCustomFields((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], fieldValue: value };
      return copy;
    });
  };

  const handleDeleteCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomField = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) {
      toast.error('Lütfen alan adı girin.');
      return;
    }
    setCustomFields((prev) => [
      ...prev,
      {
        fieldName: trimmed,
        fieldType: newFieldType,
        fieldValue: newFieldValue,
      },
    ]);
    setNewFieldName('');
    setNewFieldType('TEXT');
    setNewFieldValue('');
    setShowAddField(false);
  };

  /* ── Save Task Changes ──────────────────────────────────────────── */
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast.error('Görev başlığı boş bırakılamaz.');
      return;
    }

    setSaving(true);
    try {
      let currentColId = task.columnId;

      // Handle column move if changed
      if (columnId !== task.columnId) {
        await taskApi.move(task.id, {
          targetColumnId: columnId,
          targetPosition: 0,
        });
        currentColId = columnId;
      }

      const payload: TaskRequest = {
        title:       title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate:     dueDate || undefined,
        assignee:    assignee.trim() || undefined,
        customFields,
      };

      const updated = await taskApi.update(boardId, currentColId, task.id, payload);
      onUpdated({ ...updated, columnId: currentColId });
      toast.success('Görev başarıyla güncellendi.');
      onClose();
    } catch {
      toast.error('Görev güncellenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete Task (Admin Only) ───────────────────────────────────── */
  const handleDelete = async () => {
    if (!confirm('Bu görevi kalıcı olarak silmek istediğinizden emin misiniz?')) return;
    setDeleting(true);
    try {
      await taskApi.remove(boardId, task.columnId, task.id);
      onDeleted(task.id, task.columnId);
      toast.success('Görev silindi.');
      onClose();
    } catch {
      toast.error('Görev silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Add Comment ────────────────────────────────────────────────── */
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content) return;

    setSubmittingComment(true);
    try {
      const added = await commentService.addComment(task.id, content);
      setComments((prev) => [...prev, added]);
      setNewComment('');
      toast.success('Yorum eklendi.');
    } catch {
      toast.error('Yorum eklenirken hata oluştu.');
    } finally {
      setSubmittingComment(false);
    }
  };

  /* ── Delete Comment ─────────────────────────────────────────────── */
  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
    try {
      await commentService.deleteComment(task.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('Yorum silindi.');
    } catch {
      toast.error('Yorum silinemedi.');
    }
  };

  /* ── File Upload ────────────────────────────────────────────────── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB sınırını aşamaz.');
      return;
    }

    setUploadingFile(true);
    try {
      const added = await attachmentService.uploadAttachment(task.id, file);
      setAttachments((prev) => [added, ...prev]);
      toast.success('Dosya başarıyla yüklendi.');
    } catch {
      toast.error('Dosya yüklenirken hata oluştu.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isImageFile = (fileName: string, fileType: string) => {
    return fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
  };

  const currentColumn = columns.find((c) => c.id === columnId);
  const currentAvatar = assignee ? getAvatarColor(assignee) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl min-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-6 flex flex-col my-8 animate-scale-in max-h-[90vh] overflow-y-auto">

        {/* ── Top Bar / Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
              <FileIcon className="w-4.5 h-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Görev #{task.id}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {currentColumn?.title ?? 'Pano'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight mt-0.5">
                Görev Detayları
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Kapat"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── 2-Column Main Layout ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-start">

          {/* ══════════════════════════════════════════════════════════
              SOL BÖLÜM (~%70 / 8 Kolon):
              Başlık, Açıklama, Özel Alanlar, Medya/Ekler, Aktivite & Yorumlar
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">

            {/* Başlık Alanı */}
            <div>
              <label htmlFor="detail-task-title" className="field-label">
                Başlık <span className="text-rose-500">*</span>
              </label>
              <input
                id="detail-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Görev başlığı girin..."
                className="field text-base font-semibold text-slate-800 py-2.5"
                maxLength={200}
              />
            </div>

            {/* Açıklama Alanı */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileIcon className="w-3.5 h-3.5 text-slate-400" />
                <label htmlFor="detail-task-desc" className="field-label mb-0">
                  Açıklama
                </label>
              </div>
              <textarea
                id="detail-task-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bu göreve dair detaylı açıklama, yapılacaklar veya hedefler ekleyin..."
                className="field resize-none text-sm text-slate-700 leading-relaxed"
              />
            </div>

            {/* ── Özel Alanlar (Custom Fields) Bölümü ──────────────────── */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-500">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-800">Özel Alanlar</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                    {customFields.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddField(!showAddField)}
                  className="btn-secondary py-1.5 px-3 text-xs gap-1.5 font-medium text-slate-700 hover:text-blue-600"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Yeni Alan Ekle</span>
                </button>
              </div>

              {/* Add new custom field inline form */}
              {showAddField && (
                <div className="mb-4 p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Yeni Özel Alan Tanımla</span>
                    <button
                      type="button"
                      onClick={() => setShowAddField(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Alan Adı <span className="text-rose-500">*</span>
                      </label>
                      <input
                        autoFocus
                        type="text"
                        placeholder="örn: Jira Kodu, Test Tarihi"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        className="field w-full text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Alan Tipi
                      </label>
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                        className="field w-full text-xs bg-white font-medium"
                      >
                        <option value="TEXT">Metin (Text)</option>
                        <option value="NUMBER">Sayı (Number)</option>
                        <option value="DATE">Tarih (Date)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Değer
                      </label>
                      {newFieldType === 'DATE' ? (
                        <input
                          type="date"
                          value={newFieldValue}
                          onChange={(e) => setNewFieldValue(e.target.value)}
                          className="field w-full text-xs bg-white"
                        />
                      ) : newFieldType === 'NUMBER' ? (
                        <input
                          type="number"
                          placeholder="örn: 42"
                          value={newFieldValue}
                          onChange={(e) => setNewFieldValue(e.target.value)}
                          className="field w-full text-xs bg-white"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="örn: KAN-104"
                          value={newFieldValue}
                          onChange={(e) => setNewFieldValue(e.target.value)}
                          className="field w-full text-xs bg-white"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddField(false)}
                      className="btn-ghost py-1 px-3 text-xs"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="btn-primary py-1 px-3 text-xs font-semibold"
                    >
                      Alanı Ekle
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Fields List */}
              {customFields.length === 0 && !showAddField ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center">
                  <p className="text-xs text-slate-400 font-medium">Özel alan eklenmemiş.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddField(true)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    + Yeni Özel Alan Ekle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customFields.map((cf, index) => {
                    const typeLabel = cf.fieldType === 'DATE' ? 'Tarih' : cf.fieldType === 'NUMBER' ? 'Sayı' : 'Metin';
                    const typeBadgeColor = cf.fieldType === 'DATE' ? 'bg-amber-50 text-amber-700 border-amber-200' : cf.fieldType === 'NUMBER' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200';

                    return (
                      <div
                        key={index}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-1.5 group relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-slate-700 truncate" title={cf.fieldName}>
                              {cf.fieldName}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${typeBadgeColor}`}>
                              {typeLabel}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(index)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-all"
                            title="Alanı Sil"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Input according to field type */}
                        {cf.fieldType === 'DATE' ? (
                          <input
                            type="date"
                            value={cf.fieldValue || ''}
                            onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                            className="field w-full text-xs bg-white py-1.5"
                          />
                        ) : cf.fieldType === 'NUMBER' ? (
                          <input
                            type="number"
                            value={cf.fieldValue || ''}
                            placeholder="Sayısal değer..."
                            onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                            className="field w-full text-xs bg-white py-1.5"
                          />
                        ) : (
                          <input
                            type="text"
                            value={cf.fieldValue || ''}
                            placeholder="Metin girin..."
                            onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                            className="field w-full text-xs bg-white py-1.5"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Medya & Ekler Bölümü */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <PaperclipIcon className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Medya ve Ekler</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                    {attachments.length}
                  </span>
                </div>

                {/* Dosya Yükle Butonu */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="btn-secondary py-1.5 px-3 text-xs gap-1.5 font-medium"
                  >
                    {uploadingFile ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin" />
                        Yükleniyor…
                      </>
                    ) : (
                      <>
                        <UploadCloudIcon className="w-3.5 h-3.5 text-slate-500" />
                        Dosya Yükle
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ekler Listesi */}
              {loadingAttachments ? (
                <div className="py-6 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : attachments.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 hover:bg-blue-50/30 hover:border-blue-300 transition-all text-center cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors mb-2 shadow-xs">
                    <UploadCloudIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                    Dosya veya görsel yüklemek için tıklayın
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, PDF, ZIP (En fazla 10MB)</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((att) => {
                    const isImg = isImageFile(att.fileName, att.fileType);
                    return (
                      <div
                        key={att.id}
                        className="group flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"
                      >
                        {/* Thumbnail / File Icon */}
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
                          {isImg ? (
                            <img
                              src={att.fileUrl}
                              alt={att.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <FileIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        {/* File Metadata */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                            <span>{att.uploadedByName || 'Kullanıcı'}</span>
                            <span>&bull;</span>
                            <span>{format(parseISO(att.uploadedAt), 'd MMM yyyy')}</span>
                          </div>
                        </div>

                        {/* Download / Open Action */}
                        <button
                          type="button"
                          onClick={() => {
                            toast.promise(
                              attachmentService.downloadAttachment(task.id, att.id, att.fileName),
                              {
                                loading: 'İndiriliyor…',
                                success: 'Dosya indirildi!',
                                error: 'Dosya indirilemedi.',
                              }
                            );
                          }}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                          title="İndir"
                        >
                          <DownloadIcon className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aktivite & Yorumlar Bölümü */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquareIcon className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800">Aktivite ve Yorumlar</h3>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                  {comments.length}
                </span>
              </div>

              {/* Yorum Ekleme Formu */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Bu göreve bir yorum veya not ekleyin..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="field w-full text-xs"
                    disabled={submittingComment}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="btn-primary py-1.5 px-3 text-xs font-semibold shrink-0"
                >
                  {submittingComment ? 'Gönderiliyor…' : 'Yorum Yaz'}
                </button>
              </form>

              {/* Yorumlar Listesi */}
              {loadingComments ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 italic">Henüz yorum yapılmamış.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {comments.map((comment) => {
                    const avatar = getAvatarColor(comment.authorName);
                    const canDelete = isAdmin || (user && user.id === comment.authorId);

                    return (
                      <div
                        key={comment.id}
                        className="group flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs hover:bg-slate-50 transition-colors"
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${avatar.bg} ${avatar.text}`}
                        >
                          {comment.authorName.charAt(0).toUpperCase()}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{comment.authorName}</span>
                              <span className="text-[11px] text-slate-400">
                                {formatDistanceToNow(parseISO(comment.createdAt), {
                                  addSuffix: true,
                                  locale: tr,
                                })}
                              </span>
                            </div>

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded transition-opacity"
                                title="Yorumu Sil"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════
              SAĞ BÖLÜM (~%30 / 4 Kolon):
              Durum (Kolon), Atanan Kişi, Öncelik, Tarihler & İşlemler
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 p-4.5 space-y-4.5 shadow-xs">

            {/* Durum / Kolon Seçici */}
            <div>
              <label htmlFor="detail-task-column" className="field-label">
                Durum (Kolon)
              </label>
              <select
                id="detail-task-column"
                value={columnId}
                onChange={(e) => setColumnId(Number(e.target.value))}
                className="field font-semibold text-slate-800"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Atanan Kişi (Assignee) */}
            <div>
              <label htmlFor="detail-task-assignee" className="field-label">
                Atanan Kişi
              </label>
              <div className="space-y-2">
                <select
                  id="detail-task-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="field text-sm font-medium text-slate-700"
                >
                  <option value="">Seçiniz / Atanmamış</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                  {assignee && !users.some((u) => u.username === assignee) && (
                    <option value={assignee}>{assignee}</option>
                  )}
                </select>

                {/* Selected Assignee Badge */}
                {assignee ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200/90 shadow-xs">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${currentAvatar?.bg} ${currentAvatar?.text}`}>
                      {assignee.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate">{assignee}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">Kimseye atanmadı</p>
                )}
              </div>
            </div>

            {/* Öncelik (Priority) */}
            <div>
              <label htmlFor="detail-task-priority" className="field-label">
                Öncelik
              </label>
              <select
                id="detail-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="field text-sm font-medium text-slate-700"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityBadge[p]?.label || p}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <span className={priorityBadge[priority]?.className || 'badge-low'}>
                  {priorityBadge[priority]?.label || priority} Öncelik
                </span>
              </div>
            </div>

            {/* Bitiş Tarihi (Due Date) */}
            <div>
              <label htmlFor="detail-task-due" className="field-label">
                Bitiş Tarihi
              </label>
              <input
                id="detail-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field text-sm font-medium"
              />
            </div>

            {/* İşlem Butonları */}
            <div className="pt-4 border-t border-slate-200/90 space-y-2">
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-sm"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Kaydediliyor…
                  </span>
                ) : (
                  'Değişiklikleri Kaydet'
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full justify-center py-2 text-xs font-semibold"
              >
                Kapat
              </button>

              {/* Admin Silme Butonu */}
              {isAdmin && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn-danger w-full justify-center py-2 text-xs font-semibold gap-1.5"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    {deleting ? 'Siliniyor…' : 'Görevi Sil'}
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
