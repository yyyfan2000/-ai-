import { ipcMain } from 'electron';
import { getModels, saveModels, getDefaultModel, saveDefaultModel, getPetName } from '../services/store';
import { listProviderModels, ListProviderModelsRequest } from '../services/api-client';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get-models', () => getModels());
  ipcMain.handle('settings:save-models', (_event, models) => { saveModels(models); return { success: true }; });
  ipcMain.handle('settings:get-default-model', () => getDefaultModel());
  ipcMain.handle('settings:save-default-model', (_event, modelId: string) => { saveDefaultModel(modelId); return { success: true }; });
  ipcMain.handle('settings:get-pet-name', () => getPetName());
  ipcMain.handle('settings:list-provider-models', (_event, request: ListProviderModelsRequest) => listProviderModels(request));
}
