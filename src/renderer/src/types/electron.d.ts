interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  capabilities: { text: boolean; image: boolean; file: boolean };
}

interface ElectronAPI {
  openChatWindow: () => void;
  openSettingsWindow: () => void;
  showPetContextMenu: () => void;
  movePetWindow: (dx: number, dy: number) => void;

  setPetState: (state: string) => void;
  onPetStateChange: (callback: (state: string) => void) => () => void;

  getModels: () => Promise<ModelConfig[]>;
  getDefaultModel: () => Promise<string>;
  sendChatMessage: (args: { modelId: string; messages: Array<{ role: string; content: any }>; enableSearch?: boolean }) => void;

  onSearchStatus: (callback: (status: string) => void) => () => void;
  onStreamChunk: (callback: (text: string) => void) => () => void;
  onStreamDone: (callback: () => void) => () => void;
  onStreamError: (callback: (err: { code: string; message: string }) => void) => () => void;

  saveModels: (models: ModelConfig[]) => Promise<{ success: boolean }>;
  saveDefaultModel: (modelId: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
