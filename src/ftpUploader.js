const ftp = require('basic-ftp');
const fs = require('fs').promises;
const path = require('path');

class FTPUploader {
  constructor() {
    this.host = process.env.FTP_HOST;
    this.user = process.env.FTP_USER;
    this.password = process.env.FTP_PASSWORD;
    this.remotePath = process.env.FTP_REMOTE_PATH || '/schedule.ics';
    this.enabled = process.env.FTP_ENABLED === 'true';
  }

  isConfigured() {
    return this.enabled && this.host && this.user && this.password;
  }

  async uploadFile(localFilePath, remoteFilePath = null) {
    if (!this.isConfigured()) {
      console.log('📡 FTP upload skipped - not configured or disabled');
      return { success: false, reason: 'not_configured' };
    }

    const client = new ftp.Client();
    client.ftp.verbose = false; // ログを簡素化

    try {
      console.log(`📡 Connecting to FTP server: ${this.host}`);
      
      await client.access({
        host: this.host,
        user: this.user,
        password: this.password,
        secure: false // 必要に応じてTLSを有効にする
      });

      console.log('✅ FTP connection established');

      // ファイルの存在確認
      const fileExists = await fs.access(localFilePath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error(`Local file not found: ${localFilePath}`);
      }

      // ファイルサイズを取得
      const stats = await fs.stat(localFilePath);
      console.log(`📁 Uploading file: ${path.basename(localFilePath)} (${stats.size} bytes)`);

      // アップロード先のパス
      const targetPath = remoteFilePath || this.remotePath;
      
      // ディレクトリが存在しない場合は作成を試行
      const remoteDir = path.dirname(targetPath);
      if (remoteDir !== '/' && remoteDir !== '.') {
        try {
          await client.ensureDir(remoteDir);
          console.log(`📂 Ensured remote directory: ${remoteDir}`);
        } catch (dirError) {
          console.log(`⚠️ Could not ensure directory ${remoteDir}, proceeding anyway...`);
        }
      }

      // ファイルアップロード
      await client.uploadFrom(localFilePath, targetPath);
      
      console.log(`✅ File uploaded successfully to: ${targetPath}`);
      
      // 接続を閉じる
      client.close();
      
      return {
        success: true,
        remotePath: targetPath,
        fileSize: stats.size,
        uploadTime: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ FTP upload failed:', error.message);
      client.close();
      
      return {
        success: false,
        error: error.message,
        errorTime: new Date().toISOString()
      };
    }
  }

  async uploadSchedule() {
    const localPath = path.join(__dirname, '../public/schedule.ics');
    return await this.uploadFile(localPath);
  }

  // 複数ファイルのアップロード
  async uploadMultiple(files) {
    if (!this.isConfigured()) {
      console.log('📡 FTP upload skipped - not configured or disabled');
      return { success: false, reason: 'not_configured' };
    }

    const results = [];
    
    for (const { localPath, remotePath } of files) {
      const result = await this.uploadFile(localPath, remotePath);
      results.push({ localPath, remotePath, ...result });
      
      // アップロード間隔を空ける（サーバー負荷軽減）
      if (files.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return {
      success: results.every(r => r.success),
      results: results,
      totalFiles: files.length,
      successCount: results.filter(r => r.success).length
    };
  }

  // 接続テスト
  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, reason: 'not_configured' };
    }

    const client = new ftp.Client();
    
    try {
      console.log(`🔍 Testing FTP connection to: ${this.host}`);
      
      await client.access({
        host: this.host,
        user: this.user,
        password: this.password,
        secure: false
      });

      console.log('✅ FTP connection test successful');
      client.close();
      
      return {
        success: true,
        message: 'Connection successful',
        testTime: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ FTP connection test failed:', error.message);
      client.close();
      
      return {
        success: false,
        error: error.message,
        testTime: new Date().toISOString()
      };
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      configured: this.isConfigured(),
      host: this.host ? `${this.host.substring(0, 10)}...` : null,
      user: this.user ? `${this.user.substring(0, 5)}...` : null,
      remotePath: this.remotePath
    };
  }
}

module.exports = FTPUploader;