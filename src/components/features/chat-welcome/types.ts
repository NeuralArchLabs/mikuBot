export type SuggestionIconName =
    | 'learn'
    | 'research'
    | 'news'
    | 'organize'
    | 'ideas'
    | 'analyze'
    | 'plan'
    | 'widget'
    | 'food'
    | 'schedule'
    | 'repair'
    | 'workflow'
    | 'emotions'
    | 'personal'
    | 'something'
    | 'decision'
    | 'conversation'
    | 'idea'
    | 'goal'
    | 'question';

export type WelcomeInputMode = 'cursor' | 'replace-suffix' | 'send';

export interface WelcomeSuggestion {
    icon: SuggestionIconName;
    labels: readonly string[];
    prompt: string;
    inputMode: WelcomeInputMode;
}

export interface VisibleWelcomeSuggestion extends WelcomeSuggestion {
    label: string;
}

export interface ChatWelcomeProps {
    hasCustomBg?: boolean;
    userName?: string;
    onSuggestion: (text: string, cursorPosition: number, selectionEnd?: number) => void;
    onInstantSuggestion: (text: string) => void;
}
