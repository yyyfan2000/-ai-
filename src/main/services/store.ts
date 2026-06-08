import Store from 'electron-store';
import { safeStorage } from 'electron';

interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  capabilities: { text: boolean; image: boolean; file: boolean; search: boolean };
}

interface SettingsSchema {
  models: ModelConfig[];
  defaultModel: string;
  petName: string;
}

const store = new Store<SettingsSchema>({
  name: 'settings',
  cwd: '~/.xiaoling',
  defaults: { models: [], defaultModel: '', petName: '小灵' },
});

function encryptApiKey(plainText: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plainText).toString('base64');
  }
  return Buffer.from(plainText).toString('base64');
}

function decryptApiKey(encrypted: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  }
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

function inferCapabilities(model: ModelConfig): ModelConfig['capabilities'] {
  const lower = model.modelId.toLowerCase();
  const supportsImage =
    lower.includes('omni') ||
    lower.includes('vision') ||
    lower.includes('image') ||
    lower.includes('-vl') ||
    lower.includes('4v') ||
    lower.includes('gpt-4o') ||
    lower.includes('gpt-4.1') ||
    (model.provider === 'doubao' && lower.includes('vision')) ||
    (model.provider === 'qwen' && lower.includes('-vl')) ||
    (model.provider === 'zhipu' && lower.includes('4v'));

  return {
    text: true,
    image: supportsImage,
    file: true,
    search: true,
  };
}

export function getModels(): ModelConfig[] {
  const models = store.get('models', []);
  return models.map(m => ({
    ...m,
    apiKey: decryptApiKey(m.apiKey),
    capabilities: inferCapabilities(m),
  }));
}

export function saveModels(models: ModelConfig[]): void {
  const encrypted = models.map(m => ({
    ...m,
    capabilities: inferCapabilities(m),
    apiKey: encryptApiKey(m.apiKey),
  }));
  store.set('models', encrypted);
}

export function getDefaultModel(): string { return store.get('defaultModel', ''); }
export function saveDefaultModel(modelId: string): void { store.set('defaultModel', modelId); }
export function getPetName(): string { return store.get('petName', '小灵'); }
export function savePetName(name: string): void { store.set('petName', name); }
