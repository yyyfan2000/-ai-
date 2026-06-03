import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PetApp.css';

type PetState = 'idle' | 'hover' | 'thinking' | 'done' | 'sleep' | 'walk';

export default function PetApp() {
  const [petState, setPetState] = useState<PetState>('idle');
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);
  const [speechText, setSpeechText] = useState('');

  const petStateRef = useRef<PetState>('idle');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStateRef = useRef<PetState>('idle');

  // Keep ref in sync with state so callbacks always read the latest value
  useEffect(() => {
    petStateRef.current = petState;
  }, [petState]);

  // ---------------------------------------------------------------------------
  // Timer helpers
  // ---------------------------------------------------------------------------

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
  }, []);

  // Start (or restart) the idle → walk countdown (30 s)
  const resetIdleTimer = useCallback(() => {
    clearTimers();

    idleTimerRef.current = setTimeout(() => {
      if (petStateRef.current === 'idle') {
        setPetState('walk');
      }
    }, 30_000);
  }, [clearTimers]);

  // Return to idle state, clear any bubble, and restart the idle countdown
  const goToIdle = useCallback(() => {
    clearTimers();
    setShowSpeechBubble(false);
    setSpeechText('');
    setPetState('idle');
  }, [clearTimers]);

  // ---------------------------------------------------------------------------
  // Interaction handler – resets idle timer & wakes from sleep / walk
  // ---------------------------------------------------------------------------

  const handleInteraction = useCallback(() => {
    const current = petStateRef.current;

    if (current === 'sleep' || current === 'walk') {
      goToIdle();
      return;
    }

    if (current === 'done') {
      // Just dismiss the bubble; the 3-s done timer continues running
      setShowSpeechBubble(false);
      return;
    }

    if (current === 'idle') {
      // Any touch during idle restarts the 30-s walk countdown
      resetIdleTimer();
    }
  }, [goToIdle, resetIdleTimer]);

  // ---------------------------------------------------------------------------
  // Mouse / click handlers
  // ---------------------------------------------------------------------------

  const handleMouseEnter = useCallback(() => {
    const current = petStateRef.current;

    if (current === 'sleep' || current === 'walk') {
      clearTimers();
      setShowSpeechBubble(false);
      setSpeechText('');
      savedStateRef.current = 'idle';
      setPetState('hover');
      return;
    }

    if (current === 'idle') {
      clearTimers();
      savedStateRef.current = 'idle';
      setPetState('hover');
      return;
    }

    // thinking | done – acknowledge but stay in current state
    handleInteraction();
  }, [clearTimers, handleInteraction]);

  const handleMouseLeave = useCallback(() => {
    if (petStateRef.current === 'hover') {
      setPetState(savedStateRef.current);
    }
  }, []);

  const handleClick = useCallback(() => {
    window.electronAPI?.openChatWindow?.();
    handleInteraction();
  }, [handleInteraction]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      window.electronAPI?.showPetContextMenu?.();
      handleInteraction();
    },
    [handleInteraction],
  );

  // ---------------------------------------------------------------------------
  // Listen for main-process state changes (AI thinking / done)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onPetStateChange?.((state: string) => {
      switch (state) {
        case 'thinking':
          clearTimers();
          setShowSpeechBubble(false);
          setPetState('thinking');
          break;

        case 'done':
          clearTimers();
          setShowSpeechBubble(true);
          setSpeechText('回复好啦～');
          setPetState('done');
          doneTimerRef.current = setTimeout(() => {
            goToIdle();
          }, 3_000);
          break;

        default:
          break;
      }
    });

    return () => {
      unsubscribe?.();
      clearTimers();
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
      }
    };
  }, [clearTimers, goToIdle]);

  // ---------------------------------------------------------------------------
  // Side-effects driven by state transitions
  // ---------------------------------------------------------------------------

  // Entering idle → restart the walk countdown
  useEffect(() => {
    if (petState === 'idle') {
      resetIdleTimer();
    }
  }, [petState, resetIdleTimer]);

  // Entering walk → arm the sleep countdown (90 s = total 2 min from idle start)
  useEffect(() => {
    if (petState === 'walk') {
      idleTimerRef.current = setTimeout(() => {
        if (petStateRef.current === 'walk') {
          setShowSpeechBubble(true);
          setSpeechText('💤');
          setPetState('sleep');
        }
      }, 90_000);
    }
  }, [petState]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const getAnimationClass = (): string => {
    switch (petState) {
      case 'idle':
        return 'pet-breathe';
      case 'hover':
        return 'pet-look-up';
      case 'thinking':
        return 'pet-think';
      case 'done':
        return 'pet-bounce';
      case 'sleep':
        return 'pet-snooze';
      case 'walk':
        return 'pet-walk';
      default:
        return '';
    }
  };

  return (
    <div className="pet-container">
      {showSpeechBubble && <div className="speech-bubble">{speechText}</div>}

      <div
        className={`pet-character ${getAnimationClass()}`}
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
