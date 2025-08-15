// Simple Schedule Coordinator App JavaScript

console.log('Simple app initializing...');

// Wait for page to load
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM loaded, initializing app...');
  
  try {
    // Test API connectivity
    const healthResponse = await fetch('/api/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test auth endpoint
    const authResponse = await fetch('/api/auth/me');
    const authData = await authResponse.json();
    console.log('Auth data:', authData);
    
    // Test events endpoint
    const eventsResponse = await fetch('/api/events');
    const eventsData = await eventsResponse.json();
    console.log('Events data:', eventsData);
    
    // Check authentication status
    const isAuthenticated = authData.user && !authData.error;
    
    // Update UI with basic data
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="space-y-6">
          <h2 class="text-2xl font-bold text-gray-900">スケジュール調整アプリ</h2>
          <div class="bg-green-100 p-4 rounded-lg">
            <p class="text-green-700">✅ アプリケーションが正常に動作しています</p>
            <p class="text-sm text-green-600 mt-2">API接続: OK</p>
            <p class="text-sm text-green-600 mt-1">認証システム: ${isAuthenticated ? '✅ 認証済み' : '❌ 未認証'}</p>
          </div>
          
          ${!isAuthenticated ? `
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 class="text-lg font-medium text-blue-900 mb-2">Google認証が必要です</h3>
              <p class="text-blue-700 mb-4">イベント管理機能を使用するには、Googleアカウントでログインしてください。</p>
              <button onclick="testGoogleAuth()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                <i class="fab fa-google mr-2"></i>Googleでログイン
              </button>
            </div>
          ` : `
            <div class="space-y-4">
              <h3 class="text-lg font-medium">現在のイベント</h3>
              <div class="grid gap-4">
                ${(eventsData.events || []).map(event => `
                  <div class="border border-gray-200 rounded-lg p-4">
                    <h4 class="font-medium text-gray-900">${event.title}</h4>
                    <p class="text-gray-600 text-sm">${event.description || ''}</p>
                    <div class="mt-2">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ${event.status === 'open' ? '回答受付中' : event.status}
                      </span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `}
          
          <div class="space-y-4">
            <h3 class="text-lg font-medium">機能テスト</h3>
            <div class="space-x-4">
              ${isAuthenticated ? `
                <button onclick="testCreateEvent()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                  <i class="fas fa-plus mr-2"></i>イベント作成テスト
                </button>
                <button onclick="testLogout()" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
                  <i class="fas fa-sign-out-alt mr-2"></i>ログアウト
                </button>
              ` : `
                <button onclick="testGoogleAuth()" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                  <i class="fab fa-google mr-2"></i>Google認証テスト
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Error initializing app:', error);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="text-center py-8">
          <div class="text-red-600 mb-4">
            <i class="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <p class="text-gray-600">アプリケーションの初期化に失敗しました</p>
          <p class="text-sm text-gray-500 mt-2">エラー: ${error.message}</p>
          <button onclick="location.reload()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            再読み込み
          </button>
        </div>
      `;
    }
  }
});

// Test functions
window.testCreateEvent = async function() {
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'テストイベント',
        description: 'API動作テスト用のイベントです',
        participants: ['test@example.com']
      })
    });
    const data = await response.json();
    console.log('Create event test:', data);
    alert('イベント作成APIテスト成功: ' + JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Create event test failed:', error);
    alert('イベント作成APIテスト失敗: ' + error.message);
  }
};

window.testGoogleAuth = function() {
  console.log('Redirecting to Google auth...');
  window.location.href = '/api/auth/google';
};

window.testLogout = async function() {
  try {
    const response = await fetch('/api/auth/logout', { method: 'GET' });
    const data = await response.json();
    console.log('Logout result:', data);
    alert('ログアウトしました。ページを再読み込みします。');
    window.location.reload();
  } catch (error) {
    console.error('Logout test failed:', error);
    alert('ログアウト失敗: ' + error.message);
  }
};