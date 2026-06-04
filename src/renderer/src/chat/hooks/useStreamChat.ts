import { useEffect, useCallback } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useModelStore } from '../../stores/modelStore';
import type { ChatMessage } from '../../types/chat';
import type { UploadedFile } from '../components/ChatInput';

export function useStreamChat() {
  const addMessage = useChatStore((s) => s.addMessage);
  const setStatus = useChatStore((s) => s.setStatus);
  const setError = useChatStore((s) => s.setError);
  const appendStreamChunk = useChatStore((s) => s.appendStreamChunk);
  const finalizeStream = useChatStore((s) => s.finalizeStream);
  const getCurrentModel = useModelStore((s) => s.getCurrentModel);

  // Set up IPC stream listeners on mount, clean up on unmount
  useEffect(() => {
    const unsubChunk = window.electronAPI?.onStreamChunk((text: string) => {
      setStatus('streaming');
      appendStreamChunk(text);
    });

    const unsubDone = window.electronAPI?.onStreamDone(() => {
      finalizeStream();
      window.electronAPI?.setPetState('idle');
    });

    const unsubError = window.electronAPI?.onStreamError(
      (err: { code: string; message: string }) => {
        setError(err);
        window.electronAPI?.setPetState('idle');
      }
    );

    return () => {
      unsubChunk?.();
      unsubDone?.();
      unsubError?.();
    };
  }, [appendStreamChunk, finalizeStream, setError, setStatus]);

  const sendMessage = useCallback(
    (content: string, files?: UploadedFile[], enableSearch?: boolean) => {
      if (!content.trim()) return;

      // Validate model
      const model = getCurrentModel();
      if (!model) {
        setError({ code: 'no_model', message: '未找到指定模型，请检查设置' });
        return;
      }
      if (!model.apiKey) {
        setError({
          code: 'no_api_key',
          message: '请先在设置中配置 API Key',
        });
        return;
      }

      // Build message content (supports multimodal)
      let messageContent: any = content.trim();

      if (files && files.length > 0) {
        const parts: any[] = [{ type: 'text', text: content.trim() }];

        files.forEach((f) => {
          if (f.type === 'image') {
            parts.push({
              type: 'image_url',
              image_url: { url: f.dataUrl },
            });
          } else {
            parts.push({
              type: 'file',
              file: { filename: f.name, data: f.dataUrl },
            });
          }
        });

        messageContent = parts;
      }

      // Build user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent),
        timestamp: Date.now(),
      };

      // Get current messages before adding the new one
      const currentMessages = useChatStore.getState().messages;

      // Add message and set state
      addMessage(userMsg);
      setStatus('thinking');
      window.electronAPI?.setPetState('thinking');

      // Build message list for API (user + assistant)
      const apiMessages: Array<{ role: string; content: any }> = [...currentMessages]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          // Try to parse content that might be JSON (multimodal)
          try {
            const parsed = JSON.parse(m.content);
            if (Array.isArray(parsed)) return { role: m.role, content: parsed };
          } catch { /* keep as string */ }
          return { role: m.role, content: m.content };
        });

      // Add the new message (with proper multimodal format)
      apiMessages.push({
        role: 'user',
        content: typeof messageContent === 'string' ? messageContent : messageContent,
      });

      window.electronAPI?.sendChatMessage({
        modelId: model.id,
        messages: apiMessages,
        enableSearch,
      });
    },
    [addMessage, getCurrentModel, setError, setStatus]
  );

  return { sendMessage };
}
