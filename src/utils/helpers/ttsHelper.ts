import SPANISH_PHONETIC_DICT from '../../../electron/ttsPhoneticDict.json';
import '../../../shared/ttsChunkPlanner.cjs';

type TtsChunkPlannerApi = {
    planTtsChunks: (text: string, lang?: string) => string[];
};

const ttsChunkPlanner = (globalThis as typeof globalThis & {
    __MIKUCENTRAL_TTS_CHUNK_PLANNER__?: TtsChunkPlannerApi;
}).__MIKUCENTRAL_TTS_CHUNK_PLANNER__;

if (!ttsChunkPlanner) {
    throw new Error('Shared TTS chunk planner failed to initialize.');
}

const { planTtsChunks } = ttsChunkPlanner;

/**
 * Normalizes and cleans text to remove Markdown, HTML, code blocks, 
 * emojis, and special characters, leaving only plain readable text for the TTS engine.
 */
export function cleanTtsText(text: string, lang: string = 'es'): string {
    if (!text) return '';

    // 1. Normalize unicode to NFC (composed form)
    // This fixes issues where accented characters are decomposed (e.g. 'o' + 'combining acute accent')
    // which causes the phonemizer to say "tilde" instead of pronouncing the accented letter.
    let clean = text.normalize('NFC');

    // 2. Decode common HTML entities
    clean = clean.replace(/&amp;/g, '&')
                 .replace(/&lt;/g, '<')
                 .replace(/&gt;/g, '>')
                 .replace(/&quot;/g, '"')
                 .replace(/&#39;/g, "'")
                 .replace(/&aacute;/g, 'á')
                 .replace(/&eacute;/g, 'é')
                 .replace(/&iacute;/g, 'í')
                 .replace(/&oacute;/g, 'ó')
                 .replace(/&uacute;/g, 'ú')
                 .replace(/&ntilde;/g, 'ñ')
                 .replace(/&Aacute;/g, 'Á')
                 .replace(/&Eacute;/g, 'É')
                 .replace(/&Iacute;/g, 'Í')
                 .replace(/&Oacute;/g, 'Ó')
                 .replace(/&Uacute;/g, 'Ú')
                 .replace(/&Ntilde;/g, 'Ñ');

    // 3. Fix standalone accent characters typed or parsed after a vowel
    clean = clean.replace(/a[´']/g, 'á')
                 .replace(/e[´']/g, 'é')
                 .replace(/i[´']/g, 'í')
                 .replace(/o[´']/g, 'ó')
                 .replace(/u[´']/g, 'ú')
                 .replace(/A[´']/g, 'Á')
                 .replace(/E[´']/g, 'É')
                 .replace(/I[´']/g, 'Í')
                 .replace(/O[´']/g, 'Ó')
                 .replace(/U[´']/g, 'Ú');

    // Code examples take precedence over Signature Shield. Removing them here
    // prevents signature-like literals from consuming part of a closing fence.
    clean = clean.replace(/```mermaid[\s\S]*?```/g, '');
    clean = clean.replace(/```[\s\S]*?```/g, '');

    // 3b. SIGNATURE SHIELD: Protect the assistant's visual signature
    // Models may replace {{ }} with ( ). Unwrap that complete signature first
    // so the opening parenthesis cannot survive the generic removal pass.
    clean = clean.replace(
        /[（(]([^()（）\r\n]*≈̼\^\.┬\.̼\^≈‿⟆[^()（）\r\n]*)[）)]/gu,
        '$1'
    );

    // Remove standard {{ ... }} with signature DNA
    clean = clean.replace(/[`"']{0,2}(?:\{\{)\s*((?:(?!\n\n)[\s\S])+?)\s*(?:\}\}|\)\}|\}\)|\})[ \t]*[)\}]*[ \t]*[`"']{0,2}/g, (match, signContent) => {
        if (signContent.includes('≈') || signContent.includes('┬') || signContent.includes('~')) {
            return '';
        }
        return match;
    });

    // Remove core signature DNA pattern ≈̼^.┬.̼^≈‿⟆ with surrounding junk/emojis
    clean = clean.replace(/[`"']{0,2}(?:\{\{)?(?:(?!\n\n)\s)*[（(\[]*(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E|\w|[:_])*)(?:(?!\n\n)\s)*[（(\[]*(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*(≈̼\^\.┬\.̼\^≈‿⟆)(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*[）)\]]*(?:(?!\n\n)\s)*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E|\w|[:_])*)(?:(?!\n\n)\s)*[）)\]]*(?:(?!\n\n)\s)*(?:\}\}|\)\}|\}\)|[}\)])?[ \t]*[)\}]*[ \t]*[`"']{0,2}/gu, (match) => {
        // Keep a structural boundary when the signature occupied its own line;
        // otherwise adjacent sentences would become `Antes.Después` in TTS.
        const occupiedOwnLine = /^[\t ]*\r?\n/.test(match) || /\r?\n[\t ]*$/.test(match);
        if (occupiedOwnLine) return '\n';
        return /^\s|\s$/.test(match) ? ' ' : '';
    });

    // Fallbacks for generic curly/bracket structures
    clean = clean.replace(/\{\{[\s\S]*?\}\}/g, '');
    clean = clean.replace(/\[\[[\s\S]*?\]\]/g, '');

    // 3c. Remove leftover leading punctuation and symbols resulting from signature removal
    clean = clean.replace(/^[.,;:!?()\-—\s]+/, '');

    // 6. Remove inline code backticks (keep the text)
    clean = clean.replace(/`([^`]+)`/g, '$1');

    // Remove markdown bold, italic, and strikethrough formatting markers
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1')
                 .replace(/__([^_]+)__/g, '$1')
                 .replace(/\*([^*]+)\*/g, '$1')
                 .replace(/_([^_]+)_/g, '$1')
                 .replace(/~~([^~]+)~~/g, '$1')
                 .replace(/[\*_~]/g, '');

    // 7. Remove markdown images: ![alt](url) -> empty
    clean = clean.replace(/!\[.*?\]\(.*?\)/g, '');

    // 8. Remove markdown links: [text](url) -> text
    clean = clean.replace(/\[(.*?)\]\(.*?\)/g, '$1');

    // 9. Remove Markdown alerts/callouts like > [!TIP] or > [!NOTE]
    clean = clean.replace(/^\s*>\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]/gmi, '');

    // 10. Remove HTML tags
    clean = clean.replace(/<[^>]*>/g, '');

    // 11. Remove table separator lines like | :--- | :--- |
    clean = clean.replace(/^\s*\|[|:\-\s]+\|\s*$/gm, '');

    // 12. Replace table cell pipes with commas/spaces so table content flows naturally
    // Replaces trailing pipes with a period to end the row's sentence, removes leading pipes, and replaces middle ones with a comma.
    clean = clean.replace(/\|\s*$/gm, '.');
    clean = clean.replace(/^\s*\|/gm, '');
    clean = clean.replace(/\|/g, ', ');

    // 13. Remove markdown dividers (e.g. ---, ***, ___)
    clean = clean.replace(/^[-\*_]{3,}\s*$/gm, '');

    // 14. Ensure lines/paragraphs without punctuation at the end get a period if they represent a boundary (headers, list items, or end of text)
    const rawLines = clean.split(/\r?\n/);
    const processedLines = [];
    for (let i = 0; i < rawLines.length; i++) {
        const currentLine = rawLines[i].trim();
        if (!currentLine) {
            processedLines.push('');
            continue;
        }

        const endsWithPunctuation = /[.,;:!?。！？；：]["')\]）”’]*$/.test(currentLine);
        if (endsWithPunctuation) {
            processedLines.push(currentLine);
        } else {
            let nextNonEmptyLine = null;
            let hasEmptyLineInBetween = false;
            for (let j = i + 1; j < rawLines.length; j++) {
                if (rawLines[j].trim()) {
                    nextNonEmptyLine = rawLines[j].trim();
                    break;
                } else {
                    hasEmptyLineInBetween = true;
                }
            }

            const startsWithMarker = /^\s*([-*+]|#+|>\s*\[!|\d+\.)\s+/i.test(currentLine);
            const nextStartsWithMarker = nextNonEmptyLine && /^\s*([-*+]|#+|>\s*\[!|\d+\.)\s+/i.test(nextNonEmptyLine);

            if (startsWithMarker || nextStartsWithMarker || hasEmptyLineInBetween || !nextNonEmptyLine) {
                processedLines.push(currentLine + (lang.toLowerCase().startsWith('zh') ? '。' : '.'));
            } else {
                processedLines.push(currentLine);
            }
        }
    }
    clean = processedLines.join('\n');

    // 15. Remove list markers (+, -, *, numbers) at the start of lines
    clean = clean.replace(/^\s*[-*+]\s+/gm, '');
    clean = clean.replace(/^\s*\d+\.\s+/gm, '');
    clean = clean.replace(/^[#\s+\-*>]+\s+/gm, ''); // headers/blockquotes

    // Keep the spoken pause of an em dash while normalizing an en dash.
    clean = clean.replace(/\u2014/g, ', ').replace(/\u2013/g, '-');

    // 17. Replace newlines with spaces so it flows continuously
    clean = clean.replace(/\r?\n/g, ' ');

    // 18. Expand decimal points in numbers so they are spoken natively (e.g. "1.99" -> "1 punto 99" / "1 point 99")
    if (lang.toLowerCase().startsWith('es')) {
        clean = clean.replace(/(\d+)\.(\d+)/g, '$1 punto $2');
    } else if (lang.toLowerCase().startsWith('zh')) {
        clean = clean.replace(/(\d+)\.(\d+)/g, '$1点$2');
    } else {
        clean = clean.replace(/(\d+)\.(\d+)/g, '$1 point $2');
    }

    // Expand ampersand to spoken text based on language
    if (lang.toLowerCase().startsWith('es')) {
        clean = clean.replace(/&/g, ' y ');
    } else if (lang.toLowerCase().startsWith('zh')) {
        clean = clean.replace(/&/g, ' 和 ');
    } else {
        clean = clean.replace(/&/g, ' and ');
    }

    // English-to-Spanish phonetic dictionary for common tech terms
    if (lang.toLowerCase().startsWith('es')) {
        const sortedKeys = Object.keys(SPANISH_PHONETIC_DICT).sort((a, b) => b.length - a.length);
        // Use Unicode-aware boundaries so short keys cannot match inside words
        // containing letters such as ñ or accented characters (e.g. os in años).
        const dictRegex = new RegExp(`(?<![\\p{L}\\p{N}_])(${sortedKeys.map(k => k.replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
        clean = clean.replace(dictRegex, (match) => {
            return SPANISH_PHONETIC_DICT[match.toLowerCase()] || match;
        });
    }

    // 16. Remove all characters that are NOT letters, digits, spaces, or basic punctuation/symbols.
    // This strips emojis, drawings, and weird unicode symbols while PRESERVING essential symbols:
    // Latin, CJK, and the punctuation required for the three supported TTS
    // languages. Chinese punctuation must survive so it can form boundaries.
    clean = clean.replace(/[^\s0-9a-zA-Z\u00A0-\u00FF\u3400-\u9FFF.,;:!?¡¿，。！？；：、】【（）“”‘’()'"\-%$€&/°+*]/gu, ' ');

    // 17. Clean up multiple spaces/newlines
    clean = clean.replace(/\s+/g, ' ');

    // 18. Clean up spaces before punctuation marks to make speech synthesis flow better
    clean = clean.replace(/\s+([.,;:!?¡¿，。！？；：、】【])/g, '$1');

    // 19. Remove duplicate punctuation (e.g. "... ." or ", ,")
    clean = clean.replace(/\.+/g, '.');
    clean = clean.replace(/,+/g, ',');
    clean = clean.replace(/!+/g, '!');
    clean = clean.replace(/\?+/g, '?');
    clean = clean.replace(/¡+/g, '¡');
    clean = clean.replace(/¿+/g, '¿');
    clean = clean.replace(/。+/g, '。');
    clean = clean.replace(/，+/g, '，');
    clean = clean.replace(/！+/g, '！');
    clean = clean.replace(/？+/g, '？');
    clean = clean.replace(/；+/g, '；');

    return clean.trim();
}

export function splitTextIntoExactPartitionChunks(text: string, lang: string = 'es'): string[] {
    const cleanedText = cleanTtsText(text, lang);
    return planTtsChunks(cleanedText, lang);
}
