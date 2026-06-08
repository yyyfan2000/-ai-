import { create } from 'zustand';
import { ModelConfig } from '../types/model';

interface ModelState {
  models: ModelConfig[];
  currentModelId: string;
  setModels: (models: ModelConfig[]) => void;
  setCurrentModelId: (id: string) => void;
  getCurrentModel: () => ModelConfig | undefined;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  currentModelId: '',

  setModels: (models) => set({ models }),

  setCurrentModelId: (id) => set({ currentModelId: id }),

  getCurrentModel: () => {
    const { models, currentModelId } = get();
    return models.find((m) => m.id === currentModelId) || models[0];
  },
}));
