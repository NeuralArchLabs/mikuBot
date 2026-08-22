import { SuggestionIconName } from './types';

interface SuggestionIconProps {
    name: SuggestionIconName;
}

export const InstantSuggestionIcon = () => (
    <svg
        className="h-3 w-3 shrink-0 text-cyan-200/60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M13 2 4.5 13h6L9 22l8.5-12H11l2-8Z" />
    </svg>
);

export const SuggestionIcon = ({ name }: SuggestionIconProps) => {
    const commonProps = {
        className: 'h-4 w-4 shrink-0',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true
    };

    switch (name) {
        case 'learn':
            return (
                <svg {...commonProps}>
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
                    <path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20" />
                    <path d="M8 7h8M8 11h6" />
                </svg>
            );
        case 'research':
            return (
                <svg {...commonProps}>
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 4.5 4.5M8 10.5h5M10.5 8v5" />
                </svg>
            );
        case 'news':
            return (
                <svg {...commonProps}>
                    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
                    <path d="M8 8h8M8 12h8M8 16h4M4 8h2" />
                </svg>
            );
        case 'organize':
            return (
                <svg {...commonProps}>
                    <path d="M5 6h2M5 12h2M5 18h2M10 6h9M10 12h9M10 18h9" />
                    <path d="m5 6 .7.7L7 5.4M5 12l.7.7L7 11.4M5 18l.7.7L7 17.4" />
                </svg>
            );
        case 'ideas':
            return (
                <svg {...commonProps}>
                    <path d="M9 18h6M10 21h4" />
                    <path d="M15.1 14.5A6 6 0 1 0 8.9 14.5c.7.6 1.1 1.4 1.1 2.5h4c0-1.1.4-1.9 1.1-2.5Z" />
                </svg>
            );
        case 'analyze':
            return (
                <svg {...commonProps}>
                    <path d="M4 19V5M4 19h16" />
                    <path d="m7 15 3-4 3 2 5-6" />
                    <circle cx="7" cy="15" r=".8" fill="currentColor" stroke="none" />
                    <circle cx="10" cy="11" r=".8" fill="currentColor" stroke="none" />
                    <circle cx="13" cy="13" r=".8" fill="currentColor" stroke="none" />
                    <circle cx="18" cy="7" r=".8" fill="currentColor" stroke="none" />
                </svg>
            );
        case 'plan':
            return (
                <svg {...commonProps}>
                    <rect x="5" y="4" width="14" height="16" rx="2" />
                    <path d="M8 8h8M8 12h8M8 16h4" />
                    <path d="M8 4V2.5M16 4V2.5" />
                </svg>
            );
        case 'widget':
            return (
                <svg {...commonProps}>
                    <rect x="4" y="4" width="7" height="7" rx="1.5" />
                    <rect x="13" y="4" width="7" height="7" rx="1.5" />
                    <rect x="4" y="13" width="7" height="7" rx="1.5" />
                    <path d="M13 16.5h7M16.5 13v7" />
                </svg>
            );
        case 'food':
            return (
                <svg {...commonProps}>
                    <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M4 7h6" />
                    <path d="M17 3v18M17 3c2.2 1.1 3 3 3 5.5V12h-3" />
                </svg>
            );
        case 'schedule':
            return (
                <svg {...commonProps}>
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h5" />
                </svg>
            );
        case 'repair':
            return (
                <svg {...commonProps}>
                    <path d="M14.7 6.3a4.5 4.5 0 0 0-5.9 5.9L4 17a2.1 2.1 0 1 0 3 3l4.8-4.8a4.5 4.5 0 0 0 5.9-5.9l-3.1 3.1-2.1-2.1 3.1-3.1a4.5 4.5 0 0 0-.9-.8Z" />
                </svg>
            );
        case 'workflow':
            return (
                <svg {...commonProps}>
                    <rect x="4" y="4" width="5" height="5" rx="1" />
                    <rect x="15" y="15" width="5" height="5" rx="1" />
                    <rect x="15" y="4" width="5" height="5" rx="1" />
                    <path d="M9 6.5h6M17.5 9v6M15 17.5H9a3 3 0 0 1-3-3V9" />
                    <path d="m7 12-1 2 2 1" />
                </svg>
            );
        case 'emotions':
            return (
                <svg {...commonProps}>
                    <path d="M20.8 8.7c0 5.4-8.8 10.3-8.8 10.3S3.2 14.1 3.2 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.3Z" />
                    <path d="M9 10h.01M15 10h.01M9 13.5c1.8 1.2 4.2 1.2 6 0" />
                </svg>
            );
        case 'personal':
            return (
                <svg {...commonProps}>
                    <circle cx="9" cy="8" r="3" />
                    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15 12h4.5A1.5 1.5 0 0 1 21 13.5v3A1.5 1.5 0 0 1 19.5 18H18l-2.5 2v-2H15a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 15 12Z" />
                </svg>
            );
        case 'something':
            return (
                <svg {...commonProps}>
                    <path d="M12 3 3.5 6.5v5c0 4.7 3.6 7.9 8.5 9.5 4.9-1.6 8.5-4.8 8.5-9.5v-5L12 3Z" />
                    <path d="M12 8v4M12 15h.01" />
                </svg>
            );
        case 'decision':
            return (
                <svg {...commonProps}>
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="19" cy="6" r="2" />
                    <circle cx="19" cy="18" r="2" />
                    <path d="m7 12 5-4 5-2M7 12l5 4 5 2" />
                </svg>
            );
        case 'conversation':
            return (
                <svg {...commonProps}>
                    <path d="M18 9a6 6 0 1 0-12 0c0 2.6 1.2 4 2.5 5.4 1.2 1.3 2.2 2.4 2.2 4.2" />
                    <path d="M10.7 18.6a1.7 1.7 0 1 0 3.4 0c0-2.2.8-3.3 1.8-4.5C17 12.8 18 11.4 18 9" />
                    <path d="M9.5 9a2.5 2.5 0 1 1 5 0c0 1.2-.6 2-1.5 2.8-.8.7-1.3 1.4-1.3 2.6" />
                </svg>
            );
        case 'idea':
            return (
                <svg {...commonProps}>
                    <path d="m12 3 .8 2.5L15 6.5l-2.2 1-.8 2.5-.8-2.5-2.2-1 2.2-1L12 3ZM18 12l.6 1.8 1.8.7-1.8.7L18 17l-.6-1.8-1.8-.7 1.8-.7L18 12ZM6 13l.5 1.5L8 15l-1.5.5L6 17l-.5-1.5L4 15l1.5-.5L6 13Z" />
                </svg>
            );
        case 'goal':
            return (
                <svg {...commonProps}>
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                    <path d="m16.5 7.5 3-3M17 4.5h2.5V7" />
                </svg>
            );
        case 'question':
            return (
                <svg {...commonProps}>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M9.8 9.3a2.3 2.3 0 1 1 3.7 1.8c-.9.7-1.5 1.1-1.5 2.4M12 16.5h.01" />
                </svg>
            );
    }
};
