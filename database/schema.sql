-- ZY Sales Trainer Database Schema
-- PostgreSQL 14+

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Health Check
CREATE TABLE health_check (
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt Templates
CREATE TABLE prompt_template (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    version INTEGER DEFAULT 1,
    system_prompt TEXT NOT NULL,
    modules JSONB,
    variables JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer Personas
CREATE TABLE buyer_persona (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    personality_traits JSONB,
    language VARCHAR(10) DEFAULT 'es',
    opening_message TEXT,
    behavior_rules JSONB,
    difficulty INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT buyer_persona_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5)
);

-- Market Config
CREATE TABLE market_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    country_code VARCHAR(5) NOT NULL,
    country_name VARCHAR(100),
    language VARCHAR(10) NOT NULL,
    currency VARCHAR(5) DEFAULT 'EUR',
    avg_price_ratio NUMERIC(3, 2) DEFAULT 1.00,
    meetup_preference VARCHAR(20) DEFAULT 'avoid',
    shipping_supported BOOLEAN DEFAULT true,
    cod_supported BOOLEAN DEFAULT true,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    company_id UUID,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'employee' NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario Config
CREATE TABLE scenario_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    buyer_persona_id UUID REFERENCES buyer_persona(id),
    market_config_id UUID REFERENCES market_config(id),
    product_type VARCHAR(100),
    product_condition VARCHAR(50),
    listed_price NUMERIC(10, 2),
    sop_checklist JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training History
CREATE TABLE training_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    company_id UUID,
    user_id UUID REFERENCES users(id),
    scenario_id UUID REFERENCES scenario_config(id),
    case_id UUID,
    mode VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    buyer_persona_id UUID REFERENCES buyer_persona(id),
    total_messages INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    final_score NUMERIC(5, 2),
    rule_score NUMERIC(5, 2),
    ai_score NUMERIC(5, 2),
    bonus_score NUMERIC(5, 2) DEFAULT 0,
    score_breakdown JSONB,
    weaknesses JSONB,
    coach_review TEXT,
    coach_issues JSONB,
    coach_examples JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_history_status ON training_history USING btree (status);
CREATE INDEX idx_training_history_user ON training_history USING btree (user_id);

-- Chat Messages
CREATE TABLE chat_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    training_id UUID NOT NULL REFERENCES training_history(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'es',
    translation TEXT,
    metadata JSONB,
    score_signals JSONB,
    deduction_points JSONB,
    is_flagged BOOLEAN DEFAULT false,
    message_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_message_training ON chat_message USING btree (training_id, message_order);

-- Score Details
CREATE TABLE score_detail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    training_id UUID NOT NULL REFERENCES training_history(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_message(id),
    category VARCHAR(50) NOT NULL,
    dimension VARCHAR(50) NOT NULL,
    rule_score NUMERIC(5, 2) DEFAULT 0,
    ai_score NUMERIC(5, 2) DEFAULT 0,
    max_score NUMERIC(5, 2) NOT NULL,
    deduction_reason TEXT,
    is_violation BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_score_detail_training ON score_detail USING btree (training_id);

-- Cases
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    source VARCHAR(50),
    buyer_persona_id UUID REFERENCES buyer_persona(id),
    market_config_id UUID REFERENCES market_config(id),
    product_type VARCHAR(100),
    conversation_data JSONB NOT NULL,
    key_moments JSONB,
    best_responses JSONB,
    difficulty INTEGER DEFAULT 3,
    tags TEXT[],
    screenshots TEXT[],
    is_active BOOLEAN DEFAULT true,
    practice_count INTEGER DEFAULT 0,
    avg_similarity_score NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT cases_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 5)
);

CREATE INDEX idx_cases_active ON cases USING btree (is_active);

-- Wrong Questions
CREATE TABLE wrong_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    user_id UUID REFERENCES users(id),
    training_id UUID REFERENCES training_history(id),
    message_id UUID REFERENCES chat_message(id),
    category VARCHAR(50) NOT NULL,
    original_message TEXT,
    user_response TEXT,
    ideal_response TEXT,
    explanation TEXT,
    related_dimension VARCHAR(50),
    is_practiced BOOLEAN DEFAULT false,
    practice_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wrong_questions_user ON wrong_questions USING btree (user_id);

-- Help Requests
CREATE TABLE help_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    user_id UUID REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    conversation_context JSONB,
    buyer_type VARCHAR(100),
    product_type VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    ai_suggestion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_help_requests_status ON help_requests USING btree (status);
