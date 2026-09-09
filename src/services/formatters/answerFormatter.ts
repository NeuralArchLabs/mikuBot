/**
 * Performs lossless structural normalization before rich-content rendering.
 *
 * This layer must never infer intent from the response. Tool transport,
 * provider reasoning, historical migrations, and visual rendering each have
 * their own explicit boundaries elsewhere in the application.
 */
export function formatFinalResponse(rawText: unknown): string {
    if (rawText === undefined || rawText === null || rawText === '') return '';

    const text = typeof rawText === 'string'
        ? rawText
        : JSON.stringify(rawText, null, 2);

    return text
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .trim();
}
