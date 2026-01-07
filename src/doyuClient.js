const axios = require('axios');
const cheerio = require('cheerio');

class DoyuClient {
  constructor() {
    const prefecture = process.env.DOYU_PREFECTURE || 'shimane';
    this.baseURL = process.env.DOYU_BASE_URL || `https://${prefecture}.e-doyu.jp`;
    this.session = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      withCredentials: true
    });
    this.isAuthenticated = false;
  }

  async login(username, password) {
    try {
      console.log(`Attempting login to e-doyu with username: ${username}`);
      
      // e-doyuの一般的なログインフローを試す
      try {
        // 1. まずメインページを取得してセッションを開始
        console.log('Step 1: Accessing main page to establish session');
        const mainPage = await this.session.get('/');
        console.log('Main page response status:', mainPage.status);
        
        // 2. ログインページを取得
        console.log('Step 2: Accessing login page');
        const loginPage = await this.session.get('/login');
        const $ = cheerio.load(loginPage.data);
        
        // ログインフォームの詳細を分析
        const forms = $('form');
        console.log(`Found ${forms.length} forms on login page`);
        
        forms.each((i, form) => {
          const $form = $(form);
          const action = $form.attr('action');
          const method = $form.attr('method');
          console.log(`Form ${i}: action=${action}, method=${method}`);
          
          $form.find('input').each((j, input) => {
            const $input = $(input);
            console.log(`  Input ${j}: name=${$input.attr('name')}, type=${$input.attr('type')}`);
          });
        });

        // 3. 実際のe-doyuログインページにアクセス
        console.log('Step 3: Accessing actual e-doyu login page');
        const scheduleURL = '/s.schedule/eventList.html?init&vmode=view&appid=1033';
        const scheduleResponse = await this.session.get(scheduleURL);
        
        if (scheduleResponse.status === 200) {
          const $schedule = cheerio.load(scheduleResponse.data);
          
          // ログインページかどうかチェック
          const hasLoginForm = $schedule('form[name="frmLogin"]').length > 0;
          
          if (hasLoginForm) {
            console.log('Detected login page, proceeding with authentication');
            
            // ログインフォームの詳細を取得
            const form = $schedule('form[name="frmLogin"]');
            const action = form.attr('action') || '';
            
            console.log(`Login form action: ${action || 'default'}`);
            
            // フォームデータの準備
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            // 隠し入力フィールドも取得
            form.find('input[type="hidden"]').each((i, input) => {
              const $input = $schedule(input);
              const name = $input.attr('name');
              const value = $input.attr('value');
              if (name && value) {
                formData.append(name, value);
                console.log(`Hidden field added: ${name}=${value}`);
              }
            });

            // 4. ログイン実行
            console.log('Step 4: Submitting login form');
            const loginURL = action.startsWith('/') ? action : (action || scheduleURL);
            
            const loginResponse = await this.session.post(loginURL, formData, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': `${this.baseURL}${scheduleURL}`
              },
              maxRedirects: 5
            });

            console.log('Login response status:', loginResponse.status);
            
            // 5. ログイン後の確認（スケジュールページに再アクセス）
            console.log('Step 5: Verifying login by accessing schedule again');
            const verifyResponse = await this.session.get(scheduleURL);
            
            console.log('Verification response status:', verifyResponse.status);
            console.log('Response contains "ログイン" (indicates not logged in):', verifyResponse.data.includes('ログイン'));
            console.log('Response contains "frmLogin":', verifyResponse.data.includes('frmLogin'));
            
            if (verifyResponse.status === 200 && !verifyResponse.data.includes('frmLogin')) {
              this.isAuthenticated = true;
              console.log('✅ Login successful (Form Auth)');
              return true;
            } else {
              console.log('❌ Login verification failed - still seeing login form');
            }
          } else {
            console.log('✅ No login form detected - already authenticated or public access');
            this.isAuthenticated = true;
            return true;
          }
        }
      } catch (formError) {
        console.log('Form auth failed:', formError.message);
      }

      // 5. Basic認証も試す
      console.log('Step 5: Trying Basic Auth');
      try {
        const scheduleURL = '/s.schedule/eventList.html?init&vmode=view&appid=1033';
        const response = await this.session.get(scheduleURL, {
          auth: {
            username: username,
            password: password
          }
        });
        
        if (response.status === 200 && response.data.includes('schedule')) {
          this.isAuthenticated = true;
          console.log('✅ Login successful (Basic Auth)');
          return true;
        }
      } catch (basicError) {
        console.log('Basic auth failed:', basicError.message);
      }

      // 6. 認証なしテスト（パブリックアクセス）
      console.log('Step 6: Testing public access');
      try {
        const scheduleURL = '/s.schedule/eventList.html?init&vmode=view&appid=1033';
        const publicResponse = await this.session.get(scheduleURL);
        
        console.log('Public access status:', publicResponse.status);
        if (publicResponse.status === 200) {
          this.isAuthenticated = true;
          console.log('✅ Access successful (No Auth Required)');
          return true;
        }
      } catch (publicError) {
        console.log('Public access failed:', publicError.message);
      }

      console.error('❌ All login methods failed');
      return false;
      
    } catch (error) {
      console.error('❌ Login error:', error.message);
      return false;
    }
  }

  async fetchScheduleData() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const prefecture = process.env.DOYU_PREFECTURE || 'shimane';
      const baseURL = process.env.DOYU_BASE_URL || `https://${prefecture}.e-doyu.jp`;
      const scheduleURL = `/s.schedule/eventList.html?init&vmode=view&appid=1033&vBaseURL=${encodeURIComponent(baseURL)}%2Fs.calendar%2Findex.html%3Freset%26appid%3D1033%26vCalType%3DMonth%26vSelGroup%3D4562%26vDateSelBase%3D2025%2F12%2F27`;
      
      console.log(`Fetching schedule from: ${this.baseURL}${scheduleURL}`);
      const response = await this.session.get(scheduleURL);
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response length: ${response.data.length} characters`);
      
      // HTMLの内容をデバッグ出力（最初の500文字のみ）
      console.log('HTML preview:', response.data.substring(0, 500));
      
      // ログイン検出のデバッグ
      console.log('Login detection checks:');
      console.log('- Contains frmLogin:', response.data.includes('frmLogin'));
      console.log('- Contains ログイン:', response.data.includes('ログイン'));
      console.log('- Contains username:', response.data.includes('username'));
      console.log('- Contains password:', response.data.includes('password'));
      
      // ログインページが返された場合の処理
      if (response.data.includes('frmLogin') || response.data.includes('ログイン') || (response.data.includes('username') && response.data.includes('password'))) {
        console.log('🔐 Login page detected, attempting authentication...');
        
        // 認証情報を取得
        const username = process.env.DOYU_USERNAME;
        const password = process.env.DOYU_PASSWORD;
        
        if (username && password) {
          const $ = cheerio.load(response.data);
          const form = $('form[name="frmLogin"]');
          const action = form.attr('action') || scheduleURL;
          
          console.log(`Login form action: ${action}`);
          
          // action が空の場合は、一般的なe-doyuログインエンドポイントを試す
          const possibleLoginURLs = [
            '/login/check',
            '/login',
            '/auth/login', 
            '/doyu/login',
            '/system/login',
            '/'  // 最後のフォールバック
          ];
          
          // フォームデータの準備
          const formData = new URLSearchParams();
          formData.append('username', username);
          formData.append('password', password);
          
          // 隠し入力フィールドも取得
          form.find('input[type="hidden"]').each((i, input) => {
            const $input = $(input);
            const name = $input.attr('name');
            const value = $input.attr('value');
            if (name && value) {
              formData.append(name, value);
              console.log(`Hidden field: ${name}=${value}`);
            }
          });

          // 複数のログインエンドポイントを順番に試す
          let loginSuccess = false;
          
          for (const loginURL of possibleLoginURLs) {
            console.log(`Trying login endpoint: ${loginURL}`);
            
            try {
              const loginResponse = await this.session.post(loginURL, formData, {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Referer': `${this.baseURL}${scheduleURL}`
                },
                maxRedirects: 5
              });
              
              console.log(`Login response status for ${loginURL}: ${loginResponse.status}`);
              
              // ログイン成功の兆候をチェック
              if (loginResponse.status === 200 || loginResponse.status === 302) {
                // スケジュールページに再アクセスして確認
                console.log('Verifying login success...');
                const verifyResponse = await this.session.get(scheduleURL);
                
                if (verifyResponse.status === 200 && !verifyResponse.data.includes('frmLogin')) {
                  console.log(`✅ Login successful via ${loginURL}`);
                  response.data = verifyResponse.data;
                  loginSuccess = true;
                  break;
                } else {
                  console.log(`❌ Login verification failed for ${loginURL}`);
                }
              }
            } catch (loginError) {
              console.log(`Login attempt failed for ${loginURL}: ${loginError.message}`);
              continue;
            }
          }
          
          if (!loginSuccess) {
            console.error('❌ All login endpoints failed');
            throw new Error('Authentication failed - no valid login endpoint found');
          }
        } else {
          throw new Error('Username and password not configured');
        }
      }
      
      // HTMLファイルとして保存してデバッグ用に確認
      const fs = require('fs').promises;
      const path = require('path');
      const debugPath = path.join(__dirname, '../logs/debug-response.html');
      await fs.mkdir(path.dirname(debugPath), { recursive: true });
      await fs.writeFile(debugPath, response.data, 'utf8');
      console.log(`Debug HTML saved to: ${debugPath}`);
      
      return this.parseScheduleHTML(response.data);
    } catch (error) {
      console.error('Error fetching schedule data:', error.message);
      throw error;
    }
  }

  parseScheduleHTML(html) {
    const $ = cheerio.load(html);
    const events = [];

    console.log('HTML structure analysis:', {
      totalElements: $('*').length,
      hasTable: $('table').length > 0,
      hasList: $('ul, ol').length > 0,
      hasDivs: $('div').length > 0,
      title: $('title').text()
    });

    // e-doyuの実際の構造に基づいたパース
    console.log('🔍 Parsing e-doyu specific structure...');
    
    // イベント詳細リンクを検索（実際の構造に基づく）
    const eventLinks = $('a[onclick*="showEventDetails"]');
    console.log(`Found ${eventLinks.length} event links`);
    
    eventLinks.each((index, element) => {
      const $link = $(element);
      const title = $link.text().trim();
      
      if (title && title.length > 0) {
        // onclick属性からイベントIDを抽出
        const onclickAttr = $link.attr('onclick') || '';
        const idMatch = onclickAttr.match(/showEventDetails\('(\d+)'/);
        const eventId = idMatch ? idMatch[1] : `event-${index}`;
        
        // 親要素から日付情報を探す - 開催日/時間列（3番目の列）を確認
        const $row = $link.closest('tr');
        let dateInfo = null;
        let endDateInfo = null;
        let location = '';
        
        // テーブル行から開催日/時間列（3番目）と会場名列（6番目）を取得
        const dateCells = $row.find('td');
        if (dateCells.length > 2) {
          // 3番目のセルから開催日/時間を取得
          const dateTimeCell = $(dateCells[2]).text().trim();
          const parsedDateTime = this.parseDetailDateTime(dateTimeCell);
          if (parsedDateTime) {
            dateInfo = parsedDateTime.start;
            endDateInfo = parsedDateTime.end;
          }
        }
        
        if (dateCells.length > 5) {
          // 6番目のセルから会場名を取得
          location = $(dateCells[5]).text().trim();
        }
        
        // フォールバック: タイトルから年月を抽出（例: "2026年1月度広報委員会"）
        if (!dateInfo) {
          const yearMonthMatch = title.match(/(\d{4})年(\d{1,2})月/);
          if (yearMonthMatch) {
            const year = parseInt(yearMonthMatch[1]);
            const month = parseInt(yearMonthMatch[2]);
            dateInfo = new Date(year, month - 1, 1);
          }
        }
        
        const event = {
          id: eventId,
          title: title,
          description: title,
          startDate: dateInfo,
          endDate: endDateInfo,
          location: location,
          url: `${this.baseURL}/s.schedule/eventDetails.html?init&vmode=view&appid=1033&CCCID=&gw33105=${eventId}`
        };
        
        events.push(event);
        const dateStr = dateInfo ? dateInfo.toISOString().substring(0, 16).replace('T', ' ') : 'no date';
        console.log(`📅 Event found: ${title} (ID: ${eventId}) - ${dateStr}`);
      }
    });

    // 追加のイベント構造を検索（フォールバック）
    if (events.length === 0) {
      console.log('🔍 Trying additional parsing methods...');
      
      // より幅広いセレクタでイベント要素を検索
      const selectors = [
        '.event-item', '.calendar-event', '.schedule-item',
        'tr[data-date]', 'tr.event', 'tr.schedule',
        '.event', '.schedule', '.calendar-item',
        'div[class*="event"]', 'div[class*="schedule"]',
        'li[class*="event"]', 'li[class*="schedule"]'
      ];

      let foundElements = 0;
      
      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          foundElements += elements.length;
          
          elements.each((index, element) => {
            const $event = $(element);
            
            const event = {
              id: $event.attr('data-id') || $event.attr('id') || `event-${selector}-${index}`,
              title: this.extractText($event, ['.title', '.event-title', '.subject', '.name', 'h1', 'h2', 'h3', 'strong', 'b']),
              description: this.extractText($event, ['.description', '.event-desc', '.detail', '.content', '.summary', 'p']),
              startDate: this.extractDate($event, ['.start-date', '.date', '.event-date', '.time']),
              endDate: this.extractDate($event, ['.end-date', '.date-end']),
              location: this.extractText($event, ['.location', '.venue', '.place', '.address']),
              url: $event.find('a').attr('href') || $event.attr('href')
            };

            if (event.title && event.title.length > 0) {
              events.push(event);
            }
          });
          
          if (elements.length > 5) break;
        }
      }

      // 一般的なテーブル構造も試す
      if (events.length === 0) {
        console.log('Trying table-based parsing...');
        this.parseTableStructure($, events);
      }

      // リスト構造も試す
      if (events.length === 0) {
        console.log('Trying list-based parsing...');
        this.parseListStructure($, events);
      }
    }

    console.log(`✅ Parsed ${events.length} total events`);
    return events;
  }

  extractText($element, selectors) {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text && text.length > 0) return text;
    }
    // フォールバック: 要素自体のテキスト
    return $element.text().trim().substring(0, 100);
  }

  extractDate($element, selectors) {
    for (const selector of selectors) {
      const dateText = $element.find(selector).first().text().trim();
      if (dateText) {
        const parsedDate = this.parseDate(dateText);
        if (parsedDate) return parsedDate;
      }
    }
    return null;
  }

  parseTableStructure($, events) {
    $('table tr').each((index, row) => {
      if (index === 0) return; // ヘッダーをスキップ
      
      const $row = $(row);
      const cells = $row.find('td, th');
      
      if (cells.length >= 2) {
        const event = {
          id: `table-event-${index}`,
          title: $(cells[0]).text().trim() || $(cells[1]).text().trim(),
          description: cells.length > 2 ? $(cells[2]).text().trim() : '',
          startDate: this.parseDate($(cells[0]).text().trim()) || new Date(),
          location: cells.length > 3 ? $(cells[3]).text().trim() : ''
        };
        
        if (event.title && event.title.length > 0) {
          events.push(event);
        }
      }
    });
  }

  parseListStructure($, events) {
    $('ul li, ol li').each((index, item) => {
      const $item = $(item);
      const text = $item.text().trim();
      
      if (text && text.length > 10) {
        const event = {
          id: `list-event-${index}`,
          title: text.substring(0, 50),
          description: text,
          startDate: this.parseDate(text) || new Date()
        };
        
        events.push(event);
      }
    });
  }

  parseDetailDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    
    console.log(`🕐 Parsing datetime: "${dateTimeString}"`);
    
    // パターン: "2026/01/06（火）\n10:00～12:00"
    const pattern = /(\d{4})\/(\d{1,2})\/(\d{1,2})[（(][^)）]*[)）]\s*\n?\s*(\d{1,2}):(\d{2})\s*[～〜-]\s*(\d{1,2}):(\d{2})/;
    const match = dateTimeString.match(pattern);
    
    if (match) {
      const [, year, month, day, startHour, startMinute, endHour, endMinute] = match;
      
      // 日本時間として日付を作成（UTC+9時間のオフセットを考慮）
      const startDate = new Date(
        Date.UTC(
          parseInt(year), 
          parseInt(month) - 1, 
          parseInt(day), 
          parseInt(startHour) - 9, // UTC時間に変換するため-9時間
          parseInt(startMinute)
        )
      );
      
      const endDate = new Date(
        Date.UTC(
          parseInt(year), 
          parseInt(month) - 1, 
          parseInt(day), 
          parseInt(endHour) - 9, // UTC時間に変換するため-9時間
          parseInt(endMinute)
        )
      );
      
      console.log(`✅ Parsed: ${startDate.toISOString()} - ${endDate.toISOString()}`);
      
      return {
        start: startDate,
        end: endDate
      };
    }
    
    // フォールバック: 日付のみのパターン
    const dateOnlyPattern = /(\d{4})\/(\d{1,2})\/(\d{1,2})/;
    const dateMatch = dateTimeString.match(dateOnlyPattern);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0)); // デフォルト9:00 JST
      const endDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 1, 0)); // デフォルト10:00 JST
      
      console.log(`⚠️ Date only parsed: ${startDate.toISOString()}`);
      
      return {
        start: startDate,
        end: endDate
      };
    }
    
    console.log(`❌ Could not parse: "${dateTimeString}"`);
    return null;
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    const datePatterns = [
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/
    ];

    for (const pattern of datePatterns) {
      const match = dateString.match(pattern);
      if (match) {
        const [, year, month, day] = match;
        return new Date(year, month - 1, day);
      }
    }

    return null;
  }
}

module.exports = DoyuClient;