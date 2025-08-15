// Schedule Coordinator App JavaScript

class ScheduleApp {
  constructor() {
    this.currentUser = null;
    this.events = [];
    this.currentEvent = null;
    this.init();
  }

  async init() {
    console.log('Initializing Schedule Coordinator App...');
    
    // Configure axios defaults
    axios.defaults.baseURL = '/api';
    axios.defaults.headers.common['Content-Type'] = 'application/json';
    
    // Add request interceptor for error handling
    axios.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error);
        if (error.response && error.response.status === 401) {
          window.location.href = '/api/auth/google';
        }
        return Promise.reject(error);
      }
    );
    
    // Initialize event listeners
    this.initEventListeners();
    
    // Check authentication status
    await this.checkAuthStatus();
    
    // Initialize the appropriate view
    await this.initView();
  }

  initEventListeners() {
    // Login/logout buttons
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        window.location.href = '/api/auth/google';
      });
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await this.logout();
      });
    }
  }

  async checkAuthStatus() {
    try {
      const response = await axios.get('/auth/me');
      this.currentUser = response.data.user;
      this.updateUserUI();
    } catch (error) {
      console.log('User not authenticated');
      this.currentUser = null;
      this.updateUserUI();
    }
  }

  updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    if (this.currentUser) {
      if (loginBtn) loginBtn.classList.add('hidden');
      if (userInfo) userInfo.classList.remove('hidden');
      if (userName) userName.textContent = this.currentUser.name;
      if (userAvatar) userAvatar.src = this.currentUser.picture || 'https://via.placeholder.com/32';
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userInfo) userInfo.classList.add('hidden');
    }
  }

  async logout() {
    try {
      await axios.get('/auth/logout');
      this.currentUser = null;
      this.updateUserUI();
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  async initView() {
    const path = window.location.pathname;
    const eventId = document.getElementById('app')?.getAttribute('data-event-id');

    if (path === '/') {
      await this.renderDashboard();
    } else if (path.startsWith('/events/') && eventId) {
      await this.renderEventDetail(eventId);
    }
  }

  async renderDashboard() {
    const app = document.getElementById('app');
    if (!app) return;

    try {
      // Load events
      const response = await axios.get('/events');
      this.events = response.data.events;

      app.innerHTML = `
        <div class="space-y-6">
          <!-- Dashboard Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">スケジュール調整</h2>
              <p class="mt-1 text-sm text-gray-600">イベントを作成して、参加者と日程を調整しましょう</p>
            </div>
            <button id="createEventBtn" class="btn btn-primary mt-4 sm:mt-0">
              <i class="fas fa-plus mr-2"></i>新しいイベント
            </button>
          </div>

          <!-- Events List -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900">イベント一覧</h3>
            <div id="eventsList">
              ${this.renderEventsList()}
            </div>
          </div>

          <!-- Quick Calendar View -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900">カレンダー</h3>
            <div id="calendarView">
              ${this.renderCalendarView()}
            </div>
          </div>
        </div>

        <!-- Create Event Modal -->
        <div id="createEventModal" class="modal-overlay hidden">
          <div class="modal">
            <div class="modal-header">
              <h3 class="text-lg font-medium text-gray-900">新しいイベントを作成</h3>
            </div>
            <div class="modal-body">
              <form id="createEventForm">
                <div class="form-group">
                  <label class="form-label">イベント名</label>
                  <input type="text" name="title" class="form-input" required placeholder="例: プロジェクト会議">
                </div>
                <div class="form-group">
                  <label class="form-label">説明</label>
                  <textarea name="description" class="form-input form-textarea" placeholder="イベントの詳細を入力してください"></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">所要時間（分）</label>
                  <input type="number" name="duration_minutes" class="form-input" value="60" min="15" max="480">
                </div>
                <div class="form-group">
                  <label class="form-label">参加者（メールアドレス、カンマ区切り）</label>
                  <input type="text" name="participants" class="form-input" placeholder="user1@example.com, user2@example.com">
                </div>
                <div class="form-group">
                  <label class="form-label">回答期限</label>
                  <input type="datetime-local" name="deadline" class="form-input">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" id="cancelCreateEvent" class="btn btn-secondary">キャンセル</button>
              <button type="submit" form="createEventForm" class="btn btn-primary">作成</button>
            </div>
          </div>
        </div>
      `;

      // Add event listeners
      this.initDashboardListeners();

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      app.innerHTML = `
        <div class="text-center py-8">
          <div class="text-red-600 mb-4">
            <i class="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <p class="text-gray-600">データの読み込みに失敗しました</p>
          <button onclick="location.reload()" class="btn btn-primary mt-4">再読み込み</button>
        </div>
      `;
    }
  }

  renderEventsList() {
    if (this.events.length === 0) {
      return `
        <div class="text-center py-8 text-gray-500">
          <i class="fas fa-calendar-plus text-4xl mb-4"></i>
          <p>まだイベントがありません</p>
          <p class="text-sm">新しいイベントを作成して、日程調整を始めましょう</p>
        </div>
      `;
    }

    return this.events.map(event => `
      <div class="event-card">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h4 class="text-lg font-medium text-gray-900 mb-2">${event.title}</h4>
            ${event.description ? `<p class="text-gray-600 mb-3">${event.description}</p>` : ''}
            <div class="flex items-center space-x-4 text-sm text-gray-500">
              <span class="status-badge ${event.status}">${this.getStatusLabel(event.status)}</span>
              ${event.deadline ? `<span><i class="fas fa-clock mr-1"></i>期限: ${dayjs(event.deadline).format('M/D HH:mm')}</span>` : ''}
              <span><i class="fas fa-calendar mr-1"></i>${dayjs(event.created_at).format('M/D')}</span>
            </div>
          </div>
          <div class="flex space-x-2">
            <a href="/events/${event.id}" class="btn btn-secondary">詳細</a>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderCalendarView() {
    const today = dayjs();
    const startOfMonth = today.startOf('month');
    const endOfMonth = today.endOf('month');
    const startOfCalendar = startOfMonth.startOf('week');
    const endOfCalendar = endOfMonth.endOf('week');

    const days = [];
    let current = startOfCalendar;

    while (current.isBefore(endOfCalendar) || current.isSame(endOfCalendar, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    return `
      <div class="bg-white rounded-lg border border-gray-200">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h4 class="text-lg font-medium text-gray-900">${today.format('YYYY年M月')}</h4>
          <div class="flex space-x-2">
            <button class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
        <div class="grid grid-cols-7 gap-px bg-gray-200">
          ${weekDays.map(day => `<div class="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">${day}</div>`).join('')}
          ${days.map(day => `
            <div class="calendar-day ${day.isSame(today, 'day') ? 'today' : ''} ${!day.isSame(today, 'month') ? 'other-month' : ''}">
              <div class="text-sm">${day.format('D')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  initDashboardListeners() {
    const createEventBtn = document.getElementById('createEventBtn');
    const createEventModal = document.getElementById('createEventModal');
    const cancelCreateEvent = document.getElementById('cancelCreateEvent');
    const createEventForm = document.getElementById('createEventForm');

    if (createEventBtn && createEventModal) {
      createEventBtn.addEventListener('click', () => {
        createEventModal.classList.remove('hidden');
      });
    }

    if (cancelCreateEvent && createEventModal) {
      cancelCreateEvent.addEventListener('click', () => {
        createEventModal.classList.add('hidden');
      });
    }

    if (createEventModal) {
      createEventModal.addEventListener('click', (e) => {
        if (e.target === createEventModal) {
          createEventModal.classList.add('hidden');
        }
      });
    }

    if (createEventForm) {
      createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.createEvent(new FormData(createEventForm));
      });
    }
  }

  async createEvent(formData) {
    try {
      this.showLoading(true);

      const eventData = {
        title: formData.get('title'),
        description: formData.get('description'),
        duration_minutes: parseInt(formData.get('duration_minutes')),
        participants: formData.get('participants').split(',').map(email => email.trim()).filter(email => email),
        deadline: formData.get('deadline') ? new Date(formData.get('deadline')).toISOString() : null
      };

      const response = await axios.post('/events', eventData);
      
      console.log('Event created:', response.data);
      
      // Close modal and refresh
      document.getElementById('createEventModal').classList.add('hidden');
      await this.renderDashboard();

    } catch (error) {
      console.error('Failed to create event:', error);
      alert('イベントの作成に失敗しました');
    } finally {
      this.showLoading(false);
    }
  }

  async renderEventDetail(eventId) {
    const app = document.getElementById('app');
    if (!app) return;

    try {
      // Load event details
      const response = await axios.get(`/events/${eventId}`);
      this.currentEvent = response.data.event;

      app.innerHTML = `
        <div class="space-y-6">
          <!-- Event Header -->
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">${this.currentEvent.title}</h2>
              <p class="mt-1 text-gray-600">${this.currentEvent.description || ''}</p>
              <div class="mt-2 flex items-center space-x-4">
                <span class="status-badge ${this.currentEvent.status}">${this.getStatusLabel(this.currentEvent.status)}</span>
                <span class="text-sm text-gray-500">
                  <i class="fas fa-users mr-1"></i>${this.currentEvent.participants.length}人参加予定
                </span>
              </div>
            </div>
            <a href="/" class="btn btn-secondary">
              <i class="fas fa-arrow-left mr-2"></i>戻る
            </a>
          </div>

          <!-- Participants -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">参加者</h3>
            <div class="space-y-2">
              ${this.currentEvent.participants.map(participant => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div class="flex items-center space-x-3">
                    <img src="https://via.placeholder.com/32" alt="${participant.name}" class="w-8 h-8 rounded-full">
                    <div>
                      <p class="font-medium text-gray-900">${participant.name}</p>
                      <p class="text-sm text-gray-500">${participant.email}</p>
                    </div>
                  </div>
                  <span class="participant-status ${participant.status}">${this.getParticipantStatusLabel(participant.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Time Slots -->
          <div>
            <h3 class="text-lg font-medium text-gray-900 mb-4">候補日時</h3>
            <div class="space-y-4" id="timeSlots">
              ${this.renderTimeSlots()}
            </div>
            ${this.currentEvent.status === 'open' ? `
              <button id="saveResponsesBtn" class="btn btn-primary mt-4">
                <i class="fas fa-save mr-2"></i>回答を保存
              </button>
            ` : ''}
          </div>

          ${this.currentEvent.status === 'open' ? `
            <!-- Confirm Event -->
            <div class="border-t pt-6">
              <h3 class="text-lg font-medium text-gray-900 mb-4">イベント確定</h3>
              <button id="confirmEventBtn" class="btn btn-success">
                <i class="fas fa-check mr-2"></i>イベントを確定してカレンダーに追加
              </button>
            </div>
          ` : ''}
        </div>
      `;

      this.initEventDetailListeners();

    } catch (error) {
      console.error('Failed to load event:', error);
      app.innerHTML = `
        <div class="text-center py-8">
          <div class="text-red-600 mb-4">
            <i class="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <p class="text-gray-600">イベントの読み込みに失敗しました</p>
          <a href="/" class="btn btn-primary mt-4">ダッシュボードに戻る</a>
        </div>
      `;
    }
  }

  renderTimeSlots() {
    return this.currentEvent.time_slots.map(slot => `
      <div class="time-slot" data-slot-id="${slot.id}">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h4 class="font-medium text-gray-900">
              ${dayjs(slot.start_datetime).format('M月D日（ddd）HH:mm')} - ${dayjs(slot.end_datetime).format('HH:mm')}
            </h4>
            <p class="text-sm text-gray-500">
              所要時間: ${dayjs(slot.end_datetime).diff(dayjs(slot.start_datetime), 'minute')}分
            </p>
          </div>
          <div class="text-sm text-gray-500">
            ${this.getAvailabilityCount(slot.responses)}
          </div>
        </div>
        
        <!-- Availability responses summary -->
        <div class="flex space-x-4 mb-3">
          ${this.currentEvent.participants.map(participant => {
            const response = slot.responses.find(r => r.user_id === participant.id);
            const status = response ? response.status : 'no-response';
            return `
              <div class="flex items-center space-x-1">
                <div class="w-3 h-3 rounded-full ${this.getStatusColor(status)}"></div>
                <span class="text-xs text-gray-600">${participant.name}</span>
              </div>
            `;
          }).join('')}
        </div>

        ${this.currentEvent.status === 'open' ? `
          <!-- User's availability response -->
          <div class="availability-buttons" data-slot-id="${slot.id}">
            <button class="availability-btn" data-status="available">
              <i class="fas fa-check mr-1"></i>参加可能
            </button>
            <button class="availability-btn" data-status="maybe">
              <i class="fas fa-question mr-1"></i>たぶん可能
            </button>
            <button class="availability-btn" data-status="unavailable">
              <i class="fas fa-times mr-1"></i>参加不可
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  initEventDetailListeners() {
    // Availability button listeners
    const availabilityButtons = document.querySelectorAll('.availability-btn');
    availabilityButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slotId = e.target.closest('.availability-buttons').getAttribute('data-slot-id');
        const status = e.target.getAttribute('data-status');
        this.setAvailability(slotId, status);
      });
    });

    // Save responses button
    const saveResponsesBtn = document.getElementById('saveResponsesBtn');
    if (saveResponsesBtn) {
      saveResponsesBtn.addEventListener('click', () => {
        this.saveAvailabilityResponses();
      });
    }

    // Confirm event button
    const confirmEventBtn = document.getElementById('confirmEventBtn');
    if (confirmEventBtn) {
      confirmEventBtn.addEventListener('click', () => {
        this.confirmEvent();
      });
    }
  }

  setAvailability(slotId, status) {
    const buttonsContainer = document.querySelector(`[data-slot-id="${slotId}"]`);
    if (!buttonsContainer) return;

    // Update button states
    const buttons = buttonsContainer.querySelectorAll('.availability-btn');
    buttons.forEach(btn => {
      btn.classList.remove('available', 'maybe', 'unavailable');
      if (btn.getAttribute('data-status') === status) {
        btn.classList.add(status);
      }
    });

    // Store response for later saving
    if (!this.availabilityResponses) {
      this.availabilityResponses = {};
    }
    this.availabilityResponses[slotId] = status;
  }

  async saveAvailabilityResponses() {
    if (!this.availabilityResponses || Object.keys(this.availabilityResponses).length === 0) {
      alert('回答を選択してください');
      return;
    }

    try {
      this.showLoading(true);

      const responses = Object.keys(this.availabilityResponses).map(slotId => ({
        time_slot_id: parseInt(slotId),
        status: this.availabilityResponses[slotId]
      }));

      const response = await axios.post(`/events/${this.currentEvent.id}/respond`, {
        responses: responses
      });

      console.log('Responses saved:', response.data);
      alert('回答を保存しました');

      // Refresh event data
      await this.renderEventDetail(this.currentEvent.id);

    } catch (error) {
      console.error('Failed to save responses:', error);
      alert('回答の保存に失敗しました');
    } finally {
      this.showLoading(false);
    }
  }

  async confirmEvent() {
    if (!confirm('イベントを確定してGoogle Calendarに追加しますか？')) {
      return;
    }

    try {
      this.showLoading(true);

      // For demo, use the first time slot
      const timeSlotId = this.currentEvent.time_slots[0].id;

      const response = await axios.post(`/events/${this.currentEvent.id}/confirm`, {
        time_slot_id: timeSlotId
      });

      console.log('Event confirmed:', response.data);
      alert('イベントが確定され、Google Calendarに追加されました');

      // Refresh page
      window.location.reload();

    } catch (error) {
      console.error('Failed to confirm event:', error);
      alert('イベントの確定に失敗しました');
    } finally {
      this.showLoading(false);
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      if (show) {
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    }
  }

  getStatusLabel(status) {
    const labels = {
      'draft': '下書き',
      'open': '回答受付中',
      'confirmed': '確定',
      'cancelled': 'キャンセル'
    };
    return labels[status] || status;
  }

  getParticipantStatusLabel(status) {
    const labels = {
      'invited': '招待中',
      'responded': '回答済み',
      'declined': '辞退'
    };
    return labels[status] || status;
  }

  getAvailabilityCount(responses) {
    const available = responses.filter(r => r.status === 'available').length;
    const maybe = responses.filter(r => r.status === 'maybe').length;
    const unavailable = responses.filter(r => r.status === 'unavailable').length;
    
    return `✓${available} ?${maybe} ✗${unavailable}`;
  }

  getStatusColor(status) {
    const colors = {
      'available': 'bg-green-500',
      'maybe': 'bg-yellow-500',
      'unavailable': 'bg-red-500',
      'no-response': 'bg-gray-300'
    };
    return colors[status] || 'bg-gray-300';
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.scheduleApp = new ScheduleApp();
});

// Global error handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});