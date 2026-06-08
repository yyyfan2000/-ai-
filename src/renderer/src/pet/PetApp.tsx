import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PetApp.css';

type PetState = 'idle' | 'hover' | 'thinking' | 'done' | 'sleep' | 'walk';

const DRAG_THRESHOLD = 3;

export default function PetApp() {
  const [petState, setPetState] = useState<PetState>('idle');
  const [showSpeechBubble, setShowSpeechBubble] = useState(true);
  const [speechText, setSpeechText] = useState('我在这里');

  const petStateRef = useRef<PetState>('idle');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStateRef = useRef<PetState>('idle');

  // --- Drag state ---
  const dragRef = useRef({ active: false, startX: 0, startY: 0, moved: false });

  useEffect(() => {
    petStateRef.current = petState;
  }, [petState]);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearTimers();
    idleTimerRef.current = setTimeout(() => {
      if (petStateRef.current === 'idle') setPetState('walk');
    }, 30_000);
  }, [clearTimers]);

  const goToIdle = useCallback(() => {
    clearTimers();
    setShowSpeechBubble(false);
    setSpeechText('');
    setPetState('idle');
  }, [clearTimers]);

  const handleInteraction = useCallback(() => {
    const current = petStateRef.current;
    if (current === 'sleep' || current === 'walk') { goToIdle(); return; }
    if (current === 'done') { setShowSpeechBubble(false); return; }
    if (current === 'idle') resetIdleTimer();
  }, [goToIdle, resetIdleTimer]);

  // --- Drag handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { active: true, startX: e.screenX, startY: e.screenY, moved: false };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.screenX - dragRef.current.startX;
      const dy = e.screenY - dragRef.current.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragRef.current.moved = true;
        window.electronAPI?.movePetWindow(dx, dy);
        dragRef.current.startX = e.screenX;
        dragRef.current.startY = e.screenY;
      }
    };

    const handleMouseUp = () => {
      dragRef.current.active = false;
      if (dragRef.current.moved) {
        dragRef.current.moved = false;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Click (only if not a drag) ---
  const handleClick = useCallback(() => {
    if (dragRef.current.moved) return;
    window.electronAPI?.openChatWindow?.();
    handleInteraction();
  }, [handleInteraction]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.showPetContextMenu?.();
    handleInteraction();
  }, [handleInteraction]);

  const handleMouseEnter = useCallback(() => {
    const current = petStateRef.current;
    if (current === 'sleep' || current === 'walk') {
      clearTimers(); setShowSpeechBubble(false); setSpeechText('');
      savedStateRef.current = 'idle'; setPetState('hover'); return;
    }
    if (current === 'idle') {
      clearTimers(); savedStateRef.current = 'idle'; setPetState('hover'); return;
    }
    handleInteraction();
  }, [clearTimers, handleInteraction]);

  const handleMouseLeave = useCallback(() => {
    if (petStateRef.current === 'hover') setPetState(savedStateRef.current);
  }, []);

  // --- IPC: thinking / done ---
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onPetStateChange?.((state: string) => {
      if (state === 'thinking') {
        clearTimers(); setShowSpeechBubble(false); setPetState('thinking');
      } else if (state === 'done') {
        clearTimers(); setShowSpeechBubble(true); setSpeechText('回复好啦～');
        setPetState('done');
        doneTimerRef.current = setTimeout(() => goToIdle(), 3_000);
      }
    });
    return () => { unsubscribe?.(); clearTimers(); };
  }, [clearTimers, goToIdle]);

  // --- Side effects ---
  useEffect(() => {
    if (petState === 'idle') resetIdleTimer();
  }, [petState, resetIdleTimer]);

  useEffect(() => {
    if (petState === 'walk') {
      idleTimerRef.current = setTimeout(() => {
        if (petStateRef.current === 'walk') {
          setShowSpeechBubble(true); setSpeechText('💤'); setPetState('sleep');
        }
      }, 90_000);
    }
  }, [petState]);

  const getAnimationClass = (): string => {
    switch (petState) {
      case 'idle': return 'pet-breathe';
      case 'hover': return 'pet-look-up';
      case 'thinking': return 'pet-think';
      case 'done': return 'pet-bounce';
      case 'sleep': return 'pet-snooze';
      case 'walk': return 'pet-walk';
      default: return '';
    }
  };

  return (
    <div className="pet-container">
      {showSpeechBubble && <div className="speech-bubble">{speechText}</div>}
      <div
        className={`pet-character ${getAnimationClass()}`}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseMove={handleInteraction}
      >
        🦊
      </div>
    </div>
  );
}
