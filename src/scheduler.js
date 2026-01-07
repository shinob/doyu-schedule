const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const DoyuClient = require('./doyuClient');
const PuppeteerDoyuClient = require('./puppeteerClient');
const ICalGenerator = require('./icalGenerator');
const FTPUploader = require('./ftpUploader');

class ScheduleSync {
  constructor() {
    this.doyuClient = new DoyuClient();
    this.puppeteerClient = new PuppeteerDoyuClient();
    this.icalGenerator = new ICalGenerator();
    this.ftpUploader = new FTPUploader();
    this.outputPath = path.join(__dirname, '../public/schedule.ics');
    this.lastSync = null;
    this.lastFtpUpload = null;
    this.isRunning = false;
    this.usePuppeteer = true; // Puppeteerを優先使用
  }

  async initialize() {
    const username = process.env.DOYU_USERNAME;
    const password = process.env.DOYU_PASSWORD;

    if (!username || !password) {
      throw new Error('DOYU_USERNAME and DOYU_PASSWORD must be set in environment variables');
    }

    if (this.usePuppeteer) {
      console.log('🤖 Initializing with Puppeteer...');
      await this.puppeteerClient.initialize();
      const loginSuccess = await this.puppeteerClient.login(username, password);
      
      if (!loginSuccess) {
        console.log('❌ Puppeteer login failed, falling back to HTTP client...');
        this.usePuppeteer = false;
        const httpLoginSuccess = await this.doyuClient.login(username, password);
        if (!httpLoginSuccess) {
          throw new Error('Failed to login with both Puppeteer and HTTP client');
        }
      }
    } else {
      console.log('🌐 Initializing with HTTP client...');
      const loginSuccess = await this.doyuClient.login(username, password);
      if (!loginSuccess) {
        throw new Error('Failed to login to e-doyu');
      }
    }

    console.log('✅ Scheduler initialized successfully');
  }

  async syncSchedule() {
    if (this.isRunning) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting schedule sync...');

    try {
      let htmlData;
      let events;

      if (this.usePuppeteer) {
        console.log('🤖 Fetching data with Puppeteer...');
        htmlData = await this.puppeteerClient.fetchScheduleData();
        events = this.doyuClient.parseScheduleHTML(htmlData);
      } else {
        console.log('🌐 Fetching data with HTTP client...');
        events = await this.doyuClient.fetchScheduleData();
      }
      
      this.icalGenerator.clear();
      this.icalGenerator.addEvents(events);
      
      const icalContent = this.icalGenerator.generate();
      
      await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
      await fs.writeFile(this.outputPath, icalContent, 'utf8');
      
      this.lastSync = new Date();
      
      console.log(`✅ Sync completed: ${events.length} events, ${this.icalGenerator.getEventCount()} added to calendar`);
      console.log(`📁 iCal file saved to: ${this.outputPath}`);
      
      // FTPアップロード
      if (this.ftpUploader.isConfigured()) {
        console.log('📡 Starting FTP upload...');
        const ftpResult = await this.ftpUploader.uploadSchedule();
        
        if (ftpResult.success) {
          this.lastFtpUpload = new Date();
          console.log(`✅ FTP upload successful to: ${ftpResult.remotePath}`);
        } else {
          console.error(`❌ FTP upload failed: ${ftpResult.error || ftpResult.reason}`);
        }
      } else {
        console.log('📡 FTP upload skipped - not configured');
      }
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  startScheduledSync() {
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running scheduled sync...');
      try {
        await this.syncSchedule();
      } catch (error) {
        console.error('Scheduled sync failed:', error.message);
      }
    });

    console.log('Scheduled sync started (every 6 hours)');
  }

  getStatus() {
    return {
      lastSync: this.lastSync,
      lastFtpUpload: this.lastFtpUpload,
      isRunning: this.isRunning,
      authenticated: this.usePuppeteer ? this.puppeteerClient.isAuthenticated : this.doyuClient.isAuthenticated,
      method: this.usePuppeteer ? 'puppeteer' : 'http-client',
      ftp: this.ftpUploader.getStatus()
    };
  }


  async cleanup() {
    if (this.usePuppeteer) {
      await this.puppeteerClient.close();
    }
  }
}

module.exports = ScheduleSync;