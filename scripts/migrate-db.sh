#!/bin/bash
# ZY Sales Trainer - 数据库迁移脚本
# 从 Supabase 迁移到标准 PostgreSQL

set -e

echo "========================================="
echo "ZY Sales Trainer 数据库迁移脚本"
echo "========================================="

# 检查参数
if [ $# -lt 2 ]; then
    echo "用法: $0 <supabase_url> <postgres_url>"
    echo ""
    echo "示例:"
    echo "  $0 postgresql://user:pass@supabase-host:5432/supabase-db postgresql://zy_user:pass@localhost:5432/zy_sales_trainer"
    echo ""
    echo "注意:"
    echo "  - 确保目标数据库已创建并执行了 schema.sql"
    echo "  - 迁移前请备份数据"
    exit 1
fi

SOURCE_URL=$1
TARGET_URL=$2

echo ""
echo "源数据库: $SOURCE_URL"
echo "目标数据库: $TARGET_URL"
echo ""

# 检查 pg_dump 和 psql 是否可用
if ! command -v pg_dump &> /dev/null; then
    echo "错误: 未找到 pg_dump，请安装 PostgreSQL 客户端"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "错误: 未找到 psql，请安装 PostgreSQL 客户端"
    exit 1
fi

# 创建临时目录
TEMP_DIR=$(mktemp -d)
echo "临时目录: $TEMP_DIR"

# 导出源数据库
echo ""
echo "步骤 1/4: 导出源数据库..."
pg_dump \
    --dbname="$SOURCE_URL" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --file="$TEMP_DIR/source_schema.sql"

pg_dump \
    --dbname="$SOURCE_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --file="$TEMP_DIR/source_data.sql"

echo "✓ 导出完成"

# 转换 schema（移除 Supabase 特定的扩展和函数）
echo ""
echo "步骤 2/4: 转换 schema..."
cat "$TEMP_DIR/source_schema.sql" | \
    grep -v "CREATE EXTENSION" | \
    grep -v "ALTER DEFAULT PRIVILEGES" | \
    grep -v "GRANT" | \
    grep -v "REVOKE" > "$TEMP_DIR/target_schema.sql"

echo "✓ 转换完成"

# 导入到目标数据库
echo ""
echo "步骤 3/4: 导入数据到目标数据库..."

# 先导入 schema（如果目标数据库是空的）
# psql --dbname="$TARGET_URL" --file="$TEMP_DIR/target_schema.sql"

# 导入数据
psql \
    --dbname="$TARGET_URL" \
    --file="$TEMP_DIR/source_data.sql" \
    --quiet

echo "✓ 导入完成"

# 验证迁移
echo ""
echo "步骤 4/4: 验证迁移..."

# 检查表数量
SOURCE_TABLES=$(psql --dbname="$SOURCE_URL" --tuples-only --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
TARGET_TABLES=$(psql --dbname="$TARGET_URL" --tuples-only --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

echo "源数据库表数量: $SOURCE_TABLES"
echo "目标数据库表数量: $TARGET_TABLES"

if [ "$SOURCE_TABLES" = "$TARGET_TABLES" ]; then
    echo "✓ 表数量匹配"
else
    echo "⚠ 表数量不匹配，请检查"
fi

# 检查关键表的记录数
echo ""
echo "关键表记录数对比:"
for table in users training_history chat_message cases wrong_questions; do
    SOURCE_COUNT=$(psql --dbname="$SOURCE_URL" --tuples-only --command="SELECT count(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
    TARGET_COUNT=$(psql --dbname="$TARGET_URL" --tuples-only --command="SELECT count(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
    echo "  $table: 源=$SOURCE_COUNT, 目标=$TARGET_COUNT"
done

# 清理临时文件
echo ""
echo "清理临时文件..."
rm -rf "$TEMP_DIR"
echo "✓ 清理完成"

echo ""
echo "========================================="
echo "迁移完成！"
echo "========================================="
echo ""
echo "下一步:"
echo "1. 检查目标数据库的数据是否完整"
echo "2. 更新应用的数据库连接配置"
echo "3. 重启应用服务"
echo ""
