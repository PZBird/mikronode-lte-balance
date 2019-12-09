module.exports = () => {
  process.on("unhandledRejection", ex => {
    console.error("\x1b[31m", "Unhandled Promise Rejection", ex.message, ex);
    process.exit(1);
  });
  process.on("uncaughtException", ex => {
    console.error("\x1b[31m", "Uncaught Exception", ex.message, ex);
    process.exit(1);
  });
};
