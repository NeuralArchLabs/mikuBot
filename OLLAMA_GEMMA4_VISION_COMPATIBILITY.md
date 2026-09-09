# Ollama Gemma 4 native vision troubleshooting

## Current behavior

MikuCentral does not blacklist, downgrade, or special-route Gemma 4 models. When Ollama reports that a selected model supports vision, MikuCentral sends the raw image through the normal Ollama chat request, together with the user's message and regular conversation context.

Leaving Visual Vortex set to native means that the active Chat or Agent model receives the image directly. Selecting a different Visual Vortex model intentionally runs that separate model first and passes its text description to the active model.

## Known model-tag issue

Some older Gemma 4 E4B artifacts can accept and decode an image while still answering that no image was provided or producing an unrelated description. This can look like an attachment-transfer failure even though Ollama received the image correctly.

The following combination reproduced the problem on Windows:

- Model tag: `gemma4:e4b-it-q4_K_M` (also previously exposed through `gemma4:latest`)
- Model digest: `c6eb396dbd59`
- Symptom: Ollama logs show an image chunk being decoded, but the model claims that the image is missing or hallucinates unrelated visual content.

The newer `gemma4:e4b-it-qat` tag has been verified to receive and understand images correctly. It should be preferred when E4B native vision is required.

## Recommended resolution

1. Check the exact installed and selected tag with `ollama list`.
2. Install the updated checkpoint with `ollama pull gemma4:e4b-it-qat`.
3. Select `gemma4:e4b-it-qat` explicitly in MikuCentral instead of relying on `gemma4:latest` or the older `e4b-it-q4_K_M` tag.
4. Refresh the model list or restart the development process if the newly installed tag is not yet visible.
5. Keep Visual Vortex set to native when Gemma 4 itself should inspect the raw image.

If Ollama logs contain an `image decoded` entry but the model still says that no image was received, the transport path is working and the model artifact/runtime combination should be investigated first. If no image decoding appears, inspect the Ollama version, the model's `/api/show` capabilities, and the request payload.

## Implementation note

No Gemma 4-specific workaround should be added to MikuCentral unless a current supported tag is proven incompatible. A blanket workaround would also block fixed tags such as `gemma4:e4b-it-qat` and unnecessarily replace native multimodal context with a lossy text-only description.

Relevant references:

- [Ollama Gemma 4 model tags](https://ollama.com/library/gemma4/tags)
- [Ollama `gemma4:e4b-it-qat` model page](https://ollama.com/library/gemma4:e4b-it-qat)
- [Ollama vision API documentation](https://docs.ollama.com/capabilities/vision)
- [Ollama issue showing the older E4B symptom on Windows](https://github.com/ollama/ollama/issues/16597)
- [Google Gemma image understanding documentation](https://ai.google.dev/gemma/docs/capabilities/vision/image)
