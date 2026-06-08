import React, { useEffect, useRef, useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { getModelCapabilityLabels, getModelCapabilitySummary } from '../../shared/modelCapabilities';

function CapabilityBadges({ model, compact = false }: { model: { provider: string; modelId: string }; compact?: boolean }) {
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      {getModelCapabilityLabels(model).slice(0, compact ? 2 : 3).map((label) => (
        <span key={label.text} className={`rounded px-1.5 py-0.5 text-[10px] leading-4 ${label.className}`}>
          {label.text}
        </span>
      ))}
    </span>
  );
}

export default function ModelSwitcher() {
  const models = useModelStore((s) => s.models);
  const currentModelId = useModelStore((s) => s.currentModelId);
  const setCurrentModelId = useModelStore((s) => s.setCurrentModelId);
  const selectedModelId = models.some((m) => m.id === currentModelId)
    ? currentModelId
    : models[0]?.id || '';
  const selectedModel = models.find((m) => m.id === selectedModelId);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (models.length === 0) {
    return (
      <button
        onClick={() => window.electronAPI?.openSettingsWindow()}
        className="flex items-center gap-1 px-3 py-1.5 text-xs text-fox-orange border border-fox-orange rounded-lg hover:bg-fox-cream transition-colors"
      >
        <span>⚙️</span>
        <span>配置模型</span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 min-w-[260px] max-w-[520px] items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-left text-xs text-gray-700 hover:border-fox-orange focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange"
        title={selectedModel ? `${selectedModel.displayName || selectedModel.modelId} · ${getModelCapabilitySummary(selectedModel)}` : '选择模型'}
      >
        <span className="min-w-0 flex-1 truncate">{selectedModel?.displayName || selectedModel?.modelId || '选择模型'}</span>
        {selectedModel && <CapabilityBadges model={selectedModel} compact />}
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="absolute left-0 bottom-11 z-20 max-h-[360px] w-[min(720px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
          {models.map((m) => {
            const active = m.id === selectedModelId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setCurrentModelId(m.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-orange-50 text-fox-dark' : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={`${m.modelId} · ${getModelCapabilitySummary(m)}`}
              >
                <span className="w-4 flex-shrink-0 text-fox-orange">{active ? '✓' : ''}</span>
                <span className="min-w-0 flex-1 truncate">{m.displayName || m.modelId}</span>
                <CapabilityBadges model={m} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
