import SPANISH_PHONETIC_DICT from '../../../electron/ttsPhoneticDict.json';

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

    // 3b. SIGNATURE SHIELD: Protect the assistant's visual signature
    // Remove standard {{ ... }} with signature DNA
    clean = clean.replace(/[`"']{0,2}(?:\{\{)\s*((?:(?!\n\n)[\s\S])+?)\s*(?:\}\}|\)\}|\}\)|[}\)])[ \t]*[)\}]*[ \t]*[`"']{0,2}/g, (match, signContent) => {
        if (signContent.includes('≈') || signContent.includes('┬') || signContent.includes('~')) {
            return '';
        }
        return match;
    });

    // Remove core signature DNA pattern ≈̼^.┬.̼^≈‿⟆ with surrounding junk/emojis
    clean = clean.replace(/[`"']{0,2}(?:\{\{)?(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E|\w|[:_])*)(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*(≈̼\^\.┬\.̼\^≈‿⟆)(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E|\w|[:_])*)(?:(?!\n\n)\s)*(?:\}\}|\)\}|\}\)|[}\)])?[ \t]*[)\}]*[ \t]*[`"']{0,2}/gu, '');

    // Fallbacks for generic curly/bracket structures
    clean = clean.replace(/\{\{[\s\S]*?\}\}/g, '');
    clean = clean.replace(/\[\[[\s\S]*?\]\]/g, '');

    // 3c. Remove leftover leading punctuation and symbols resulting from signature removal
    clean = clean.replace(/^[.,;:!?()\-—\s]+/, '');

    // 4. Remove Mermaid diagram blocks completely
    clean = clean.replace(/```mermaid[\s\S]*?```/g, '');

    // 5. Remove standard code blocks completely
    clean = clean.replace(/```[\s\S]*?```/g, '');

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

        const endsWithPunctuation = /[.,;:!?]["')\]]*$/.test(currentLine);
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
                processedLines.push(currentLine + '.');
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

    // 16. Normalize common dashes/hyphens to simple hyphens
    clean = clean.replace(/[\u2013\u2014]/g, '-');

    // 17. Replace newlines with spaces so it flows continuously
    clean = clean.replace(/\r?\n/g, ' ');

    // 18. Expand decimal points in numbers so they are spoken natively (e.g. "1.99" -> "1 punto 99" / "1 point 99")
    if (lang.toLowerCase().startsWith('es')) {
        clean = clean.replace(/(\d+)\.(\d+)/g, '$1 punto $2');
    } else {
        clean = clean.replace(/(\d+)\.(\d+)/g, '$1 point $2');
    }

    // Expand ampersand to spoken text based on language
    if (lang.toLowerCase().startsWith('es')) {
        clean = clean.replace(/&/g, ' y ');
    } else {
        clean = clean.replace(/&/g, ' and ');
    }

    // English-to-Spanish phonetic dictionary for common tech terms
    if (lang.toLowerCase().startsWith('es')) {
        const sortedKeys = Object.keys(SPANISH_PHONETIC_DICT).sort((a, b) => b.length - a.length);
        const dictRegex = new RegExp(`\\b(${sortedKeys.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
        clean = clean.replace(dictRegex, (match) => {
            return SPANISH_PHONETIC_DICT[match.toLowerCase()] || match;
        });
    }

    // 16. Remove all characters that are NOT letters, digits, spaces, or basic punctuation/symbols.
    // This strips emojis, drawings, and weird unicode symbols while PRESERVING essential symbols:
    // .,;:!?¡¿()'"- and %, $, €, &, /, °, +, *
    clean = clean.replace(/[^\s0-9a-zA-Z\u00A0-\u00FF\u4e00-\u9fa5.,;:!?¡¿()'"\-%$€&/°+*]/gu, ' ');

    // 17. Clean up multiple spaces/newlines
    clean = clean.replace(/\s+/g, ' ');

    // 18. Clean up spaces before punctuation marks to make speech synthesis flow better
    clean = clean.replace(/\s+([.,;:!?¡¿])/g, '$1');

    // 19. Remove duplicate punctuation (e.g. "... ." or ", ,")
    clean = clean.replace(/\.+/g, '.');
    clean = clean.replace(/,+/g, ',');
    clean = clean.replace(/!+/g, '!');
    clean = clean.replace(/\?+/g, '?');
    clean = clean.replace(/¡+/g, '¡');
    clean = clean.replace(/¿+/g, '¿');

    return clean.trim();
}

function splitSentenceIntoTwo(s: string, limit: number, allowWordSplit: boolean): [string, string] {
    if (s.length <= limit) return [s, ""];

    // Use a soft threshold to avoid splitting sentences that are only slightly over the limit.
    // If allowWordSplit is true (Chunk 0 & 1), we allow up to 95 chars to respect natural sentences while keeping them brief.
    // If allowWordSplit is false (Chunk 2+), we allow up to 190 chars.
    const softLimit = allowWordSplit ? 95 : 190;
    if (s.length <= softLimit) {
        return [s, ""];
    }

    // Try splitting by clause punctuation first: , ; : —
    const regex = /(?<=[,;:—])\s+/g;
    let match;
    let lastSplitIndex = -1;

    // First pass: find the best punctuation split before the limit
    while ((match = regex.exec(s)) !== null) {
        const splitPos = match.index;
        // Enforce a minimum length on both sides to prevent tiny fragments
        // For Chunk 0 & 1, we allow smaller parts (e.g. 15 chars)
        const minPartLen = allowWordSplit ? 15 : 40;
        if (splitPos <= limit) {
            const firstPartLen = splitPos;
            const secondPartLen = s.length - splitPos;
            if (firstPartLen >= minPartLen && secondPartLen >= minPartLen) {
                lastSplitIndex = splitPos;
            }
        } else {
            break;
        }
    }

    // Second pass: if no split was found before the limit, check if there is one slightly after the limit (up to limit + 45)
    if (lastSplitIndex === -1) {
        regex.lastIndex = 0;
        const extendedLimit = limit + 45;
        while ((match = regex.exec(s)) !== null) {
            const splitPos = match.index;
            const minPartLen = allowWordSplit ? 15 : 40;
            if (splitPos <= extendedLimit) {
                const firstPartLen = splitPos;
                const secondPartLen = s.length - splitPos;
                if (firstPartLen >= minPartLen && secondPartLen >= minPartLen) {
                    lastSplitIndex = splitPos;
                }
            } else {
                break;
            }
        }
    }

    if (lastSplitIndex !== -1) {
        return [s.substring(0, lastSplitIndex).trim(), s.substring(lastSplitIndex).trim()];
    }

    // If no punctuation split is found within the limit:
    if (allowWordSplit) {
        const lastSpace = s.substring(0, limit).lastIndexOf(" ");
        if (lastSpace !== -1 && lastSpace > 15) {
            return [s.substring(0, lastSpace).trim(), s.substring(lastSpace).trim()];
        }
    }

    // Fallback split point to avoid word breakage (only if extremely long)
    if (allowWordSplit || s.length > 220) {
        const firstSplitAfter = s.substring(limit).indexOf(" ");
        if (firstSplitAfter !== -1) {
            const splitIndex = limit + firstSplitAfter;
            if (s.length - splitIndex >= 30) {
                return [s.substring(0, splitIndex).trim(), s.substring(splitIndex).trim()];
            }
        }
    }

    return [s, ""];
}

export function splitTextIntoExactPartitionChunks(text: string, lang: string = 'es'): string[] {
    const cleanedText = cleanTtsText(text, lang);
    if (!cleanedText) return [];

    // Use {1,3} for letter abbreviations so two-letter or three-letter ones like EE. or UU. or USA. don't trigger splits
    const sentenceSplitRegex = /(?<=(?<!\b\d+|\b[a-zA-Z]{1,3}|\b(?:ej|etc|vs|dr|sr|sra|ref|pág|pag|vol|min|seg|approx|ca|art))[.?!;¿¡]["')\]]*)\s+/i;
    const rawSentences = cleanedText.split(sentenceSplitRegex).map(s => s.trim()).filter(Boolean);

    const chunks: string[] = [];
    let currentGroup = "";

    while (rawSentences.length > 0) {
        const sentence = rawSentences.shift()!;
        const currentChunkIndex = chunks.length;
        const targetLimit = currentChunkIndex === 0 ? 80 : 160;
        const allowWordSplit = currentChunkIndex === 0; // Only allow word splits for Chunk 0

        if (!currentGroup) {
            if (sentence.length > targetLimit) {
                const parts = splitSentenceIntoTwo(sentence, targetLimit, allowWordSplit);
                currentGroup = parts[0];
                if (parts[1]) {
                    rawSentences.unshift(parts[1]);
                }
            } else {
                currentGroup = sentence;
            }
        } else {
            if (currentGroup.length + sentence.length + 1 > targetLimit) {
                chunks.push(currentGroup);
                currentGroup = "";
                rawSentences.unshift(sentence);
            } else {
                currentGroup += " " + sentence;
            }
        }
    }

    if (currentGroup) {
        chunks.push(currentGroup);
    }

    return chunks;
}
