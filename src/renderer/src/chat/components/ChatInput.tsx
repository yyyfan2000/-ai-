import React, { useRef, useCallback, useState, DragEvent, KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';

export interface UploadedFile {
  name: string;
  dataUrl: string;
  type: 'image' | 'file';
  textContent?: string;
  parseError?: string;
}

interface Props {
  onSend: (content: string, files?: UploadedFile[]) => void;
  disabled: boolean;
  supportsImage?: boolean;
  supportsFile?: boolean;
  supportsSearch?: boolean;
  searchEnabled?: boolean;
  onSearchToggle?: (enabled: boolean) => void;
}

const ACCEPT_TEXT_TYPES = [
  'text/', 'application/json', 'application/xml', 'text/xml',
  'application/javascript', 'application/typescript',
  'text/csv', 'text/markdown', 'text/x-python',
  'text/x-java', 'text/x-c', 'text/x-c++',
];

const MAX_ATTACHMENT_TEXT = 60_000;

function isTextFile(file: File): boolean {
  return ACCEPT_TEXT_TYPES.some(t => file.type.startsWith(t)) ||
    /\.(txt|md|json|xml|csv|yml|yaml|py|js|ts|jsx|tsx|java|c|cpp|h|hpp|rs|go|rb|php|sql|sh|bash|zsh|log|env|cfg|ini|toml)$/i.test(file.name);
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function isDocxFile(file: File): boolean {
  return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name);
}

function truncateAttachmentText(text: string): string {
  if (text.length <= MAX_ATTACHMENT_TEXT) return text;
  return text.slice(0, MAX_ATTACHMENT_TEXT) + `\n\n[内容过长，已截断前 ${MAX_ATTACHMENT_TEXT} 字符]`;
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsArrayBuffer(file);
  });
}

async function inflateData(data: Uint8Array, format: string): Promise<Uint8Array> {
  const StreamCtor = (globalThis as any).DecompressionStream;
  if (!StreamCtor) throw new Error('当前环境不支持压缩文档解码');

  const payload = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([payload]).stream().pipeThrough(new StreamCtor(format));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;

  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('无法读取 docx 目录');

  const centralDirOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const targetEntries = ['word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml'];
  const xmlParts: string[] = [];
  let offset = centralDirOffset;

  while (offset + 46 <= bytes.length && view.getUint32(offset, true) === 0x02014b50) {
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    if (targetEntries.includes(fileName) && view.getUint32(localHeaderOffset, true) === 0x04034b50) {
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      const fileBytes = method === 0 ? compressed : await inflateData(compressed, 'deflate-raw');
      xmlParts.push(decoder.decode(fileBytes));
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  const xml = xmlParts.join('\n');
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [xml];
  const text = paragraphs
    .map((paragraph) => paragraph
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>/g, '\n')
      .match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
      ?.map((part) => decodeXmlText(part.replace(/<[^>]+>/g, '')))
      .join('') || '')
    .filter(Boolean)
    .join('\n');

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\d{1,3}/g, ' ')
    .trim();
}

function extractPdfTextFromStream(text: string): string {
  const results: string[] = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const arrayRegex = /\[((?:\s*(?:\((?:\\.|[^\\)])*\)|-?\d+(?:\.\d+)?)\s*)+)\]\s*TJ/g;
  let match;

  while ((match = literalRegex.exec(text)) !== null) {
    results.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, '').slice(1)));
  }

  while ((match = arrayRegex.exec(text)) !== null) {
    const parts = match[1].match(/\((?:\\.|[^\\)])*\)/g) || [];
    const line = parts.map((part) => decodePdfLiteral(part.slice(1, -1))).join('');
    if (line) results.push(line);
  }

  return results.join('\n');
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(bytes);
  const results: string[] = [extractPdfTextFromStream(raw)];
  const streamRegex = /stream\r?\n/g;
  let match;

  while ((match = streamRegex.exec(raw)) !== null && results.join('').length < MAX_ATTACHMENT_TEXT) {
    const streamStart = match.index + match[0].length;
    const streamEnd = raw.indexOf('endstream', streamStart);
    if (streamEnd < 0) break;

    const header = raw.slice(Math.max(0, match.index - 500), match.index);
    const streamBytes = bytes.slice(streamStart, streamEnd);
    try {
      const decoded = header.includes('/FlateDecode')
        ? await inflateData(streamBytes, 'deflate')
        : streamBytes;
      results.push(extractPdfTextFromStream(decoder.decode(decoded)));
    } catch {
      // Keep best-effort text from other streams.
    }
  }

  return results.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 压缩图片：限制长边 1024px，质量 0.7，最大输出约 5MB */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
          'image/jpeg',
          0.7
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

