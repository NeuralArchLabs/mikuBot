import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { MIKU_FACE } from '../../../utils/easterEgg';

const SIGNATURE = `{{ ${MIKU_FACE} }}`;
const SIGNATURE_EASTER_EGG_CHANCE = 0.2;
const TYPE_SPEED = 42;
const DELETE_SPEED = 40;
const PAUSE_AFTER_SIG = 1000;
const PAUSE_AFTER_DEL = 250;
const MESSAGE_EXIT_DURATION = 320;
const NAME_REVEAL_STAGGER = 42;
const NAME_REVEAL_DURATION = 620;

interface TypewriterIdleProps {
    hasCustomBg?: boolean;
    messageKeys: readonly string[];
    greetingBeforeName: string;
    greetingName: string;
    greetingAfterName: string;
    onMessageReady?: () => void;
    startMessageExit?: boolean;
}

type Phase =
    | 'typing-sig'
    | 'holding-sig'
    | 'deleting-sig'
    | 'pause'
    | 'typing-final'
    | 'holding-final'
    | 'exiting-final'
    | 'pause-before-greeting'
    | 'typing-greeting'
    | 'revealing-greeting-name'
    | 'greeting-idle';

const pickMessageKey = (messageKeys: readonly string[], current?: string) => {
    if (messageKeys.length <= 1) return messageKeys[0] || '';
    const candidates = messageKeys.filter(key => key !== current);
    return candidates[Math.floor(Math.random() * candidates.length)] || messageKeys[0];
};

