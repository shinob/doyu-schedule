const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const ScheduleSync = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;
const scheduler = new ScheduleSync();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'doyu-schedule-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.get('/', (req, res) => {
  res.json({ 
    message: 'Doyu Schedule API', 
    version: '1.0.0',
    status: scheduler.getStatus()
  });
});

app.get('/schedule.ics', async (req, res) => {
  try {
    const icalPath = path.join(__dirname, '../public/schedule.ics');
    const icalContent = await fs.readFile(icalPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="doyu-schedule.ics"');
    res.send(icalContent);
  } catch (error) {
    res.status(404).json({ error: 'Schedule not found' });
  }
});

app.post('/sync', async (req, res) => {
  try {
    await scheduler.syncSchedule();
    res.json({ 
      success: true, 
      message: 'Schedule synced successfully',
      status: scheduler.getStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/status', (req, res) => {
  res.json(scheduler.getStatus());
});

app.post('/ftp/test', async (req, res) => {
  try {
    const result = await scheduler.ftpUploader.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/ftp/upload', async (req, res) => {
  try {
    const result = await scheduler.ftpUploader.uploadSchedule();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

async function startServer() {
  try {
    await scheduler.initialize();
    scheduler.startScheduledSync();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📅 iCal URL: http://localhost:${PORT}/schedule.ics`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🔚 Shutting down gracefully...');
      await scheduler.cleanup();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;