import React, { useState, useEffect, useCallback } from 'react';
import './SettingsApp.css';
import ModelForm from './components/ModelForm';
import ModelList from './components/ModelList';
import { ModelConfig } from '../types/model';

export default function SettingsApp() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [defaultModelId, setDefaultModelId] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Load settings from main process on mount
  useEffect(() => {
    async function load() {
      try {
        const savedModels = await window.electronAPI?.getModels();
        if (savedModels) {
          setModels(savedModels);
        }
        const defId = await window.electronAPI?.getDefaultModel();
        if (defId) {
          setDefaultModelId(defId);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
    load();
  }, []);

  // Auto-hide saved feedback toast after 2 seconds
  useEffect(() => {
    if (!savedFeedback) return;
    const timer = setTimeout(() => setSavedFeedback(false), 2000);
    return () => clearTimeout(timer);
  }, [savedFeedback]);

  // Add a new model from the form
  const handleAddModel = useCallback(
    (model: ModelConfig | ModelConfig[]) => {
      const incomingModels = Array.isArray(model) ? model : [model];
      setModels((prev) => {
        const existingKeys = new Set(prev.map((m) => `${m.provider}|${m.baseUrl}|${m.modelId}`));
        const freshModels = incomingModels.filter((m) => {
          const key = `${m.provider}|${m.baseUrl}|${m.modelId}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });
        const updated = [...prev, ...freshModels];
        // If this is the first model, auto-select it as default
        if (prev.length === 0 && updated.length > 0) {
          setDefaultModelId(updated[0].id);
        }
        return updated;
      });
    },
    []
  );

  // Delete a model by ID
  const handleDeleteModel = useCallback(
    (id: string) => {
      const newModels = models.filter((m) => m.id !== id);
      setModels(newModels);
      if (defaultModelId === id) {
        setDefaultModelId(newModels.length > 0 ? newModels[0].id : '');
      }
    },
    [models, defaultModelId]
  );

  // Save all models and default model via IPC
  const handleSave = useCallback(async () => {
    try {
      await window.electronAPI?.saveModels(models);
      if (defaultModelId) {
        await window.electronAPI?.saveDefaultModel(defaultModelId);
      }
      setSavedFeedback(true);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [models, defaultModelId]);

  // Close the settings window
  const handleClose = useCallback(() => {
    try {
      window.close();
    } catch {
      // fallback
    }
  }, []);

  // Reset the add-model form
  const handleFormCancel = useCallback(() => {
    setFormKey((k) => k + 1);
  }, []);

  const selectClass =
    'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-fox-orange focus:ring-1 focus:ring-fox-orange';

  return (
    <div className="settings-window">
      {/* Title Bar */}
      <header className="settings-titlebar flex items-center pl-[76px] pr-5 py-3 border-b border-gray-200 bg-white flex-shrink-0 select-none">
        <h2 className="text-sm font-semibold text-gray-800">⚙️ 设置</h2>
      </header>

      {/* Scrollable Content */}
      <div className="settings-content px-5 py-4 space-y-5">
        {/* Saved feedback toast */}
        {savedFeedback && (
          <div className="settings-saved-toast flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            ✓ 已保存
          </div>
        )}

        {/* Section: Model Configuration */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🤖 模型配置</h3>
          <div className="space-y-3">
            <ModelForm
              key={formKey}
              onSave={handleAddModel}
              onCancel={handleFormCancel}
            />
            <ModelList models={models} onDelete={handleDeleteModel} />
          </div>
        </section>

        {/* Section: Chat Settings (only when models exist) */}
        {models.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">💬 对话设置</h3>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                默认模型
              </label>
              <select
                value={defaultModelId}
                onChange={(e) => setDefaultModelId(e.target.value)}
                className={selectClass}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="settings-bottom-bar flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-white">
        <button
          onClick={handleClose}
          className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-sm rounded-lg bg-fox-orange text-white hover:bg-fox-dark transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}
