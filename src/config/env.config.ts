export const EnvConfiguration = () => ({
  server: {
    port: process.env.PORT || 3001,
    jwtsecretkey: process.env.JWTSECRETKEY,
    jwtrefreshtokenkey: process.env.JWTREFRESHTOKENKEY,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    frontendUrl: process.env.FRONTEND_URL,
  },
  database: {
    connectionString: process.env.DB_CONNECTION_STRING,
  },
});
