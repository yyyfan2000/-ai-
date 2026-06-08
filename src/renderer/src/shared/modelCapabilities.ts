import { ModelConfig } from '../types/model';

export interface ModelCapabilityLabel {
  text: string;
  className: string;
}

export function getModelCapabilityLabels(model: Pick<ModelConfig, 'modelId' | 'provider'>): ModelCapabilityLabel[] {
  const id = model.modelId.toLowerCase();
  const labels: ModelCapabilityLabel[] = [];

  if (id.includes('omni')) {
    labels.push({ text: '全模态', className: 'bg-violet-100 text-violet-700' });
  } else if (id.includes('-vl') || id.includes('vision') || id.includes('4v')) {
    labels.push({ text: '视觉', className: 'bg-sky-100 text-sky-700' });
  } else if (id.includes('image')) {
    labels.push({ text: id.includes('edit') ? '图片编辑' : '图片', className: 'bg-pink-100 text-pink-700' });
  } else {
    labels.push({ text: '文本', className: 'bg-gray-100 text-gray-600' });
  }

  if (id.includes('realtime') || id.includes('livetranslate')) {
    labels.push({ text: '实时', className: 'bg-emerald-100 text-emerald-700' });
  }

  if (model.provider === 'qwen' || id.includes('search')) {
    labels.push({ text: '联网', className: 'bg-blue-100 text-blue-700' });
  }

  return labels;
}

export function getModelCapabilitySummary(model: Pick<ModelConfig, 'modelId' | 'provider'>): string {
  return getModelCapabilityLabels(model).map((label) => label.text).join(' · ');
}
