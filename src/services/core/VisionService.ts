/**
 * Vision Service (Visual Cortex)
 * Handles image-to-text descriptions using the configured Vision Runtime.
 */

import { AppConfig, Provider, ModelInfo } from '../../types';
import type { ProviderOptions } from './ModelProviders';

export class VisionService {
    /**
     * Processes an image and returns a high-detail text description.
     * Uses the visionProvider and visionModel configured in AppConfig.
     */
    static async describeImage(
        config: AppConfig, 
        imageData: string, 
        imageType: string,
        models: Record<Provider, ModelInfo[]>
    ): Promise<string> {
        if (!config.visionProvider || !config.visionModel) {
            throw new Error('Vision Runtime results requested but not configured.');
        }

        const abortController = new AbortController();
        
        // Prepare options for the provider
        const options: ProviderOptions = {
            config: {
                ...config,
                // Override main model with vision model for this specific call
                provider: config.visionProvider,
                model: config.visionModel
            },
            onStatus: () => {}, // Stateless call, no UI updates needed during pre-processing
            abortSignal: abortController.signal,
            useTools: false,
            tools: [],
            isElectronProxy: !!(window as any).electron
        };

        try {
            const { ProviderFactory } = await import('./ModelProviders');
            const provider = ProviderFactory.create(config.visionProvider, options);
            
            // Construct the specific vision message
            const messages = [
                {
                    role: 'user',
                    content: 'Describe what you see in rich detail',
                    attachments: [
                        {
                            type: imageType,
                            data: imageData // Should be base64 (dataURL)
                        }
                    ]
                }
            ];

            const response = await provider.streamRequest(messages);
            return response.content || '';
        } catch (err: any) {
            console.error('[VisionService] Error analyzing image:', err);
            throw new Error(`Failed to analyze image: ${err.message}`);
        }
    }
}
