export interface ModelCapabilities {
  text: boolean;
  image: boolean;
  file: boolean;
  search: boolean;
}

export interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  capabilities: ModelCapabilities;
}

export interface ProviderPreset {
  key: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  defaultCapabilities: ModelCapabilities;
}
