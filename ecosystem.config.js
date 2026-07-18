module.exports = {
  apps: [{
    name: "train",
    cwd: "/home/ubuntu/zy-sales-traine",
    script: "npm",
    args: "start",
    env: {
      COZE_PROJECT_ENV: "PROD",
      PORT: 3000,
      HOSTNAME: "0.0.0.0",
      COZE_SUPABASE_URL: "https://br-peppy-pike-04ffaa28.supabase2.aidap-global.cn-beijing.volces.com",
      COZE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNjQ5NjE1NDEsInJvbGUiOiJhbm9uIn0.7hYU2pQbFe9fHe-ZlDE9MMQ2S8B_Ank6qzZnv6HI91g",
      COZE_SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNjQ5NjE1NDEsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.cJcPhwDTZYJyfRuB6sAQywvfVTQdwTercqVjPXTUG5g",
      COZE_BUCKET_ENDPOINT_URL: "https://integration.coze.cn/coze-coding-s3proxy/v1",
      COZE_BUCKET_NAME: "bucket_1784321390844",
      OPENAI_API_KEY: "sk-cae6a3b65f1e44aa9042ae621c93c992",
      OPENAI_BASE_URL: "https://api.deepseek.com/v1",
      DEEPSEEK_MODEL_ID: "deepseek-chat"
    }
  }]
}
