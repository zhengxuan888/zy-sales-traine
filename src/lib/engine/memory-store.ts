// =============================================
// Buyer Memory Store
// Tracks 6 types of information + trust state
// =============================================

import type { BuyerMemory, TrustStatus, ChatMessage, MessageRole } from './types';

export function createInitialMemory(): BuyerMemory {
  const emptyTrust = (): TrustStatus => ({
    level: 0,
    confirmed: false,
    details: [],
  });

  return {
    productAuthenticity: emptyTrust(),
    logisticsReliability: emptyTrust(),
    personalChatAuth: emptyTrust(),
    priceSatisfaction: emptyTrust(),
    conditionClarity: emptyTrust(),
    sellerCredibility: emptyTrust(),
    overallTrust: 20, // starts low - buyers are naturally skeptical
    purchaseIntent: 30, // starts with some interest
    mood: 'neutral',
  };
}

// Trust building sequence: product → logistics → personal chat
const TRUST_SEQUENCE = ['productAuthenticity', 'conditionClarity', 'logisticsReliability', 'sellerCredibility', 'personalChatAuth', 'priceSatisfaction'] as const;

export function updateMemory(
  memory: BuyerMemory,
  sellerMessage: string,
  buyerMessage: string,
  messageHistory: ChatMessage[]
): BuyerMemory {
  const updated = { ...memory };
  const sellerMsg = sellerMessage.toLowerCase();
  const buyerMsg = buyerMessage.toLowerCase();

  // 1. Product Authenticity signals
  if (/original|genuine|authentic|real|nuevo|originalny|prawdziwy|oryginal/i.test(sellerMsg)) {
    updated.productAuthenticity = boostTrust(updated.productAuthenticity, 15, 'Seller claims product is authentic');
  }
  if (/battery.*\d+%|bater[ií]a.*\d+%|bateria.*\d+%|health.*\d+/i.test(sellerMsg)) {
    updated.productAuthenticity = boostTrust(updated.productAuthenticity, 20, 'Seller provided specific battery health');
  }
  if (/never repaired|no reparad|nigdy nie naprawian|sem reparo/i.test(sellerMsg)) {
    updated.productAuthenticity = boostTrust(updated.productAuthenticity, 15, 'Seller confirmed no repairs');
  }
  if (/scratches?|damage|defect|ara[nñ]a|rysa|poškozen/i.test(sellerMsg)) {
    updated.conditionClarity = boostTrust(updated.conditionClarity, 10, 'Seller is honest about condition');
  }

  // 2. Condition Clarity signals
  if (/\d+\s*gb|storage|almacenamiento|pam[iě]ť/i.test(sellerMsg)) {
    updated.conditionClarity = boostTrust(updated.conditionClarity, 10, 'Seller provided storage info');
  }
  if (/model|year|a[ñn]o|rok|version|versi[oó]n/i.test(sellerMsg)) {
    updated.conditionClarity = boostTrust(updated.conditionClarity, 10, 'Seller provided model/year info');
  }

  // 3. Logistics Reliability signals
  if (/cod|cash.*delivery|contrareembolso|za pobraniem|pagamento.*entrega/i.test(sellerMsg)) {
    updated.logisticsReliability = boostTrust(updated.logisticsReliability, 20, 'Seller offers COD payment');
  }
  if (/ship|env[ií]o|wysy[lł]|dostaw|entrega|envio/i.test(sellerMsg) &&
      !/meet|pickup|recoger|osobist/i.test(sellerMsg)) {
    updated.logisticsReliability = boostTrust(updated.logisticsReliability, 10, 'Seller offers shipping');
  }
  if (/tracking|seguimiento|[sś]ledzenie|rastreamento/i.test(sellerMsg)) {
    updated.logisticsReliability = boostTrust(updated.logisticsReliability, 10, 'Seller mentions tracking');
  }

  // 4. Seller Credibility signals
  if (/i travel|i.*m.*abroad|estoy en el extranjero|jestem za granic/i.test(sellerMsg)) {
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, 10, 'Seller provides plausible reason for shipping');
  }
  if (/business|company|tienda|sklep|loja/i.test(sellerMsg)) {
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, -5, 'Seller claims to be business (suspicious on marketplace)');
  }

  // 5. Personal Chat Authenticity signals
  if (/emoji|haha|lol|jaja|rsrs/i.test(sellerMsg)) {
    updated.personalChatAuth = boostTrust(updated.personalChatAuth, 5, 'Seller uses casual language');
  }
  if (/you.*welcome|de nada|prosz[ię]|obrigado|parakal[oó]/i.test(sellerMsg) &&
      /thank|gracias|dzi[ię]k|obrigad|efcharist[oó]/i.test(buyerMsg)) {
    updated.personalChatAuth = boostTrust(updated.personalChatAuth, 10, 'Natural conversational exchange');
  }

  // 6. Price Satisfaction
  if (/discount|descuento|rabat|desconto||[εé]kptwsh/i.test(sellerMsg) &&
      /ok|deal|perfect|vale|zgoda|ok/i.test(buyerMsg)) {
    updated.priceSatisfaction = boostTrust(updated.priceSatisfaction, 20, 'Buyer accepted price/discount');
  }
  if (/price.*fixed|precio.*fijo|cena.*sta[lł]a|pre[cç]o.*fixo/i.test(sellerMsg)) {
    updated.priceSatisfaction = boostTrust(updated.priceSatisfaction, -10, 'Seller is firm on price');
  }

  // Negative signals - reduce trust
  if (/hola se[nñ]or|buenos d[ií]as se[nñ]or|szanowny panie|estimado/i.test(sellerMsg)) {
    // Customer service language - reduces personal trust
    updated.personalChatAuth = boostTrust(updated.personalChatAuth, -20, 'Too formal, customer-service-like');
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, -15, 'Sounds like a business, not individual');
  }

  if (/guarantee|warranty|garant[ií]a|gwarancja|garantia/i.test(sellerMsg) &&
      messageHistory.filter(m => m.role === 'seller').length < 3) {
    // Offering guarantee too early is suspicious
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, -10, 'Guarantee offered too early');
  }

  // Buyer mood signals
  if (/scam|fake|estafa|oszustwo|golp/i.test(buyerMsg)) {
    updated.mood = 'suspicious';
    updated.overallTrust = Math.max(0, updated.overallTrust - 15);
  } else if (/great|perfect|awesome|genial|perfecto|super|genialne/i.test(buyerMsg)) {
    updated.mood = 'happy';
    updated.overallTrust = Math.min(100, updated.overallTrust + 10);
  } else if (/whatever|never mind|no thanks|daaj spok|n[aã]o obrigado|deja/i.test(buyerMsg)) {
    updated.mood = 'frustrated';
    updated.purchaseIntent = Math.max(0, updated.purchaseIntent - 20);
  }

  // Calculate overall trust (weighted by trust sequence priority)
  updated.overallTrust = calculateOverallTrust(updated);
  updated.purchaseIntent = calculatePurchaseIntent(updated);

  return updated;
}

