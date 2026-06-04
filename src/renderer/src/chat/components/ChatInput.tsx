import React, { useRef, useCallback, useState, KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';

export interface UploadedFile {
  name: string;
  dataUrl: string;
  type: 'image' | 'file';
  /** 文本文件内容（用于发送给 AI 解读） */
  textContent?: string;
}

interface Props {
  onSend: (content: string, files?: UploadedFile[]) => void;
  disabled: boolean;
  supportsImage?: boolean;
  supportsFile?: boolean;
  searchEnabled?: boolean;
  onSearchToggle?: (enabled: boolean) => void;
}

const ACCEPT_TEXT_TYPES = [
  'text/', 'application/json', 'application/xml', 'text/xml',
  'application/javascript', 'application/typescript',
  'text/csv', 'text/markdown', 'text/x-python',
  'text/x-java', 'text/x-c', 'text/x-c++',
];

function isTextFile(file: File): boolean {
  return ACCEPT_TEXT_TYPES.some(t => file.type.startsWith(t)) ||
    /\.(txt|md|json|xml|csv|yml|yaml|py|js|ts|jsx|tsx|java|c|cpp|h|hpp|rs|go|rb|php|sql|sh|bash|zsh|log|env|cfg|ini|toml)$/i.test(file.name);
}

export default function ChatInput({
  onSend, disabled, supportsImage = false, supportsFile = false,
  searchEnabled = false, onSearchToggle,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const showUpload = supportsImage || supportsFile;

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content && files.length === 0) return;
    if (!content) return;

    onSend(content, files.length > 0 ? files : undefined);
    setInput('');
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, files, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 80), 160) + 'px';
  };

  // Paste image support
  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = () => {
          setFiles(prev => [...prev, {
            name: `paste-${Date.now()}.png`,
            dataUrl: reader.result as string,
            type: 'image',
          }]);
        };
        reader.readAsDataURL(blob);
      }
    }
  }, []);

  // File selection
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    Array.from(selected).forEach(file => {
      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');
      const isReadableText = isTextFile(file);

      reader.onload = () => {
        const dataUrl = reader.result as string;
        const fileObj: UploadedFile = {
          name: file.name,
          dataUrl,
          type: isImage ? 'image' : 'file',
        };
        // 读取文本文件内容用于 AI 解读
        if (isReadableText && !isImage) {
          fileObj.textContent = dataUrl.includes('base64,')
            ? atob(dataUrl.split('base64,')[1])
            : dataUrl;
        }
        setFiles(prev => [...prev, fileObj]);
      };

      if (isReadableText && !isImage) {
        reader.readAsText(file);
      } else if (isImage) {
        reader.readAsDataURL(file);
      } else {
        // 二进制文件（PDF 等）→ base64
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const acceptTypes = [
    supportsImage ? 'image/*' : '',
    supportsFile ? '.pdf,.doc,.docx,.txt,.csv,.json,.xml,.md,.yml,.yaml,.py,.js,.ts,.go,.rs,.rb,.java,.c,.cpp,.h,.hpp,.sql,.sh,.bash,.zsh,.log,.env,.ini,.toml' : '',
  ].filter(Boolean).join(',');

  return (
    <div className="border-t border-gray-200 bg-white px-3 pt-2 pb-3">
      {/* File preview chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-100 rounded-lg pl-1.5 pr-1 py-0.5 text-xs text-gray-600 max-w-[180px] group">
              {f.type === 'image' ? (
                <img src={f.dataUrl} alt={f.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
              ) : (
                <span className="text-sm flex-shrink-0">{f.textContent ? '📝' : '📄'}</span>
              )}
              <span className="truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={showUpload ? '输入问题，或直接粘贴图片...' : '输入你的问题...'}
        disabled={disabled}
        rows={1}
        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ minHeight: '80px', maxHeight: '160px' }}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between mt-2">
        {/* Left: Upload + Search */}
        <div className="flex items-center gap-1">
          {showUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-fox-orange hover:bg-orange-50 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="上传文件/图片"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept={acceptTypes} multiple onChange={handleFileSelect} className="hidden" />

          {onSearchToggle && (
            <button
              onClick={() => onSearchToggle(!searchEnabled)}
              disabled={disabled}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                searchEnabled
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
              }`}
              title={searchEnabled ? '已开启联网搜索' : '联网搜索'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
              {searchEnabled && '搜索中'}
            </button>
          )}
        </div>

        {/* Right: Send button */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 hidden sm:block">Enter 发送 · Shift+Enter 换行</span>
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-fox-orange text-white flex items-center justify-center hover:bg-fox-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="发送"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5,3 19,12 5,21 5,14 13,12 5,10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
