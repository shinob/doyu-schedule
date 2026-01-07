const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class PuppeteerDoyuClient {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  async initialize() {
    console.log('🚀 Starting Puppeteer browser...');
    this.browser = await puppeteer.launch({
      headless: 'new', // より安定したheadlessモード
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // ユーザーエージェントを設定（一般的なブラウザに偽装）
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // ビューポートサイズを設定
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // キャッシュ無効化ヘッダーを設定
    await this.page.setExtraHTTPHeaders({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    console.log('✅ Puppeteer browser initialized');
  }

  async login(username, password) {
    if (!this.page) {
      throw new Error('Puppeteer not initialized. Call initialize() first.');
    }

    try {
      console.log('🔐 Attempting login with Puppeteer...');
      
      // e-doyuのスケジュールページにアクセス
      const prefecture = process.env.DOYU_PREFECTURE || 'shimane';
      const baseURL = process.env.DOYU_BASE_URL || `https://${prefecture}.e-doyu.jp`;
      const scheduleURL = `${baseURL}/s.schedule/eventList.html?init&vmode=view&appid=1033&vBaseURL=${encodeURIComponent(baseURL)}%2Fs.calendar%2Findex.html%3Freset%26appid%3D1033%26vCalType%3DMonth%26vSelGroup%3D4562%26vDateSelBase%3D2025%2F12%2F27`;
      
      console.log(`📖 Navigating to: ${scheduleURL}`);
      await this.page.goto(scheduleURL, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // ページのタイトルを確認
      const pageTitle = await this.page.title();
      console.log(`📄 Page title: ${pageTitle}`);
      
      // ログインフォームが存在するかチェック
      const loginFormExists = await this.page.$('form[name="frmLogin"]') !== null;
      console.log(`🔍 Login form detected: ${loginFormExists}`);
      
      if (loginFormExists) {
        console.log('🔑 Filling login form...');
        
        // ユーザー名入力
        await this.page.waitForSelector('input[name="username"]', { timeout: 5000 });
        await this.page.type('input[name="username"]', username);
        console.log('👤 Username entered');
        
        // パスワード入力
        await this.page.waitForSelector('input[name="password"]', { timeout: 5000 });
        await this.page.type('input[name="password"]', password);
        console.log('🔒 Password entered');
        
        // 少し待機（フォーム処理のため）
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // ログインフォーム送信（送信ボタンまたはEnterキー）
        console.log('📤 Submitting login form...');
        
        // 送信ボタンがあるか確認
        const submitButton = await this.page.$('form[name="frmLogin"] input[type="submit"], form[name="frmLogin"] button[type="submit"], form[name="frmLogin"] button');
        
        if (submitButton) {
          console.log('🖱️ Clicking submit button...');
          await submitButton.click();
        } else {
          console.log('⌨️ Using Enter key...');
          await this.page.keyboard.press('Enter');
        }
        
        // ページの変化を待機
        try {
          await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
          console.log('🔄 Page navigation completed');
        } catch (navError) {
          console.log('⏰ Navigation timeout, checking current state...');
          // ナビゲーションがなくても、ページの状態をチェック
        }
        
        // ログイン成功の確認
        await new Promise(resolve => setTimeout(resolve, 2000));
        const afterLoginTitle = await this.page.title();
        const stillHasLoginForm = await this.page.$('form[name="frmLogin"]') !== null;
        
        console.log(`📄 After login page title: ${afterLoginTitle}`);
        console.log(`🔍 Still has login form: ${stillHasLoginForm}`);
        
        if (!stillHasLoginForm) {
          this.isAuthenticated = true;
          console.log('✅ Login successful!');
          // 成功時のスクリーンショット
          await this.takeScreenshot('login-success.png');
          return true;
        } else {
          console.error('❌ Login failed - still shows login form');
          // 失敗時のスクリーンショット
          await this.takeScreenshot('login-failed.png');
          
          // エラーメッセージがあるか確認
          const errorMessages = await this.page.$$eval('.error, .alert, .warning', elements => 
            elements.map(el => el.textContent.trim())
          ).catch(() => []);
          
          if (errorMessages.length > 0) {
            console.error('🚨 Error messages found:', errorMessages);
          }
          
          return false;
        }
      } else {
        // ログインフォームがない場合は既に認証済み
        this.isAuthenticated = true;
        console.log('✅ No login required - already authenticated');
        return true;
      }
      
    } catch (error) {
      console.error('❌ Login error:', error.message);
      return false;
    }
  }

  async fetchScheduleData() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Call login() first.');
    }

    try {
      console.log('📊 Fetching schedule data...');
      
      // ページが切り離されている場合は新しいページを作成し、再認証を実行
      try {
        await this.page.evaluate(() => document.title);
      } catch (error) {
        console.log('🔄 Page detached, re-authenticating...');
        this.isAuthenticated = false;
        
        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await this.page.setViewport({ width: 1280, height: 720 });
        
        // キャッシュ無効化ヘッダーを設定
        await this.page.setExtraHTTPHeaders({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        
        // 再ログインを実行
        const username = process.env.DOYU_USERNAME;
        const password = process.env.DOYU_PASSWORD;
        const loginSuccess = await this.login(username, password);
        
        if (!loginSuccess) {
          throw new Error('Failed to re-authenticate after page detachment');
        }
      }
      
      // ページを強制リロードして最新コンテンツを取得
      try {
        await this.page.reload({ waitUntil: 'networkidle0', timeout: 15000 });
        console.log('🔄 Page reloaded to get fresh content');
      } catch (reloadError) {
        console.log('⚠️ Page reload failed, proceeding with current content');
      }
      
      // 現在のページのHTMLコンテンツを取得
      const html = await this.page.content();
      console.log(`📄 Retrieved HTML: ${html.length} characters`);
      
      // HTMLをタイムスタンプ付きファイルに保存（デバッグ用）
      const fs = require('fs').promises;
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const debugPath = path.join(__dirname, `../logs/puppeteer-response-${timestamp}.html`);
      await fs.mkdir(path.dirname(debugPath), { recursive: true });
      await fs.writeFile(debugPath, html, 'utf8');
      console.log(`🗂️ Debug HTML saved to: ${debugPath}`);
      
      // 最新のファイルへのリンクも保持
      const latestPath = path.join(__dirname, '../logs/puppeteer-response-latest.html');
      await fs.writeFile(latestPath, html, 'utf8');
      
      return html;
      
    } catch (error) {
      console.error('❌ Error fetching schedule data:', error.message);
      throw error;
    }
  }

  async fetchEventDetails(eventId) {
    if (!this.page) {
      throw new Error('Puppeteer not initialized.');
    }

    try {
      const prefecture = process.env.DOYU_PREFECTURE || 'shimane';
      const baseURL = process.env.DOYU_BASE_URL || `https://${prefecture}.e-doyu.jp`;
      const detailURL = `${baseURL}/s.schedule/eventDetails.html?init&vmode=view&appid=1033&CCCID=&gw33105=${eventId}`;
      
      console.log(`🔍 Fetching event details: ${eventId}`);
      await this.page.goto(detailURL, { waitUntil: 'networkidle0', timeout: 15000 });
      
      // ページの内容を解析
      const eventDetails = await this.page.evaluate(() => {
        const details = {};
        
        // タイトルを取得
        const titleElement = document.querySelector('h1, h2, h3, .title, .event-title');
        details.title = titleElement ? titleElement.textContent.trim() : '';
        
        // 日時情報を検索
        const dateElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.includes('年') && text.includes('月') && text.includes('日') ||
                 text.includes('開催日') || text.includes('日時') || text.includes('時間');
        });
        
        details.dateTexts = dateElements.map(el => el.textContent.trim()).filter(text => text.length > 0);
        
        // 場所情報を検索
        const locationElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.includes('会場') || text.includes('場所') || text.includes('開催地') ||
                 text.includes('住所') || text.includes('所在地');
        });
        
        details.locationTexts = locationElements.map(el => el.textContent.trim()).filter(text => text.length > 0);
        
        // 説明・内容を取得
        const contentElements = Array.from(document.querySelectorAll('p, div, span')).filter(el => {
          const text = el.textContent || '';
          return text.length > 10 && text.length < 500;
        });
        
        details.contentTexts = contentElements.map(el => el.textContent.trim()).slice(0, 5);
        
        // 全体のHTMLを保存（デバッグ用）
        details.fullHTML = document.documentElement.outerHTML;
        
        return details;
      });
      
      // 詳細ページのHTMLを保存
      const fs = require('fs').promises;
      const path = require('path');
      const debugDetailPath = path.join(__dirname, `../logs/event-detail-${eventId}.html`);
      await fs.writeFile(debugDetailPath, eventDetails.fullHTML, 'utf8');
      
      return eventDetails;
      
    } catch (error) {
      console.error(`❌ Error fetching details for event ${eventId}:`, error.message);
      return null;
    }
  }

  async fetchAllEventDetails(eventIds) {
    const allDetails = [];
    
    console.log(`🔄 Fetching details for ${eventIds.length} events...`);
    
    // 最初の数件のみを詳細取得（パフォーマンス考慮）
    const limitedIds = eventIds.slice(0, 5);
    
    for (const eventId of limitedIds) {
      const details = await this.fetchEventDetails(eventId);
      if (details) {
        allDetails.push({ eventId, ...details });
      }
      
      // レート制限を避けるため少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Retrieved details for ${allDetails.length} events`);
    return allDetails;
  }

  async close() {
    if (this.browser) {
      console.log('🔚 Closing Puppeteer browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isAuthenticated = false;
      console.log('✅ Browser closed');
    }
  }

  // スクリーンショット機能（デバッグ用）
  async takeScreenshot(filename = 'debug-screenshot.png') {
    if (this.page) {
      const screenshotPath = `./logs/${filename}`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
    }
  }
}

module.exports = PuppeteerDoyuClient;