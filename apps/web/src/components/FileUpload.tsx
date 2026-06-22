import { useState, useRef } from 'react';
import { Upload, Loader2, X, CheckCircle } from 'lucide-react';
import { uploadKycFile } from '../lib/supabase';

interface FileUploadProps {
  userId: string;
  docType: string;
  label: string;
  onUploaded: (url: string) => void;
  onClear?: () => void;
  currentUrl?: string;
}

export default function FileUpload({
  userId,
  docType,
  label,
  onUploaded,
  onClear,
  currentUrl,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      if (file.size > 5 * 1024 * 1024) {
        setError('File too large. Max 5 MB.');
        setUploading(false);
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        setUploading(false);
        return;
      }

      const url = await uploadKycFile(file, userId, docType);
      if (url) {
        setUploadedUrl(url);
        onUploaded(url);
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClear = () => {
    setUploadedUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    if (onClear) onClear();
  };

  if (uploadedUrl) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
        <CheckCircle size={16} className="text-green-400 shrink-0" />
        <span className="text-xs text-green-400 truncate flex-1">Uploaded successfully</span>
        <a
          href={uploadedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-triq-cyan hover:underline shrink-0"
        >
          View
        </a>
        <button onClick={handleClear} className="text-gray-400 hover:text-white shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="cursor-pointer rounded-lg border border-dashed border-triq-light/30 hover:border-triq-cyan/50 p-3 flex items-center justify-center gap-2 transition-colors"
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="text-triq-cyan animate-spin" />
            <span className="text-xs text-gray-400">Uploading...</span>
          </>
        ) : (
          <>
            <Upload size={16} className="text-gray-400" />
            <span className="text-xs text-gray-400">{label}</span>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
