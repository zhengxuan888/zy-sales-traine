// =============================================
// AI Buyer Response Post-Validation
// Validates LLM output before sending to user
// =============================================

import type { MarketConfigData } from './types';

// Forbidden customer-service patterns (multi-language)
const FORBIDDEN_PATTERNS = [
  // English
  /hello\s+(sir|madam|dear)/i,
  /thank\s+you\s+for\s+(contacting|reaching|your\s+interest)/i,
  /our\s+(store|shop|company)/i,
  /dear\s+(customer|sir|madam)/i,
  /we\s+are\s+(pleased|happy|glad)\s+to/i,
  /feel\s+free\s+to\s+(contact|reach)/i,
  /is\s+there\s+anything\s+else/i,
  /have\s+a\s+(great|nice|wonderful)\s+day/i,
  /as\s+an?\s+ai\s+(assistant|model|language)/i,
  /i'?m\s+an?\s+ai/i,
  // Spanish
  /hola\s+se[ñn]or/i,
  /buenos\s+d[ií]as\s+se[ñn]or/i,
  /estimad[oa]/i,
  /gracias\s+por\s+contactar/i,
  /nuestra\s+(tienda|empresa)/i,
  /le\s+atendemos/i,
  /como\s+modelo\s+de\s+lenguaje/i,
  /soy\s+una?\s+ia/i,
  // Polish
  /szanowny\s+panie/i,
  /dzi[ię]kujemy\s+za\s+kontakt/i,
  /nasz\s+sklep/i,
  /jako\s+model\s+językowy/i,
  // Portuguese
  /prezado/i,
  /obrigado\s+por\s+contatar/i,
  /nossa\s+loja/i,
  /como\s+modelo\s+de\s+linguagem/i,
  // Greek
  /αγαπητέ\s+πελάτη/i,
  /ευχαριστώ\s+που\s+επικοινωνήσατε/i,
  /ως\s+μοντέλο\s+γλώσσας/i,
  // Croatian
  /poštovani/i,
  /hvala\s+na\s+kontaktu/i,
  /kao\s+jezični\s+model/i,
  // Czech
  /vážený\s+zákazníku/i,
  /děkujeme\s+za\s+kontakt/i,
  /jako\s+jazykový\s+model/i,
];

// Chinese character detection (AI should never reply in Chinese)
const CHINESE_PATTERN = /[\u4e00-\u9fff]{3,}/;

// Market to language mapping
const MARKET_LANGUAGES: Record<string, { name: string; patterns: RegExp[] }> = {
  spain: {
    name: 'Spanish',
    patterns: [/[a-záéíóúñü¿¡]+/i],
  },
  poland: {
    name: 'Polish',
    patterns: [/[a-ząćęłńóśźż]+/i],
  },
  czech: {
    name: 'Czech',
    patterns: [/[a-záčďéěíňóřšťúůýž]+/i],
  },
  portugal: {
    name: 'Portuguese',
    patterns: [/[a-záàâãéêíóôõúç]+/i],
  },
  greece: {
    name: 'Greek',
    patterns: [/[\u0370-\u03ff]+/i],
  },
  croatia: {
    name: 'Croatian',
    patterns: [/[a-zčćđšž]+/i],
  },
  uk: {
    name: 'English',
    patterns: [/[a-z]+/i],
  },
};

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

/**
 * Validate AI buyer response before sending to user
 */
export function validateBuyerResponse(
  response: string,
  market: MarketConfigData | null
): ValidationResult {
  const reasons: string[] = [];

  // 1. Check for Chinese characters (should never appear)
  if (CHINESE_PATTERN.test(response)) {
    reasons.push('Response contains Chinese characters - must use target market language');
  }

  // 2. Check for forbidden customer service patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(response)) {
      reasons.push(`Response contains forbidden customer service pattern: ${pattern.source}`);
      break;
    }
  }

  // 3. Check for AI identity leaks
  if (/as\s+an?\s+ai|i'?m\s+an?\s+ai|como\s+(modelo|ia)|soy\s+una?\s+ia|jako\s+(model|ai)/i.test(response)) {
    reasons.push('Response reveals AI identity');
  }

  // 4. Check language matches market (basic heuristic)
  if (market) {
    const mkt = market as unknown as Record<string, unknown>;
    const countryName = mkt.country_name || market.countryName || mkt.country_code || market.countryCode || '';
    const country = String(countryName).toLowerCase();
    if (country === 'greece' || country === 'gr' || country === 'ελλάδα') {
      // Greek market should have Greek characters
      if (!/[\u0370-\u03ff]/.test(response) && /[a-z]/i.test(response)) {
        // Allow some Latin chars in Greek (numbers, brand names) but majority should be Greek
        const greekChars = (response.match(/[\u0370-\u03ff]/g) || []).length;
        const latinChars = (response.match(/[a-zA-Z]/g) || []).length;
        if (latinChars > greekChars * 3 && latinChars > 20) {
          reasons.push('Greek market response should be primarily in Greek');
        }
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Get fallback buyer response based on market
 */
export function getFallbackBuyerResponse(market: MarketConfigData | null, context?: string): string {
  const mkt = market as unknown as Record<string, unknown> | null;
  const countryName = mkt ? (mkt.country_name || market!.countryName || mkt.country_code || market!.countryCode || '') : '';
  const country = String(countryName).toLowerCase();

  if (country === 'spain' || country === 'es') {
    return context ? `Entendido. ${context}` : 'Vale, entendido. Cuéntame más.';
  }
  if (country === 'poland' || country === 'pl') {
    return context ? `Rozumiem. ${context}` : 'OK, rozumiem. Powiedz mi więcej.';
  }
  if (country === 'czech' || country === 'cz') {
    return context ? `Rozumím. ${context}` : 'Dobrý den, rozumím. Řekněte mi více.';
  }
  if (country === 'portugal' || country === 'pt') {
    return context ? `Entendi. ${context}` : 'Ok, entendi. Me conta mais.';
  }
  if (country === 'greece' || country === 'gr') {
    return context ? `Κατάλαβα. ${context}` : 'Εντάξει, κατάλαβα. Πες μου περισσότερα.';
  }
  if (country === 'croatia' || country === 'hr') {
    return context ? `Razumijem. ${context}` : 'U redu, razumijem. Reci mi više.';
  }
  return context ? `Understood. ${context}` : 'OK, I understand. Tell me more.';
}
