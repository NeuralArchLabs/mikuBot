import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InstantSuggestionIcon, SuggestionIcon } from './SuggestionIcon';
import { TypewriterIdle } from './TypewriterIdle';
import { createWelcomeContent, MESSAGE_KEYS } from './welcomeContent';
import { ChatWelcomeProps, VisibleWelcomeSuggestion } from './types';

export const ChatWelcome = ({ hasCustomBg, userName, onSuggestion, onInstantSuggestion }: ChatWelcomeProps) => {
    const { t } = useTranslation();
    const displayName = userName?.trim() || t('common.user');
    const [{ greetingKey, suggestions: visibleSuggestions }] = useState(createWelcomeContent);
    const [suggestionsReady, setSuggestionsReady] = useState(false);
    const [suggestionsRendered, setSuggestionsRendered] = useState(false);
    const handleMessageReady = useCallback(() => setSuggestionsReady(true), []);
    const handleSuggestionsRendered = useCallback(() => setSuggestionsRendered(true), []);
    const greetingNameMarker = '__MIKU_WELCOME_NAME__';
    const greeting = t(greetingKey, { name: greetingNameMarker });
    const markerIndex = greeting.indexOf(greetingNameMarker);
    const greetingBeforeName = markerIndex >= 0 ? greeting.slice(0, markerIndex) : greeting;
    const greetingAfterName = markerIndex >= 0 ? greeting.slice(markerIndex + greetingNameMarker.length) : '';

    const renderSuggestion = ({ icon, label, prompt, inputMode }: VisibleWelcomeSuggestion, index: number) => {
        const suggestion = t(prompt);
        const colonIndex = suggestion.indexOf(':');
        const fullWidthColonIndex = suggestion.indexOf('：');
        const delimiterIndex = colonIndex >= 0 ? colonIndex : fullWidthColonIndex;
        const cursorPosition = delimiterIndex >= 0
            ? delimiterIndex + (colonIndex >= 0 ? 2 : 1)
            : suggestion.length;

        return (
            <button
                key={label}
                type="button"
                onClick={() => {
                    if (inputMode === 'send') {
                        onInstantSuggestion(suggestion);
                        return;
                    }
                    onSuggestion(suggestion, cursorPosition, inputMode === 'replace-suffix' ? suggestion.length : undefined);
                }}
                onAnimationEnd={() => {
                    if (suggestionsReady && index === visibleSuggestions.length - 1) {
                        handleSuggestionsRendered();
                    }
                }}
                style={suggestionsReady ? { animationDelay: `${250 + index * 180}ms` } : undefined}
                className={`${suggestionsReady ? 'welcome-suggestion-enter' : 'pointer-events-none opacity-0'} group min-h-[44px] max-w-full rounded-2xl px-4 py-2.5 text-xs font-bold leading-tight backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-0 hover:-translate-y-0.5 active:translate-y-0 ${hasCustomBg
                    ? 'bg-slate-800/90 text-white shadow-[0_4px_18px_rgba(0,0,0,0.35)] hover:bg-slate-700/95'
                    : 'bg-slate-800/90 text-blue-100 shadow-[0_6px_20px_rgba(15,23,42,0.42)] hover:bg-slate-700/95'
                    }`}
            >
                <span className="inline-flex items-center justify-center gap-2">
                    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                        <span className={inputMode === 'send' ? 'transition-opacity duration-200 group-hover:opacity-0' : undefined}>
                            <SuggestionIcon name={icon} />
                        </span>
                        {inputMode === 'send' && (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                <InstantSuggestionIcon />
                            </span>
                        )}
                    </span>
                    <span>{t(label)}</span>
                </span>
            </button>
        );
    };

    return (
        <div className={`relative top-20 flex w-full flex-col items-center justify-center text-center ${hasCustomBg ? 'mix-blend-difference' : ''}`}>
            <div className="relative top-5 flex flex-col items-center">
                <div className={`relative mb-5 rounded-full ${hasCustomBg ? 'shadow-[0_0_60px_rgba(0,0,0,0.85)]' : 'shadow-[0_12px_42px_rgba(37,99,235,0.28)]'}`}>
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-400/50 via-indigo-500/20 to-transparent blur-md" />
                    <img
                        src="./mikuBotICON.png"
                        alt="MikuBot"
                        className="relative h-20 w-20 rounded-full border-2 border-blue-300/30 object-cover brightness-110 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
                    />
                </div>

                <div className="mt-0 flex min-h-[58px] w-full max-w-3xl items-center justify-center overflow-visible text-center">
                    <TypewriterIdle
                        hasCustomBg={hasCustomBg}
                        messageKeys={MESSAGE_KEYS}
                        greetingBeforeName={greetingBeforeName}
                        greetingName={displayName}
                        greetingAfterName={greetingAfterName}
                        onMessageReady={handleMessageReady}
                        startMessageExit={suggestionsRendered}
                    />
                </div>
            </div>

            <div className="pointer-events-auto mt-8 flex w-full max-w-3xl flex-col gap-y-5">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
                    {visibleSuggestions.slice(0, 3).map((suggestion, index) => renderSuggestion(suggestion, index))}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
                    {visibleSuggestions.slice(3).map((suggestion, index) => renderSuggestion(suggestion, index + 3))}
                </div>
            </div>
        </div>
    );
};
