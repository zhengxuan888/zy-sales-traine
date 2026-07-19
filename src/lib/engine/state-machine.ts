// =============================================
// Conversation State Machine
// 9 states + Allowed/Blocked Actions
// =============================================

import type { ConversationState, StateConfig, ChatMessage, BuyerMemory } from './types';

const STATE_CONFIGS: Record<ConversationState, StateConfig> = {
  INITIAL: {
    state: 'INITIAL',
    allowedActions: ['greet', 'provide_basic_info', 'ask_what_they_need'],
    blockedActions: ['push_sale', 'give_discount', 'share_personal_info'],
    transitions: [
      { to: 'INQUIRING', trigger: 'buyer asks about product details' },
      { to: 'NEGOTIATING', trigger: 'buyer immediately asks about price' },
      { to: 'RESISTANT', trigger: 'buyer expresses doubt' },
    ],
  },
  INQUIRING: {
    state: 'INQUIRING',
    allowedActions: ['provide_product_details', 'share_specs', 'describe_condition', 'share_battery_health'],
    blockedActions: ['push_meetup', 'give_discount_prematurely', 'share_personal_address'],
    transitions: [
      { to: 'TRUST_BUILDING', trigger: 'buyer seems satisfied with info' },
      { to: 'NEGOTIATING', trigger: 'buyer asks about price/discount' },
      { to: 'LOGISTICS', trigger: 'buyer asks about shipping/delivery' },
      { to: 'RESISTANT', trigger: 'buyer expresses doubt or compares' },
    ],
  },
  TRUST_BUILDING: {
    state: 'TRUST_BUILDING',
    allowedActions: ['prove_authenticity', 'share_photos', 'explain_history', 'build_rapport'],
    blockedActions: ['rush_to_close', 'share_exact_location', 'pressure_buyer'],
    transitions: [
      { to: 'LOGISTICS', trigger: 'trust established, buyer asks about delivery' },
      { to: 'NEGOTIATING', trigger: 'buyer uses trust to negotiate' },
      { to: 'CLOSING', trigger: 'buyer ready to purchase' },
      { to: 'RESISTANT', trigger: 'trust broken by bad response' },
    ],
  },
  NEGOTIATING: {
    state: 'NEGOTIATING',
    allowedActions: ['counter_offer', 'explain_value', 'small_discount', 'bundle_deal'],
    blockedActions: ['accept_very_low_offer', 'get_angry', 'share_cost_price'],
    transitions: [
      { to: 'CLOSING', trigger: 'price agreed' },
      { to: 'TRUST_BUILDING', trigger: 'buyer needs more convincing' },
      { to: 'RESISTANT', trigger: 'negotiation fails' },
      { to: 'GHOSTED', trigger: 'buyer stops responding after price discussion' },
    ],
  },
  LOGISTICS: {
    state: 'LOGISTICS',
    allowedActions: ['offer_cod', 'explain_shipping', 'provide_fake_meetup_excuse', 'describe_packaging'],
    blockedActions: ['give_exact_address', 'agree_to_specific_meetup_time', 'refuse_all_shipping'],
    transitions: [
      { to: 'CLOSING', trigger: 'logistics agreed' },
      { to: 'NEGOTIATING', trigger: 'buyer wants discount for shipping cost' },
      { to: 'RESISTANT', trigger: 'buyer refuses shipping terms' },
    ],
  },
  CLOSING: {
    state: 'CLOSING',
    allowedActions: ['confirm_order', 'provide_payment_info', 'give_timeline', 'say_goodbye'],
    blockedActions: ['change_terms', 'increase_price', 'introduce_new_conditions'],
    transitions: [
      { to: 'COMPLETED', trigger: 'deal confirmed' },
      { to: 'NEGOTIATING', trigger: 'buyer has last-minute concerns' },
    ],
  },
  RESISTANT: {
    state: 'RESISTANT',
    allowedActions: ['reassure', 'offer_guarantee', 'provide_proof', 'give_space'],
    blockedActions: ['pressure', 'get_defensive', 'insult_buyer'],
    transitions: [
      { to: 'INQUIRING', trigger: 'buyer re-engages with questions' },
      { to: 'NEGOTIATING', trigger: 'buyer comes back to negotiate' },
      { to: 'GHOSTED', trigger: 'buyer completely stops responding' },
      { to: 'TRUST_BUILDING', trigger: 'seller successfully rebuilds trust' },
    ],
  },
  GHOSTED: {
    state: 'GHOSTED',
    allowedActions: ['follow_up_gentle', 'offer_new_incentive'],
    blockedActions: ['spam', 'guilt_trip', 'threaten'],
    transitions: [
      { to: 'INQUIRING', trigger: 'buyer responds again' },
      { to: 'COMPLETED', trigger: 'timeout - conversation ends' },
    ],
  },
  COMPLETED: {
    state: 'COMPLETED',
    allowedActions: ['say_goodbye', 'ask_for_referral'],
    blockedActions: ['continue_selling', 'negotiate'],
    transitions: [],
  },
};

