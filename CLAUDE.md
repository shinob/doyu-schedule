# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js web scraping application that automatically extracts schedule data from e-doyu (a Japanese business networking platform) and converts it to iCal format for calendar integration. The system supports both Puppeteer-based browser automation and HTTP client fallback for data extraction. Multi-prefecture support is available through environment variable configuration.

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server with file watching
npm run dev

# Start production server
npm start
```

### Preferred Startup Method
```bash
# Basic startup (recommended)
./run.sh

# Custom port
./run.sh -p 8080

# Background daemon mode
./run.sh --daemon

# Stop daemon process
kill $(cat doyu-schedule.pid)
```

### Environment Setup
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env file with your e-doyu credentials and settings
```

## Core Architecture

The application follows a modular architecture with clear separation of concerns:

- **scheduler.js**: Main orchestrator that manages the data sync workflow, handles both Puppeteer and HTTP client fallback, coordinates with all other modules
- **app.js**: Express.js web server providing REST API endpoints for manual sync, status checks, and iCal file serving
- **puppeteerClient.js**: Browser automation client using Puppeteer for JavaScript-heavy sites, handles authentication and DOM interaction
- **doyuClient.js**: HTTP client fallback with comprehensive HTML parsing using Cheerio, includes multiple authentication strategies
- **icalGenerator.js**: iCal format conversion and calendar event generation
- **ftpUploader.js**: Optional FTP upload functionality for external file sharing

### Data Flow
1. ScheduleSync initializes either Puppeteer or HTTP client based on configuration
2. Authentication is attempted with primary method, falls back if needed
3. Schedule data is fetched and parsed from e-doyu HTML structure
4. Events are converted to iCal format and saved to public/schedule.ics
5. Optional FTP upload distributes the file to external servers
6. Process runs on 6-hour cron schedule or via manual API trigger

## Key Dependencies

- **puppeteer**: Browser automation for JavaScript-heavy authentication
- **cheerio**: Server-side HTML parsing and DOM manipulation
- **ical-generator**: iCal format generation and RFC5545 compliance
- **node-cron**: Scheduled task execution
- **express**: Web server and API endpoints
- **basic-ftp**: FTP file upload functionality

## Environment Variables

Required variables in `.env`:
- `DOYU_PREFECTURE`: Prefecture name (e.g., shimane, hiroshima, kagawa) - determines target e-doyu site
- `DOYU_USERNAME`: e-doyu authentication username
- `DOYU_PASSWORD`: e-doyu authentication password
- `SESSION_SECRET`: Express session encryption key

Optional variables:
- `PORT`: HTTP server port (default: 3000)
- `ICAL_DOMAIN`: iCalendar domain identifier (default: [prefecture]-doyu.local)
- `DOYU_BASE_URL`: Override base URL if needed (default: https://[prefecture].e-doyu.jp)

Optional FTP variables:
- `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_REMOTE_PATH`, `FTP_ENABLED`: FTP upload configuration

## API Endpoints

- `GET /`: System status and information
- `GET /schedule.ics`: Download iCal file
- `POST /sync`: Trigger manual schedule synchronization
- `GET /status`: Detailed sync status and metrics
- `POST /ftp/test`: Test FTP connection
- `POST /ftp/upload`: Manual FTP upload

## File Structure

- `src/`: Source code modules
- `public/`: Generated iCal files and static content
- `logs/`: Debug HTML files and application logs
- `config/`: Configuration files (if present)

## Development Notes

- The system prioritizes Puppeteer for authentication but gracefully falls back to HTTP client
- HTML parsing includes multiple fallback strategies for different e-doyu page structures
- All scraping operations save debug HTML files for troubleshooting
- Authentication state is maintained across requests within each client
- FTP upload is optional and can be disabled by omitting FTP environment variables

## Multi-Prefecture Configuration

The application dynamically constructs URLs based on the `DOYU_PREFECTURE` environment variable:
- Base URL: `https://[prefecture].e-doyu.jp`
- Schedule pages and event details automatically adapt to the prefecture
- iCal calendar names and domains are generated based on prefecture setting
- Each prefecture maintains separate calendar identifiers to avoid conflicts

Example configurations:
```bash
# Shimane Prefecture
DOYU_PREFECTURE=shimane
ICAL_DOMAIN=shimane-doyu.local

# Hiroshima Prefecture  
DOYU_PREFECTURE=hiroshima
ICAL_DOMAIN=hiroshima-doyu.local

# Kagawa Prefecture
DOYU_PREFECTURE=kagawa
ICAL_DOMAIN=kagawa-doyu.local
```