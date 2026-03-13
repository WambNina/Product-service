const cron = require('node-cron');
const productService = require('../services/productService');

const initCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily payment expiry check...');
    try {
      const result = await productService.checkExpiredPayments();
      console.log(`Processed ${result.processed} expired products`);
    } catch (error) {
      console.error('Error in expiry check:', error);
    }
  });

  cron.schedule('0 9 * * *', async () => {
    console.log('Running renewal reminder check...');
    try {
      const result = await productService.sendRenewalReminders();
      console.log(`Sent ${result.reminders_sent} renewal reminders`);
    } catch (error) {
      console.error('Error in reminder check:', error);
    }
  });

  console.log('✅ Cron jobs initialized');
};

module.exports = initCronJobs;