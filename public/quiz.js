// Bắt đầu toàn bộ ứng dụng chỉ sau khi HTML đã tải xong
document.addEventListener("DOMContentLoaded", () => {
    
    // =================================================================================
    // KHAI BÁO BIẾN TRẠNG THÁI (STATE VARIABLES)
    // =================================================================================
    let user = null;
    let isAdmin = false;
    let socket = null;
    let selectedQuizId = null;
    let partVisibilityState = Array(7).fill(true);
    let heartbeatInterval = null;
    let timerInterval = null;
    let isDirectTestMode = false;
    let isTestEnded = false;
    let userAnswers = {};
    let answerKey = {};
    let currentQuizPart = 1;

    // =================================================================================
    // LẤY CÁC PHẦN TỬ DOM (CHỈ CHẠY KHI DOM SẴN SÀNG)
    // =================================================================================
    const welcomeScreen = document.getElementById("welcome-screen");
    const adminLogin = document.getElementById("admin-login");
    const studentLogin = document.getElementById("student-login");
    const quizListScreen = document.getElementById("quiz-list-screen");
    const adminOptions = document.getElementById("admin-options");
    const adminControls = document.getElementById("admin-controls");
    const quizList = document.getElementById("quiz-list");
    const quizStatus = document.getElementById("quiz-status");
    const participantCount = document.getElementById("participant-count");
    const submittedCount = document.getElementById("submitted-count");
    const assignBtn = document.getElementById("assignBtn");
    const directTestBtn = document.getElementById("directTestBtn");
    const resultsTable = document.getElementById("results-table");
    const resultsBody = document.getElementById("results-body");
    const quizContainer = document.getElementById("quiz-container");
    const studentNameForm = document.getElementById("student-name-form");
    const adminLoginForm = document.getElementById("admin-login-form");
    const notification = document.getElementById("notification");
    const notificationAdminLogin = document.getElementById("notification-admin-login");
    const notificationStudentLogin = document.getElementById("notification-student-login");

    // =================================================================================
    // CÁC HÀM QUẢN LÝ GIAO DIỆN (UI FUNCTIONS)
    // =================================================================================
    
    function hideAllScreens() {
        // Sử dụng class chung 'screen' để ẩn tất cả
        document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    }

    function showScreen(screenId) {
        hideAllScreens();
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.remove('hidden');
        } else {
            console.error(`Lỗi: Không tìm thấy màn hình với ID "${screenId}"`);
        }
    }

    function showWelcomeScreen() {
        showScreen('welcome-screen');
        user = null;
        isAdmin = false;
        selectedQuizId = null;
        if (socket) {
            socket.close();
            socket = null;
        }
        localStorage.clear();
    }
    
    function updatePartVisibilityButtons() {
        for (let i = 0; i < 7; i++) {
            const btn = document.getElementById(`toggle-part-${i + 1}`);
            if (btn) {
                if (partVisibilityState[i]) {
                    btn.classList.add('visible');
                    btn.classList.remove('hidden-part');
                } else {
                    btn.classList.add('hidden-part');
                    btn.classList.remove('visible');
                }
            }
        }
    }

    function populateResultsTable(bodyElement, resultsData) {
        if (!bodyElement) return;
        bodyElement.innerHTML = "";
        if (!resultsData || resultsData.length === 0) {
            bodyElement.innerHTML = "<tr><td colspan='3' class='border p-2 text-center'>Chưa có kết quả nào.</td></tr>";
        } else {
            resultsData.forEach(result => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td class="border p-2">${result.username || 'Unknown'}</td>
                    <td class="border p-2">${result.score !== undefined ? result.score : 0}</td>
                    <td class="border p-2">${result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</td>
                `;
                bodyElement.appendChild(tr);
            });
        }
    }

    // =================================================================================
    // LOGIC NGHIỆP VỤ & KẾT NỐI MÁY CHỦ
    // =================================================================================
    
    const loadQuizzes = async () => {
        const url = isAdmin ? `/quizzes?email=${encodeURIComponent(user.email)}` : '/quizzes';
        try {
            const res = await fetch(url);
            const quizzesData = await res.json();
            quizList.innerHTML = "";
            
            const partControls = document.getElementById('part-visibility-controls');
            if (isAdmin && selectedQuizId && quizzesData.some(q => q.quizId === selectedQuizId)) {
                partControls.classList.remove('hidden');
                updatePartVisibilityButtons();
            } else {
                partControls.classList.add('hidden');
            }

            if (quizzesData.length === 0) {
                quizList.innerHTML = `<p>${isAdmin ? 'Chưa có đề thi nào.' : 'Chưa có bài thi nào được giao.'}</p>`;
            } else {
                quizzesData.forEach(quiz => {
                    const div = document.createElement("div");
                    div.className = "flex items-center space-x-2";
                    const isSelected = selectedQuizId === quiz.quizId;
                    if (isAdmin) {
                        div.innerHTML = `
                            <span class="text-lg font-medium">${quiz.quizName}${isSelected ? ' ✅' : ''}</span>
                            <button data-quiz-id="${quiz.quizId}" class="select-quiz-btn bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Chọn</button>
                            <button data-quiz-id="${quiz.quizId}" class="download-quiz-btn bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600">Tải xuống</button>
                            <button data-quiz-id="${quiz.quizId}" class="delete-quiz-btn bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Xóa</button>
                        `;
                    } else {
                         div.innerHTML = `
                            <span class="text-lg font-medium">${quiz.quizName}</span>
                            <button data-quiz-id="${quiz.quizId}" class="start-quiz-btn bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Bắt đầu làm bài</button>
                        `;
                    }
                    quizList.appendChild(div);
                });
            }
        } catch (error) {
            console.error("Error loading quizzes:", error);
            quizList.innerHTML = "<p>Lỗi khi tải danh sách đề thi.</p>";
        }
    };
    
    const selectQuiz = async (quizId) => {
        try {
            const res = await fetch("/select-quiz", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quizId }),
            });
            if (res.ok) {
                selectedQuizId = quizId;
                await loadQuizzes();
            }
        } catch (error) { console.error("Error selecting quiz:", error); }
    };

    const handleWebSocketMessage = (event) => {
        try {
            if (!event.data) return;
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'adminLoginSuccess':
                    showScreen('quiz-list-screen');
                    adminOptions.classList.remove("hidden");
                    adminControls.classList.remove("hidden");
                    loadQuizzes();
                    break;
                case 'partVisibilityUpdate':
                    if (message.quizId === selectedQuizId) {
                        partVisibilityState = message.visibility;
                        if (isAdmin) updatePartVisibilityButtons();
                    }
                    break;
                case 'quizAssigned':
                    if (!isAdmin) loadQuizzes();
                    break;
                case 'quizStatus':
                    quizStatus.innerText = message.quizId ? `Đề thi hiện tại: ${message.quizName}` : "Chưa có đề thi được chọn.";
                    if (selectedQuizId !== message.quizId) {
                         selectedQuizId = message.quizId;
                         loadQuizzes();
                    }
                    break;
                case 'participantCount':
                    participantCount.innerText = `Số người tham gia: ${message.count || 0}`;
                    break;
                case 'submitted':
                    submittedCount.innerText = `Số bài đã nộp: ${message.count !== undefined ? message.count : 0}`;
                    if (isAdmin && message.results) {
                        populateResultsTable(resultsBody, message.results);
                        resultsTable.classList.remove("hidden");
                    }
                    break;
            }
        } catch (error) {
            console.error("Error handling WebSocket message:", error);
        }
    };
    
    const initializeWebSocket = () => {
        if (socket && socket.readyState === WebSocket.OPEN) return;
        socket = new WebSocket(wsProtocol + location.host);
        socket.onopen = () => {
            console.log("WebSocket connected.");
            if (user && user.name) socket.send(JSON.stringify({ type: "login", username: user.name }));
            socket.send(JSON.stringify({ type: "requestQuizStatus" }));
        };
        socket.onmessage = handleWebSocketMessage;
        socket.onclose = () => {
            socket = null;
            setTimeout(initializeWebSocket, 3000);
        };
    };

    // --- GẮN SỰ KIỆN (EVENT LISTENERS) ---
    document.querySelector('button[onclick="showAdminLogin()"]').onclick = () => showScreen('admin-login');
    document.querySelector('button[onclick="showStudentLogin()"]').onclick = () => showScreen('student-login');
    document.querySelector('button[onclick="logout()"]').onclick = showWelcomeScreen;

    adminLoginForm.onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById("admin-username").value;
        const password = document.getElementById("admin-password").value;
        if (username === 'admin' && password === '12345') {
            user = { name: 'Admin', email: 'admin@local.com' };
            isAdmin = true;
            initializeWebSocket();
            socket.addEventListener('open', () => {
                socket.send(JSON.stringify({ type: "adminLogin", user: user }));
            }, { once: true });
        } else {
            notificationAdminLogin.innerText = "Tên đăng nhập hoặc mật khẩu không đúng!";
        }
    };
    
    studentNameForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById("student-name").value.trim();
        if (!name) {
            notificationStudentLogin.innerText = "Vui lòng nhập tên!";
            return;
        };
        user = { name };
        isAdmin = false;
        localStorage.setItem("user", JSON.stringify(user));
        showScreen('quiz-list-screen');
        adminOptions.classList.add("hidden");
        adminControls.classList.add("hidden");
        initializeWebSocket();
        await loadQuizzes();
    };

    quizList.addEventListener('click', (e) => {
        const target = e.target;
        const quizId = target.dataset.quizId;
        if (!quizId) return;
        if (target.classList.contains('select-quiz-btn')) selectQuiz(quizId);
    });
    
    // --- KHỞI CHẠY ỨNG DỤNG ---
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
        user = JSON.parse(savedUser);
        isAdmin = false; 
        showScreen('quiz-list-screen');
        adminOptions.classList.add("hidden");
        adminControls.classList.add("hidden");
        initializeWebSocket();
        loadQuizzes();
    } else {
        showWelcomeScreen();
    }
    
    setTimeout(() => {
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");
    }, 500);
});