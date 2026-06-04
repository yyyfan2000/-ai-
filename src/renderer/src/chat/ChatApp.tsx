import React, { useEffect, useCallback, useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useModelStore } from '../stores/modelStore';
import { useStreamChat } from './hooks/useStreamChat';
import MessageList from './components/MessageList';
import ModelSwitcher from './components/ModelSwitcher';
import ChatInput, { UploadedFile } from './components/ChatInput';
import type { ChatError } from '../types/chat';
import './ChatApp.css';
import 'highlight.js/styles/github-dark.css';

function getErrorActionLabel(error: ChatError): string | null {
  switch (error.code) {
    case 'no_model':
    case 'no_api_key':
    case 'auth_failed':
      return '打开设置';
    case 'service_unavailable':
    case 'timeout':
      return '重试';
    default:
      return null;
  }
}

function handleErrorAction(error: ChatError, sendMessage: (content: string, files?: UploadedFile[], enableSearch?: boolean) => void): void {
  switch (error.code) {
    case 'no_model':
    case 'no_api_key':
    case 'auth_failed':
      window.electronAPI?.openSettingsWindow();
      break;
    case 'service_unavailable':
    case 'timeout': {
      const messages = useChatStore.getState().messages;
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        useChatStore.getState().setError(null);
        sendMessage(lastUserMsg.content);
      }
      break;
    }
    default:
      break;
  }
}

export default function ChatApp() {
  const status = useChatStore((s) => s.status);
  const error = useChatStore((s) => s.error);
  const clearError = useChatStore((s) => () => s.setError(null));
  const { sendMessage } = useStreamChat();

  const setModels = useModelStore((s) => s.setModels);
  const setCurrentModelId = useModelStore((s) => s.setCurrentModelId);
  const getCurrentModel = useModelStore((s) => s.getCurrentModel);

  const [searchEnabled, setSearchEnabled] = useState(false);

  const currentModel = getCurrentModel();

  const loadModels = useCallback(async () => {
    try {
      const models = await window.electronAPI?.getModels();
      if (models && models.length > 0) {
        setModels(models);
        const defaultId = await window.electronAPI?.getDefaultModel();
        if (defaultId && models.find((m) => m.id === defaultId)) {
          setCurrentModelId(defaultId);
        } else {
          setCurrentModelId(models[0].id);
        }
      }
    } catch {
      // Silently fail
    }
  }, [setModels, setCurrentModelId]);

  useEffect(() => { loadModels(); }, [loadModels]);

  useEffect(() => {
    const onFocus = () => loadModels();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadModels]);

  const handleSend = useCallback(
    (content: string, files?: UploadedFile[]) => {
      sendMessage(content, files, searchEnabled);
    },
    [sendMessage, searchEnabled]
  );

  const errorActionLabel = error ? getErrorActionLabel(error) : null;

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Title bar */}
      <div className="titlebar flex items-center justify-between pl-[76px] pr-4 py-2 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦊</span>
          <span className="text-sm font-medium text-gray-800">小灵 · AI助手</span>
        </div>
        <button
          onClick={() => window.electronAPI?.openSettingsWindow()}
          className="no-drag w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="设置"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-red-500 text-sm flex-shrink-0">⚠️</span>
              <span className="text-sm text-red-700 truncate">
                {error.message}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {errorActionLabel && (
                <button
                  onClick={() => handleErrorAction(error, sendMessage)}
                  className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                >
                  {errorActionLabel}
                </button>
              )}
              <button
                onClick={clearError}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                title="关闭"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message list */}
      <MessageList />

      {/* Bottom toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
        <ModelSwitcher />
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={status !== 'idle'}
        supportsImage={currentModel?.capabilities?.image ?? false}
        supportsFile={currentModel?.capabilities?.file ?? false}
        searchEnabled={searchEnabled}
        onSearchToggle={setSearchEnabled}
      />
    </div>
  );
}
