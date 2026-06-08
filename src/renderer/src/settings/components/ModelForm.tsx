import React, { useState, useCallback } from 'react';
import { PROVIDER_PRESETS } from '../../shared/providers';
import { ModelConfig } from '../../types/model';
import ProviderSelect from './ProviderSelect';

interface Props {
  onSave: (model: ModelConfig | ModelConfig[]) => void;
  onCancel: () => void;
}

function generateId(): string {
  return 'model_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

function inferCapabilities(provider: string, modelId: string): ModelConfig['capabilities'] {
  const lower = modelId.toLowerCase();
  const supportsImage =
    lower.includes('omni') ||
    lower.includes('vision') ||
    lower.includes('image') ||
    lower.includes('-vl') ||
    lower.includes('4v') ||
    lower.includes('gpt-4o') ||
    lower.includes('gpt-4.1') ||
    (provider === 'doubao' && lower.includes('vision')) ||
    (provider === 'qwen' && lower.includes('-vl')) ||
    (provider === 'zhipu' && lower.includes('4v'));

  return {
    text: true,
    image: supportsImage,
    file: true,
    search: true,
  };
}

export default function ModelForm({ onSave, onCancel }: Props) {
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncedModels, setSyncedModels] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'fallback' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const preset = PROVIDER_PRESETS.find((p) => p.key === provider);
  const isCustom = provider === 'custom';
  const modelOptions = syncedModels.length > 0 ? syncedModels : preset?.models || [];

  const handleProviderChange = useCallback((key: string) => {
    setProvider(key);
    setSyncedModels([]);
    setSyncStatus('idle');
    setSyncMessage('');
    const selected = PROVIDER_PRESETS.find((p) => p.key === key);
    if (!selected) return;

    if (key === 'custom') {
      setModel('');
      setDisplayName('');
      setBaseUrl('');
    } else {
      setModel(selected.defaultModel);
      setDisplayName(`${selected.name}-${selected.defaultModel}`);
      setBaseUrl(selected.baseUrl);
    }
  }, []);

  const handleModelChange = useCallback(
    (value: string) => {
      setModel(value);
      if (preset && !isCustom) {
        setDisplayName(`${preset.name}-${value}`);
      }
    },
    [preset, isCustom, provider]
  );

  const buildModelConfig = useCallback((modelId: string): ModelConfig => {
    return {
      id: generateId(),
      provider,
      modelId,
      displayName: preset && !isCustom ? `${preset.name}-${modelId}` : displayName.trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      capabilities: inferCapabilities(provider, modelId),
    };
  }, [apiKey, baseUrl, displayName, isCustom, preset, provider]);

  const handleSyncModels = useCallback(async () => {
    if (!provider || !apiKey.trim() || !baseUrl.trim()) return;

    setSyncStatus('loading');
    setSyncMessage('');
    try {
      const result = await window.electronAPI?.listProviderModels({
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
      });
      const models = result?.models || [];
      setSyncedModels(models);
      if (models.length > 0) {
        const nextModel = models.includes(model) ? model : models[0];
        handleModelChange(nextModel);
        setSyncStatus(result?.source === 'api' ? 'success' : 'fallback');
        setSyncMessage(result?.source === 'api'
          ? `已同步 ${models.length} 个模型`
          : `接口不可用，已使用内置列表 ${models.length} 个模型`);
      } else {
        setSyncStatus('error');
        setSyncMessage(result?.error || '没有获取到可用模型');
      }
    } catch (err: any) {
      setSyncedModels([]);
      setSyncStatus('error');
      setSyncMessage(err.message || '同步失败');
    }
  }, [apiKey, baseUrl, handleModelChange, model, provider]);

  const handleSubmit = useCallback(() => {
    if (!provider || !model.trim() || !displayName.trim() || !apiKey.trim() || !baseUrl.trim()) {
      return;
    }
    onSave(buildModelConfig(model.trim()));
  }, [provider, model, displayName, apiKey, baseUrl, buildModelConfig, onSave]);

  const handleAddSyncedModels = useCallback(() => {
    if (!provider || syncedModels.length === 0 || !apiKey.trim() || !baseUrl.trim()) return;
    onSave(syncedModels.map(buildModelConfig));
  }, [apiKey, baseUrl, buildModelConfig, onSave, provider, syncedModels]);

  const isFormValid =
    provider && model.trim() && displayName.trim() && apiKey.trim() && baseUrl.trim();
  const canSync = Boolean(provider && !isCustom && apiKey.trim() && baseUrl.trim() && syncStatus !== 'loading');

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
            disabled={!preset || modelOptions.length === 0}
            className={inputClass + ' disabled:opacity-50 disabled:cursor-not-allowed'}
          >
            <option value="">选择模型</option>
            {modelOptions.map((m) => (
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

      {!isCustom && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncModels}
            disabled={!canSync}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:text-fox-orange hover:border-fox-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncStatus === 'loading' ? '同步中...' : '同步模型'}
          </button>
          {syncMessage && (
            <span className={`text-xs ${
              syncStatus === 'error' ? 'text-red-500' :
                syncStatus === 'fallback' ? 'text-amber-600' : 'text-green-600'
            }`}>
              {syncMessage}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          取消
        </button>
        {syncedModels.length > 1 && (
          <button
            type="button"
            onClick={handleAddSyncedModels}
            className="px-4 py-1.5 text-sm rounded-lg border border-fox-orange text-fox-orange hover:bg-orange-50 transition-colors"
          >
            添加全部
          </button>
        )}
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
