import { create } from 'zustand';
import { ChatMessage, ChatStatus, ChatError } from '../types/chat';

interface ChatState {
  messages: ChatMessage[];
  status: ChatStatus;
  error: ChatError | null;
  streamingContent: string;
  addMessage: (msg: ChatMessage) => void;
  setStatus: (status: ChatStatus) => void;
  setError: (error: ChatError | null) => void;
  appendStreamChunk: (chunk: string) => void;
  finalizeStream: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  status: 'idle',
  error: null,
  streamingContent: '',

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setStatus: (status) => set({ status, error: status !== 'error' ? null : undefined }),

  setError: (error) => set({ status: 'error', error }),

  appendStreamChunk: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),

  finalizeStream: () =>
    set((s) => {
      if (!s.streamingContent.trim()) {
        return {
          streamingContent: '',
          status: 'error',
          error: { code: 'empty_response', message: '当前模型没有返回可显示的文本，请切换模型后重试' },
        };
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: s.streamingContent,
        timestamp: Date.now(),
      };
      return {
        messages: [...s.messages, assistantMsg],
        streamingContent: '',
        status: 'idle',
      };
    }),

  clearMessages: () =>
    set({ messages: [], streamingContent: '', status: 'idle', error: null }),
}));