export const TypewriterIdle = ({
    hasCustomBg,
    messageKeys,
    greetingBeforeName,
    greetingName,
    greetingAfterName,
    onMessageReady,
    startMessageExit = false
}: TypewriterIdleProps) => {
    const { t } = useTranslation();
    const [messageKey, setMessageKey] = useState(() => pickMessageKey(messageKeys));
    const [displayText, setDisplayText] = useState('');
    const [phase, setPhase] = useState<Phase>(() => (
        Math.random() < SIGNATURE_EASTER_EGG_CHANCE ? 'typing-sig' : 'typing-final'
    ));
    const charIndex = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const finalMessage = t(messageKey);
    const greetingText = `${greetingBeforeName}${greetingName}${greetingAfterName}`;
    const greetingCharacters = Array.from(greetingText);
    const greetingNameCharacters = Array.from(greetingName);
    const greetingNameRevealDuration = greetingNameCharacters.length > 0
        ? NAME_REVEAL_DURATION + (greetingNameCharacters.length - 1) * NAME_REVEAL_STAGGER
        : 0;

    useEffect(() => {
        clearTimer();

        switch (phase) {
            case 'typing-sig':
                if (charIndex.current < SIGNATURE.length) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current++;
                        setDisplayText(SIGNATURE.slice(0, charIndex.current));
                    }, TYPE_SPEED);
                } else {
                    setPhase('holding-sig');
                }
                break;
            case 'holding-sig':
                timerRef.current = setTimeout(() => {
                    charIndex.current = SIGNATURE.length;
                    setPhase('deleting-sig');
                }, PAUSE_AFTER_SIG);
                break;
            case 'deleting-sig':
                if (charIndex.current > 0) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current--;
                        setDisplayText(SIGNATURE.slice(0, charIndex.current));
                    }, DELETE_SPEED);
                } else {
                    setPhase('pause');
                }
                break;
            case 'pause':
                timerRef.current = setTimeout(() => {
                    charIndex.current = 0;
                    setPhase('typing-final');
                }, PAUSE_AFTER_DEL);
                break;
            case 'typing-final':
                if (charIndex.current < finalMessage.length) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current++;
                        setDisplayText(finalMessage.slice(0, charIndex.current));
                    }, TYPE_SPEED);
                } else {
                    onMessageReady?.();
                    setPhase('holding-final');
                }
                break;
            case 'holding-final':
                if (startMessageExit) {
                    setPhase('exiting-final');
                }
                break;
            case 'exiting-final':
                timerRef.current = setTimeout(() => {
                    charIndex.current = 0;
                    setDisplayText('');
                    setPhase('pause-before-greeting');
                }, MESSAGE_EXIT_DURATION);
                break;
            case 'pause-before-greeting':
                timerRef.current = setTimeout(() => {
                    charIndex.current = 0;
                    setDisplayText('');
                    setPhase('typing-greeting');
                }, PAUSE_AFTER_DEL);
                break;
            case 'typing-greeting':
                if (charIndex.current < greetingCharacters.length) {
                    timerRef.current = setTimeout(() => {
                        charIndex.current++;
                        setDisplayText(greetingCharacters.slice(0, charIndex.current).join(''));
                    }, TYPE_SPEED);
                } else {
                    setPhase('revealing-greeting-name');
                }
                break;
            case 'revealing-greeting-name':
                timerRef.current = setTimeout(() => {
                    setPhase('greeting-idle');
                }, greetingNameRevealDuration);
                break;
            case 'greeting-idle':
                break;
        }

        return clearTimer;
    }, [phase, displayText, finalMessage, greetingText, greetingNameRevealDuration, messageKeys, clearTimer, onMessageReady, startMessageExit]);

    const isGreeting = phase === 'typing-greeting' || phase === 'revealing-greeting-name' || phase === 'greeting-idle';
    const isGreetingComplete = phase === 'revealing-greeting-name' || phase === 'greeting-idle';
    const isNameReveal = phase === 'revealing-greeting-name';
    const isGreetingCursorVisible = phase === 'typing-greeting';
    const isSignature = phase === 'typing-sig' || phase === 'holding-sig' || phase === 'deleting-sig';
    const isExitingMessage = phase === 'exiting-final';

    const renderTypedText = (className?: string) => {
        const typedCharacters = Array.from(displayText) as string[];
        return (
            <span className={`typewriter-text ${className || ''}`}>
                {typedCharacters.map((character, index) => (
                <span
                    key={`${index}-${character}`}
                    className={`typewriter-char ${/\s/.test(character) ? 'typewriter-char-space' : ''}`}
                >
                    {character}
                </span>
                ))}
            </span>
        );
    };

    return (
        <span className={`inline-flex min-h-[42px] max-w-full items-center justify-center text-2xl font-normal tracking-tight sm:text-3xl ${hasCustomBg ? 'text-white drop-shadow-[0_0_14px_rgba(0,0,0,1)]' : 'text-slate-100'}`}>
            {isGreeting ? (
                isGreetingComplete ? (
                    <span className="welcome-greeting-line">
                        <span>{greetingBeforeName}</span>
                        <span className="welcome-name-slot" aria-label={greetingName}>
                            <span
                                className={`welcome-name-base ${isGreetingComplete ? 'welcome-name-base-fade-out' : ''}`}
                                style={{ '--welcome-name-fade-duration': `${greetingNameRevealDuration}ms` } as CSSProperties}
                            >
                                {greetingName}
                            </span>
                            {isGreetingComplete && (
                                <span className="welcome-name-reveal" aria-hidden="true">
                                    {greetingNameCharacters.map((character, index) => (
                                        <span
                                            key={`${character}-${index}`}
                                            className={`welcome-name-reveal-char ${isNameReveal ? '' : 'welcome-name-reveal-char-final'}`}
                                            style={{
                                                '--welcome-name-delay': `${index * NAME_REVEAL_STAGGER}ms`,
                                                '--welcome-name-glow': ['#60a5fa', '#a78bfa', '#f0abfc'][index % 3]
                                            } as CSSProperties}
                                        >
                                            {character === ' ' ? '\u00A0' : character}
                                        </span>
                                    ))}
                                </span>
                            )}
                        </span>
                        <span>{greetingAfterName}</span>
                    </span>
                ) : (
                    <span>{displayText}</span>
                )
            ) : (
                <span className={`welcome-message-viewport ${isExitingMessage ? 'welcome-message-sink-viewport' : ''}`}>
                    <span className={isExitingMessage ? 'welcome-message-sink' : undefined}>
                        {renderTypedText(isSignature ? 'font-mono text-xl sm:text-2xl' : undefined)}
                    </span>
                </span>
            )}
            {isGreetingCursorVisible && <span className={`typewriter-cursor ${hasCustomBg ? '!bg-white' : ''}`} />}
            {!isGreeting && phase !== 'greeting-idle' && <span className={`typewriter-cursor ${isExitingMessage ? 'no-blink' : ''} ${hasCustomBg ? '!bg-white' : ''}`} />}
        </span>
    );
};
