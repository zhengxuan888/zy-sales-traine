# AGENTS.md - AI Training Platform

## 项目概览

AI Training Platform - FB Marketplace 销售训练系统。帮助二手手机/电子产品卖家通过 AI 模拟买家对话训练销售技巧。

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19, TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **Database**: PostgreSQL (via Supabase SDK)
- **LLM**: coze-coding-dev-sdk (Doubao/DeepSeek/Kimi models)
- **包管理**: pnpm

## 目录结构

```
src/
├── app/
│   ├── page.tsx                    # 首页 - 6大功能入口
│   ├── training/[id]/page.tsx      # 训练聊天页面
│   ├── training/[id]/review/page.tsx # AI教练点评页
│   ├── cases/page.tsx              # 真实案例学习
│   ├── wrong-questions/page.tsx    # 错题重练
│   ├── scores/page.tsx             # 我的成绩
│   ├── admin/page.tsx              # 老板后台
│   ├── help/page.tsx               # 实战求助
│   ├── api/                        # API路由
│   │   ├── training/start/         # 开始训练
│   │   ├── training/[id]/message/  # 发送消息
│   │   ├── training/[id]/complete/ # 完成训练
│   │   ├── training/history/       # 训练历史
│   │   ├── cases/                  # 案例管理
│   │   ├── scores/                 # 成绩统计
│   │   ├── wrong-questions/        # 错题管理
│   │   ├── help-requests/          # 实战求助
│   │   └── admin/                  # 管理后台
│   └── layout.tsx
├── lib/
│   ├── db.ts                       # Supabase客户端
│   ├── llm/llm-adapter.ts          # LLM统一适配层
│   └── engine/                     # AI训练引擎核心
│       ├── types.ts                # 类型定义
│       ├── state-machine.ts        # 9状态机
│       ├── memory-store.ts         # 买家记忆系统
│       ├── rule-engine.ts          # 规则引擎
│       ├── prompt-builder.ts       # Prompt构建器
│       ├── scoring-engine.ts       # 评分引擎
│       ├── training-engine.ts      # 训练编排器
│       └── index.ts
└── storage/database/
    ├── supabase-client.ts          # Supabase客户端模板
    └── shared/schema.ts            # Drizzle Schema
```

## 核心业务规则

- 聊天风格：口语化，禁止客服腔
- 面交处理：允许编造身份/地点回避，主推出差型
- 物流：全业务COD货到付款，一口价含运费，覆盖13国
- 信任建立顺序：产品真实性→物流真实性→个人聊天真实性
- 优秀回复标杆：Hi! Battery is 92%. Never repaired. 256GB.
- 支持7种语言：西语/波兰语/捷克语/葡语/希腊语/克罗地亚语/英语

## 评分体系

- Rule Score: 60分（规则检查）
- AI Score: 40分（AI质量评分）
- Bonus: 10分（加分项）
- 总分: 0-110分

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发环境
pnpm build            # 构建
pnpm ts-check         # TypeScript检查
pnpm lint             # ESLint检查
```

## 数据库表

- `users` - 用户（员工/管理员/老板）
- `buyer_persona` - 12种买家类型配置
- `market_config` - 7个市场参数配置
- `prompt_template` - 3套Prompt模板(Buyer/Coach/Judge)
- `scenario_config` - 训练场景配置
- `training_history` - 训练记录
- `chat_message` - 对话消息
- `score_detail` - 评分明细
- `cases` - 案例库
- `wrong_questions` - 错题收藏
- `help_requests` - 实战求助
