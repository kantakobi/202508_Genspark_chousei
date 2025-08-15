import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>スケジュール調整アプリ</title>
        
        {/* Tailwind CSS */}
        <script src="https://cdn.tailwindcss.com"></script>
        
        {/* Font Awesome Icons */}
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
        
        {/* Day.js for date handling */}
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/utc.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/timezone.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/relativeTime.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/isoWeek.js"></script>
        
        {/* Axios for HTTP requests */}
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        
        {/* Custom styles */}
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body class="bg-gray-50 font-sans">
        <nav class="bg-white shadow-sm border-b border-gray-200">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
              <div class="flex items-center">
                <i class="fas fa-calendar-alt text-blue-600 text-2xl mr-3"></i>
                <h1 class="text-xl font-semibold text-gray-900">スケジュール調整</h1>
              </div>
              <div class="flex items-center space-x-4">
                <button id="loginBtn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                  <i class="fab fa-google mr-2"></i>Googleでログイン
                </button>
                <div id="userInfo" class="hidden flex items-center space-x-3">
                  <img id="userAvatar" src="" alt="ユーザーアバター" class="w-8 h-8 rounded-full" />
                  <span id="userName" class="text-gray-700"></span>
                  <button id="logoutBtn" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-sign-out-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>
        
        <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div class="bg-white rounded-lg shadow">
            <div class="p-6">
              {children}
            </div>
          </div>
        </main>
        
        {/* Loading overlay */}
        <div id="loadingOverlay" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span class="text-gray-700">処理中...</span>
          </div>
        </div>
        
        {/* Custom JavaScript */}
        <script src="/static/app-simple.js"></script>
      </body>
    </html>
  )
})
