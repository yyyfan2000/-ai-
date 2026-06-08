import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

let chatWindow: BrowserWindow | null = null;
let topTimer: ReturnType<typeof setTimeout> | null = null;

function setVisibleEverywhere(win: BrowserWindow): void {
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  }
}

function positionNearPet(win: BrowserWindow): void {
  const petWin = BrowserWindow.getAllWindows().find((candidate) => {
    const url = candidate.webContents.getURL();
    return !candidate.isDestroyed() && url.includes('window=pet');
  });
  if (!petWin || petWin.isDestroyed()) return;

  const petBounds = petWin.getBounds();
  const display = screen.getDisplayMatching(petBounds);
  const workArea = display.workArea;
  const [chatWidth, chatHeight] = win.getSize();
  const gap = 12;

  const preferredX = petBounds.x - chatWidth - gap;
  const fallbackX = petBounds.x + petBounds.width + gap;
  const x = preferredX >= workArea.x
    ? preferredX
    : Math.min(fallbackX, workArea.x + workArea.width - chatWidth);
  const y = Math.min(
    Math.max(petBounds.y - 40, workArea.y),
    workArea.y + workArea.height - chatHeight
  );

  win.setPosition(Math.round(x), Math.round(y), false);
}

function bringChatWindowToFront(win: BrowserWindow): void {
  setVisibleEverywhere(win);
  positionNearPet(win);

  if (win.isMinimized()) win.restore();

  if (process.platform === 'darwin') {
    if (topTimer) clearTimeout(topTimer);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.showInactive();
    win.moveTop();
    topTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.setAlwaysOnTop(false);
      }
    }, 160);
  } else {
    win.show();
    win.moveTop();
    win.focus();
  }
}

function lowerChatWindow(win: BrowserWindow): void {
  if (topTimer) {
    clearTimeout(topTimer);
    topTimer = null;
  }
  if (!win.isDestroyed()) win.setAlwaysOnTop(false);
}

export function createChatWindow(): BrowserWindow {
  if (chatWindow && !chatWindow.isDestroyed()) {
    bringChatWindowToFront(chatWindow);
    return chatWindow;
  }

  chatWindow = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 340,
    minHeight: 400,
    title: '小灵 · AI助手',
    titleBarStyle: 'hiddenInset',
    type: process.platform === 'darwin' ? 'panel' : undefined,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  setVisibleEverywhere(chatWindow);

  if (process.env.NODE_ENV === 'development') {
    chatWindow.loadURL('http://localhost:5173?window=chat');
  } else {
    chatWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'chat' },
    });
  }

  chatWindow.once('ready-to-show', () => {
    if (chatWindow && !chatWindow.isDestroyed()) bringChatWindowToFront(chatWindow);
  });
  chatWindow.on('blur', () => {
    if (chatWindow && !chatWindow.isDestroyed()) lowerChatWindow(chatWindow);
  });
  chatWindow.on('focus', () => {
    if (chatWindow && !chatWindow.isDestroyed()) lowerChatWindow(chatWindow);
  });
  chatWindow.on('closed', () => { chatWindow = null; });
  return chatWindow;
}

export function getChatWindow(): BrowserWindow | null {
  return chatWindow && !chatWindow.isDestroyed() ? chatWindow : null;
}

export function showChatWindow(): BrowserWindow {
  const win = createChatWindow();
  bringChatWindowToFront(win);
  return win;
}

export function closeChatWindow(): void {
  chatWindow?.close();
  chatWindow = null;
}