export default function ChatInput({
  onSend, disabled, supportsImage = false, supportsFile = false,
  supportsSearch = false, searchEnabled = false, onSearchToggle,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const showUpload = supportsImage || supportsFile;

  const processFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isReadable = isTextFile(file);

    if (isImage && file.size > 5 * 1024 * 1024) {
      // 压缩大图
      try {
        const blob = await compressImage(file);
        const dataUrl = await readFileAsDataUrl(blob);
        setFiles(prev => [...prev, { name: file.name, dataUrl, type: 'image' }]);
      } catch {
        const dataUrl = await readFileAsDataUrl(file);
        setFiles(prev => [...prev, { name: file.name, dataUrl, type: 'image' }]);
      }
      return;
    }

    if (isImage) {
      const dataUrl = await readFileAsDataUrl(file);
      setFiles(prev => [...prev, { name: file.name, dataUrl, type: 'image' }]);
      return;
    }

    try {
      let textContent = '';
      if (isReadable) {
        textContent = await readFileAsText(file);
      } else if (isPdfFile(file)) {
        textContent = await extractPdfText(await readFileAsArrayBuffer(file));
      } else if (isDocxFile(file)) {
        textContent = await extractDocxText(await readFileAsArrayBuffer(file));
      }

      if (textContent.trim()) {
        setFiles(prev => [...prev, {
          name: file.name,
          dataUrl: '',
          type: 'file',
          textContent: truncateAttachmentText(textContent.trim()),
        }]);
        return;
      }

      setFiles(prev => [...prev, {
        name: file.name,
        dataUrl: '',
        type: 'file',
        parseError: '未能从该文档提取文本',
      }]);
    } catch {
      setFiles(prev => [...prev, {
        name: file.name,
        dataUrl: '',
        type: 'file',
        parseError: '文档解析失败',
      }]);
    }
  }, []);

  const handleSend = useCallback(() => {
    const content = input.trim() || '请分析这些附件。';
    if (!input.trim() && files.length === 0) return;
    onSend(content, files.length > 0 ? files : undefined);
    setInput('');
    setFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, files, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 80), 160) + 'px';
  };

  // Paste images
  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) processFile(new File([blob], `paste-${Date.now()}.png`, { type: blob.type }));
      }
    }
  }, [processFile]);

  // File select
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(processFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFile]);

  // Drag-drop
  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent) => { e.preventDefault(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!e.dataTransfer?.files) return;
    Array.from(e.dataTransfer.files).forEach(processFile);
  }, [processFile]);

  const removeFile = useCallback((index: number) => setFiles(prev => prev.filter((_, i) => i !== index)), []);

  const acceptTypes = [
    supportsImage ? 'image/*' : '',
    supportsFile ? '.pdf,.docx,.txt,.csv,.json,.xml,.md,.yml,.yaml,.py,.js,.ts,.go,.rs,.rb,.java,.c,.cpp,.h,.hpp,.sql,.sh,.bash,.zsh,.log,.env,.ini,.toml' : '',
  ].filter(Boolean).join(',');

  return (
    <div
      className={`border-t border-gray-200 bg-white px-3 pt-2 pb-3 transition-colors ${dragOver ? 'bg-orange-50 border-fox-orange' : ''}`}
      onDragOver={showUpload ? handleDragOver : undefined}
      onDragLeave={showUpload ? handleDragLeave : undefined}
      onDrop={showUpload ? handleDrop : undefined}
    >
      {/* File previews */}
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
              {f.parseError && <span className="text-red-400 flex-shrink-0" title={f.parseError}>!</span>}
              <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Drag overlay hint */}
      {dragOver && (
        <div className="text-center text-xs text-fox-orange mb-2">松开以添加文件</div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={showUpload ? '输入问题，或拖拽/粘贴图片和文件...' : '输入你的问题...'}
        disabled={disabled}
        rows={1}
        className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ minHeight: '80px', maxHeight: '160px' }}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between mt-2">
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

          {supportsSearch && onSearchToggle && (
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
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
              {searchEnabled ? '已开启' : '联网搜索'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 hidden sm:block">Enter 发送 · Shift+Enter 换行</span>
          <button
            onClick={handleSend}
            disabled={disabled || (!input.trim() && files.length === 0)}
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
