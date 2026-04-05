import { useState, useEffect, useRef, useCallback } from 'react';
import { MIKU_FACE } from '../../utils/easterEgg';

const FINAL_MESSAGE = 'System Ready. Context Loaded.';
const SIGNATURE = `{{ ${MIKU_FACE} }}`;
const TYPE_SPEED = 70;        // ms per character typing
const DELETE_SPEED = 40;      // ms per character deleting
const PAUSE_AFTER_SIG = 2000; // ms to hold signature before deleting
const PAUSE_AFTER_DEL = 400;  // ms pause after deleting before typing final
const IDLE_INTERVAL = 45000;  // ms before replaying animation (45s)

type Phase = 'typing-sig' | 'holding-sig' | 'deleting-sig' | 'pause' | 'typing-final' | 'idle';

export const TypewriterIdle = () => {
    const [displayText, setDisplayText] = useState('');
    const [phase, setPhase] = useState<Phase>('typing-sig');
    const charIndex = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Animation state machine
    useEffect(() => {
        clearTimer();

        switch (phase) {
            case 'typing-sig': {
                if (charIndex.current < SIGNATURE.length) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current++;
                        setDisplayText(SIGNATURE.slice(0, charIndex.current));
                    }, TYPE_SPEED);
                } else {
                    setPhase('holding-sig');
                }
                break;
            }
            case 'holding-sig': {
                timerRef.current = setTimeout(() => {
                    charIndex.current = SIGNATURE.length;
                    setPhase('deleting-sig');
                }, PAUSE_AFTER_SIG);
                break;
            }
            case 'deleting-sig': {
                if (charIndex.current > 0) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current--;
                        setDisplayText(SIGNATURE.slice(0, charIndex.current));
                    }, DELETE_SPEED);
                } else {
                    setPhase('pause');
                }
                break;
            }
            case 'pause': {
                timerRef.current = setTimeout(() => {
                    charIndex.current = 0;
                    setPhase('typing-final');
                }, PAUSE_AFTER_DEL);
                break;
            }
            case 'typing-final': {
                if (charIndex.current < FINAL_MESSAGE.length) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current++;
                        setDisplayText(FINAL_MESSAGE.slice(0, charIndex.current));
                    }, TYPE_SPEED);
                } else {
                    setPhase('idle');
                }
                break;
            }
            case 'idle': {
                // Wait a long time, then replay
                timerRef.current = setTimeout(() => {
                    charIndex.current = 0;
                    setDisplayText('');
                    setPhase('typing-sig');
                }, IDLE_INTERVAL);
                break;
            }
        }

        return clearTimer;
    }, [phase, displayText, clearTimer]);

    return (
        <div className="flex items-center justify-center min-h-[24px]">
            <span className="font-mono text-[16px] inline-flex items-center">
                <span className="text-blue-500/25">{displayText}</span>
                <span className={`typewriter-cursor ${phase === 'idle' ? 'no-blink' : ''}`} />
            </span>
        </div>
    );
};