export function getStateConfig(state: ConversationState): StateConfig {
  return STATE_CONFIGS[state];
}

export function detectStateTransition(
  currentState: ConversationState,
  buyerMessage: string,
  _sellerLastMessage: string,
  buyerMemory: BuyerMemory,
  _messageHistory: ChatMessage[]
): ConversationState {
  const config = STATE_CONFIGS[currentState];
  const msgLower = buyerMessage.toLowerCase();

  // Check for ghosting signals (only after at least 4 messages to avoid premature ghosting)
  if (currentState !== 'GHOSTED' && currentState !== 'COMPLETED' && _messageHistory.length >= 10) {
    if (buyerMemory.purchaseIntent < 10 && buyerMemory.overallTrust < 15) {
      return 'GHOSTED';
    }
  }

  // State-specific transition detection with minimum message count guards
  const msgCount = _messageHistory.length;
  for (const transition of config.transitions) {
    // Prevent premature transitions - ensure full conversation flow
    if (transition.to === 'CLOSING' && msgCount < 8) continue;
    if (transition.to === 'COMPLETED' && msgCount < 12) continue;
    if (transition.to === 'GHOSTED' && msgCount < 10) continue;
    
    if (matchesTransition(transition.trigger, msgLower, buyerMemory, currentState)) {
      return transition.to;
    }
  }

  return currentState; // no transition
}

