// =============================================
// Rule Engine
// Dialog state tracking + scoring signals + SOP checks
// =============================================

import type { ChatMessage, ScoreSignal, DeductionPoint, ConversationState, BuyerMemory } from './types';

// Forbidden customer service patterns (multi-language)
const CS_PATTERNS = [
  // English
  /hello\s+(sir|madam|dear)/i,
  /thank\s+you\s+for\s+(contacting|reaching|your\s+interest)/i,
  /our\s+(store|shop|company)/i,
  /dear\s+(customer|sir|madam)/i,
  /we\s+are\s+(pleased|happy|glad)\s+to/i,
  /feel\s+free\s+to\s+(contact|reach)/i,
  /is\s+there\s+anything\s+else/i,
  /have\s+a\s+(great|nice|wonderful)\s+day/i,
  // Spanish
  /hola\s+se[ñn]or/i,
  /buenos\s+d[ií]as\s+se[ñn]or/i,
  /estimad[oa]/i,
  /gracias\s+por\s+contactar/i,
  /nuestra\s+(tienda|empresa)/i,
  /le\s+atendemos/i,
  // Polish
  /szanowny\s+panie/i,
  /dzi[ię]kujemy\s+za\s+kontakt/i,
  /nasz\s+sklep/i,
  // Portuguese
  /prezado/i,
  /obrigado\s+por\s+contatar/i,
  /nossa\s+loja/i,
  // Greek
  /αγαπητέ\s+πελάτη/i,
  /ευχαριστώ\s+που\s+επικοινωνήσατε/i,
  // Croatian
  /poštovani/i,
  /hvala\s+na\s+kontaktu/i,
  // Czech
  /vážený\s+zákazníku/i,
  /děkujeme\s+za\s+kontakt/i,
];

// Too long message pattern (>3 sentences)
const LONG_MESSAGE_PATTERN = /[^.!?]*[.!?][^.!?]*[.!?][^.!?]*[.!?][^.!?]*[.!?]/;

// Specific meetup/address patterns
const MEETUP_PATTERNS = [
  /let'?s?\s+meet/i,
  /i'?m\s+at\s+\d+/i, // "I'm at 123 Main St"
  /come\s+to\s+my\s+(place|house|home|address)/i,
  /puedo\s+recoger/i,
  /pued[oe]\s+pasar/i,
  /mog[ię]\s+odebra[cć]/i,
  /posso\s+ritirare/i,
  /μπορ[ωώ]\s+να\s+πάρω/i,
];

// Address leak patterns
const ADDRESS_PATTERNS = [
  /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)/i,
  /calle\s+\w+/i,
  /ulica\s+\w+/i,
  /rua\s+\w+/i,
  /οδ[όο]ς\s+\w+/i,
];

// COD mention patterns
const COD_PATTERNS = [
  /cod|cash\s+on\s+delivery/i,
  /contrareembolso/i,
  /za\s+pobraniem/i,
  /pagamento\s+na\s+entrega/i,
  /αντικαταβολ/i,
  /pouzečenie/i,
  /pla[cč]anje\s+prilikom/i,
];

// Shipping mention patterns
const SHIPPING_PATTERNS = [
  /ship|env[ií]o|wysy[lł]|entrega|envio|στέλνω|dostav/i,
];

// Battery health pattern
const BATTERY_PATTERN = /batter[yí]a?\s*(is|health|zdravotn[ií] stav)?\s*\d+\s*%|bater[ií]a\s*\d+\s*%|\d+\s*%\s*batter/i;

// Repair history pattern
const REPAIR_PATTERN = /never\s+repaired|no\s*(ha\s+sido\s+)?reparad|nigdy\s+nie\s+naprawian|sem\s+reparo|ποτέ\s+επισκευ/i;

export interface RuleCheckResult {
  signals: ScoreSignal[];
  deductions: DeductionPoint[];
  flags: string[];
}

