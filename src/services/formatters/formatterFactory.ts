/**
 * ──────────────────────────────────────────────────────────────────────
 *  Formatter Factory — Dynamic Formatter Selection
 * ──────────────────────────────────────────────────────────────────────
 *
 *  Factory that creates the appropriate formatter based on context:
 *  - Model type (Gemma, standard, etc.)
 *  - Output destination (Telegram, UI, etc.)
 * ──────────────────────────────────────────────────────────────────────
 */

import { IFormatter, FormatterType } from './IFormatter';
import { GemmaFormatter } from './GemmaFormatter';
import { TelegramFormatter } from './telegramFormatter';
import { StandardFormatter } from './StandardFormatter';

/**
 * Options for formatter creation
 */
export interface FormatterOptions {
    modelName?: string;
    isTelegram?: boolean;
    formatterType?: FormatterType;
}

/**
 * Creates the appropriate formatter based on the provided options.
 *
 * Priority:
 * 1. Explicit formatterType
 * 2. Telegram output
 * 3. Gemma model detection
 * 4. Standard formatter (default)
 */
export function createFormatter(options: FormatterOptions = {}): IFormatter {
    const { modelName, isTelegram, formatterType } = options;

    // 1. Explicit formatter type takes precedence
    if (formatterType) {
        switch (formatterType) {
            case FormatterType.GEMMA:
                return new GemmaFormatter();
            case FormatterType.TELEGRAM:
                return new TelegramFormatter();
            case FormatterType.STANDARD:
            default:
                return new StandardFormatter();
        }
    }

    // 2. Telegram output uses Telegram formatter
    if (isTelegram) {
        return new TelegramFormatter();
    }

    // 3. Detect Gemma models
    if (modelName && modelName.toLowerCase().includes('gemma')) {
        return new GemmaFormatter();
    }

    // 4. Default to standard formatter
    return new StandardFormatter();
}

/**
 * Helper to detect if a model name is Gemma
 */
export function isGemmaModel(modelName: string): boolean {
    return modelName.toLowerCase().includes('gemma');
}

/**
 * Helper to determine formatter type from context
 */
export function determineFormatterType(options: FormatterOptions): FormatterType {
    if (options.formatterType) {
        return options.formatterType;
    }

    if (options.isTelegram) {
        return FormatterType.TELEGRAM;
    }

    if (options.modelName && isGemmaModel(options.modelName)) {
        return FormatterType.GEMMA;
    }

    return FormatterType.STANDARD;
}
