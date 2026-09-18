import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type {
  AttachmentDto,
  CommentDto,
  CustomFieldDto,
  CustomFieldType,
  Priority,
  TaskActivityDto,
  TaskActivityType,
  TaskChecklistItemDto,
  TaskRequest,
  TaskResponse,
  TaskTypeDto,
  UserSummary,
} from '@/types';
import { taskApi } from '@/api/taskApi';
import { commentService } from '@/services/commentService';
import { attachmentService } from '@/services/attachmentService';
import { taskActivityService } from '@/services/taskActivityService';
import { userService } from '@/services/userService';
import { taskTypeService } from '@/services/taskTypeService';
import { useAuth } from '@/contexts/AuthContext';
import { isColumnMatching, normalizeColumnTitle } from '@/utils/workflowUtils';
import CascadingSelectField from './CascadingSelectField';
import {
  CalendarIcon,
  ClockIcon,
  DownloadIcon,
  HistoryIcon,
  MessageSquareIcon,
  PaperclipIcon,
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

const PRIORITIES: { value: Priority; label: string; icon: string }[] = [
  { value: 'HIGH',   label: 'Yüksek', icon: '▲' },
  { value: 'MEDIUM', label: 'Orta',   icon: '〓' },
  { value: 'LOW',    label: 'Düşük',  icon: '▼' },
];

function getAvatarColor(name: string) {
  const colors = [
    'bg-blue-600 text-white',
    'bg-emerald-600 text-white',
    'bg-violet-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-cyan-600 text-white',
    'bg-indigo-600 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getActivityMeta(type: TaskActivityType) {
  switch (type) {
    case 'CREATED':
      return {
        label: 'Oluşturuldu',
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'STATUS_CHANGED':
      return {
        label: 'Durum Değişikliği',
        color: 'bg-blue-50 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'ASSIGNEE_CHANGED':
      return {
        label: 'Atanan Değişti',
        color: 'bg-purple-50 text-purple-800 border-purple-200',
        dot: 'bg-purple-500',
      };
    case 'PRIORITY_CHANGED':
      return {
        label: 'Öncelik Değişti',
        color: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'DUE_DATE_CHANGED':
      return {
        label: 'Tarih Değişti',
        color: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
      };
    case 'TITLE_UPDATED':
      return {
        label: 'Başlık Güncellendi',
        color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dot: 'bg-indigo-500',
      };
    case 'DESCRIPTION_UPDATED':
      return {
        label: 'Açıklama Güncellendi',
        color: 'bg-slate-100 text-slate-800 border-slate-200',
        dot: 'bg-slate-500',
      };
    case 'FIELD_UPDATED':
      return {
        label: 'Alan Güncellendi',
        color: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        dot: 'bg-cyan-500',
      };
    case 'CHECKLIST_UPDATED':
      return {
        label: 'Kontrol Listesi',
        color: 'bg-teal-50 text-teal-800 border-teal-200',
        dot: 'bg-teal-500',
      };
    case 'ATTACHMENT_ADDED':
      return {
        label: 'Dosya Eklendi',
        color: 'bg-sky-50 text-sky-800 border-sky-200',
        dot: 'bg-sky-500',
      };
    case 'ATTACHMENT_DELETED':
      return {
        label: 'Dosya Silindi',
        color: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
      };
    case 'COMMENT_ADDED':
      return {
        label: 'Yorum Yapıldı',
        color: 'bg-violet-50 text-violet-800 border-violet-200',
        dot: 'bg-violet-500',
      };
    default:
      return {
        label: 'Aktivite',
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

export default function TaskDetailModal({
  task,
  boardId,
  columns,
  isOpen = true,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const canEditAdminFields = isAdmin || isSuperAdmin;
  const isReporter = !!(
    user && (
      (task?.reporterId && task.reporterId === user.id) ||
      (task?.reporter?.id && task.reporter.id === user.id) ||
      (task?.reporterName && user.username && task.reporterName.toLowerCase() === user.username.toLowerCase())
    )
  );
  const canEditEstimatedHours = canEditAdminFields || isReporter;

  /* ── Form State ─────────────────────────────────────────────────── */
  const [title, setTitle]                 = useState('');
  const [description, setDescription]     = useState('');
  const [priority, setPriority]           = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate]             = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [reporterId, setReporterId]       = useState<number | null>(null);
  const [columnId, setColumnId]           = useState<number>(0);
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState<number | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [customFields, setCustomFields]   = useState<CustomFieldDto[]>([]);
  const [tags, setTags]                   = useState<string[]>([]);
  const [tagInput, setTagInput]           = useState('');

  /* ── Checklist Items ────────────────────────────────────────────── */
  const [checklistItems, setChecklistItems] = useState<TaskChecklistItemDto[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingChecklist, setAddingChecklist] = useState(false);

  /* ── Data & Async State ─────────────────────────────────────────── */
  const [users, setUsers]                         = useState<UserSummary[]>([]);
  const [taskTypes, setTaskTypes]                 = useState<TaskTypeDto[]>([]);
  const [comments, setComments]                   = useState<CommentDto[]>([]);
  const [attachments, setAttachments]             = useState<AttachmentDto[]>([]);
  const [activities, setActivities]               = useState<TaskActivityDto[]>([]);
  const [newComment, setNewComment]               = useState('');
  const [loadingComments, setLoadingComments]     = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingFile, setUploadingFile]         = useState(false);
  const [saving, setSaving]                       = useState(false);
  const [deleting, setDeleting]                   = useState(false);

  // Assignee dropdown toggle
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const assigneeBoxRef = useRef<HTMLDivElement>(null);

  const loadActivities = (taskId: number) => {
    setLoadingActivities(true);
    taskActivityService
      .getActivities(taskId)
      .then((data) => setActivities(data))
      .catch(() => { /* silent fail or fallback */ })
      .finally(() => setLoadingActivities(false));
  };

  /* ── Synchronize with selected task & load fresh data from backend ── */
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setDueDate(task.dueDate ?? '');
      setEstimatedHours(task.estimatedHours ?? '');
      setReporterId(task.reporterId ?? task.reporter?.id ?? null);
      setColumnId(task.columnId);
      setSelectedTaskTypeId(task.taskTypeId ?? null);
      setSelectedAssigneeIds(task.assigneeIds || (task.assignee ? [] : []));
      setChecklistItems(task.checklistItems || []);
      setCustomFields(task.customFields || []);
      setTags(task.tags || []);
      setTagInput('');
      setNewComment('');
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
            setCustomFields((prev) => syncCustomFieldsWithTaskType(typeId, prev, data));
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
          setEstimatedHours(freshTask.estimatedHours ?? '');
          setReporterId(freshTask.reporterId ?? freshTask.reporter?.id ?? null);
          setColumnId(freshTask.columnId);
          setSelectedTaskTypeId(freshTask.taskTypeId ?? null);
          setSelectedAssigneeIds(freshTask.assigneeIds || []);
          setChecklistItems(freshTask.checklistItems || []);
          setCustomFields(freshTask.customFields || []);
          setTags(freshTask.tags || []);

          if (freshTask.taskTypeId) {
            populateChecklistFromTaskType(freshTask.taskTypeId, freshTask.checklistItems || []);
            setCustomFields(syncCustomFieldsWithTaskType(freshTask.taskTypeId, freshTask.customFields || []));
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

      // 6. Load activities fresh
      loadActivities(task.id);
    }
  }, [task, boardId]);

  // Helper to sync custom field definitions from TaskType
  const syncCustomFieldsWithTaskType = (
    typeId: number | null,
    currentFields: CustomFieldDto[],
    typesList: TaskTypeDto[] = taskTypes
  ): CustomFieldDto[] => {
    if (!typeId) return currentFields;
    const type = typesList.find((t) => t.id === typeId);
    if (!type || !type.fields || type.fields.length === 0) return currentFields;

    const result = [...currentFields];
    for (const f of type.fields) {
      const idx = result.findIndex(
        (cf) => cf.fieldName.trim().toLowerCase() === f.fieldName.trim().toLowerCase()
      );
      if (idx === -1) {
        result.push({
          fieldName: f.fieldName,
          fieldType: (f.fieldType as CustomFieldType) || 'TEXT',
          fieldValue: '',
          required: f.required,
          options: f.options,
          placeholder: f.placeholder,
        });
      } else {
        result[idx] = {
          ...result[idx],
          required: f.required,
          options: f.options,
          placeholder: f.placeholder,
          fieldType: (f.fieldType as CustomFieldType) || result[idx].fieldType,
        };
      }
    }
    return result;
  };

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
            (rule.targetColumnTitle && isColumnMatching(rule.targetColumnTitle, c.title))
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
      loadActivities(task.id);
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
      loadActivities(task.id);
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
      loadActivities(task.id);
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
        const srcColIndex = columns.findIndex((c) => c.id === task.columnId);
        const dstColIndex = columns.findIndex((c) => c.id === columnId);
        const targetCol = columns[dstColIndex];
        const sourceCol = columns[srcColIndex];

        // 1. Enforce sequential column transition (cannot skip forward across columns)
        if (srcColIndex !== -1 && dstColIndex !== -1 && dstColIndex > srcColIndex + 1) {
          const nextCol = columns[srcColIndex + 1];
          toast.error(
            `Görevler aşamaları atlayarak taşınamaz. Lütfen iş akışı sırasını takip edin (Sıradaki aşama: ${nextCol?.title || 'Sonraki Aşama'}).`,
            {
              duration: 5000,
              style: {
                border: '1px solid #EF4444',
                padding: '12px',
                color: '#991B1B',
                backgroundColor: '#FEF2F2',
              },
            }
          );
          setColumnId(task.columnId);
          setSaving(false);
          return;
        }

        // 2. Pre-validate transition rules on client-side
        if (selectedTaskTypeId) {
          const currentType = taskTypes.find((t) => t.id === selectedTaskTypeId);

          if (currentType && targetCol) {
            if (currentType.rules) {
              for (const rule of currentType.rules) {
                const targetMatches =
                  (rule.targetColumnId && rule.targetColumnId === columnId) ||
                  (rule.targetColumnTitle && isColumnMatching(rule.targetColumnTitle, targetCol.title));

                if (!targetMatches) continue;

                const hasSource = rule.sourceColumnId || (rule.sourceColumnTitle && rule.sourceColumnTitle.trim() !== '');
                if (hasSource && sourceCol) {
                  const sourceMatches =
                    (rule.sourceColumnId && rule.sourceColumnId === sourceCol.id) ||
                    (rule.sourceColumnTitle && isColumnMatching(rule.sourceColumnTitle, sourceCol.title));
                  if (!sourceMatches) continue;
                }

                if (rule.ruleType === 'CHECKLIST_REQUIRED') {
                  const items = checklistItems || [];
                  if (items.length === 0) {
                    const ruleDetail = rule.description ? ` (${rule.description})` : '';
                    toast.error(`Bu aşamaya (${targetCol.title}) geçebilmek için kontrol listesi maddeleri tamamlanmalıdır.${ruleDetail}`, {
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

                  const normRuleDesc = normalizeColumnTitle(rule.description);
                  const descMatchedItems = normRuleDesc
                    ? items.filter((item) => {
                        const itemTitle = normalizeColumnTitle(item.title);
                        return itemTitle.includes(normRuleDesc) || normRuleDesc.includes(itemTitle);
                      })
                    : [];

                  const colMatchedItems = items.filter(
                    (item) => item.requiredForColumnId && item.requiredForColumnId === columnId
                  );

                  let targetItemsToCheck = items.filter(
                    (item) => !item.requiredForColumnId || item.requiredForColumnId === columnId
                  );
                  if (descMatchedItems.length > 0) {
                    targetItemsToCheck = descMatchedItems;
                  } else if (colMatchedItems.length > 0) {
                    targetItemsToCheck = colMatchedItems;
                  }

                  const uncompleted = targetItemsToCheck.filter((item) => !item.isCompleted);
                  if (targetItemsToCheck.length === 0 || uncompleted.length > 0) {
                    const ruleDetail = rule.description ? ` (${rule.description})` : '';
                    toast.error(`Bu aşamaya (${targetCol.title}) geçebilmek için kontrol listesi maddeleri tamamlanmalıdır.${ruleDetail}`, {
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
                    const ruleDetail = rule.description ? ` (${rule.description})` : '';
                    toast.error(`Bu aşamaya (${targetCol.title}) geçebilmek için dosya/görsel eki yüklenmelidir.${ruleDetail}`, {
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
        }

        await taskApi.move(task.id, {
          targetColumnId: columnId,
          targetPosition: 0,
        });
        currentColId = columnId;
      }

      // Validate required custom fields from selected TaskType
      if (selectedTaskTypeId) {
        const currentType = taskTypes.find((t) => t.id === selectedTaskTypeId);
        if (currentType?.fields && currentType.fields.length > 0) {
          for (const field of currentType.fields) {
            if (field.required) {
              const match = customFields.find((cf) => cf.fieldName.trim().toLowerCase() === field.fieldName.trim().toLowerCase());
              if (!match || !match.fieldValue || !match.fieldValue.trim()) {
                toast.error(`"${field.fieldName}" alanı bu görev tipi için zorunludur.`, {
                  duration: 5000,
                  style: {
                    border: '1px solid #EF4444',
                    padding: '12px',
                    color: '#991B1B',
                    backgroundColor: '#FEF2F2',
                  },
                });
                setSaving(false);
                return;
              }
            }
          }
        }
      }

      const payload: TaskRequest = {
        title:             title.trim(),
        description:       description.trim() || undefined,
        priority,
        dueDate:           dueDate || undefined,
        estimatedHours:    typeof estimatedHours === 'number' && !isNaN(estimatedHours) ? estimatedHours : undefined,
        reporterId:        reporterId || undefined,
        taskTypeId:        selectedTaskTypeId,
        assigneeIds:       selectedAssigneeIds,
        customFields:      customFields.filter((cf) => cf.fieldValue !== undefined && cf.fieldValue !== null && cf.fieldValue.trim() !== ''),
        tags:              tags,
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
      loadActivities(task.id);
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

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Dosya boyutu 25MB sınırını aşamaz.');
      return;
    }

    setUploadingFile(true);
    try {
      const uploaded = await attachmentService.upload(task.id, file);
      setAttachments((prev) => [uploaded, ...prev]);
      toast.success('Dosya yüklendi.');
      loadActivities(task.id);
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
      loadActivities(task.id);
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
  const currentCol = columns.find((c) => c.id === columnId);

  const reporterDisplayName =
    task?.reporterName ||
    (reporterId ? users.find((u) => u.id === reporterId)?.username : '') ||
    (task?.reporterId ? `User #${task.reporterId}` : 'Belirtilmemiş');

  const handleAssignToMe = () => {
    if (user && !selectedAssigneeIds.includes(user.id)) {
      setSelectedAssigneeIds((prev) => [...prev, user.id]);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box max-w-6xl xl:max-w-7xl w-full p-0 overflow-hidden flex flex-col max-h-[92vh] shadow-2xl rounded-2xl border border-slate-200/90">

        {/* ── Modal Header (Jira / Linear style breadcrumb) ───────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <div className="flex items-center gap-2.5 flex-wrap">
            {(() => {
              const currentPrefix = selectedType?.taskPrefix || task.taskPrefix;
              const displayKey = (currentPrefix && task.taskKey && !task.taskKey.startsWith(`${currentPrefix}-`))
                ? `${currentPrefix}-${task.id}`
                : (task.taskKey || `${currentPrefix || 'TASK'}-${task.id}`);
              return (
                <span
                  className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border shadow-2xs"
                  style={{
                    backgroundColor: selectedType?.colorHex ? `${selectedType.colorHex}12` : '#FFFFFF',
                    color: selectedType?.colorHex || '#334155',
                    borderColor: selectedType?.colorHex ? `${selectedType.colorHex}40` : '#CBD5E1',
                  }}
                  title={`Görev Kodu: ${displayKey}`}
                >
                  {displayKey}
                </span>
              );
            })()}
            {selectedType && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs"
                style={{
                  backgroundColor: selectedType.colorHex ? `${selectedType.colorHex}12` : '#EFF6FF',
                  color: selectedType.colorHex || '#2563EB',
                  borderColor: selectedType.colorHex ? `${selectedType.colorHex}30` : '#BFDBFE',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shadow-2xs"
                  style={{ backgroundColor: selectedType.colorHex || '#2563EB' }}
                />
                {selectedType.name}
              </span>
            )}
            {currentCol && (
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <span>/</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold text-[11px]">
                  {currentCol.title}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              aria-label="Kapat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Modal Body (2-Column Layout) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">

          {/* ── Workflow Transition Rules Info Banner ── */}
          {selectedType && selectedType.rules && selectedType.rules.length > 0 && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-amber-50/70 border border-blue-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-white shadow-2xs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    Kolon Geçiş Kuralları (Workflow Guards)
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                  {selectedType.rules.length} Kural Tanımlı
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {selectedType.rules.map((rule) => {
                  const isChecklist = rule.ruleType === 'CHECKLIST_REQUIRED';
                  const isSatisfied = isChecklist
                    ? (checklistItems.length > 0 && checklistItems.every((i) => i.isCompleted))
                    : attachments.length > 0;

                  return (
                    <div
                      key={rule.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                        isSatisfied
                          ? 'bg-emerald-50/90 border-emerald-300/80 text-emerald-900 shadow-2xs'
                          : 'bg-white border-amber-200/90 text-slate-800 shadow-2xs'
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-4 h-4 rounded-full mt-0.5 shrink-0 text-[10px] font-bold ${
                          isSatisfied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {isSatisfied ? '✓' : '!'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">
                            Hedef: {rule.targetColumnTitle}
                          </span>
                          {rule.sourceColumnTitle && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({rule.sourceColumnTitle}’dan)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                          {isChecklist ? (
                            <>
                              <strong className="font-semibold text-slate-800">Kontrol:</strong>{' '}
                              {rule.description ? rule.description : 'Tüm checklist tamamlanmalı'}{' '}
                              <span className={`font-semibold ${checklistItems.length > 0 && checklistItems.every((i) => i.isCompleted) ? 'text-emerald-700' : 'text-amber-700'}`}>
                                ({checklistItems.filter((i) => i.isCompleted).length}/{checklistItems.length})
                              </span>
                            </>
                          ) : (
                            <>
                              <strong className="font-semibold text-slate-800">Medya/Ek:</strong>{' '}
                              {rule.description ? rule.description : 'Dosya/ek yüklenmeli'}{' '}
                              <span className={`font-semibold ${attachments.length > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                ({attachments.length} yüklü)
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-start">

            {/* ══════════════════════════════════════════════════════════
                SOL BÖLÜM (~%62 / 7-8 Kolon):
                Başlık, Açıklama, Kontrol Listesi, Özel Alanlar, Ekler, Yorumlar
               ══════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-6">

              {/* Başlık Input */}
              <div>
                <label htmlFor="detail-task-title" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Görev Başlığı <span className="text-rose-500">*</span>
                </label>
                <input
                  id="detail-task-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="w-full text-lg sm:text-xl font-bold text-slate-900 placeholder-slate-400 bg-white border border-slate-200/90 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
                  placeholder="Görev başlığı girin..."
                />
              </div>

              {/* Açıklama */}
              <div>
                <label htmlFor="detail-task-description" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Açıklama
                </label>
                <textarea
                  id="detail-task-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-200/90 rounded-xl p-3.5 text-sm text-slate-800 leading-relaxed placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all resize-y min-h-[100px]"
                  placeholder="Görevin detaylı açıklaması, hedefleri ve yapılacaklar..."
                />
              </div>

              {/* ── Kontrol Listesi (Checklist) ──────────────────────── */}
              <div className="pt-5 border-t border-slate-200/70 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kontrol Listesi (Checklist)</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold border border-slate-200">
                      {checklistItems.filter((i) => i.isCompleted).length}/{checklistItems.length}
                    </span>
                  </div>
                </div>

                {/* Checklist Transition Rules Pills */}
                {selectedType && selectedType.rules?.some((r) => r.ruleType === 'CHECKLIST_REQUIRED') && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs">
                    <span className="text-amber-900 font-semibold flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Zorunlu Geçiş Kuralları:
                    </span>
                    {selectedType.rules
                      .filter((r) => r.ruleType === 'CHECKLIST_REQUIRED')
                      .map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-amber-900 border border-amber-200 shadow-2xs"
                        >
                          [{r.targetColumnTitle} için Zorunlu]
                          {r.description ? ` (${r.description})` : ''}
                        </span>
                      ))}
                  </div>
                )}

                {/* Checklist Items List */}
                <div className="space-y-2">
                  {checklistItems.map((item) => {
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
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 shadow-2xs transition-all group"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.isCompleted}
                            onChange={() => handleToggleChecklistItem(item.id)}
                            className="rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                          />
                          <span className={`text-xs sm:text-[13px] truncate ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                            {item.title}
                          </span>
                          {targetColTitle && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 ml-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              [{targetColTitle} için Zorunlu]
                            </span>
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-all shrink-0 ml-2"
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
                    className="field text-xs py-2 flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    disabled={addingChecklist || !newChecklistTitle.trim()}
                    className="btn-secondary px-3.5 py-2 text-xs font-semibold"
                  >
                    + Ekle
                  </button>
                </div>
              </div>

              {/* ── Özel Alanlar (Custom Fields) ──────────────────────── */}
              {customFields.length > 0 && (
                <div className="pt-5 border-t border-slate-200/70 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Özel Alanlar</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold border border-slate-200">
                      {customFields.length}
                    </span>
                  </div>

                  {/* Custom Fields List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customFields.map((cf, index) => {
                      const isCascading = cf.fieldType === 'CASCADING_SELECT' || (cf.fieldName != null && cf.fieldName.toLowerCase().includes('port'));
                      const typeLabel = isCascading ? 'Bağlantılı Seçim' : cf.fieldType === 'DATE' ? 'Tarih' : cf.fieldType === 'NUMBER' ? 'Sayı' : cf.fieldType === 'SELECT' ? 'Seçim' : 'Metin';
                      const typeBadgeColor = isCascading ? 'bg-blue-50 text-blue-700 border-blue-200' : cf.fieldType === 'DATE' ? 'bg-amber-50 text-amber-700 border-amber-200' : cf.fieldType === 'NUMBER' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : cf.fieldType === 'SELECT' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200';
                      const selectOptions = cf.options ? cf.options.split(',').map((o) => o.trim()).filter(Boolean) : [];

                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs transition-all space-y-1.5 ${
                            isCascading ? 'sm:col-span-2' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-bold text-slate-700 truncate" title={cf.fieldName}>
                                {cf.fieldName}
                              </span>
                              {cf.required && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  * Zorunlu
                                </span>
                              )}
                              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${typeBadgeColor}`}>
                                {typeLabel}
                              </span>
                            </div>
                          </div>

                          {isCascading ? (
                            <CascadingSelectField
                              fieldName={cf.fieldName}
                              fieldValue={cf.fieldValue || ''}
                              options={cf.options}
                              placeholder={cf.placeholder}
                              required={cf.required}
                              onChange={(newVal) => handleCustomFieldValueChange(index, newVal)}
                            />
                          ) : cf.fieldType === 'SELECT' ? (
                            <select
                              value={cf.fieldValue || ''}
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className={`field w-full text-xs bg-white py-1.5 ${cf.required && !cf.fieldValue ? 'border-amber-400 bg-amber-50/20' : ''}`}
                            >
                              <option value="">-- {cf.placeholder || 'Seçiniz'} --</option>
                              {selectOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : cf.fieldType === 'DATE' ? (
                            <input
                              type="date"
                              value={cf.fieldValue || ''}
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className={`field w-full text-xs bg-white py-1.5 ${cf.required && !cf.fieldValue ? 'border-amber-400 bg-amber-50/20' : ''}`}
                            />
                          ) : cf.fieldType === 'NUMBER' ? (
                            <input
                              type="number"
                              value={cf.fieldValue || ''}
                              placeholder={cf.placeholder || 'Sayısal değer...'}
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className={`field w-full text-xs bg-white py-1.5 ${cf.required && !cf.fieldValue ? 'border-amber-400 bg-amber-50/20' : ''}`}
                            />
                          ) : (
                            <input
                              type="text"
                              value={cf.fieldValue || ''}
                              placeholder={cf.placeholder || 'Metin girin...'}
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className={`field w-full text-xs bg-white py-1.5 ${cf.required && !cf.fieldValue ? 'border-amber-400 bg-amber-50/20' : ''}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Medya & Ekler Bölümü ────────────────────────────── */}
              <div className="pt-5 border-t border-slate-200/70">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PaperclipIcon className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Medya ve Ekler</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold border border-slate-200">
                      {attachments.length}
                    </span>
                    {selectedType?.rules?.some((r) => r.ruleType === 'ATTACHMENT_REQUIRED') && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        [Görsel/Dosya Zorunludur]
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
                    className="group p-5 rounded-xl border border-dashed border-slate-200 bg-white hover:bg-blue-50/20 hover:border-blue-300 transition-all text-center cursor-pointer shadow-2xs"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors mb-1.5 shadow-2xs">
                      <UploadCloudIcon className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                      Dosya veya görsel yüklemek için tıklayın
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, PDF, ZIP (Maks. 25MB)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachments.map((att) => {
                      const isImg = isImageFile(att.fileName, att.fileType);
                      return (
                        <div
                          key={att.id}
                          className="group flex flex-col justify-between p-3 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-xs transition-all shadow-2xs"
                        >
                          <div className="flex items-start gap-3">
                            {isImg ? (
                              <img
                                src={att.fileUrl}
                                alt={att.fileName}
                                className="w-11 h-11 object-cover rounded-lg border border-slate-100 bg-slate-50 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
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

              {/* ── Yorumlar Bölümü ─────────────────────────────────── */}
              <div className="pt-5 border-t border-slate-200/70 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquareIcon className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Yorumlar
                    </h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold border border-slate-200">
                      {comments.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <form onSubmit={handleAddComment} className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Bir yorum yazın…"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="field text-xs py-2 resize-none bg-white"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingComment || !newComment.trim()}
                        className="btn-primary py-1.5 px-3.5 text-xs font-semibold"
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
                    <p className="text-xs text-slate-400 italic py-2">Henüz yorum yapılmamış.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {comments.map((c) => (
                        <div key={c.id} className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(c.authorName)}`}>
                                {c.authorName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-bold text-slate-700">{c.authorName}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {format(parseISO(c.createdAt), 'dd.MM.yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap pl-7">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ══════════════════════════════════════════════════════════
                SAĞ BÖLÜM (~%38 / 5 Kolon) - JIRA / ENTERPRISE STİLİ AYRINTILAR:
                Durum, Görev Tipi, Atanan Kişiler, Raporlayan, Öncelik, Bitiş Tarihi, Efor,
                İşlem Butonları ve Aktivite Geçmişi (Task History / Audit Log)
               ══════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6">
              
              {/* 1. Ayrıntılar Kartı */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 sm:p-7 space-y-7 shadow-2xs">
                {/* Ayrıntılar Başlığı */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">
                    Ayrıntılar
                  </h3>
                </div>

                {/* Ayrıntılar Satırları (Ferah ve Geniş Boşluklar) */}
                <div className="space-y-6 sm:space-y-7">
                  
                  {/* 1. Durum (Kolon) */}
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <span className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600">
                      Durum
                    </span>
                    <div className="flex-1 min-w-0">
                      <select
                        id="detail-task-column"
                        value={columnId}
                        onChange={(e) => setColumnId(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-h-[40px]"
                      >
                        {columns.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. Görev Tipi (Task Type) */}
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <span className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600">
                      Görev Tipi
                    </span>
                    <div className="flex-1 min-w-0">
                      {canEditAdminFields ? (
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
                          className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-h-[40px]"
                        >
                          <option value="">-- Görev Tipi Seçiniz --</option>
                          {taskTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 min-h-[40px]">
                          {selectedType ? (
                            <>
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: selectedType.colorHex || '#64748b' }}
                              />
                              <span className="truncate">{selectedType.name}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-normal">Görev tipi atanmamış</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Atanan Kişi(ler) & Bana Ata Linki */}
                  <div className="flex items-start justify-between gap-4 text-xs sm:text-sm">
                    <div className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600 pt-2 flex items-center gap-1">
                      <span>Atanan Kişi</span>
                    </div>
                    <div className="flex-1 min-w-0 relative" ref={assigneeBoxRef}>
                      <div
                        onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                        className="w-full min-h-[40px] bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-2 cursor-pointer shadow-2xs transition-all flex flex-wrap items-center gap-1.5"
                      >
                        {selectedAssigneeIds.length === 0 ? (
                          <span className="text-slate-400 text-xs sm:text-sm px-1 flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                            Kişi seçiniz…
                          </span>
                        ) : (
                          selectedAssigneeIds.map((userId) => {
                            const u = users.find((item) => item.id === userId);
                            if (!u) return null;
                            return (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs"
                              >
                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                                  {u.username.charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate max-w-[90px]">{u.username}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAssignee(u.id);
                                  }}
                                  className="hover:text-rose-600 text-blue-400 ml-0.5 font-bold text-sm"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>

                      {/* Quick 'Bana ata' button if current user is not assigned */}
                      {user && !selectedAssigneeIds.includes(user.id) && (
                        <button
                          type="button"
                          onClick={handleAssignToMe}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline inline-block mt-1.5 pl-0.5 cursor-pointer"
                        >
                          Bana ata
                        </button>
                      )}

                      {/* Multi-Select Dropdown */}
                      {assigneeDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto p-2 animate-scale-in">
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
                                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                                        {u.username.charAt(0).toUpperCase()}
                                      </span>
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
                  </div>

                  {/* 4. Raporlayan (Reporter) */}
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <span className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600">
                      Raporlayan
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs min-h-[40px]">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(reporterDisplayName)}`}>
                          {reporterDisplayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                          {reporterDisplayName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Öncelik (Priority) */}
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <span className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600">
                      Öncelik
                    </span>
                    <div className="flex-1 min-w-0">
                      <select
                        id="detail-task-priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Priority)}
                        className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-h-[40px]"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.icon} {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 6. Bitiş Tarihi (Due Date) */}
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <span className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600">
                      Bitiş Tarihi
                    </span>
                    <div className="flex-1 min-w-0">
                      {canEditAdminFields ? (
                        <input
                          id="detail-task-due"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[40px]"
                        />
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-600 min-h-[40px]">
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <span>{dueDate ? format(parseISO(dueDate), 'dd.MM.yyyy') : 'Tarih belirlenmemiş'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 7. Tahmini Efor (Estimated Hours / SP) */}
                  <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
                    <span className="w-32 sm:w-36 shrink-0 font-semibold text-slate-600">
                      Tahmini Efor
                    </span>
                    <div className="flex-1 min-w-0">
                      {canEditEstimatedHours ? (
                        <div className="relative">
                          <input
                            id="detail-task-estimated-hours"
                            type="number"
                            min={0}
                            placeholder="Örn: 8"
                            value={estimatedHours}
                            onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : '')}
                            className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2 pr-16 text-xs sm:text-sm font-medium text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[40px]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                            Saat / SP
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-600 min-h-[40px]">
                          <ClockIcon className="w-4 h-4 text-slate-400" />
                          <span>
                            {estimatedHours !== '' && estimatedHours !== undefined ? `${estimatedHours} Saat / SP` : 'Efor girilmemiş'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 8. Etiketler (Tags) */}
                  <div className="flex flex-col gap-2 text-xs sm:text-sm pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">
                        Etiketler (Tags)
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {tags.length} etiket
                      </span>
                    </div>

                    {/* Tag pills list */}
                    <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                            className="text-blue-400 hover:text-rose-600 ml-0.5 text-xs font-bold transition-colors"
                            title="Etiketi Kaldır"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {tags.length === 0 && (
                        <span className="text-xs text-slate-400 italic">Henüz etiket eklenmedi</span>
                      )}
                    </div>

                    {/* Add Tag Input */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Etiket yazıp Enter'a basın..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const clean = tagInput.trim().replace(/^#/, '');
                            if (clean && !tags.includes(clean)) {
                              setTags((prev) => [...prev, clean]);
                            }
                            setTagInput('');
                          }
                        }}
                        className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[38px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = tagInput.trim().replace(/^#/, '');
                          if (clean && !tags.includes(clean)) {
                            setTags((prev) => [...prev, clean]);
                          }
                          setTagInput('');
                        }}
                        disabled={!tagInput.trim()}
                        className="btn-secondary px-3.5 py-2 text-xs font-semibold shrink-0 min-h-[38px]"
                      >
                        + Ekle
                      </button>
                    </div>
                  </div>

                </div>

                {/* İşlem Butonları */}
                <div className="pt-6 border-t border-slate-200/80 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="btn-primary w-full justify-center py-2.5 text-xs sm:text-sm font-semibold shadow-sm"
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
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="btn-danger w-full justify-center py-2 text-xs font-semibold gap-1.5 mt-1"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      {deleting ? 'Siliniyor…' : 'Görevi Sil'}
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Aktivite Geçmişi (Task History / Audit Log) Kartı */}
              <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80">
                      <HistoryIcon className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                      Aktivite Geçmişi
                    </h3>
                    <span className="bg-blue-100/70 text-blue-700 text-[11px] px-2 py-0.5 rounded-full font-bold border border-blue-200">
                      {activities.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadActivities(task.id)}
                    disabled={loadingActivities}
                    className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer"
                    title="Geçmişi Yenile"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 ${loadingActivities ? 'animate-spin' : ''}`}>
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21v-5h5" />
                    </svg>
                    Yenile
                  </button>
                </div>

                {/* Timeline İçeriği */}
                {loadingActivities ? (
                  <div className="py-6 flex justify-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">Henüz bir aktivite kaydı bulunmuyor.</p>
                ) : (
                  <div className="relative pl-4 space-y-3.5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 max-h-[420px] overflow-y-auto pr-1">
                    {activities.map((act) => {
                      const meta = getActivityMeta(act.activityType);
                      return (
                        <div key={act.id} className="relative group">
                          {/* Timeline Bullet */}
                          <span className={`absolute -left-4 top-2.5 w-2.5 h-2.5 rounded-full ring-4 ring-slate-50 shadow-2xs ${meta.dot}`} />

                          <div className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${getAvatarColor(act.username)}`}>
                                  {act.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-bold text-slate-800 truncate max-w-[95px]" title={act.username}>{act.username}</span>
                                {act.userRole && (
                                  <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium border border-slate-200 shrink-0">
                                    {act.userRole === 'ROLE_SUPER_ADMIN' ? 'Süper Admin' : act.userRole === 'ROLE_ADMIN' ? 'Admin' : 'Kullanıcı'}
                                  </span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${meta.color}`}>
                                  {meta.label}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {format(parseISO(act.createdAt), 'dd.MM HH:mm')}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                              {act.description}
                            </p>

                            {(act.oldValue || act.newValue) && (
                              <div className="pt-1 border-t border-slate-100 flex items-center gap-1.5 text-[11px] flex-wrap font-mono">
                                {act.oldValue && act.newValue ? (
                                  <>
                                    <span className="line-through text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100 max-w-[130px] truncate" title={act.oldValue}>
                                      {act.oldValue}
                                    </span>
                                    <span className="text-slate-400 font-sans font-bold">→</span>
                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-100 max-w-[130px] truncate" title={act.newValue}>
                                      {act.newValue}
                                    </span>
                                  </>
                                ) : act.newValue ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-100 max-w-[180px] truncate" title={act.newValue}>
                                    + {act.newValue}
                                  </span>
                                ) : (
                                  <span className="line-through text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100 max-w-[180px] truncate" title={act.oldValue!}>
                                    - {act.oldValue}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
