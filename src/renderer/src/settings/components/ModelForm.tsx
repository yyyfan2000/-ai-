import React, { useState, useCallback } from 'react';
import { PROVIDER_PRESETS } from '../../shared/providers';
import { ModelConfig, ModelCapabilities } from '../../types/model';
import ProviderSelect from './ProviderSelect';

interface Props {
  onSave: (model: ModelConfig) => void;
  onCancel: () => void;
}

function generateId(): string {
  return 'model_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

const defaultCaps: ModelCapabilities = { text: true, image: false, file: false, search: false };

export default function ModelForm({ onSave, onCancel }: Props) {
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [capabilities, setCapabilities] = useState<ModelCapabilities>({ ...defaultCaps });
  const [showApiKey, setShowApiKey] = useState(false);

  const preset = PROVIDER_PRESETS.find((p) => p.key === provider);
  const isCustom = provider === 'custom';

  const handleProviderChange = useCallback((key: string) => {
    setProvider(key);
    const selected = PROVIDER_PRESETS.find((p) => p.key === key);
    if (!selected) return;

    if (key === 'custom') {
      setModel('');
      setDisplayName('');
      setBaseUrl('');
      setCapabilities({ ...defaultCaps });
    } else {
      setModel(selected.defaultModel);
      setDisplayName(`${selected.name}-${selected.defaultModel}`);
      setBaseUrl(selected.baseUrl);
      setCapabilities({ ...selected.defaultCapabilities });
    }
  }, []);

  const handleModelChange = useCallback(
    (value: string) => {
      setModel(value);
      if (preset && !isCustom) {
        setDisplayName(`${preset.name}-${value}`);
      }
    },
    [preset, isCustom]
  );

  const handleCapToggle = useCallback((key: keyof ModelCapabilities) => {
    if (key === 'text') return; // text is always enabled
    setCapabilities((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!provider || !model.trim() || !displayName.trim() || !apiKey.trim() || !baseUrl.trim()) {
      return;
    }
    onSave({
      id: generateId(),
      provider,
      modelId: model.trim(),
      displayName: displayName.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      capabilities,
    });
  }, [provider, model, displayName, apiKey, baseUrl, capabilities, onSave]);

  const isFormValid =
    provider && model.trim() && displayName.trim() && apiKey.trim() && baseUrl.trim();

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {/* Provider */}
      <div>
        <label className={labelClass}>提供商</label>
        <ProviderSelect value={provider} onChange={handleProviderChange} />
      </div>

      {/* Model */}
      <div>
        <label className={labelClass}>模型</label>
        {isCustom ? (
          <input
            type="text"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            placeholder="输入模型 ID，如 gpt-4o"
            className={inputClass}
          />
        ) : (
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={!preset || preset.models.length === 0}
            className={inputClass + ' disabled:opacity-50 disabled:cursor-not-allowed'}
          >
            <option value="">选择模型</option>
            {preset?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Display Name */}
      <div>
        <label className={labelClass}>显示名称</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="输入显示名称"
          className={inputClass}
        />
      </div>

      {/* API Key */}
      <div>
        <label className={labelClass}>API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-xxxxxxxxxxxxxxxx"
            className={inputClass + ' pr-10'}
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            title={showApiKey ? '隐藏' : '显示'}
          >
            {showApiKey ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className={labelClass}>Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className={inputClass}
        />
      </div>

      {/* Capabilities */}
      <div>
        <label className={labelClass}>能力</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={capabilities.text}
              disabled
              className="accent-fox-orange"
            />
            <span>📝 文本</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={capabilities.image}
              onChange={() => handleCapToggle('image')}
              className="accent-fox-orange"
            />
            <span>🖼️ 图片</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={capabilities.file}
              onChange={() => handleCapToggle('file')}
              className="accent-fox-orange"
            />
            <span>📎 文件</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={capabilities.search}
              onChange={() => handleCapToggle('search')}
              className="accent-fox-orange"
            />
            <span>🌐 联网搜索</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="px-4 py-1.5 text-sm rounded-lg bg-fox-orange text-white hover:bg-fox-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          添加模型
        </button>
      </div>
    </div>
  );
}
