import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type {
  AttachmentDto,
  CommentDto,
  CustomFieldDto,
  CustomFieldType,
  Priority,
  TaskChecklistItemDto,
  TaskRequest,
  TaskResponse,
  TaskTypeDto,
  UserSummary,
} from '@/types';
import { taskApi } from '@/api/taskApi';
import { commentService } from '@/services/commentService';
import { attachmentService } from '@/services/attachmentService';
import { userService } from '@/services/userService';
import { taskTypeService } from '@/services/taskTypeService';
import { useAuth } from '@/contexts/AuthContext';
import {
  DownloadIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PlusIcon,
  TrashIcon,
  UploadCloudIcon,
  UserIcon,
} from './icons';

interface Props {
  task:       TaskResponse | null;
  boardId:    number;
  columns:    { id: number; title: string }[];
  isOpen?:    boolean;
  onClose:    () => void;
  onUpdated:  (task: TaskResponse) => void;
  onDeleted:  (taskId: number, columnId: number) => void;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

const priorityBadge: Record<Priority, { label: string; className: string }> = {
  HIGH:   { label: 'Yüksek', className: 'badge-high' },
  MEDIUM: { label: 'Orta',   className: 'badge-medium' },
  LOW:    { label: 'Düşük',  className: 'badge-low' },
};

export default function TaskDetailModal({
  task,
  boardId,
  columns,
  isOpen = true,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const { isAdmin } = useAuth();

  /* ── Form State ─────────────────────────────────────────────────── */
  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [priority, setPriority]           = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate]             = useState('');
  const [columnId, setColumnId]           = useState<number>(0);
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<number | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [customFields, setCustomFields]   = useState<CustomFieldDto[]>([]);

  /* ── Checklist Items ────────────────────────────────────────────── */
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItemDto[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingChecklist, setAddingChecklist] = useState(false);

  /* ── Custom Field Addition Form State ───────────────────────────── */
  const [showAddField, setShowAddField]   = useState(false);
  const [newFieldName, setNewFieldName]   = useState('');
  const [newFieldType, setNewFieldType]   = useState<CustomFieldType>('TEXT');
  const [newFieldValue, setNewFieldValue] = useState('');

  /* ── Data & Async State ─────────────────────────────────────────── */
  const [users, setUsers]                         = useState<UserSummary[]>([]);
  const [taskTypes, setTaskTypes]                 = useState<TaskTypeDto[]>([]);
  const [comments, setComments]                   = useState<CommentDto[]>([]);
  const [attachments, setAttachments]             = useState<AttachmentDto[]>([]);
  const [newComment, setNewComment]               = useState('');
  const [loadingComments, setLoadingComments]     = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingFile, setUploadingFile]         = useState(false);
  const [saving, setSaving]                       = useState(false);
  const [deleting, setDeleting]                   = useState(false);

  // Assignee dropdown toggle
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const assigneeBoxRef = useRef<HTMLDivElement>(null);

  /* ── Synchronize with selected task & load fresh data from backend ── */
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setDueDate(task.dueDate ?? '');
      setColumnId(task.columnId);
      setSelectedTaskTypeId(task.taskTypeId ?? null);
      setSelectedAssigneeIds(task.assigneeIds || (task.assignee ? [] : []));
      setChecklistItems(task.checklistItems || []);
      setCustomFields(task.customFields || []);
      setNewComment('');
      setShowAddField(false);
      setAssigneeDropdownOpen(false);

      // 1. Fetch fresh users list
      userService
        .getAll()
        .then((data) => setUsers(data))
        .catch(() => { /* fallback */ });

      // 2. Fetch task types and auto-populate rules if needed
      taskTypeService
        .getAll()
        .then((data) => {
          setTaskTypes(data);
          const typeId = task.taskTypeId;
          if (typeId) {
            populateChecklistFromTaskType(typeId, task.checklistItems || [], data);
          }
        })
        .catch(() => { /* fallback */ });

