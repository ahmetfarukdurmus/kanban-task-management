import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { AttachmentDto, ColumnResponse, CommentDto, Priority, TaskRequest, TaskResponse, UserSummary } from '@/types';
import { taskApi } from '@/api/taskApi';
import { userService } from '@/services/userService';
import { commentService } from '@/services/commentService';
import { attachmentService } from '@/services/attachmentService';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  task:        TaskResponse | null;
  boardId:     number;
  columns:     ColumnResponse[];
  onClose:     () => void;
  onUpdated:   (task: TaskResponse) => void;
  onDeleted:   (taskId: number, columnId: number) => void;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

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

  /* ── Load Users for Assignee Selection ──────────────────────────── */
  useEffect(() => {
    userService
      .getAll()
      .then((data) => setUsers(data))
      .catch(() => { /* ignore or fallback */ });
  }, []);

  /* ── Synchronize with selected task & load comments / attachments ── */
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setPriority(task.priority);
      setDueDate(task.dueDate ?? '');
      setAssignee(task.assignee ?? '');
      setColumnId(task.columnId);
      setNewComment('');

      // Load comments
      setLoadingComments(true);
      commentService
        .getComments(task.id)
        .then((data) => setComments(data))
        .catch(() => toast.error('Yorumlar yüklenemedi.'))
        .finally(() => setLoadingComments(false));

      // Load attachments
      setLoadingAttachments(true);
      attachmentService
        .getAttachments(task.id)
        .then((data) => setAttachments(data))
        .catch(() => toast.error('Ekler yüklenemedi.'))
        .finally(() => setLoadingAttachments(false));
    }
  }, [task]);

  if (!task) return null;

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
      const created = await commentService.addComment(task.id, content);
      setComments((prev) => [...prev, created]);
      setNewComment('');
      toast.success('Yorum eklendi.');
    } catch {
      toast.error('Yorum eklenirken hata oluştu.');
    } finally {
      setSubmittingComment(false);
    }
  };

  /* ── Upload Attachment ──────────────────────────────────────────── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const uploaded = await attachmentService.uploadAttachment(task.id, file);
      setAttachments((prev) => [uploaded, ...prev]);
      toast.success('Dosya başarıyla yüklendi.');
    } catch {
      toast.error('Dosya yüklenemedi.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isImageFile = (fileName: string, fileType?: string) => {
    if (fileType && fileType.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  };

  const currentColumn = columns.find((c) => c.id === columnId) || columns.find((c) => c.id === task.columnId);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-5xl min-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col my-8 animate-scale-in max-h-[90vh] overflow-y-auto">

        {/* ── Top Bar / Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Görev #{task.id} &bull; {currentColumn?.title ?? 'Pano'}
              </span>
              <h2 className="text-base font-bold text-slate-800">Görev Detayları</h2>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">

          {/* ══════════════════════════════════════════════════════════
              SOL BÖLÜM (~%70 / 8 Kolon):
              Başlık, Açıklama, Medya/Ekler, Aktivite & Yorumlar
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">

            {/* Başlık Alanı */}
            <div>
              <label htmlFor="detail-task-title" className="field-label font-semibold text-slate-600">
                Başlık <span className="text-red-500">*</span>
              </label>
              <input
                id="detail-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Görev başlığı..."
                className="field text-base font-semibold text-slate-800"
                maxLength={200}
              />
            </div>

            {/* Açıklama Alanı */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-400">
                  <line x1="21" y1="10" x2="3" y2="10" />
                  <line x1="21" y1="6" x2="3" y2="6" />
                  <line x1="21" y1="14" x2="3" y2="14" />
                  <line x1="21" y1="18" x2="7" y2="18" />
                </svg>
                <label htmlFor="detail-task-desc" className="field-label mb-0 font-semibold text-slate-600">
                  Açıklama
                </label>
              </div>
              <textarea
                id="detail-task-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bu göreve dair detaylı açıklama ekleyin..."
                className="field resize-none text-sm text-slate-700 leading-relaxed"
              />
            </div>

            {/* Medya & Ekler Bölümü */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-500">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  <h3 className="text-sm font-semibold text-slate-700">Medya ve Ekler</h3>
                  <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium">
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
                    className="btn-secondary py-1.5 px-3 text-xs gap-1.5"
                  >
                    {uploadingFile ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin" />
                        Yükleniyor…
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Dosya Yükle
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ekler Listesi */}
              {loadingAttachments ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : attachments.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                  <p className="text-xs text-slate-400">Henüz dosya veya görsel eklenmedi.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((att) => {
                    const isImg = isImageFile(att.fileName, att.fileType);
                    return (
                      <div
                        key={att.id}
                        className="group flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"
                      >
                        {/* Preview / Icon */}
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {isImg ? (
                            <img
                              src={att.fileUrl}
                              alt={att.fileName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // fallback if thumbnail error
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6 text-slate-400">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                              <polyline points="13 2 13 9 20 9" />
                            </svg>
                          )}
                        </div>

                        {/* File Meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate" title={att.fileName}>
                            {att.fileName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                            <span>{att.uploadedByName || 'Kullanıcı'}</span>
                            <span>&bull;</span>
                            <span>{format(parseISO(att.uploadedAt), 'dd MMM')}</span>
                          </div>
                        </div>

                        {/* Download / Open Link */}
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost p-1.5 text-slate-400 hover:text-blue-600"
                          title="Görüntüle / İndir"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aktivite & Yorumlar Bölümü */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-500">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-700">Aktivite ve Yorumlar</h3>
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium">
                  {comments.length}
                </span>
              </div>

              {/* Yorum Yap Input Alanı */}
              <form onSubmit={handleAddComment} className="flex gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0 mt-1 shadow-sm">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
                <div className="flex-1 space-y-2">
                  <textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Bir yorum veya güncelleme yazın..."
                    className="field text-sm resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="btn-primary py-1.5 px-3 text-xs"
                    >
                      {submittingComment ? 'Gönderiliyor…' : 'Yorum Yap'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Yorumlar Akışı */}
              {loadingComments ? (
                <div className="py-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">Henüz yorum yapılmadı.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex-shrink-0 mt-0.5">
                        {comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '?'}
                      </span>
                      <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-800 text-xs">
                            {comment.authorName}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {format(parseISO(comment.createdAt), 'dd MMM yyyy, HH:mm')}
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════
              SAĞ BÖLÜM (~%30 / 4 Kolon):
              Durum (Kolon), Atanan Kişi, Öncelik, Tarihler & İşlemler
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-4">

            {/* Durum / Kolon Seçici */}
            <div>
              <label htmlFor="detail-task-column" className="field-label font-semibold text-slate-600">
                Durum (Kolon)
              </label>
              <select
                id="detail-task-column"
                value={columnId}
                onChange={(e) => setColumnId(Number(e.target.value))}
                className="field font-medium text-slate-700"
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
              <label htmlFor="detail-task-assignee" className="field-label font-semibold text-slate-600">
                Atanan Kişi
              </label>
              <div className="space-y-2">
                <select
                  id="detail-task-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="field text-sm font-medium"
                >
                  <option value="">Atanmamış</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                  {/* If the current assignee is free-text not in users list */}
                  {assignee && !users.some((u) => u.username === assignee) && (
                    <option value={assignee}>{assignee}</option>
                  )}
                </select>

                {/* Display Current Selected Assignee Card */}
                {assignee ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
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
              <label htmlFor="detail-task-priority" className="field-label font-semibold text-slate-600">
                Öncelik
              </label>
              <select
                id="detail-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="field text-sm font-medium"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="mt-1.5">
                <span
                  className={
                    priority === 'HIGH'
                      ? 'badge-high'
                      : priority === 'MEDIUM'
                      ? 'badge-medium'
                      : 'badge-low'
                  }
                >
                  {priority} Öncelik
                </span>
              </div>
            </div>

            {/* Bitiş Tarihi (Due Date) */}
            <div>
              <label htmlFor="detail-task-due" className="field-label font-semibold text-slate-600">
                Bitiş Tarihi
              </label>
              <input
                id="detail-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field text-sm"
              />
            </div>

            {/* İşlem Butonları */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
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
                className="btn-secondary w-full justify-center py-2 text-xs"
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
                    className="btn-danger w-full justify-center py-2 text-xs"
                  >
                    {deleting ? 'Siliniyor…' : '🗑 Görevi Sil'}
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