function boostTrust(status: TrustStatus, delta: number, detail: string): TrustStatus {
  const newLevel = Math.max(0, Math.min(100, status.level + delta));
  return {
    level: newLevel,
    confirmed: newLevel >= 70,
    details: [...status.details, `${delta > 0 ? '+' : ''}${delta}: ${detail}`].slice(-10),
  };
}

function calculateOverallTrust(memory: BuyerMemory): number {
  // Trust must be built in sequence: product → logistics → personal
  // Later stages are capped by earlier stages
  const productTrust = (memory.productAuthenticity.level + memory.conditionClarity.level) / 2;
  const logisticsTrust = memory.logisticsReliability.level;
  const personalTrust = (memory.sellerCredibility.level + memory.personalChatAuth.level) / 2;

  // Sequence enforcement: later stages can't exceed earlier stages + 20
  const effectiveLogistics = Math.min(logisticsTrust, productTrust + 20);
  const effectivePersonal = Math.min(personalTrust, effectiveLogistics + 20);

  // Weighted average
  const overall = (productTrust * 0.35 + effectiveLogistics * 0.35 + effectivePersonal * 0.30);
  return Math.round(Math.max(0, Math.min(100, overall)));
}

function calculatePurchaseIntent(memory: BuyerMemory): number {
  let intent = memory.priceSatisfaction.level * 0.4 +
    memory.overallTrust * 0.3 +
    memory.conditionClarity.level * 0.15 +
    memory.logisticsReliability.level * 0.15;

  // Mood modifier
  if (memory.mood === 'happy') intent += 10;
  if (memory.mood === 'suspicious') intent -= 15;
  if (memory.mood === 'frustrated') intent -= 25;

  return Math.round(Math.max(0, Math.min(100, intent)));
}

export function getMemorySummary(memory: BuyerMemory): string {
  const parts: string[] = [];

  if (memory.productAuthenticity.confirmed) parts.push('Product authenticity: confirmed');
  else parts.push(`Product authenticity: ${memory.productAuthenticity.level}%`);

  if (memory.conditionClarity.confirmed) parts.push('Condition clarity: confirmed');
  else parts.push(`Condition clarity: ${memory.conditionClarity.level}%`);

  if (memory.logisticsReliability.confirmed) parts.push('Logistics trust: confirmed');
  else parts.push(`Logistics trust: ${memory.logisticsReliability.level}%`);

  parts.push(`Overall trust: ${memory.overallTrust}%`);
  parts.push(`Purchase intent: ${memory.purchaseIntent}%`);
  parts.push(`Mood: ${memory.mood}`);

  return parts.join('. ');
}

export function getTrustSequenceStatus(memory: BuyerMemory): {
  stage: string;
  progress: number;
  nextRequirement: string;
} {
  const productAvg = (memory.productAuthenticity.level + memory.conditionClarity.level) / 2;
  const logisticsLevel = memory.logisticsReliability.level;
  const personalAvg = (memory.sellerCredibility.level + memory.personalChatAuth.level) / 2;

  if (productAvg < 50) {
    return {
      stage: 'product_authenticity',
      progress: productAvg,
      nextRequirement: 'Must establish product authenticity first (battery health, condition, repair history)',
    };
  }
  if (logisticsLevel < 50) {
    return {
      stage: 'logistics_reliability',
      progress: logisticsLevel,
      nextRequirement: 'Must establish logistics trust (COD, shipping, tracking)',
    };
  }
  if (personalAvg < 50) {
    return {
      stage: 'personal_chat',
      progress: personalAvg,
      nextRequirement: 'Must build personal rapport (casual tone, natural conversation)',
    };
  }
  return {
    stage: 'complete',
    progress: 100,
    nextRequirement: 'All trust stages established - ready to close',
  };
}
