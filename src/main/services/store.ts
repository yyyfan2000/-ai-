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

export function getModels(): ModelConfig[] {
  const models = store.get('models', []);
  return models.map(m => ({
    ...m,
    apiKey: decryptApiKey(m.apiKey),
    capabilities: {
      text: m.capabilities?.text ?? true,
      image: m.capabilities?.image ?? false,
      file: m.capabilities?.file ?? false,
      search: m.capabilities?.search ?? false,
    },
  }));
}

export function saveModels(models: ModelConfig[]): void {
  const encrypted = models.map(m => ({ ...m, apiKey: encryptApiKey(m.apiKey) }));
  store.set('models', encrypted);
}

export function getDefaultModel(): string { return store.get('defaultModel', ''); }
export function saveDefaultModel(modelId: string): void { store.set('defaultModel', modelId); }
export function getPetName(): string { return store.get('petName', '小灵'); }
export function savePetName(name: string): void { store.set('petName', name); }
