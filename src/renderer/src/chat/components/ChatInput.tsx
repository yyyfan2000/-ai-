import React, { useRef, useCallback, useState, KeyboardEvent, ChangeEvent } from 'react';

export interface UploadedFile {
  name: string;
  dataUrl: string;     // base64 data URL
  type: 'image' | 'file';
}

interface Props {
  onSend: (content: string, files?: UploadedFile[]) => void;
  disabled: boolean;
  /** 当前模型是否支持图片 */
  supportsImage?: boolean;
  /** 当前模型是否支持文件 */
  supportsFile?: boolean;
  /** 联网搜索开关 */
  searchEnabled?: boolean;
  onSearchToggle?: (enabled: boolean) => void;
}

export default function ChatInput({
  onSend,
  disabled,
  supportsImage = false,
  supportsFile = false,
  searchEnabled = false,
  onSearchToggle,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const showUpload = supportsImage || supportsFile;

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const handleSend = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const content = el.value.trim();
    if (!content && files.length === 0) return;
    if (!content) return;

    onSend(content, files.length > 0 ? files : undefined);
    el.value = '';
    el.style.height = 'auto';
    setFiles([]);
  }, [onSend, files]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const isImage = file.type.startsWith('image/');
        setFiles((prev) => [
          ...prev,
          { name: file.name, dataUrl, type: isImage ? 'image' : 'file' },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-600 max-w-[200px]"
            >
              {f.type === 'image' ? (
                <img src={f.dataUrl} alt={f.name} className="w-6 h-6 rounded object-cover" />
              ) : (
                <span className="text-base">📄</span>
              )}
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-red-500 ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Upload button (only for multimodal models) */}
        {showUpload && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex-shrink-0 w-9 h-9 rounded-full text-gray-400 hover:text-fox-orange hover:bg-orange-50 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`上传${supportsImage ? '图片' : ''}${supportsImage && supportsFile ? '/' : ''}${supportsFile ? '文件' : ''}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={[
                supportsImage ? 'image/*' : '',
                supportsFile ? '.pdf,.doc,.docx,.txt,.csv,.json,.xml,.md' : '',
              ].filter(Boolean).join(',')}
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}

        {/* Search toggle */}
        {onSearchToggle && (
          <button
            onClick={() => onSearchToggle(!searchEnabled)}
            disabled={disabled}
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              searchEnabled
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
            }`}
            title={searchEnabled ? '已开启联网搜索' : '开启联网搜索'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
          </button>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="输入你的问题... (Enter 发送 / Shift+Enter 换行)"
          disabled={disabled}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ maxHeight: '120px' }}
        />

        <button
          onClick={handleSend}
          disabled={disabled}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-fox-orange text-white flex items-center justify-center hover:bg-fox-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="发送 (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5,3 19,12 5,21 5,14 13,12 5,10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
