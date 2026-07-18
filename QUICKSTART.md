# ZY Sales Trainer - 快速部署指南

## 5分钟快速部署

### 1. 安装依赖
```bash
# 安装 PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# 安装 Node.js 24+
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install nodejs

# 安装 pnpm
npm install -g pnpm
```

### 2. 创建数据库
```bash
# 登录 PostgreSQL
sudo -u postgres psql

# 执行以下 SQL
CREATE DATABASE zy_sales_trainer;
CREATE USER zy_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE zy_sales_trainer TO zy_user;
\q

# 初始化数据库结构
psql -U zy_user -d zy_sales_trainer -h localhost -f database/schema.sql
psql -U zy_user -d zy_sales_trainer -h localhost -f database/seed.sql
```

### 3. 配置环境变量
```bash
# 克隆项目
git clone https://github.com/zhengxuan888/zy-sales-traine.git
cd zy-sales-traine

# 创建 .env 文件
cat > .env << EOF
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=zy_sales_trainer
POSTGRES_USER=zy_user
POSTGRES_PASSWORD=your_password
PORT=5000
NODE_ENV=production
EOF
```

### 4. 安装和构建
```bash
pnpm install
pnpm build
```

### 5. 启动服务
```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start "pnpm start" --name zy-sales-trainer
pm2 save
pm2 startup
```

### 6. 访问
打开浏览器访问 `http://your-server-ip:5000`

## 完整部署文档

详细部署文档请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 常见问题

**Q: 数据库连接失败？**
A: 检查 PostgreSQL 是否运行，用户名密码是否正确

**Q: 端口被占用？**
A: 修改 `.env` 中的 `PORT` 变量

**Q: 如何更新代码？**
A: `git pull` 后重新 `pnpm build`，然后 `pm2 restart zy-sales-trainer`