export function checkSellerMessage(
  message: string,
  messageOrder: number,
  state: ConversationState,
  memory: BuyerMemory,
  history: ChatMessage[]
): RuleCheckResult {
  const signals: ScoreSignal[] = [];
  const deductions: DeductionPoint[] = [];
  const flags: string[] = [];

  // 1. Check for customer service language (10pts dimension)
  for (const pattern of CS_PATTERNS) {
    if (pattern.test(message)) {
      deductions.push({
        dimension: 'language_tone',
        points: 5,
        reason: 'Used customer service / formal language. Sound like a real person, not a business.',
        severity: 'moderate',
        messageRef: messageOrder,
      });
      flags.push('cs_language');
      break;
    }
  }

  // 2. Check message length (conciseness)
  const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 3) {
    deductions.push({
      dimension: 'conciseness',
      points: 3,
      reason: `Message too long (${sentences.length} sentences). Keep it to 1-3 sentences like a real chat.`,
      severity: 'minor',
      messageRef: messageOrder,
    });
    flags.push('too_long');
  }
  if (message.length > 300) {
    deductions.push({
      dimension: 'conciseness',
      points: 3,
      reason: 'Message way too long for a chat. Real sellers write short messages.',
      severity: 'moderate',
      messageRef: messageOrder,
    });
    flags.push('way_too_long');
  }

  // 3. Check trust sequence
  const trustStage = getTrustStage(memory);
  if (trustStage === 'product' && /ship|env[ií]o|wysy|entrega|envio/i.test(message) &&
      !/batter|condition|repaired|gb|storage|model/i.test(message)) {
    // Talking about shipping before establishing product info
    deductions.push({
      dimension: 'trust_sequence',
      points: 5,
      reason: 'Mentioned logistics before establishing product authenticity. Follow the trust sequence: product → logistics → personal.',
      severity: 'moderate',
      messageRef: messageOrder,
    });
    flags.push('wrong_trust_order');
  }

  // 4. Check meetup handling
  for (const pattern of MEETUP_PATTERNS) {
    if (pattern.test(message)) {
      deductions.push({
        dimension: 'meetup_handling',
        points: 8,
        reason: 'Offered or agreed to specific meetup. Should avoid meetup and push for shipping with COD.',
        severity: 'severe',
        messageRef: messageOrder,
      });
      flags.push('meetup_offer');
      break;
    }
  }

  // 5. Check address leak
  for (const pattern of ADDRESS_PATTERNS) {
    if (pattern.test(message)) {
      deductions.push({
        dimension: 'meetup_handling',
        points: 10,
        reason: 'Leaked specific address. Never give real address. Use excuse of being abroad/on business trip.',
        severity: 'severe',
        messageRef: messageOrder,
      });
      flags.push('address_leak');
      break;
    }
  }

  // 6. Check COD mention (positive signal when discussing payment)
  if (state === 'CLOSING' || state === 'LOGISTICS' || /pay|pago|płat|pagament/i.test(message)) {
    const hasCOD = COD_PATTERNS.some(p => p.test(message));
    if (hasCOD) {
      signals.push({
        type: 'positive',
        dimension: 'payment_handling',
        points: 5,
        reason: 'Mentioned COD (Cash on Delivery) - good practice for building trust',
        messageRef: messageOrder,
      });
    } else if (/pay|pago|płat|pagament|transfer|bizum/i.test(message)) {
      deductions.push({
        dimension: 'payment_handling',
        points: 3,
        reason: 'Discussed payment without mentioning COD. Always offer COD to build buyer trust.',
        severity: 'minor',
        messageRef: messageOrder,
      });
    }
  }

  // 7. Check for positive signals
  if (BATTERY_PATTERN.test(message)) {
    signals.push({
      type: 'positive',
      dimension: 'product_info',
      points: 5,
      reason: 'Provided specific battery health percentage - builds product trust',
      messageRef: messageOrder,
    });
  }

  if (REPAIR_PATTERN.test(message)) {
    signals.push({
      type: 'positive',
      dimension: 'product_info',
      points: 3,
      reason: 'Mentioned repair history - transparency builds trust',
      messageRef: messageOrder,
    });
  }

  if (/\d+\s*gb/i.test(message) && /storage|almacenamiento|pam/i.test(message)) {
    signals.push({
      type: 'positive',
      dimension: 'product_info',
      points: 2,
      reason: 'Provided storage capacity info',
      messageRef: messageOrder,
    });
  }

  // 8. Check for giving specific return time (should be vague)
  if (/i'?ll\s+be\s+back\s+on|vuelvo\s+el|wracam\s+dnia|regreso\s+el/i.test(message)) {
    deductions.push({
      dimension: 'meetup_handling',
      points: 5,
      reason: 'Gave specific return time. Should be vague about when coming back. Use "not sure when I\'m back" approach.',
      severity: 'moderate',
      messageRef: messageOrder,
    });
    flags.push('specific_return_time');
  }

  // 9. Check for honesty issues
  if (/brand\s+new|perfect\s+condition|like\s+new|nuevo|perfecto\s+estado|nowy/i.test(message) &&
      history.some(m => m.role === 'seller' && /used|scratch|wear|usado|ara[nñ]a|rysa/i.test(m.content))) {
    deductions.push({
      dimension: 'honesty',
      points: 8,
      reason: 'Contradictory statements about product condition. Be consistent and honest.',
      severity: 'severe',
      messageRef: messageOrder,
    });
    flags.push('honesty_issue');
  }

  // 10. Natural language bonus
  if (message.length < 100 && !CS_PATTERNS.some(p => p.test(message))) {
    signals.push({
      type: 'positive',
      dimension: 'language_tone',
      points: 2,
      reason: 'Short, natural message - sounds like a real person',
      messageRef: messageOrder,
    });
  }

  return { signals, deductions, flags };
}

function getTrustStage(memory: BuyerMemory): 'product' | 'logistics' | 'personal' | 'complete' {
  const productAvg = (memory.productAuthenticity.level + memory.conditionClarity.level) / 2;
  if (productAvg < 50) return 'product';
  if (memory.logisticsReliability.level < 50) return 'logistics';
  const personalAvg = (memory.sellerCredibility.level + memory.personalChatAuth.level) / 2;
  if (personalAvg < 50) return 'personal';
  return 'complete';
}

export function checkSOP(
  sopChecklist: Array<{ step: string; required: boolean }>,
  history: ChatMessage[]
): { passed: string[]; failed: string[] } {
  const allText = history.filter(m => m.role === 'seller').map(m => m.content).join(' ');
  const passed: string[] = [];
  const failed: string[] = [];

  for (const item of sopChecklist) {
    const checks: Record<string, RegExp> = {
      greet_naturally: /^(hi|hey|hola|buenas|cześć|oi|γεια|bok|ahoj|hello)/im,
      provide_battery_health: BATTERY_PATTERN,
      provide_specs: /\d+\s*gb|storage|model/i,
      mention_no_repair: REPAIR_PATTERN,
      offer_cod_shipping: COD_PATTERNS[0],
      avoid_specific_meetup: /^(?!.*(?:meet|pickup|recoger|osobist))/im,
      handle_bargain: /best.*price|precio.*fijo|cena.*sta|minimum/i,
      close_sale: /deal|ok|perfect|vale|zgoda|confirm/i,
    };

    const check = checks[item.step];
    if (check) {
      if (check.test(allText)) {
        passed.push(item.step);
      } else if (item.required) {
        failed.push(item.step);
      }
    }
  }

  return { passed, failed };
}
