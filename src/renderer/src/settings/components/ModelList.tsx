import React from 'react';
import { ModelConfig } from '../../types/model';
import { getModelCapabilityLabels } from '../../shared/modelCapabilities';

interface Props {
  models: ModelConfig[];
  onDelete: (id: string) => void;
}

export default function ModelList({ models, onDelete }: Props) {
  if (models.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        还没有配置模型，请添加第一个模型
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {models.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="text-green-500 flex-shrink-0">✓</span>
          <span className="flex-1 text-sm text-gray-700 truncate">{m.displayName}</span>
          <span className="flex items-center gap-1 flex-shrink-0">
            {getModelCapabilityLabels(m).slice(0, 3).map((label) => (
              <span key={label.text} className={`rounded px-1.5 py-0.5 text-[10px] leading-4 ${label.className}`}>
                {label.text}
              </span>
            ))}
          </span>
          <button
            onClick={() => onDelete(m.id)}
            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors text-sm ml-1"
            title="删除模型"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}
