// OCR et classification visuelle via Cloudflare Workers AI

// Seuil minimum de caractères pour considérer qu'une image contient du texte
const OCR_MIN_CHARS = 10;

// Modèle OCR disponible dans Workers AI
const MODEL_OCR = '@cf/microsoft/resnet-50';

// Modèle de classification d'images
const MODEL_CLASSIFICATION = '@cf/microsoft/resnet-50';

/**
 * Extrait le texte d'une image via OCR Workers AI
 * Retourne { text, hasText }
 */
export async function runOCR(env, imageBuffer) {
  try {
    const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...new Uint8Array(imageBuffer)],
      prompt: 'Extract all text visible in this image. Return only the raw text, nothing else. If there is no text, return an empty string.',
      max_tokens: 512,
    });

    const text = (result.response || '').trim();
    return {
      text,
      hasText: text.length >= OCR_MIN_CHARS,
    };
  } catch (err) {
    console.error('Erreur OCR :', err);
    return { text: '', hasText: false };
  }
}

/**
 * Classifie visuellement une image et retourne des tags descriptifs
 * Utilisé quand l'OCR ne détecte pas de texte significatif
 */
export async function runClassification(env, imageBuffer) {
  try {
    const result = await env.AI.run('@cf/microsoft/resnet-50', {
      image: [...new Uint8Array(imageBuffer)],
    });

    // Filtrer les labels avec un score de confiance suffisant (> 10%)
    const tags = (result || [])
      .filter(item => item.score > 0.1)
      .slice(0, 5)
      .map(item => item.label.toLowerCase().replace(/_/g, ' '));

    return tags;
  } catch (err) {
    console.error('Erreur classification :', err);
    return [];
  }
}
