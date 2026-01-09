export const EnvConfiguration = () => ({
  server: {
    port: process.env.PORT || 3001,
    jwtsecretkey: process.env.JWTSECRETKEY,
    jwtrefreshtokenkey: process.env.JWTREFRESHTOKENKEY,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    slackWebhookUrlMerch: process.env.SLACK_WEBHOOK_URL_MERCH,
    slackWebhookUrlShop: process.env.SLACK_WEBHOOK_URL_SHOP,
    slackWebhookUrlOffboarding: process.env.SLACK_WEBHOOK_URL_OFFBOARDING,
    slackComputerUpgradeWebhook: process.env.SLACK_WEBHOOK_URL_COMPUTER_UPGRADE,
    frontendUrl: process.env.FRONTEND_URL,
    slackWebhookUrlShipments: process.env.SLACK_WEBHOOK_URL_SHIPMENTS,
    slackWebhookUrlWarehouseAlerts:
      process.env.SLACK_WEBHOOK_URL_WAREHOUSE_ALERTS,
    slackWebhookUrlQuotes: process.env.SLACK_WEBHOOK_URL_QUOTES,
  },
  database: {
    connectionString: process.env.DB_CONNECTION_STRING,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
});
