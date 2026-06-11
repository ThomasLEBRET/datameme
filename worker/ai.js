// OCR et génération de mots-clés via Cloudflare Workers AI

// Seuil minimum de caractères pour considérer qu'une image contient du texte
const OCR_MIN_CHARS = 4;

// Modèle vision (OCR + description)
const MODEL_VISION = '@cf/llava-hf/llava-1.5-7b-hf';

// Modèle de classification d'images (dernier recours)
const MODEL_CLASSIFICATION = '@cf/microsoft/resnet-50';

// Nettoie la réponse du modèle : retire les phrases d'enrobage que LLaVA ajoute
// autour du texte extrait ("The text in the image reads: …", etc.)
function cleanOcrResponse(raw) {
  let text = (raw || '').trim();
  text = text.replace(/^(the\s+)?(text|words?|caption)\s+(in|on|of)\s+(the|this)\s+image\s+(is|reads?|says?)\s*:?\s*/i, '');
  text = text.replace(/^(it|the\s+image)\s+(says?|reads?|contains?)\s*:?\s*/i, '');
  text = text.replace(/^["'«\s]+|["'»\s]+$/g, '').trim();
  // Réponses « pas de texte » sous toutes leurs formes
  if (/^(none|n\/a|no\s+(readable\s+|visible\s+)?text|there\s+is\s+no|aucun\s+texte|empty)/i.test(text)) return '';
  return text;
}

/**
 * Extrait le texte d'une image via le modèle vision
 * Retourne { text, hasText }
 */
export async function runOCR(env, imageBuffer) {
  try {
    const result = await env.AI.run(MODEL_VISION, {
      image: [...new Uint8Array(imageBuffer)],
      prompt: 'Transcribe all readable text in this image exactly as written. Reply with the transcription only, no commentary. If there is no readable text, reply with the single word: NONE',
      max_tokens: 512,
    });

    const text = cleanOcrResponse(result.response);
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
 * Demande au modèle vision des mots-clés descriptifs en français
 * Bien plus pertinent pour des mèmes que les classes ImageNet de resnet-50
 */
export async function runKeywords(env, imageBuffer) {
  try {
    const result = await env.AI.run(MODEL_VISION, {
      image: [...new Uint8Array(imageBuffer)],
      prompt: 'Describe this meme image with 3 to 5 short keywords in French, lowercase, separated by commas. Reply with the keywords only, no other text.',
      max_tokens: 64,
    });

    const raw = (result.response || '').toLowerCase().replace(/^[^:\n]{0,40}:\s*/, '');
    return raw
      .split(/[,\n]+/)
      .map(k => k.trim().replace(/[^a-zà-ÿœç' -]/g, '').trim())
      .filter(k => k.length >= 3 && k.length <= 30 && k.split(' ').length <= 3)
      .slice(0, 5);
  } catch (err) {
    console.error('Erreur keywords :', err);
    return [];
  }
}

/**
 * Classification visuelle resnet-50 — dernier recours si le modèle vision n'a rien donné
 * Labels ImageNet en anglais, seuil de confiance relevé pour limiter le bruit
 */
export async function runClassification(env, imageBuffer) {
  try {
    const result = await env.AI.run(MODEL_CLASSIFICATION, {
      image: [...new Uint8Array(imageBuffer)],
    });

    const tags = (result || [])
      .filter(item => item.score > 0.3)
      .slice(0, 3)
      .map(item => item.label.toLowerCase().replace(/_/g, ' '));

    return tags;
  } catch (err) {
    console.error('Erreur classification :', err);
    return [];
  }
}