function matchesTransition(
  trigger: string,
  msgLower: string,
  memory: BuyerMemory,
  _currentState: ConversationState
): boolean {
  const triggerMap: Record<string, () => boolean> = {
    'buyer asks about product details': () =>
      /what|how|condition|battery|screen|repair|spec|feature|color|storage|gb/i.test(msgLower),
    'buyer immediately asks about price': () =>
      /price|cost|how much|cu[aá]nto|precio|ile koszt|cena/i.test(msgLower),
    'buyer expresses doubt': () =>
      /sure|doubt|scam|fake|real|trust|seguro|duda|estafa|realny/i.test(msgLower),
    'buyer seems satisfied with info': () =>
      memory.productAuthenticity.level > 50 && memory.conditionClarity.level > 50,
    'buyer asks about price/discount': () =>
      /price|discount|cheaper|offer|deal|precio|descuento|barato|rabat|taniej/i.test(msgLower),
    'buyer asks about shipping/delivery': () =>
      /ship|deliver|send|env[ií]o|entrega|wysy|dostaw/i.test(msgLower),
    'buyer uses trust to negotiate': () =>
      memory.overallTrust > 60 && /price|discount|mejor precio|lepiej|cheaper/i.test(msgLower),
    'trust established, buyer asks about delivery': () =>
      memory.overallTrust > 50 && /ship|deliver|when|cu[aá]ndo|kiedy|envio/i.test(msgLower),
    'buyer ready to purchase': () =>
      memory.purchaseIntent > 70 && /buy|want|take|deal|lo quiero|lo llevo|chce|biorę|compro/i.test(msgLower),
    'trust broken by bad response': () =>
      memory.overallTrust < 30,
    'price agreed': () =>
      /deal|agreed|trato|zgoda|ok.*price|vale.*precio/i.test(msgLower),
    'negotiation fails': () =>
      memory.priceSatisfaction.level < 30,
    'buyer stops responding after price discussion': () =>
      memory.purchaseIntent < 20,
    'offer_cod': () => false, // handled by seller action
    'explain_shipping': () => false,
    'provide_fake_meetup_excuse': () => false,
    'describe_packaging': () => false,
    'logistics agreed': () =>
      memory.logisticsReliability.level > 55 && /perfect|sounds good|genial|vale.*env|ok.*ship/i.test(msgLower),
    'buyer wants discount for shipping cost': () =>
      /shipping.*expensive|caro|drog/i.test(msgLower),
    'buyer refuses shipping terms': () =>
      /no.*ship|won.*accept|no quiero|nie chc/i.test(msgLower),
    'confirm_order': () => false,
    'provide_payment_info': () => false,
    'give_timeline': () => false,
    'say_goodbye': () => false,
    'deal confirmed': () =>
      /confirmed|paid|transfer|done|hecho|pagado|zaplacone/i.test(msgLower),
    'buyer has last-minute concerns': () =>
      /wait|stop|actually|change|espera|moment|czekaj/i.test(msgLower),
    'reassure': () => false,
    'offer_guarantee': () => false,
    'provide_proof': () => false,
    'give_space': () => false,
    'buyer re-engages with questions': () =>
      /what|how|still|todav|jeszcze|ainda/i.test(msgLower),
    'buyer comes back to negotiate': () =>
      /price|still.*available|todav|jeszcze/i.test(msgLower) && /price|precio|cena/i.test(msgLower),
    'buyer completely stops responding': () =>
      memory.purchaseIntent < 10,
    'seller successfully rebuilds trust': () =>
      memory.overallTrust > 55 && memory.purchaseIntent > 40,
    'buyer responds again': () =>
      msgLower.length > 5,
    'timeout - conversation ends': () => false,
    'continue_selling': () => false,
    'negotiate': () => false,
    'ask_for_referral': () => false,
    'push_sale': () => false,
    'give_discount': () => false,
    'share_personal_info': () => false,
    'provide_basic_info': () => false,
    'ask_what_they_need': () => false,
    'greet': () => false,
    'provide_product_details': () => false,
    'share_specs': () => false,
    'describe_condition': () => false,
    'share_battery_health': () => false,
    'push_meetup': () => false,
    'give_discount_prematurely': () => false,
    'share_personal_address': () => false,
    'prove_authenticity': () => false,
    'share_photos': () => false,
    'explain_history': () => false,
    'build_rapport': () => false,
    'rush_to_close': () => false,
    'share_exact_location': () => false,
    'pressure_buyer': () => false,
    'counter_offer': () => false,
    'explain_value': () => false,
    'small_discount': () => false,
    'bundle_deal': () => false,
    'accept_very_low_offer': () => false,
    'get_angry': () => false,
    'share_cost_price': () => false,
    'change_terms': () => false,
    'increase_price': () => false,
    'introduce_new_conditions': () => false,
    'pressure': () => false,
    'get_defensive': () => false,
    'insult_buyer': () => false,
    'follow_up_gentle': () => false,
    'offer_new_incentive': () => false,
    'spam': () => false,
    'guilt_trip': () => false,
    'threaten': () => false,
  };

  const matcher = triggerMap[trigger];
  return matcher ? matcher() : false;
}

export function isActionAllowed(state: ConversationState, action: string): boolean {
  const config = STATE_CONFIGS[state];
  return config.allowedActions.includes(action) && !config.blockedActions.includes(action);
}

export function getAllStates(): ConversationState[] {
  return Object.keys(STATE_CONFIGS) as ConversationState[];
}
