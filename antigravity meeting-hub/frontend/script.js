document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const authOverlay = document.getElementById('auth-overlay');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultsGrid = document.getElementById('results-grid');
    const fileInfo = document.getElementById('file-info');

    const displayFilename = document.getElementById('display-filename');
    const displayWordcount = document.getElementById('display-wordcount');
    const displaySpeakers = document.getElementById('display-speakers');

    const overviewText = document.getElementById('meeting-overview-text');
    const decisionsList = document.getElementById('decisions-list');
    const actionsTableBody = document.getElementById('actions-table-body');

    const sentimentLabel = document.getElementById('sentiment-label');
    const posPctSpan = document.getElementById('pos-pct');
    const negPctSpan = document.getElementById('neg-pct');

    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat');

    const API_BASE_URL = '';
    let currentUser = JSON.parse(localStorage.getItem('meetingHubUser'));
    let sentimentChart;

    // --- Authentication Logic ---
    function updateUIForAuth() {
        const guestControls = document.getElementById('guest-controls');
        const userControls = document.getElementById('user-controls');
        const loggedInOnly = document.querySelector('.logged-in-only');
        const archiveNav = document.querySelector('[data-section="archive"]');

        const settingsGuestBox = document.getElementById('settings-guest-box');
        const settingsUserBox = document.getElementById('settings-user-box');
        const settingsLogoutBox = document.getElementById('settings-logout-box');

        if (currentUser) {
            guestControls.classList.add('hidden');
            userControls.classList.remove('hidden');
            loggedInOnly.classList.remove('hidden');

            settingsGuestBox.classList.add('hidden');
            settingsUserBox.classList.remove('hidden');
            settingsLogoutBox.classList.remove('hidden');

            document.getElementById('profile-name').textContent = currentUser.name;
            document.getElementById('profile-avatar').textContent = currentUser.name[0].toUpperCase();
            document.getElementById('settings-name').value = currentUser.name;
            document.getElementById('settings-email').value = currentUser.email;

            authOverlay.classList.add('hidden');
        } else {
            guestControls.classList.remove('hidden');
            userControls.classList.add('hidden');
            loggedInOnly.classList.add('hidden');

            settingsGuestBox.classList.remove('hidden');
            settingsUserBox.classList.add('hidden');
            settingsLogoutBox.classList.add('hidden');
        }
        // Always load archive (current user or guest)
        loadArchive();
    }

    // Modal Controls
    const openLogin = () => {
        authOverlay.classList.remove('hidden');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    };

    document.getElementById('open-login').onclick = openLogin;
    document.getElementById('settings-open-login').onclick = openLogin;
    document.getElementById('close-auth').onclick = () => authOverlay.classList.add('hidden');
    document.getElementById('close-reg').onclick = () => authOverlay.classList.add('hidden');

    document.getElementById('show-register').onclick = () => {
        resetRegisterForm();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    };

    document.getElementById('show-login').onclick = () => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    };

    // Password Toggle
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
            } else {
                input.type = 'password';
                btn.textContent = '👁️';
            }
        };
    });

    // Validation Helpers
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isStrongPassword(pwd) {
        // At least 6 chars, contains letters and numbers
        return pwd.length >= 6 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
    }

    // Register Multi-step Logic
    const regMainFields = document.getElementById('reg-main-fields');
    const regOTPFields = document.getElementById('reg-otp-fields');
    const regSubtitle = document.getElementById('reg-subtitle');

    function resetRegisterForm() {
        regMainFields.classList.remove('hidden');
        regOTPFields.classList.add('hidden');
        regSubtitle.textContent = "Join the intelligence network";
    }

    document.getElementById('request-otp-btn').onclick = async () => {
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (!name) return alert("Please enter your name.");
        if (!isValidEmail(email)) return alert("Please enter a valid email address.");
        if (!isStrongPassword(password)) return alert("Password must be at least 6 characters and contain both letters and numbers.");

        try {
            const resp = await fetch(`${API_BASE_URL}/request-otp?email=${encodeURIComponent(email)}`, { method: 'POST' });
            if (resp.ok) {
                regMainFields.classList.add('hidden');
                regOTPFields.classList.remove('hidden');
                regSubtitle.textContent = `Enter the OTP sent to ${email}`;
                alert("OTP sent! (Note: In this demo, check the backend console/terminal for the code)");
            } else {
                alert("Failed to send OTP. Try again.");
            }
        } catch (e) { alert("Backend connection error."); }
    };

    document.getElementById('back-to-reg').onclick = resetRegisterForm;

    document.getElementById('register-btn').onclick = async () => {
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const otp = document.getElementById('reg-otp').value.trim();

        if (otp.length !== 6) return alert("Enter a valid 6-digit OTP.");

        try {
            const resp = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, otp })
            });
            const data = await resp.json();
            if (resp.ok) {
                alert("Account verified and created! Please login.");
                document.getElementById('show-login').click();
            } else {
                alert(data.detail || "Registration failed.");
            }
        } catch (e) { alert("Backend connection error."); }
    };

    // Login logic
    document.getElementById('login-btn').onclick = async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) return alert("Please fill in both fields.");

        try {
            const resp = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await resp.json();
            if (resp.ok) {
                localStorage.setItem('meetingHubUser', JSON.stringify(data.user));
                currentUser = data.user;
                updateUIForAuth();
            } else {
                // Precise pop-up for invalid name or password as requested
                alert(data.detail || "Invalid login credentials.");
            }
        } catch (e) { alert("Backend connection error."); }
    };

    const logoutHandler = () => {
        localStorage.removeItem('meetingHubUser');
        currentUser = null;
        updateUIForAuth();
        document.querySelector('[data-section="dashboard"]').click();
    };

    document.getElementById('logout-btn').onclick = logoutHandler;
    document.getElementById('settings-logout-btn-alt').onclick = logoutHandler;

    // --- Theme ---
    const themeHandler = () => {
        const isLight = document.body.classList.toggle('light-theme');
        const labels = document.querySelectorAll('.theme-switch');
        labels.forEach(l => l.textContent = isLight ? 'Switch to Dark' : 'Switch to Light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    };
    document.getElementById('theme-toggle-alt').onclick = themeHandler;

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        const labels = document.querySelectorAll('.theme-switch');
        labels.forEach(l => l.textContent = 'Switch to Dark');
    }

    // --- Navigation ---
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            const section = item.getAttribute('data-section');
            if (section === 'archive' && !currentUser) return alert("Please login to access the archive.");
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
            if (section === 'archive') loadArchive();
        };
    });

    // --- Processing ---
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#7c69ff'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'rgba(255,255,255,0.1)'; };
    dropZone.ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]); };
    fileInput.onchange = (e) => { if (e.target.files.length) handleFileUpload(e.target.files[0]); };

    async function handleFileUpload(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'txt' && ext !== 'vtt') return alert("Invalid file type.");

        loadingSpinner.classList.remove('hidden');
        resultsGrid.classList.add('hidden');
        fileInfo.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', file);
        const emailParam = currentUser ? currentUser.email : "guest";

        try {
            const response = await fetch(`${API_BASE_URL}/upload?email=${emailParam}`, { method: 'POST', body: formData });
            const data = await response.json();
            populateDashboard(data);
            loadArchive(); // Refresh the archive session after upload
        } catch (error) {
            alert("Processing error.");
            loadingSpinner.classList.add('hidden');
        }
    }

    function populateDashboard(data) {
        loadingSpinner.classList.add('hidden');
        resultsGrid.classList.remove('hidden');
        fileInfo.classList.remove('hidden');
        displayFilename.textContent = data.basic_info.filename;
        displayWordcount.textContent = `${data.basic_info.word_count} words`;
        displaySpeakers.textContent = `${data.basic_info.speaker_count} speakers`;
        overviewText.textContent = data.overview;
        decisionsList.innerHTML = data.decisions.length ? data.decisions.map(d => `<li>${d}</li>`).join('') : '<li>No decisions detected.</li>';
        actionsTableBody.innerHTML = data.action_items.length ? data.action_items.map(i => `<tr><td><strong>${i.person}</strong></td><td>${i.task}</td><td><span class="archive-badge">${i.deadline}</span></td></tr>`).join('') : '<tr><td colspan="3">No action items.</td></tr>';
        sentimentLabel.textContent = data.sentiment.overall;
        posPctSpan.textContent = data.sentiment.positive_pct;
        negPctSpan.textContent = data.sentiment.negative_pct;
        updateSentimentChart(data.sentiment);
        chatMessages.innerHTML = '';
        addBotMessage("Hi! I've analyzed the transcript. Ask me anything about the meeting.");
    }

    function updateSentimentChart(sentiment) {
        if (sentimentChart) sentimentChart.destroy();
        const ctx = document.getElementById('sentimentChart').getContext('2d');
        sentimentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Negative', 'Neutral'],
                datasets: [{
                    data: [sentiment.positive_pct, sentiment.negative_pct, sentiment.neutral_pct],
                    backgroundColor: ['#00d97e', '#ff4d4d', '#3a3a4d'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '70%', plugins: { legend: { display: false } } }
        });
    }

    async function loadArchive() {
        const email = currentUser ? currentUser.email : "guest";
        const list = document.getElementById('archive-list');
        const miniList = document.getElementById('dashboard-archive-list');
        const titlePara = document.querySelector('#archive-section .welcome-section p');

        if (!currentUser) {
            if (titlePara) titlePara.textContent = "Viewing guest session history. Login to sync these across devices.";
        } else {
            if (titlePara) titlePara.textContent = `Viewing archive for ${currentUser.email}`;
        }

        try {
            const resp = await fetch(`${API_BASE_URL}/archive/${email}`);
            const meetings = await resp.json();

            // Full Archive List
            list.innerHTML = meetings.length ? meetings.map(m => `
                <div class="archive-item" onclick='window.loadArchivedMeeting(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
                    <div class="archive-item-info">
                        <h4>${m.basic_info.filename}</h4>
                        <p>${m.date} • ${m.basic_info.word_count} words</p>
                    </div>
                    <div class="archive-badge">${m.sentiment.overall}</div>
                </div>
            `).join('') : '<p style="text-align:center; padding:40px; color: var(--text-muted);">No uploads found in this session yet.</p>';

            // Mini Dashboard List (Recent 3)
            if (miniList) {
                miniList.innerHTML = meetings.length ? meetings.slice(0, 3).map(m => `
                    <div class="archive-item" style="padding: 10px 15px; border-radius: 10px;" onclick='window.loadArchivedMeeting(${JSON.stringify(m).replace(/'/g, "&apos;")})'>
                        <div class="archive-item-info">
                            <h4 style="font-size: 13px;">${m.basic_info.filename}</h4>
                            <p style="font-size: 11px;">${m.date}</p>
                        </div>
                    </div>
                `).join('') : '<p style="font-size: 13px; color: var(--text-muted);">No sessions yet.</p>';
            }
        } catch (e) {
            console.error("Archive fetch error:", e);
        }
    }

    window.loadArchivedMeeting = data => {
        document.querySelector('[data-section="dashboard"]').click();
        populateDashboard(data);
    };

    async function handleChat() {
        const query = chatInput.value.trim();
        if (!query) return;
        addUserMessage(query);
        chatInput.value = '';
        try {
            const resp = await fetch(`${API_BASE_URL}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
            const data = await resp.json();
            addBotMessage(data.answer, data.source);
        } catch (e) { addBotMessage("Chat error."); }
    }

    function addUserMessage(msg) {
        const d = document.createElement('div'); d.className = 'message user-message'; d.textContent = msg;
        chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addBotMessage(msg, source = null) {
        const d = document.createElement('div'); d.className = 'message bot-message';
        let html = `<p>${msg}</p>`;
        if (source && source !== "N/A") html += `<div class="source-text" style="font-size: 10px; opacity: 0.6; margin-top: 5px;">Source: ${source}</div>`;
        d.innerHTML = html; chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    sendChatBtn.onclick = handleChat;
    chatInput.onkeypress = e => { if (e.key === 'Enter') handleChat(); };

    updateUIForAuth();
});
