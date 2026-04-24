export const config = {
  port: parseInt(process.env.PORT || "3003", 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://northwind:northwind@localhost:5432/webhooks",
};
