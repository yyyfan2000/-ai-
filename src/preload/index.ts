import { contextBridge, ipcRenderer } from 'electron';

// 暴露给 Renderer 的安全 API（各任务会逐步填充）
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  openChatWindow: () => ipcRenderer.send('window:open-chat'),
  openSettingsWindow: () => ipcRenderer.send('window:open-settings'),
  showPetContextMenu: () => ipcRenderer.send('pet:context-menu'),

  // 宠物状态
  setPetState: (state: string) => ipcRenderer.send('pet:set-state', state),
  onPetStateChange: (callback: (state: string) => void) => {
    const handler = (_event: any, state: string) => callback(state);
    ipcRenderer.on('pet:state-changed', handler);
    return () => ipcRenderer.removeListener('pet:state-changed', handler);
  },

  // 对话
  getModels: () => ipcRenderer.invoke('settings:get-models'),
  getDefaultModel: () => ipcRenderer.invoke('settings:get-default-model'),
  sendChatMessage: (args: { modelId: string; messages: Array<{ role: string; content: any }>; enableSearch?: boolean }) =>
    ipcRenderer.send('chat:send-message', args),

  // 联网搜索状态
  onSearchStatus: (callback: (status: string) => void) => {
    const handler = (_event: any, status: string) => callback(status);
    ipcRenderer.on('chat:search-status', handler);
    return () => ipcRenderer.removeListener('chat:search-status', handler);
  },

  // 流式响应
  onStreamChunk: (callback: (text: string) => void) => {
    const handler = (_event: any, text: string) => callback(text);
    ipcRenderer.on('chat:stream-chunk', handler);
    return () => ipcRenderer.removeListener('chat:stream-chunk', handler);
  },
  onStreamDone: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('chat:stream-done', handler);
    return () => ipcRenderer.removeListener('chat:stream-done', handler);
  },
  onStreamError: (callback: (err: { code: string; message: string }) => void) => {
    const handler = (_event: any, err: { code: string; message: string }) => callback(err);
    ipcRenderer.on('chat:stream-error', handler);
    return () => ipcRenderer.removeListener('chat:stream-error', handler);
  },

  // 设置
  saveModels: (models: any[]) => ipcRenderer.invoke('settings:save-models', models),
  saveDefaultModel: (modelId: string) => ipcRenderer.invoke('settings:save-default-model', modelId),
});
