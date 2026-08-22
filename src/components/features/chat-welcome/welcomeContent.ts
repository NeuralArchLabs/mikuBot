import { VisibleWelcomeSuggestion, WelcomeSuggestion } from './types';

export const MESSAGE_KEYS = [
    'chat.welcome.messages.one',
    'chat.welcome.messages.two',
    'chat.welcome.messages.three',
    'chat.welcome.messages.four',
    'chat.welcome.messages.five'
] as const;

export const GREETING_KEYS = [
    'chat.welcome.greetings.one',
    'chat.welcome.greetings.two',
    'chat.welcome.greetings.three',
    'chat.welcome.greetings.four',
    'chat.welcome.greetings.five',
    'chat.welcome.greetings.six',
    'chat.welcome.greetings.seven'
] as const;

export const SUGGESTIONS: readonly WelcomeSuggestion[] = [
    { icon: 'learn', labels: ['chat.welcome.suggestions.learn.label', 'chat.welcome.suggestions.learn.label_alt'], prompt: 'chat.welcome.suggestions.learn.prompt', inputMode: 'cursor' },
    { icon: 'research', labels: ['chat.welcome.suggestions.research.label', 'chat.welcome.suggestions.research.label_alt'], prompt: 'chat.welcome.suggestions.research.prompt', inputMode: 'cursor' },
    { icon: 'news', labels: ['chat.welcome.suggestions.news.label', 'chat.welcome.suggestions.news.label_alt'], prompt: 'chat.welcome.suggestions.news.prompt', inputMode: 'cursor' },
    { icon: 'organize', labels: ['chat.welcome.suggestions.organize.label', 'chat.welcome.suggestions.organize.label_alt'], prompt: 'chat.welcome.suggestions.organize.prompt', inputMode: 'cursor' },
    { icon: 'ideas', labels: ['chat.welcome.suggestions.ideas.label', 'chat.welcome.suggestions.ideas.label_alt'], prompt: 'chat.welcome.suggestions.ideas.prompt', inputMode: 'cursor' },
    { icon: 'analyze', labels: ['chat.welcome.suggestions.analyze.label', 'chat.welcome.suggestions.analyze.label_alt'], prompt: 'chat.welcome.suggestions.analyze.prompt', inputMode: 'cursor' },
    { icon: 'plan', labels: ['chat.welcome.suggestions.plan.label', 'chat.welcome.suggestions.plan.label_alt'], prompt: 'chat.welcome.suggestions.plan.prompt', inputMode: 'replace-suffix' },
    { icon: 'widget', labels: ['chat.welcome.suggestions.widget.label', 'chat.welcome.suggestions.widget.label_alt'], prompt: 'chat.welcome.suggestions.widget.prompt', inputMode: 'replace-suffix' },
    { icon: 'food', labels: ['chat.welcome.suggestions.food.label', 'chat.welcome.suggestions.food.label_alt'], prompt: 'chat.welcome.suggestions.food.prompt', inputMode: 'replace-suffix' },
    { icon: 'schedule', labels: ['chat.welcome.suggestions.schedule.label', 'chat.welcome.suggestions.schedule.label_alt'], prompt: 'chat.welcome.suggestions.schedule.prompt', inputMode: 'replace-suffix' },
    { icon: 'repair', labels: ['chat.welcome.suggestions.repair.label', 'chat.welcome.suggestions.repair.label_alt'], prompt: 'chat.welcome.suggestions.repair.prompt', inputMode: 'replace-suffix' },
    { icon: 'workflow', labels: ['chat.welcome.suggestions.workflow.label', 'chat.welcome.suggestions.workflow.label_alt'], prompt: 'chat.welcome.suggestions.workflow.prompt', inputMode: 'replace-suffix' },
    { icon: 'emotions', labels: ['chat.welcome.suggestions.emotions.label', 'chat.welcome.suggestions.emotions.label_alt'], prompt: 'chat.welcome.suggestions.emotions.prompt', inputMode: 'replace-suffix' },
    { icon: 'personal', labels: ['chat.welcome.suggestions.personal.label', 'chat.welcome.suggestions.personal.label_alt'], prompt: 'chat.welcome.suggestions.personal.prompt', inputMode: 'replace-suffix' },
    { icon: 'something', labels: ['chat.welcome.suggestions.something.label', 'chat.welcome.suggestions.something.label_alt'], prompt: 'chat.welcome.suggestions.something.prompt', inputMode: 'send' },
    { icon: 'decision', labels: ['chat.welcome.suggestions.decision.label', 'chat.welcome.suggestions.decision.label_alt'], prompt: 'chat.welcome.suggestions.decision.prompt', inputMode: 'send' },
    { icon: 'conversation', labels: ['chat.welcome.suggestions.conversation.label', 'chat.welcome.suggestions.conversation.label_alt'], prompt: 'chat.welcome.suggestions.conversation.prompt', inputMode: 'send' },
    { icon: 'idea', labels: ['chat.welcome.suggestions.idea.label', 'chat.welcome.suggestions.idea.label_alt'], prompt: 'chat.welcome.suggestions.idea.prompt', inputMode: 'send' },
    { icon: 'goal', labels: ['chat.welcome.suggestions.goal.label', 'chat.welcome.suggestions.goal.label_alt'], prompt: 'chat.welcome.suggestions.goal.prompt', inputMode: 'send' },
    { icon: 'question', labels: ['chat.welcome.suggestions.question.label', 'chat.welcome.suggestions.question.label_alt'], prompt: 'chat.welcome.suggestions.question.prompt', inputMode: 'send' }
];

const randomItem = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] ?? items[0];

export const createWelcomeContent = (): {
    greetingKey: string;
    suggestions: VisibleWelcomeSuggestion[];
} => {
    const shuffled = [...SUGGESTIONS];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return {
        greetingKey: randomItem(GREETING_KEYS),
        suggestions: shuffled.slice(0, 5).map((suggestion) => ({
            ...suggestion,
            label: randomItem(suggestion.labels)
        }))
    };
};
