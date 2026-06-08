import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

let petWindow: BrowserWindow | null = null;

export function createPetWindow(): BrowserWindow {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.focus();
    petWindow.showInactive();
    petWindow.moveTop();
    return petWindow;
  }

  const { workArea } = screen.getPrimaryDisplay();
  const width = 100;
  const height = 120;

  petWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 30,
    y: workArea.y + 260,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    show: true,
    skipTaskbar: true,
    type: 'panel',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.NODE_ENV === 'development') {
    petWindow.loadURL('http://localhost:5173?window=pet');
  } else {
    petWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'pet' },
    });
  }

  petWindow.on('closed', () => { petWindow = null; });
  petWindow.webContents.on('did-fail-load', (_event, _errorCode, errorDescription) => {
    console.error(`pet did-fail-load: ${errorDescription}`);
  });
  petWindow.once('ready-to-show', () => {
    if (!petWindow || petWindow.isDestroyed()) return;
    petWindow.showInactive();
    petWindow.moveTop();
  });

  return petWindow;
}

export function getPetWindow(): BrowserWindow | null {
  return petWindow && !petWindow.isDestroyed() ? petWindow : null;
}

export function hidePetWindow(): void {
  petWindow?.hide();
}

export function showPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.showInactive();
    petWindow.moveTop();
  } else {
    createPetWindow();
  }
}

export function closePetWindow(): void {
  petWindow?.close();
  petWindow = null;
}