      // 3. Fetch latest task details from backend
      taskApi
        .getTask(boardId, task.columnId, task.id)
        .then((freshTask) => {
          setTitle(freshTask.title);
          setDescription(freshTask.description ?? '');
          setPriority(freshTask.priority);
          setDueDate(freshTask.dueDate ?? '');
          setColumnId(freshTask.columnId);
          setSelectedTaskTypeId(freshTask.taskTypeId ?? null);
          setSelectedAssigneeIds(freshTask.assigneeIds || []);
          setChecklistItems(freshTask.checklistItems || []);
          setCustomFields(freshTask.customFields || []);

          if (freshTask.taskTypeId) {
            populateChecklistFromTaskType(freshTask.taskTypeId, freshTask.checklistItems || []);
          }
        })
        .catch(() => { /* use prop task as fallback */ });

      // 4. Load comments fresh
      setLoadingComments(true);
      commentService
        .getComments(task.id)
        .then((data) => setComments(data))
        .catch(() => toast.error('Yorumlar yüklenemedi.'))
        .finally(() => setLoadingComments(false));

      // 5. Load attachments fresh
      setLoadingAttachments(true);
      attachmentService
        .getAttachments(task.id)
        .then((data) => setAttachments(data))
        .catch(() => toast.error('Ekler yüklenemedi.'))
        .finally(() => setLoadingAttachments(false));
    }
  }, [task, boardId]);

  // Helper to auto-populate checklist items based on task type transition rules
  const populateChecklistFromTaskType = async (
    typeId: number,
    currentList: TaskChecklistItemDto[],
    typesList: TaskTypeDto[] = taskTypes
  ) => {
    const type = typesList.find((t) => t.id === typeId);
    if (!type || !type.rules || !task) return;

    const checklistRules = type.rules.filter((r) => r.ruleType === 'CHECKLIST_REQUIRED');
    if (checklistRules.length === 0) return;

    for (const rule of checklistRules) {
      const ruleTitle = rule.description?.trim() || `${rule.targetColumnTitle} Kontrolü`;
      const exists = currentList.some(
        (item) => item.title.trim().toLowerCase() === ruleTitle.toLowerCase()
      );
      if (!exists) {
        const targetCol = columns.find(
          (c) =>
            (rule.targetColumnId && c.id === rule.targetColumnId) ||
            (rule.targetColumnTitle && c.title.toLowerCase() === rule.targetColumnTitle.toLowerCase())
        );
        try {
          const created = await taskApi.addChecklist(task.id, {
            title: ruleTitle,
            requiredForColumnId: targetCol?.id,
          });
          setChecklistItems((prev) => {
            if (prev.some((p) => p.id === created.id || p.title.toLowerCase() === created.title.toLowerCase())) {
              return prev;
            }
            return [...prev, created];
          });
        } catch {
          // ignore / fallback
        }
      }
    }
  };

  // Close assignee dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assigneeBoxRef.current && !assigneeBoxRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!task || !isOpen) return null;

  const handleToggleAssignee = (userId: number) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  /* ── Checklist Actions ──────────────────────────────────────────── */
  const handleToggleChecklistItem = async (itemId: number) => {
    try {
      const updated = await taskApi.toggleChecklist(task.id, itemId);
      setChecklistItems((prev) =>
        prev.map((item) => (item.id === itemId ? updated : item))
      );
    } catch {
      toast.error('Kontrol maddesi güncellenemedi.');
    }
  };

  const handleAddChecklistItem = async () => {
    const trimmed = newChecklistTitle.trim();
    if (!trimmed) return;
    setAddingChecklist(true);
    try {
      const created = await taskApi.addChecklist(task.id, { title: trimmed });
      setChecklistItems((prev) => [...prev, created]);
      setNewChecklistTitle('');
      toast.success('Kontrol maddesi eklendi.');
    } catch {
      toast.error('Kontrol maddesi eklenemedi.');
    } finally {
      setAddingChecklist(false);
    }
  };

  const handleDeleteChecklistItem = async (itemId: number) => {
    try {
      await taskApi.deleteChecklist(task.id, itemId);
      setChecklistItems((prev) => prev.filter((item) => item.id !== itemId));
      toast.success('Kontrol maddesi silindi.');
    } catch {
      toast.error('Kontrol maddesi silinemedi.');
    }
  };

  /* ── Custom Field Handlers ──────────────────────────────────────── */
  const handleCustomFieldValueChange = (index: number, value: string) => {
    setCustomFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], fieldValue: value };
      return next;
    });
  };

  const handleDeleteCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomField = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) {
      toast.error('Alan adı zorunludur.');
      return;
    }
    if (customFields.some((f) => f.fieldName.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Bu isimde bir özel alan zaten var.');
      return;
    }
    setCustomFields([
      ...customFields,
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

      // Handle column move if changed (with transition rule check)
      if (columnId !== task.columnId) {
        // Pre-validate transition rules on client-side
        if (selectedTaskTypeId) {
          const currentType = taskTypes.find((t) => t.id === selectedTaskTypeId);
          const targetCol = columns.find((c) => c.id === columnId);
          const sourceCol = columns.find((c) => c.id === task.columnId);

          if (currentType?.rules && targetCol) {
            for (const rule of currentType.rules) {
              const targetMatches =
                (rule.targetColumnId && rule.targetColumnId === columnId) ||
                (rule.targetColumnTitle && rule.targetColumnTitle.toLowerCase() === targetCol.title.toLowerCase());

              if (!targetMatches) continue;

              const hasSource = rule.sourceColumnId || (rule.sourceColumnTitle && rule.sourceColumnTitle.trim() !== '');
              if (hasSource && sourceCol) {
                const sourceMatches =
                  (rule.sourceColumnId && rule.sourceColumnId === sourceCol.id) ||
                  (rule.sourceColumnTitle && rule.sourceColumnTitle.toLowerCase() === sourceCol.title.toLowerCase());
                if (!sourceMatches) continue;
              }

              if (rule.ruleType === 'CHECKLIST_REQUIRED') {
                const uncompleted = checklistItems.filter(
                  (item) => !item.isCompleted && (!item.requiredForColumnId || item.requiredForColumnId === columnId)
                );
                if (checklistItems.length === 0 || uncompleted.length > 0) {
                  toast.error('Bu aşamaya geçebilmek için zorunlu kontrol listesi maddeleri tamamlanmalıdır.', {
                    duration: 5000,
                    style: {
                      border: '1px solid #EF4444',
                      padding: '12px',
                      color: '#991B1B',
                      backgroundColor: '#FEF2F2',
                    },
                  });
                  setColumnId(task.columnId);
                  setSaving(false);
                  return;
                }
              } else if (rule.ruleType === 'ATTACHMENT_REQUIRED') {
                if (attachments.length === 0) {
                  toast.error('Bu aşamaya geçebilmek için dosya/görsel eki yüklenmelidir.', {
                    duration: 5000,
                    style: {
                      border: '1px solid #EF4444',
                      padding: '12px',
                      color: '#991B1B',
                      backgroundColor: '#FEF2F2',
                    },
                  });
                  setColumnId(task.columnId);
                  setSaving(false);
                  return;
                }
              }
            }
          }
        }

        await taskApi.move(task.id, {
          targetColumnId: columnId,
          targetPosition: 0,
        });
        currentColId = columnId;
      }

      const payload: TaskRequest = {
        title:        title.trim(),
        description:  description.trim() || undefined,
        priority,
        dueDate:      dueDate || undefined,
        taskTypeId:   selectedTaskTypeId,
        assigneeIds:  selectedAssigneeIds,
        customFields,
      };

      const updated = await taskApi.update(boardId, currentColId, task.id, payload);
      onUpdated({ ...updated, columnId: currentColId });
      toast.success('Görev başarıyla güncellendi.');
      onClose();
    } catch (err: unknown) {
      setColumnId(task.columnId); // Reset back to original column on error
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Bu aşamaya geçebilmek için zorunlu kontrol listesi maddeleri tamamlanmalıdır.';
      toast.error(errorMsg, {
        duration: 5000,
        style: {
          border: '1px solid #EF4444',
          padding: '12px',
          color: '#991B1B',
          backgroundColor: '#FEF2F2',
        },
      });
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
      toast.error('Yorum eklenemedi.');
    } finally {
      setSubmittingComment(false);
    }
  };

  /* ── File Upload ─────────────────────────────────────────────────── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB sınırını aşamaz.');
      return;
    }

    setUploadingFile(true);
    try {
      const uploaded = await attachmentService.upload(task.id, file);
      setAttachments((prev) => [uploaded, ...prev]);
      toast.success('Dosya yüklendi.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast.error('Dosya yüklenemedi.');
    } finally {
      setUploadingFile(false);
    }
  };

  /* ── File Delete ─────────────────────────────────────────────────── */
  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) return;
    try {
      await attachmentService.deleteAttachment(task.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success('Dosya silindi.');
    } catch {
      toast.error('Dosya silinemedi.');
    }
  };

  const isImageFile = (fileName: string, fileType: string) => {
    return fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
  };

  const filteredUsers = users.filter((u) => {
    const term = assigneeSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      (u.organizationName && u.organizationName.toLowerCase().includes(term))
    );
  });

  const selectedType = taskTypes.find((t) => t.id === selectedTaskTypeId);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box max-w-4xl p-0 overflow-hidden flex flex-col max-h-[92vh]">

        {/* ── Modal Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60">
              #{task.id}
            </span>
            {selectedType && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold border"
                style={{
                  backgroundColor: selectedType.colorHex ? `${selectedType.colorHex}15` : '#EFF6FF',
                  color: selectedType.colorHex || '#2563EB',
                  borderColor: selectedType.colorHex ? `${selectedType.colorHex}35` : '#BFDBFE',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: selectedType.colorHex || '#2563EB' }}
                />
                {selectedType.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Kapat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Modal Body (2-Column Layout) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Workflow Transition Rules Info Banner (Gereken Kurallar Bilgi Kutusu) ── */}
          {selectedType && selectedType.rules && selectedType.rules.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-amber-50/70 border border-blue-200/90 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    Bu görevin bir sonraki aşamaya geçebilmesi için gereken kurallar (Workflow Guards)
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                  {selectedType.rules.length} Kural Tanımlı
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {selectedType.rules.map((rule) => {
                  const isChecklist = rule.ruleType === 'CHECKLIST_REQUIRED';
                  const isSatisfied = isChecklist
                    ? (checklistItems.length > 0 && checklistItems.every((i) => i.isCompleted))
                    : attachments.length > 0;

                  return (
                    <div
                      key={rule.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                        isSatisfied
                          ? 'bg-emerald-50/90 border-emerald-300/80 text-emerald-900 shadow-2xs'
                          : 'bg-white border-amber-200/90 text-slate-800 shadow-2xs'
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-4 h-4 rounded-full mt-0.5 shrink-0 text-[10px] font-bold ${
                          isSatisfied
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {isSatisfied ? '✓' : '!'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[11px] text-slate-900">
                            Hedef: {rule.targetColumnTitle}
                          </span>
                          {rule.sourceColumnTitle && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({rule.sourceColumnTitle} aşamasından)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          {isChecklist ? (
                            <>
                              <strong className="font-semibold text-slate-800">Kontrol Listesi:</strong>{' '}
                              {rule.description ? rule.description : 'Tüm kontrol listesi maddeleri tamamlanmalı'}{' '}
                              <span className={`font-semibold ${checklistItems.length > 0 && checklistItems.every((i) => i.isCompleted) ? 'text-emerald-700' : 'text-amber-700'}`}>
                                ({checklistItems.filter((i) => i.isCompleted).length}/{checklistItems.length} tamamlandı)
                              </span>
                            </>
                          ) : (
                            <>
                              <strong className="font-semibold text-slate-800">Medya/Ek:</strong>{' '}
                              {rule.description ? rule.description : 'En az bir görsel veya dosya yüklenmeli'}{' '}
                              <span className={`font-semibold ${attachments.length > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                ({attachments.length} dosya yüklü)
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* ══════════════════════════════════════════════════════════
                SOL BÖLÜM (~%70 / 8 Kolon):
                Başlık, Açıklama, Kontrol Listesi, Özel Alanlar, Ekler, Yorumlar
               ══════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-8 space-y-6">

              {/* Başlık */}
              <div>
                <label htmlFor="detail-task-title" className="field-label">
                  Görev Başlığı <span className="text-rose-500">*</span>
                </label>
                <input
                  id="detail-task-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="field text-base font-bold text-slate-800"
                  placeholder="Görev başlığı girin..."
                />
              </div>

            {/* Açıklama */}
            <div>
              <label htmlFor="detail-task-description" className="field-label">
                Açıklama
              </label>
              <textarea
                id="detail-task-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field leading-relaxed text-sm resize-none"
                placeholder="Görevin detaylı açıklaması, hedefleri ve yapılacaklar..."
              />
            </div>

            {/* ── Kontrol Listesi (Checklist) ──────────────────────── */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">Kontrol Listesi (Checklist)</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                    {checklistItems.filter((i) => i.isCompleted).length}/{checklistItems.length}
                  </span>
                </div>
              </div>

              {/* Checklist Transition Rules Pills (if task type has checklist rules) */}
              {selectedType && selectedType.rules?.some((r) => r.ruleType === 'CHECKLIST_REQUIRED') && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs">
                  <span className="text-amber-900 font-semibold flex items-center gap-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Zorunlu Geçiş Kuralları:
                  </span>
                  {selectedType.rules
                    .filter((r) => r.ruleType === 'CHECKLIST_REQUIRED')
                    .map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-amber-900 border border-amber-200/90 shadow-2xs"
                      >
                        [{r.targetColumnTitle} için Zorunlu]
                        {r.description ? ` (${r.description})` : ''}
                      </span>
                    ))}
                </div>
              )}

              {/* Checklist Items List */}
              <div className="space-y-1.5">
                {checklistItems.map((item) => {
                  // Determine required column name for this item
                  let targetColTitle: string | null = null;
                  if (item.requiredForColumnId) {
                    const col = columns.find((c) => c.id === item.requiredForColumnId);
                    if (col) targetColTitle = col.title;
                  }
                  if (!targetColTitle && selectedType?.rules) {
                    const matchedRule = selectedType.rules.find(
                      (r) =>
                        r.ruleType === 'CHECKLIST_REQUIRED' &&
                        (r.description?.trim().toLowerCase() === item.title.trim().toLowerCase() ||
                          item.title.toLowerCase().includes(r.targetColumnTitle.toLowerCase()))
                    );
                    if (matchedRule) targetColTitle = matchedRule.targetColumnTitle;
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:bg-white transition-all group"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => handleToggleChecklistItem(item.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className={`text-xs truncate ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                          {item.title}
                        </span>
                        {targetColTitle && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 ml-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            [{targetColTitle} için Zorunlu]
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded shrink-0 ml-2"
                        title="Maddeyi Sil"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add checklist input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Yeni kontrol maddesi ekle…"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  className="field text-xs py-1.5 flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  disabled={addingChecklist || !newChecklistTitle.trim()}
                  className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                >
                  + Ekle
                </button>
              </div>
            </div>

            {/* ── Özel Alanlar (Custom Fields) ──────────────────────── */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800">Özel Alanlar</h3>
                {!showAddField && (
                  <button
                    type="button"
                    onClick={() => setShowAddField(true)}
                    className="btn-ghost text-xs text-blue-600 hover:text-blue-700 font-semibold gap-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Özel Alan Ekle
                  </button>
                )}
              </div>

              {/* Add Field Inline Form */}
              {showAddField && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 mb-3 space-y-3 animate-scale-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Alan Adı (Örn: Bütçe, Sürüm)"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="field bg-white text-xs"
                      autoFocus
                    />
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                      className="field bg-white text-xs"
                    >
                      <option value="TEXT">Metin</option>
                      <option value="NUMBER">Sayı</option>
                      <option value="DATE">Tarih</option>
                    </select>
                    <input
                      type={newFieldType === 'DATE' ? 'date' : newFieldType === 'NUMBER' ? 'number' : 'text'}
                      placeholder="Değer..."
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                      className="field bg-white text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddField(false)}
                      className="btn-ghost py-1 px-2.5 text-xs"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="btn-primary py-1 px-3 text-xs font-semibold"
                    >
                      Alanı Kaydet
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Fields List */}
              {customFields.length > 0 && (
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
                <div className="flex items-center gap-2 flex-wrap">
                  <PaperclipIcon className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">Medya ve Ekler</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                    {attachments.length}
                  </span>
                  {selectedType?.rules?.some((r) => r.ruleType === 'ATTACHMENT_REQUIRED') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      [Bu aşama için Dosya/Görsel Yüklemek Zorunludur]
                    </span>
                  )}
                </div>

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
                        className="group flex flex-col justify-between p-3 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-xs transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {isImg ? (
                            <img
                              src={att.fileUrl}
                              alt={att.fileName}
                              className="w-12 h-12 object-cover rounded-lg border border-slate-100 bg-slate-50 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                              <PaperclipIcon className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate" title={att.fileName}>
                              {att.fileName}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {att.uploadedByName} • {format(parseISO(att.uploadedAt), 'dd.MM.yyyy HH:mm')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                          <a
                            href={att.fileUrl}
                            download={att.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <DownloadIcon className="w-3.5 h-3.5" />
                            İndir
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                            title="Dosyayı Sil"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Yorumlar Bölümü */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquareIcon className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800">Yorumlar ve Aktivite</h3>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold border border-slate-200/60">
                  {comments.length}
                </span>
              </div>

              <form onSubmit={handleAddComment} className="space-y-2">
                <textarea
                  rows={2}
                  placeholder="Bir yorum yazın…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="field text-xs py-2 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="btn-primary py-1.5 px-3 text-xs font-semibold"
                  >
                    {submittingComment ? 'Gönderiliyor…' : 'Yorum Yap'}
                  </button>
                </div>
              </form>

              {loadingComments ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Henüz yorum yapılmamış.</p>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{c.authorName}</span>
                        <span className="text-[11px] text-slate-400">
                          {format(parseISO(c.createdAt), 'dd.MM.yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════
              SAĞ BÖLÜM (~%30 / 4 Kolon):
              Durum (Kolon), Görev Tipi, Atanan Kişiler, Öncelik, Tarihler
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

            {/* Görev Tipi (Task Type) */}
            <div>
              <label htmlFor="detail-task-type" className="field-label">
                Görev Tipi (Task Type)
              </label>
              <select
                id="detail-task-type"
                value={selectedTaskTypeId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const newTypeId = val ? Number(val) : null;
                  setSelectedTaskTypeId(newTypeId);
                  if (newTypeId) {
                    populateChecklistFromTaskType(newTypeId, checklistItems);
                  }
                }}
                className="field text-sm font-medium text-slate-700"
              >
                <option value="">-- Görev Tipi Seçiniz --</option>
                {taskTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Atanan Kişiler (Multi-Select) */}
            <div ref={assigneeBoxRef} className="relative">
              <label className="field-label">
                Atanan Kişiler <span className="text-slate-400 font-normal text-xs">(Çoklu Seçim)</span>
              </label>

              <div
                onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                className="field min-h-[42px] cursor-pointer flex flex-wrap items-center gap-1.5 p-1.5"
              >
                {selectedAssigneeIds.length === 0 ? (
                  <span className="text-slate-400 text-xs font-normal px-1 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5" />
                    Kişi seçiniz…
                  </span>
                ) : (
                  selectedAssigneeIds.map((userId) => {
                    const u = users.find((item) => item.id === userId);
                    if (!u) return null;
                    return (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] font-bold">
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                        {u.username}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAssignee(u.id);
                          }}
                          className="hover:text-rose-600 text-blue-400 ml-0.5 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* Multi-Select Dropdown */}
              {assigneeDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto p-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Kullanıcı ara…"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    className="field text-xs py-1.5 mb-2 w-full"
                  />
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Kullanıcı bulunamadı.</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredUsers.map((u) => {
                        const isSelected = selectedAssigneeIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => handleToggleAssignee(u.id)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>{u.username}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
    </div>
  );
}
