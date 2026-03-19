import { useState, useRef } from 'react';
import { Upload, File, FileText, Image, Trash2, Download, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/context/PlanContext';
import { UpgradeButton } from '@/components/Upgrade';
import toast from 'react-hot-toast';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type, className }) {
  if (type?.startsWith('image/')) return <Image className={cn('text-blue-500', className)} />;
  if (type === 'application/pdf') return <FileText className={cn('text-red-500', className)} />;
  return <File className={cn('text-muted-foreground', className)} />;
}

function AttachmentRow({ attachment, resourceType, resourceId, onDeleted, canDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${attachment.name}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/attachments/${resourceType}/${resourceId}/${attachment._id}`);
      onDeleted(attachment._id);
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group rounded-lg">
      <FileIcon type={attachment.type} className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(attachment.size)}
          {attachment.uploadedAt && ` · ${formatDate(attachment.uploadedAt)}`}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="View / Download"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors text-muted-foreground opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function Attachments({ resourceType, resourceId, initialAttachments = [] }) {
  const { canWrite } = useRole();
  const { canUse } = usePlan();
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const uploadFile = async (file) => {
    // Validate
    if (file.size > MAX_SIZE) {
      toast.error(`${file.name} is too large. Max size is 10MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`${file.name} is not a supported file type`);
      return;
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast.error('File uploads not configured. Add Cloudinary vars to client .env');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload to Cloudinary directly from browser
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', `crm/${resourceType}s/${resourceId}`);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
        { method: 'POST', body: formData }
      );

      if (!cloudRes.ok) throw new Error('Upload to Cloudinary failed');
      const cloudData = await cloudRes.json();

      // 2. Save metadata to our backend
      const { data } = await api.post(`/attachments/${resourceType}/${resourceId}`, {
        publicId: cloudData.public_id,
        url: cloudData.secure_url,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });

      setAttachments((prev) => [...prev, data.attachment]);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(`Failed to upload ${file.name}`);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(uploadFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDeleted = (attachmentId) => {
    setAttachments((prev) => prev.filter((a) => a._id !== attachmentId));
  };

  return (
    <div className="space-y-3">
      {/* File list */}
      {attachments.length > 0 ? (
        <div className="space-y-0.5">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment._id}
              attachment={attachment}
              resourceType={resourceType}
              resourceId={resourceId}
              onDeleted={handleDeleted}
              canDelete={canWrite}
            />
          ))}
        </div>
      ) : (
        !canWrite && (
          <p className="text-sm text-muted-foreground text-center py-4">No files attached</p>
        )
      )}

      {/* Upload area */}
      {canWrite && (
        canUse('attachments') ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-4 text-center transition-all',
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/20',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Uploading...
            </div>
          ) : (
            <>
              <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-xs text-muted-foreground mb-2">
                Drop files here or{' '}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-primary hover:underline font-medium"
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Word, Excel, Images · Max 10MB
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
        ) : (
          <div className="border border-dashed border-border rounded-xl p-4 text-center">
            <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground mb-2">File attachments are a Growth feature</p>
            <UpgradeButton feature="attachments" label="Upgrade to attach files" size="sm" />
          </div>
        )
      )}
    </div>
  );
}