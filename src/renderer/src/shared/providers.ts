import { ProviderPreset } from '../types/model';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultCapabilities: { text: true, image: false, file: false, search: true },
  },
  {
    key: 'doubao',
    name: '豆包 (火山引擎)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-vision-pro-32k'],
    defaultCapabilities: { text: true, image: true, file: true, search: false },
  },
  {
    key: 'qwen',
    name: '千问 (通义)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-max', 'qwen-vl-plus', 'qwen-vl-max'],
    defaultCapabilities: { text: true, image: true, file: false, search: false },
  },
  {
    key: 'zhipu',
    name: '智谱清言 (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4',
    models: ['glm-4', 'glm-4v', 'glm-4-flash'],
    defaultCapabilities: { text: true, image: true, file: false, search: true },
  },
  {
    key: 'kimi',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultCapabilities: { text: true, image: false, file: false, search: true },
  },
  {
    key: 'custom',
    name: '自定义',
    baseUrl: '',
    defaultModel: '',
    models: [],
    defaultCapabilities: { text: true, image: false, file: false, search: false },
  },
];
