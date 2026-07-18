# ZY Sales Trainer - 自部署指南

本文档介绍如何将 ZY Sales Trainer 部署到自己的服务器上，使用独立的 PostgreSQL 数据库。

## 系统要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+) 或 macOS
- **Node.js**: 24+
- **PostgreSQL**: 14+
- **pnpm**: 8+

## 1. 安装 PostgreSQL

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### CentOS/RHEL
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS (Homebrew)
```bash
brew install postgresql@14
brew services start postgresql@14
```

## 2. 创建数据库和用户

```bash
# 登录 PostgreSQL
sudo -u postgres psql

# 创建数据库
CREATE DATABASE zy_sales_trainer;

# 创建用户
CREATE USER zy_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# 授权
GRANT ALL PRIVILEGES ON DATABASE zy_sales_trainer TO zy_user;

# 退出
\q
```

## 3. 初始化数据库结构

```bash
# 连接到数据库
psql -U zy_user -d zy_sales_trainer -h localhost

# 执行 schema 文件
\i /path/to/zy-sales-traine/database/schema.sql

# 执行 seed 文件（初始数据）
\i /path/to/zy-sales-traine/database/seed.sql

# 退出
\q
```

或者使用一行命令：
```bash
psql -U zy_user -d zy_sales_trainer -h localhost -f database/schema.sql
psql -U zy_user -d zy_sales_trainer -h localhost -f database/seed.sql
```

## 4. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# 数据库配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=zy_sales_trainer
POSTGRES_USER=zy_user
POSTGRES_PASSWORD=your_secure_password

# 应用配置
PORT=5000
NODE_ENV=production
HOSTNAME=0.0.0.0

# 对象存储配置（可选，使用本地存储则不需要）
# STORAGE_TYPE=local
# LOCAL_STORAGE_PATH=/var/lib/zy-sales-trainer/uploads

# LLM 配置（可选，使用内置模型则不需要）
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your_api_key
```

## 5. 修改代码使用 PostgreSQL

需要将项目中的 Supabase SDK 调用替换为标准 PostgreSQL 调用。

### 5.1 安装依赖
```bash
pnpm add pg
pnpm add -D @types/pg
```

### 5.2 更新数据库客户端

项目已提供 `src/lib/db-postgres.ts` 作为 PostgreSQL 客户端。

需要将所有 API 路由中的 `import { supabase } from '@/lib/db'` 替换为：
```typescript
import { query } from '@/lib/db-postgres';
```

### 5.3 示例：修改 API 路由

**原代码 (Supabase)**:
```typescript
import { supabase } from '@/lib/db';

const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);
```

**新代码 (PostgreSQL)**:
```typescript
import { query } from '@/lib/db-postgres';

const { rows } = await query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

## 6. 安装和构建

```bash
# 安装依赖
pnpm install

# 构建生产版本
pnpm build
```

## 7. 启动服务

### 方式一：直接启动
```bash
pnpm start
```

### 方式二：使用 PM2（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start "pnpm start" --name zy-sales-trainer

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status

# 查看日志
pm2 logs zy-sales-trainer
```

### 方式三：使用 systemd
创建 `/etc/systemd/system/zy-sales-trainer.service`:

```ini
[Unit]
Description=ZY Sales Trainer
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/zy-sales-traine
Environment="NODE_ENV=production"
EnvironmentFile=/path/to/zy-sales-traine/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl start zy-sales-trainer
sudo systemctl enable zy-sales-trainer
sudo systemctl status zy-sales-trainer
```

## 8. 配置 Nginx 反向代理（可选）

创建 `/etc/nginx/sites-available/zy-sales-trainer`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/zy-sales-trainer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 配置 HTTPS（推荐）

使用 Let's Encrypt：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 10. 数据备份

### 手动备份
```bash
pg_dump -U zy_user zy_sales_trainer > backup_$(date +%Y%m%d).sql
```

### 自动备份（cron）
```bash
# 编辑 crontab
crontab -e

# 添加每日备份任务（每天凌晨2点）
0 2 * * * pg_dump -U zy_user zy_sales_trainer > /backups/zy_sales_trainer_$(date +\%Y\%m\%d).sql
```

### 恢复备份
```bash
psql -U zy_user -d zy_sales_trainer -h localhost < backup_20240101.sql
```

## 11. 迁移现有数据

如果从 Coze 平台迁移数据：

1. 从 Coze 导出数据库（需要 Coze 支持）
2. 使用 `pg_dump` 导出：
   ```bash
   pg_dump -U coze_user -h coze-host coze_database > coze_backup.sql
   ```
3. 导入到新数据库：
   ```bash
   psql -U zy_user -d zy_sales_trainer -h localhost < coze_backup.sql
   ```

## 12. 故障排查

### 数据库连接失败
```bash
# 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 检查连接
psql -U zy_user -d zy_sales_trainer -h localhost

# 检查端口
sudo netstat -tlnp | grep 5432
```

### 应用启动失败
```bash
# 查看日志
pm2 logs zy-sales-trainer

# 检查环境变量
cat .env

# 检查端口占用
sudo netstat -tlnp | grep 5000
```

### 性能问题
```bash
# 检查数据库连接数
psql -U zy_user -d zy_sales_trainer -c "SELECT count(*) FROM pg_stat_activity;"

# 检查慢查询
psql -U zy_user -d zy_sales_trainer -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

## 13. 安全建议

1. **修改默认密码**：修改 PostgreSQL 用户密码
2. **防火墙配置**：只开放必要端口（80, 443）
3. **定期备份**：设置自动备份任务
4. **更新系统**：定期更新系统和依赖
5. **监控日志**：定期检查应用和数据库日志
6. **限制数据库访问**：只允许 localhost 连接

## 14. 环境变量参考

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `POSTGRES_HOST` | 数据库主机 | `localhost` |
| `POSTGRES_PORT` | 数据库端口 | `5432` |
| `POSTGRES_DATABASE` | 数据库名 | `zy_sales_trainer` |
| `POSTGRES_USER` | 数据库用户 | `postgres` |
| `POSTGRES_PASSWORD` | 数据库密码 | `postgres` |
| `PORT` | 应用端口 | `5000` |
| `NODE_ENV` | 运行环境 | `production` |
| `HOSTNAME` | 监听地址 | `0.0.0.0` |

## 支持

如有问题，请查看：
- 应用日志：`pm2 logs zy-sales-trainer`
- 数据库日志：`/var/log/postgresql/postgresql-*.log`
- 系统日志：`journalctl -u zy-sales-trainer`
