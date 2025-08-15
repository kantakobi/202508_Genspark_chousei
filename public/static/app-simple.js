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
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${isAuthenticated ? `
                <button onclick="testCreateEvent()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                  <i class="fas fa-plus mr-2"></i>イベント作成
                </button>
                <button onclick="testCalendarEvents()" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
                  <i class="fas fa-calendar mr-2"></i>カレンダー取得
                </button>
                <button onclick="testConfirmEvent()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                  <i class="fas fa-check mr-2"></i>イベント確定
                </button>
                <button onclick="testConflictCheck()" class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700">
                  <i class="fas fa-exclamation-triangle mr-2"></i>競合チェック
                </button>
                <button onclick="testLogout()" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
                  <i class="fas fa-sign-out-alt mr-2"></i>ログアウト
                </button>
              ` : `
                <button onclick="testGoogleAuth()" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 col-span-full">
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

window.testCalendarEvents = async function() {
  try {
    const response = await fetch('/api/calendar/events');
    const data = await response.json();
    console.log('Calendar events:', data);
    
    if (data.error) {
      alert('カレンダーイベント取得エラー: ' + data.error);
    } else {
      alert(`カレンダーイベント取得成功！\n${data.events.length}件のイベントが見つかりました。\n\n詳細はコンソールを確認してください。`);
    }
  } catch (error) {
    console.error('Calendar events test failed:', error);
    alert('カレンダーイベント取得失敗: ' + error.message);
  }
};

window.testConfirmEvent = async function() {
  try {
    const response = await fetch('/api/events/1/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        time_slot_id: 1,
        location: 'オンライン会議室'
      })
    });
    const data = await response.json();
    console.log('Event confirmation:', data);
    
    if (data.error) {
      alert('イベント確定エラー: ' + data.error);
    } else {
      const message = `イベント確定成功！\n\n` +
        `Google Event ID: ${data.google_event_id || 'N/A'}\n` +
        `Calendar URL: ${data.calendar_url || 'N/A'}\n\n` +
        `詳細はコンソールを確認してください。`;
      alert(message);
    }
  } catch (error) {
    console.error('Event confirmation test failed:', error);
    alert('イベント確定失敗: ' + error.message);
  }
};

window.testConflictCheck = async function() {
  try {
    const startTime = '2025-08-20T10:00:00Z';
    const endTime = '2025-08-20T11:30:00Z';
    
    const response = await fetch('/api/calendar/check-conflicts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startTime,
        endTime,
        participantIds: [] // empty for now
      })
    });
    const data = await response.json();
    console.log('Conflict check:', data);
    
    if (data.error) {
      alert('競合チェックエラー: ' + data.error);
    } else {
      const conflicts = Object.values(data.conflicts || {});
      const hasAnyConflict = conflicts.some(c => c.hasConflict);
      
      const message = `競合チェック完了！\n\n` +
        `期間: ${new Date(startTime).toLocaleString()} - ${new Date(endTime).toLocaleString()}\n` +
        `結果: ${hasAnyConflict ? '競合あり' : '競合なし'}\n\n` +
        `詳細はコンソールを確認してください。`;
      alert(message);
    }
  } catch (error) {
    console.error('Conflict check test failed:', error);
    alert('競合チェック失敗: ' + error.message);
  }
};