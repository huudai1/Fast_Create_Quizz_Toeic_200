const { GoogleGenerativeAI } = require("@google/generative-ai");

// KIỂM TRA API KEY
if (!process.env.GEMINI_API_KEY) {
    console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.warn("!!! CẢNH BÁO: GEMINI_API_KEY CHƯA ĐƯỢC THIẾT LẬP.         !!!");
    console.warn("!!! Chức năng AI sẽ không hoạt động.                     !!!");
    console.warn("!!! Hãy thêm biến môi trường này trên dashboard Render. !!!");
    console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let user = null;
let heartbeatInterval = null;
let isAdmin = false;
let timeLeft = 7200;
let timerInterval = null;
let isAdminControlled = false;
let selectedQuizId = null;
let isDirectTestMode = false;
let isTestEnded = false;
let userAnswers = null;
let answerKey = null;
let currentReviewPart = 1;
let initialTimeLimit = null; // Lưu thời gian ban đầu (giây)

let partVisibility = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
let studentPartVisibility = null;

const ADMIN_PASSWORD = "admin123";
const adminLoginForm = document.getElementById("admin-login-form"); // Thêm dòng này
const adminPasswordInput = document.getElementById("admin-password"); // Thêm dòng này
const notificationAdmin = document.getElementById("notification-admin"); // Thêm dòng này


const directTestProgressBar = document.getElementById("direct-test-progress-bar");
const directTestTimer = document.getElementById("direct-test-timer");
const answerNotification = document.getElementById("answer-notification");
const answerImageDisplay = document.getElementById("answer-image-display");
const welcomeScreen = document.getElementById("welcome-screen");
const adminLogin = document.getElementById("admin-login");
const studentLogin = document.getElementById("student-login");
const studentNameForm = document.getElementById("student-name-form");
const quizListScreen = document.getElementById("quiz-list-screen");
const adminOptions = document.getElementById("admin-options");
const adminControls = document.getElementById("admin-controls");
const uploadQuizzesSection = document.getElementById("upload-quizzes");
const quizzesFileInput = document.getElementById("quizzes-file");
const quizList = document.getElementById("quiz-list");
const quizContainer = document.getElementById("quiz-container");
const notification = document.getElementById("notification");
const quizStatus = document.getElementById("quiz-status");
const participantCount = document.getElementById("participant-count");
const submittedCount = document.getElementById("submitted-count");
const assignBtn = document.getElementById("assignBtn");
const directTestBtn = document.getElementById("directTestBtn");
const directTestScreen = document.getElementById("direct-test-screen");
const endDirectTestBtn = document.getElementById("endDirectTestBtn");
const directParticipantCount = document.getElementById("direct-participant-count");
const directSubmittedCount = document.getElementById("direct-submitted-count");
const directResultsTable = document.getElementById("direct-results-table");
const directResultsBody = document.getElementById("direct-results-body");
const resultsTable = document.getElementById("results-table");
const resultsBody = document.getElementById("results-body");
const historyBody = document.getElementById("history-body");
const imageDisplay = document.getElementById("image-display");
const audio = document.getElementById("audio");
const audioSource = document.getElementById("audio-source");
const timerDisplay = document.getElementById("timer");
const quizForm = document.getElementById("quizForm");
const resultScreen = document.getElementById("result-screen");
const resultScore = document.getElementById("result-score");
const resultTime = document.getElementById("result-time");
const downloadNotice = document.getElementById("download-notice");
const reviewScreen = document.getElementById("review-answers");
const staticScreen = document.getElementById("statistics-screen");

const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
let socket = null;
let currentAdminStep = 0;
let currentQuizPart = 1;
const partAnswerCounts = [6, 25, 39, 30, 30, 16, 54];


function togglePartVisibility(part) {
    partVisibility[part] = !partVisibility[part];
    renderPartVisibilityControls();
}

/**
 * Hàm tạo và vẽ 7 nút bấm
 */
function renderPartVisibilityControls() {
    const container = document.getElementById("part-visibility-controls");
    if (!container) return;
    container.innerHTML = '<span class="font-semibold align-middle">Các phần hiển thị:</span>';
    for (let i = 1; i <= 7; i++) {
        const isVisible = partVisibility[i];
        const button = document.createElement('button');
        button.innerText = `Part ${i}`;
        button.className = `px-3 py-1 rounded text-white font-medium transition-colors duration-200 ${
            isVisible ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
        }`;
        button.onclick = () => togglePartVisibility(i);
        container.appendChild(button);
    }
}

/**
 * Hàm reset trạng thái về "hiện tất cả" và hiển thị thanh điều khiển
 */
function resetAndShowPartControls() {
    partVisibility = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
    renderPartVisibilityControls();
    document.getElementById('part-visibility-controls').classList.remove('hidden');
}

// --- Các hàm hỗ trợ cho phía học sinh ---

function applyPartVisibility(visibility) {
    if (!visibility) return;
    studentPartVisibility = visibility;
    for (let i = 1; i <= 7; i++) {
        const partContainer = document.getElementById(`quiz-part${i}`);
        if (partContainer) partContainer.classList.add('hidden');
    }
    const firstVisiblePart = findFirstVisiblePart(visibility);
    if (firstVisiblePart) {
        document.getElementById(`quiz-part${firstVisiblePart}`).classList.remove('hidden');
    } else {
        notification.innerText = "Đề thi này không có phần nào được mở.";
        document.querySelector("#quizForm button[type=submit]").disabled = true;
    }
}

function findFirstVisiblePart(visibility) {
    if (!visibility) return 1;
    for (let i = 1; i <= 7; i++) {
        if (visibility[i]) return i;
    }
    return null;
}

function findNextVisiblePart(current, visibility) {
    if (!visibility) return current + 1 > 7 ? null : current + 1;
    for (let i = current + 1; i <= 7; i++) {
        if (visibility[i]) return i;
    }
    return null;
}

function findPrevVisiblePart(current, visibility) {
    if (!visibility) return current - 1 < 1 ? null : current - 1;
    for (let i = current - 1; i >= 1; i--) {
        if (visibility[i]) return i;
    }
    return null;
}

function updateQuizNavigation(current, visibility) {
    const prevBtn = document.getElementById('prev-button');
    const nextBtn = document.getElementById('next-button');
    if (!prevBtn || !nextBtn) return;
    const nextVisible = findNextVisiblePart(current, visibility);
    const prevVisible = findPrevVisiblePart(current, visibility);
    prevBtn.disabled = !prevVisible;
    nextBtn.disabled = !nextVisible;
}

// ===== KẾT THÚC KHỐI CODE MỚI =====

function showResultScreen() {
  hideAllScreens();
  resultScreen.classList.remove("hidden");
}

function startHeartbeat() {
    if (heartbeatInterval) {
        return; // Already running
    }
    // Show the heartbeat indicator (a simple emoji or icon)
    const heartbeatIndicator = document.getElementById("heartbeat-indicator");
    if (heartbeatIndicator) {
        heartbeatIndicator.classList.remove("hidden");
    }

    heartbeatInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "heartbeat" }));
            console.log("Heartbeat sent.");
        }
    }, 30000); // Sends a heartbeat every 30 seconds
}

function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    // Hide the heartbeat indicator
    const heartbeatIndicator = document.getElementById("heartbeat-indicator");
    if (heartbeatIndicator) {
        heartbeatIndicator.classList.add("hidden");
    }
    console.log("Heartbeat stopped.");
}

function saveAdminState() {
  if (isAdmin && user) {
    localStorage.setItem("adminState", JSON.stringify({
      user: user,
      isAdmin: true,
      screen: getCurrentScreen(),
      selectedQuizId: selectedQuizId,
      isDirectTestMode: isDirectTestMode,
      isTestEnded: isTestEnded,
      currentAdminStep: currentAdminStep
    }));
  }
}

adminLoginForm.onsubmit = async (e) => {
    e.preventDefault(); // Ngăn trang tải lại
    const password = adminPasswordInput.value;

    // Kiểm tra mật khẩu
    if (password === ADMIN_PASSWORD) {
        // Nếu đúng, thiết lập trạng thái admin
        isAdmin = true;
        user = { name: "Admin", email: "admin@example.com" }; // Tạo một user admin tạm thời

        // Ẩn các màn hình khác và hiển thị màn hình danh sách quiz cho admin
        hideAllScreens();
        quizListScreen.classList.remove("hidden");
        adminOptions.classList.remove("hidden");
        adminControls.classList.remove("hidden");
        downloadNotice.classList.add("hidden");

        initializeWebSocket();
        startHeartbeat(); // Bắt đầu gửi tín hiệu heartbeat cho admin

        // Tải danh sách các đề thi
        try {
            await loadQuizzes();
        } catch (error) {
            console.error("Lỗi khi tải đề thi cho admin:", error);
            notification.innerText = "Không thể tải danh sách đề thi.";
        }
        
        saveAdminState(); // Lưu lại trạng thái đăng nhập của admin

    } else {
        // Nếu sai, hiển thị thông báo lỗi
        notificationAdmin.innerText = "Mật khẩu không đúng!";
        adminPasswordInput.value = ""; // Xóa trường nhập mật khẩu
    }
};

function getCurrentScreen() {
    if (!welcomeScreen.classList.contains("hidden")) return "welcome-screen";
    if (!adminLogin.classList.contains("hidden")) return "admin-login";
    if (!studentLogin.classList.contains("hidden")) return "student-login";
    if (!quizListScreen.classList.contains("hidden")) return "quiz-list-screen";
    if (!directTestScreen.classList.contains("hidden")) return "direct-test-screen";
    if (!uploadQuizzesSection.classList.contains("hidden")) return "upload-quizzes";
    if (!quizContainer.classList.contains("hidden")) return "quiz-container";
    if (!resultScreen.classList.contains("hidden")) return "result-screen";
    if (!reviewScreen.classList.contains("hidden")) return "review-answers";
    if (!staticScreen.classList.contains("hidden")) return "statistics-screen";
    // Sửa lại để chỉ kiểm tra màn hình tạo quiz duy nhất
    if (document.getElementById("admin-step-create-quiz") && !document.getElementById("admin-step-create-quiz").classList.contains("hidden")) {
        return "admin-step-create-quiz";
    }
    return "welcome-screen";
}

async function restoreAdminState() {
    const adminState = localStorage.getItem("adminState");
    if (adminState) {
        const state = JSON.parse(adminState);
        if (state.isAdmin && state.user) {
            user = state.user;
            isAdmin = true;
            selectedQuizId = state.selectedQuizId;
            isDirectTestMode = state.isDirectTestMode;
            isTestEnded = state.isTestEnded;
            currentAdminStep = state.currentAdminStep;

            hideAllScreens();
            // Logic đã được đơn giản hóa, chỉ kiểm tra các màn hình còn tồn tại
            if (state.screen === "quiz-list-screen") {
                quizListScreen.classList.remove("hidden");
                adminOptions.classList.remove("hidden");
                adminControls.classList.remove("hidden");
                if (selectedQuizId) {
                    assignBtn.classList.remove("hidden");
                    directTestBtn.classList.remove("hidden");
                    resetAndShowPartControls();
                }
                await loadQuizzes();
            } else if (state.screen === "direct-test-screen") {
                directTestScreen.classList.remove("hidden");
                endDirectTestBtn.disabled = isTestEnded;
                if (isTestEnded) {
                    await fetchDirectResults();
                }
            } else if (state.screen === "upload-quizzes") {
                uploadQuizzesSection.classList.remove("hidden");
            } else if (state.screen === "admin-step-create-quiz") {
                // Chỉ khôi phục màn hình tạo quiz duy nhất
                const createQuizScreen = document.getElementById("admin-step-create-quiz");
                if (createQuizScreen) createQuizScreen.classList.remove("hidden");
            } else {
                // Nếu không khớp màn hình nào, quay về trang danh sách quiz
                quizListScreen.classList.remove("hidden");
                adminOptions.classList.remove("hidden");
                adminControls.classList.remove("hidden");
            }

            initializeWebSocket();
            if (isAdmin) {
                startHeartbeat();
            }
            downloadNotice.classList.add("hidden");
            return true;
        }
    }
    return false;
}

async function showStatistics() {
  if (!selectedQuizId) {
    notification.innerText = "Vui lòng chọn một đề thi trước!";
    return;
  }

  try {
    const res = await fetch(`/statistics?quizId=${selectedQuizId}`);
    if (!res.ok) {
      throw new Error(`Lỗi server: ${res.status}`);
    }
    const data = await res.json();
    console.log("Statistics data:", data);

    hideAllScreens();
    const statisticsScreen = document.getElementById("statistics-screen");
    statisticsScreen.classList.remove("hidden");
    const notificationStatistics = document.getElementById("notification-statistics");
    notificationStatistics.innerText = "";

    const averageScore = data.averageScore || 0;
    const averageScoreBar = document.getElementById("average-score-bar");
    const averageScoreText = document.getElementById("average-score-text");
    const percentage = (averageScore / 200) * 100;
    averageScoreBar.style.width = `${percentage}%`;
    averageScoreText.innerText = `Điểm trung bình: ${averageScore.toFixed(2)}/200`;

    const statisticsBody = document.getElementById("statistics-body");
    statisticsBody.innerHTML = "";
    
    data.questionStats.forEach(stat => {
      const tr = document.createElement("tr");
      const questionNumber = parseInt(stat.questionId.replace("q", ""));
      const wrongPercentage = stat.totalCount > 0 ? ((stat.wrongCount / stat.totalCount) * 100).toFixed(2) : 0;
      tr.innerHTML = `
        <td class="border p-2">${questionNumber}</td>
        <td class="border p-2">${stat.wrongCount}</td>
        <td class="border p-2">${stat.totalCount}</td>
        <td class="border p-2">${wrongPercentage}%</td>
      `;
      statisticsBody.appendChild(tr);
    });

    saveAdminState();
  } catch (error) {
    console.error("Error fetching statistics:", error);
    document.getElementById("notification-statistics").innerText = "Lỗi khi tải thống kê. Vui lòng thử lại.";
  }
}

function hideAllScreens() {
  welcomeScreen.classList.add("hidden");
  adminLogin.classList.add("hidden");
  studentLogin.classList.add("hidden");
  quizListScreen.classList.add("hidden");
  directTestScreen.classList.add("hidden");
  uploadQuizzesSection.classList.add("hidden");
  quizContainer.classList.add("hidden");
  resultScreen.classList.add("hidden");
  staticScreen.classList.add("hidden");
  const reviewScreen = document.getElementById("review-answers");
  if (reviewScreen) reviewScreen.classList.add("hidden");
  document.querySelectorAll(".admin-step").forEach(step => step.classList.add("hidden"));
}

function clearState() {
  localStorage.removeItem("adminState");
}

function showDownloadNotice() {
  downloadNotice.classList.remove("hidden");
  setTimeout(() => {
    downloadNotice.classList.add("hidden");
  }, 5000);
}

function startDownloadNotice() {
  showDownloadNotice();
  setInterval(() => {
    if (!downloadNotice.classList.contains("hidden")) return;
    showDownloadNotice();
  }, 30000);
}

function showAdminLogin() {
    hideAllScreens();
    adminLogin.classList.remove("hidden");
    notificationAdmin.innerText = ""; // 👈 Đổi từ 'notification' thành 'notificationAdmin'
    downloadNotice.classList.add("hidden");
    saveAdminState();
}

function showStudentLogin() {
  hideAllScreens();
  studentLogin.classList.remove("hidden");
  notification.innerText = "";
  downloadNotice.classList.add("hidden");
}

function showWelcomeScreen() {
    hideAllScreens();
    welcomeScreen.classList.remove("hidden");
    notification.innerText = "";
    user = null;
    isAdmin = false;
    selectedQuizId = null; // Reset ID ở đây
    isDirectTestMode = false;
    isTestEnded = false;
    currentAdminStep = 0;
    currentQuizPart = 1;
    if (socket) {
        socket.close();
        socket = null;
    }
    clearState();
    clearUserAnswers();
    
    // THÊM DÒNG NÀY ĐỂ DỌN DẸP SẠCH SẼ
    localStorage.removeItem("selectedQuizId");

    downloadNotice.classList.remove("hidden");
    startDownloadNotice();
}

function initializeWebSocket() {
  try {
    socket = new WebSocket(wsProtocol + location.host);
    socket.onopen = () => {
      console.log("WebSocket connected successfully.");
      if (user && user.name) {
        socket.send(JSON.stringify({ type: "login", username: user.name }));
      }
      socket.send(JSON.stringify({ type: "requestQuizStatus" }));
      notification.innerText = "";
    };
    socket.onmessage = handleWebSocketMessage;
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      notification.innerText = "Lỗi kết nối WebSocket. Một số thông tin (như số bài nộp) có thể không cập nhật.";
    };
    socket.onclose = () => {
      console.log("WebSocket closed. Attempting to reconnect...");
      socket = null;
      notification.innerText = "Mất kết nối WebSocket. Đang thử kết nối lại...";
      setTimeout(initializeWebSocket, 3000);
    };
  } catch (error) {
    console.error("Failed to initialize WebSocket:", error);
    notification.innerText = "Không thể khởi tạo WebSocket. Vẫn có thể tiếp tục sử dụng.";
  }
}

studentNameForm.onsubmit = async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById("student-name");
  const name = nameInput.value.trim();
  
  if (!name) {
    notification.innerText = "Vui lòng nhập tên!";
    return;
  }
  if (name.length > 50) {
    notification.innerText = "Tên không được dài quá 50 ký tự!";
    return;
  }

  user = { name };
  isAdmin = false;
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("currentScreen", "quiz-list-screen");

  hideAllScreens();
  quizListScreen.classList.remove("hidden");
  adminOptions.classList.add("hidden");
  adminControls.classList.add("hidden");
  downloadNotice.classList.add("hidden");

  initializeWebSocket();
  try {
    await loadQuizzes();
  } catch (error) {
    console.error("Error loading quizzes:", error);
    notification.innerText = "Không thể tải danh sách đề thi. Vui lòng thử lại.";
    quizList.innerHTML = "<p>Lỗi khi tải danh sách đề thi. Vui lòng làm mới trang.</p>";
  }
};

function backToQuizList() {
  hideAllScreens();
  quizListScreen.classList.remove("hidden");
  if (isAdmin) {
    adminOptions.classList.remove("hidden");
    adminControls.classList.remove("hidden");
    if (selectedQuizId) {
      assignBtn.classList.remove("hidden");
      directTestBtn.classList.remove("hidden");
    }
  } else {
    adminOptions.classList.add("hidden");
    adminControls.classList.add("hidden");
  }
  notification.innerText = "";
  isDirectTestMode = false;
  isTestEnded = false;
  endDirectTestBtn.disabled = false;
  directResultsTable.classList.add("hidden");
  downloadNotice.classList.add("hidden");
  loadQuizzes();
  if (isAdmin) saveAdminState();
}

function createNewQuiz() {
    hideAllScreens();
    // THAY ĐỔI: Hiển thị form tạo đề mới
    document.getElementById("admin-step-create-quiz").classList.remove("hidden");
    downloadNotice.classList.add("hidden");
    saveAdminState();
}

function showUploadQuizzes() {
  hideAllScreens();
  uploadQuizzesSection.classList.remove("hidden");
  downloadNotice.classList.add("hidden");
  saveAdminState();
}

async function uploadQuizzes() {
    const notificationElement = document.getElementById("notification-upload");
    const uploadButton = document.querySelector('#upload-quizzes button[onclick="uploadQuizzes()"]');
    const modal = document.getElementById("loading-modal");
    const file = quizzesFileInput.files[0];

    if (!file) {
        notificationElement.innerText = "Vui lòng chọn file (.json hoặc .zip)!";
        return;
    }
    if (!user || !user.email) {
        notificationElement.innerText = "Lỗi: Vui lòng đăng nhập lại!";
        return;
    }

    const formData = new FormData();
    formData.append("quizzes", file);
    
    // ---- ĐÂY LÀ THAY ĐỔI QUAN TRỌNG ----
    // Gửi đi user.email thay vì user.name để thống nhất
    formData.append("createdBy", user.email); 
    // ---- KẾT THÚC THAY ĐỔI ----

    modal.classList.remove("hidden");
    uploadButton.disabled = true;

    try {
        const endpoint = file.name.endsWith('.zip') ? '/upload-quizzes-zip' : '/upload-quizzes';
        const res = await fetch(endpoint, {
            method: "POST",
            body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.message || "Server returned an error");
        }
        
        // Tải lên thành công, tự động quay lại màn hình admin và thông báo
        backToQuizList();
        setTimeout(() => {
            notification.innerText = "Tải lên đề thi thành công! Danh sách đã được cập nhật.";
        }, 100);

    } catch (error) {
        console.error("Error uploading quizzes:", error);
        notificationElement.innerText = `Lỗi khi tải lên đề thi: ${error.message}. Vui lòng thử lại.`;
    } finally {
        modal.classList.add("hidden");
        uploadButton.disabled = false;
        quizzesFileInput.value = '';
    }
}

async function downloadQuizzes(quizId) {
  const loadingModal = document.getElementById('loading-modal');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  loadingModal.classList.remove('hidden');

  try {
    const url = `/download-quiz-zip/${quizId}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    xhr.onprogress = function(event) {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        progressBar.style.width = `${percentComplete}%`;
        progressText.innerText = `${Math.round(percentComplete)}%`;
      }
    };

    xhr.onload = function() {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `quiz_${quizId}.zip`; // Keep ZIP name as quiz_<quizId>.zip
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        notification.innerText = "Đã tải xuống file ZIP chứa đề thi.";
        setTimeout(() => {
          loadingModal.classList.add('hidden');
          progressBar.style.width = '0%';
          progressText.innerText = '0%';
        }, 1000);
      } else {
        throw new Error(`HTTP error! Status: ${xhr.status}`);
      }
    };

    xhr.onerror = function() {
      throw new Error('Network error occurred');
    };

    xhr.send();
  } catch (error) {
    console.error("Error downloading quiz:", error);
    notification.innerText = "Lỗi khi tải xuống file ZIP. Vui lòng thử lại.";
    loadingModal.classList.add('hidden');
    progressBar.style.width = '0%';
    progressText.innerText = '0%';
  }
}


async function clearDatabase() {
  if (!confirm("Bạn có chắc muốn xóa toàn bộ database? Hành động này không thể hoàn tác!")) return;
  try {
    const res = await fetch("/clear-database", {
      method: "DELETE",
    });
    const result = await res.json();
    notification.innerText = result.message;
    if (res.ok) {
      selectedQuizId = null;
      loadQuizzes();
      if (isAdmin) saveAdminState();
    } else {
      throw new Error(result.message || 'Lỗi không xác định');
    }
  } catch (error) {
    console.error("Error clearing database:", error);
    notification.innerText = `Lỗi khi xóa database: ${error.message}. Vui lòng thử lại.`;
  }
}

async function fetchWithRetry(url, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      throw new Error(`HTTP error! Status: ${res.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function loadQuizzes() {
  const url = isAdmin ? `/quizzes?email=${encodeURIComponent(user.email)}` : '/quizzes';
  try {
    const res = await fetchWithRetry(url);
    const quizzes = await res.json();
    quizList.innerHTML = "";
    
    const directTestState = localStorage.getItem("directTestState");
    const directTestNotice = document.getElementById("direct-test-notice");
    const directTestMessage = document.getElementById("direct-test-message");
    const joinDirectTestBtn = document.getElementById("join-direct-test-btn");
    
    if (!isAdmin && directTestState) {
      const { isDirectTestMode, quizId, timeLimit, startTime } = JSON.parse(directTestState);
      if (isDirectTestMode && !isTestEnded) {
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const remainingTime = timeLimit - elapsedTime;
        if (remainingTime > 0) {
          directTestMessage.innerText = `Kiểm tra trực tiếp đang diễn ra! (Còn: ${Math.floor(remainingTime / 60)}:${remainingTime % 60 < 10 ? "0" : ""}${remainingTime % 60})`;
          joinDirectTestBtn.onclick = () => joinDirectTest(quizId, remainingTime, startTime);
          directTestNotice.classList.remove("hidden");
        }
      }
    } else {
      directTestNotice.classList.add("hidden");
    }

    if (quizzes.length === 0) {
      quizList.innerHTML = "<p>Chưa có đề thi nào.</p>";
    } else {
      quizzes.forEach(quiz => {
        const div = document.createElement("div");
        div.className = "flex items-center space-x-2";
        const isSelected = selectedQuizId === quiz.quizId;
        if (isAdmin) {
          div.innerHTML = `
            <span class="text-lg font-medium">${quiz.quizName}${isSelected ? ' ✅' : ''}</span>
            <button onclick="selectQuiz('${quiz.quizId}')" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Chọn</button>
            <button onclick="downloadQuizzes('${quiz.quizId}')" class="bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600">Tải xuống</button>
            <button onclick="deleteQuiz('${quiz.quizId}')" class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Xóa</button>
          `;
        } else {
          div.innerHTML = `
            <span class="text-lg font-medium">${quiz.quizName}${isSelected ? ' ✅' : ''}</span>
            <button onclick="startQuiz('${quiz.quizId}')" class="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 ${quiz.isAssigned ? '' : 'hidden'}">Bắt đầu làm bài</button>
          `;
        }
        quizList.appendChild(div);
      });
    }
  } catch (error) {
    console.error("Error loading quizzes:", error);
    notification.innerText = "Không thể tải danh sách đề thi.";
    quizList.innerHTML = "<p>Lỗi khi tải danh sách đề thi.</p>";
  }
}

async function joinDirectTest(quizId, remainingTime, startTime) {
  try {
    const res = await fetch("/select-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    const result = await res.json();
    if (res.ok) {
      isAdminControlled = true;
      initialTimeLimit = remainingTime; // Lưu thời gian ban đầu
      timeLeft = remainingTime;
      selectedQuizId = quizId;
      hideAllScreens();
      quizContainer.classList.remove("hidden");
      timerDisplay.classList.remove("hidden");
      audio.classList.remove("hidden");

      const savedAnswers = localStorage.getItem("userAnswers");
      userAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};

      if (userAnswers) {
        Object.keys(userAnswers).forEach(questionId => {
          const radio = document.querySelector(`input[name="${questionId}"][value="${userAnswers[questionId]}"]`);
          if (radio) radio.checked = true;
        });
      }

      localStorage.setItem("selectedQuizId", quizId);
      localStorage.setItem("currentScreen", "quiz-container");
      localStorage.setItem("timeLeft", remainingTime);

      await loadAudio(1);
      await loadImages(1);
      startTimer();
      updateProgressBar(); // Cập nhật thanh tiến trình ngay khi tham gia
      currentQuizPart = 1;
      downloadNotice.classList.add("hidden");
      notification.innerText = "Đã tham gia kiểm tra trực tiếp!";
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "joinDirectTest", username: user.name }));
      }
    } else {
      notification.innerText = result.message;
    }
  } catch (error) {
    console.error("Error joining direct test:", error);
    notification.innerText = "Lỗi khi tham gia kiểm tra trực tiếp.";
  }
}

async function deleteQuiz(quizId) {
  if (!confirm("Bạn có chắc muốn xóa đề thi này?")) return;
  try {
    const res = await fetch(`/delete-quiz/${quizId}`, {
      method: "DELETE",
    });
    const result = await res.json();
    notification.innerText = result.message;
    if (res.ok) {
      if (selectedQuizId === quizId) selectedQuizId = null;
      loadQuizzes();
      if (isAdmin) saveAdminState();
    }
  } catch (error) {
    console.error("Error deleting quiz:", error);
    notification.innerText = "Lỗi khi xóa đề thi. Vui lòng thử lại.";
  }
}

async function selectQuiz(quizId) {
    try {
        const res = await fetch("/select-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizId }),
        });
        const result = await res.json();
        if (res.ok) {
            selectedQuizId = quizId;
            assignBtn.classList.remove("hidden");
            directTestBtn.classList.remove("hidden");
            
            // THAY ĐỔI: Reset và hiển thị các nút điều khiển part
            resetAndShowPartControls();
            
            await loadQuizzes();
            notification.innerText = `Đã chọn đề: ${result.quizName}`;
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "quizSelected", quizId }));
            }
            saveAdminState();
        } else {
            notification.innerText = result.message;
        }
    } catch (error) {
        console.error("Error selecting quiz:", error);
        notification.innerText = "Lỗi khi chọn đề thi. Vui lòng thử lại.";
    }
}

async function assignQuiz() {
    if (!selectedQuizId) {
        notification.innerText = "Vui lòng chọn một đề thi trước!";
        return;
    }
    const timeLimit = prompt("Nhập thời gian làm bài (phút, tối đa 120):", "120");
    if (timeLimit === null) return;
    let timeLimitSeconds = parseInt(timeLimit) * 60;
    if (isNaN(timeLimitSeconds) || timeLimitSeconds <= 0 || timeLimitSeconds > 7200) {
        notification.innerText = "Thời gian không hợp lệ! Sử dụng mặc định 120 phút.";
        timeLimitSeconds = 7200;
    }
    try {
        const res = await fetch("/assign-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // THAY ĐỔI: Gửi kèm trạng thái các part
            body: JSON.stringify({
                quizId: selectedQuizId,
                timeLimit: timeLimitSeconds,
                partVisibility: partVisibility 
            }),
        });
        const result = await res.json();
        if (res.ok) {
            notification.innerText = "Học sinh đã có thể làm bài!";
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "quizAssigned", quizId: selectedQuizId, timeLimit: timeLimitSeconds }));
            }
            loadQuizzes();
            saveAdminState();
        } else {
            notification.innerText = result.message;
        }
    } catch (error) {
        console.error("Error assigning quiz:", error);
        notification.innerText = "Lỗi khi giao đề thi. Vui lòng thử lại.";
    }
}

async function startDirectTest() {
    if (!selectedQuizId) {
        notification.innerText = "Vui lòng chọn một đề!";
        return;
    }
    const timeLimit = prompt("Nhập thời gian làm bài (phút, tối đa 120):", "120");
    if (!timeLimit) return;
    let timeLimitSeconds = parseInt(timeLimit) * 60;
    if (isNaN(timeLimitSeconds) || timeLimitSeconds <= 0 || timeLimitSeconds > 7200) {
        notification.innerText = "Thời gian không hợp lệ! Mặc định 120 phút.";
        timeLimitSeconds = 7200;
    }
    try {
        const res = await fetch("/select-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizId: selectedQuizId }),
        });
        const result = await res.json();
        if (res.ok) {
            isDirectTestMode = true;
            isTestEnded = false;
            initialTimeLimit = timeLimitSeconds;
            timeLeft = timeLimitSeconds;
            hideAllScreens();
            directTestScreen.classList.remove("hidden");
            directResultsTable.classList.add("hidden");
            endDirectTestBtn.disabled = false;

            const startTime = Date.now();
            localStorage.setItem("directTestState", JSON.stringify({
                isDirectTestMode: true,
                quizId: selectedQuizId,
                timeLimit: timeLimitSeconds,
                startTime: startTime,
            }));

            updateProgressBar();
            startDirectTestTimer();

            if (socket && socket.readyState === WebSocket.OPEN) {
                // THAY ĐỔI: Gửi kèm trạng thái các part qua WebSocket
                socket.send(JSON.stringify({
                    type: "start",
                    quizId: selectedQuizId,
                    timeLimit: timeLimitSeconds,
                    startTime: startTime,
                    partVisibility: partVisibility 
                }));
            }
            notification.innerText = "Đã bắt đầu kiểm tra trực tiếp.";
            saveAdminState();
        } else {
            notification.innerText = result.message;
        }
    } catch (error) {
        console.error("Error starting direct test:", error);
        notification.innerText = "Lỗi khi bắt đầu kiểm tra trực tiếp.";
    }
}

function startDirectTestTimer() {
  clearInterval(timerInterval); // Xóa timer cũ nếu có
  timerInterval = setInterval(() => {
    if (timeLeft <= 0 || isTestEnded) {
      clearInterval(timerInterval);
      directTestProgressBar.style.width = "0%";
      directTestTimer.innerText = "Hết thời gian!";
      if (!isTestEnded) {
        endDirectTest();
      }
      return;
    }
    updateProgressBar();
    timeLeft--;
  }, 1000);
}

function updateProgressBar() {
  if (initialTimeLimit) {
    const percentage = (timeLeft / initialTimeLimit) * 100;
    directTestProgressBar.style.width = `${percentage}%`;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    directTestTimer.innerText = `Còn: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    
    // Thay đổi màu thanh tiến trình dựa trên thời gian còn lại
    if (percentage <= 20) {
      directTestProgressBar.classList.remove("bg-green-500");
      directTestProgressBar.classList.add("bg-red-500");
    } else if (percentage <= 50) {
      directTestProgressBar.classList.remove("bg-green-500", "bg-red-500");
      directTestProgressBar.classList.add("bg-yellow-500");
    } else {
      directTestProgressBar.classList.remove("bg-yellow-500", "bg-red-500");
      directTestProgressBar.classList.add("bg-green-500");
    }
  }
}

async function endDirectTest() {
  if (isTestEnded) {
    notification.innerText = "Kiểm tra đã kết thúc!";
    return;
  }
  try {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "end" }));
      isTestEnded = true;
      endDirectTestBtn.disabled = true;
      localStorage.removeItem("directTestState");
      clearInterval(timerInterval);
      directTestProgressBar.style.width = "0%";
      directTestTimer.innerText = "Kiểm tra đã kết thúc!";
      await fetchDirectResults();
      saveAdminState();
    } else {
      notification.innerText = "Không thể gửi tín hiệu kết thúc.";
      await fetchDirectResults();
    }
  } catch (error) {
    console.error("Error ending direct test:", error);
    notification.innerText = "Lỗi khi kết thúc kiểm tra.";
  }
}

async function startQuiz(quizId) {
    try {
        const res = await fetch("/select-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizId }),
        });
        const result = await res.json();
        if (res.ok) {
            isAdminControlled = false;
            timeLeft = result.timeLimit || 7200;
            const visibility = result.partVisibility;
            const pdfUrl = result.quizPdfUrl; // Lấy URL của PDF

            hideAllScreens();
            quizContainer.classList.remove("hidden");
            timerDisplay.classList.remove("hidden");
            audio.classList.remove("hidden");

            // Tải file PDF duy nhất vào khu vực hiển thị
            await loadQuizPdf(pdfUrl, 'image-display');

            const savedAnswers = localStorage.getItem("userAnswers");
            userAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};
            if (userAnswers) {
                Object.keys(userAnswers).forEach(questionId => {
                    const radio = document.querySelector(`input[name="${questionId}"][value="${userAnswers[questionId]}"]`);
                    if (radio) radio.checked = true;
                });
            }

            localStorage.setItem("selectedQuizId", quizId);
            localStorage.setItem("currentScreen", "quiz-container");
            localStorage.setItem("timeLeft", timeLeft);

            applyPartVisibility(visibility);
            const firstVisiblePart = findFirstVisiblePart(visibility) || 1;

            await loadAudio(firstVisiblePart);
            startTimer();
            currentQuizPart = firstVisiblePart;
            updateQuizNavigation(currentQuizPart, studentPartVisibility);
            
            downloadNotice.classList.add("hidden");
        } else {
            notification.innerText = result.message;
        }
    } catch (error) {
        console.error("Error starting quiz:", error);
        notification.innerText = "Lỗi khi bắt đầu bài thi. Vui lòng thử lại.";
    }
}

async function loadAudio(part) {
    if (part > 4) {
        audio.classList.add("hidden");
        audio.pause();
        audio.currentTime = 0;
        return;
    }
    try {
        audio.classList.remove("hidden");
        // THAY ĐỔI: Gửi kèm quizId khi yêu cầu file audio
        const currentQuizId = selectedQuizId || localStorage.getItem("selectedQuizId");
        const audioRes = await fetch(`/quiz-audio?part=part${part}&quizId=${currentQuizId}`);
        const data = await audioRes.json();
        if (data.audio) {
            audioSource.src = data.audio;
            audio.load();
        } else {
            notification.innerText = `Không tìm thấy file nghe cho Part ${part}!`;
            // Ẩn player nếu không có audio
            audio.classList.add("hidden");
        }
    } catch (audioError) {
        console.error("Error loading audio:", audioError);
        notification.innerText = `Lỗi khi tải file nghe cho Part ${part}!`;
    }
}

const createQuestion = (id, num, part) => {
  const div = document.createElement("div");
  div.className = "question-block";
  div.innerHTML = `
    <p class="question-text font-semibold">Câu ${num} (Part ${part})</p>
    <div class="answer-options">
      <label class="answer-item">
        <input type="radio" name="${id}" value="A" />
        <span>A</span>
      </label>
      <label class="answer-item">
        <input type="radio" name="${id}" value="B" />
        <span>B</span>
      </label>
      <label class="answer-item">
        <input type="radio" name="${id}" value="C" />
        <span>C</span>
      </label>
      <label class="answer-item">
        <input type="radio" name="${id}" value="D" />
        <span>D</span>
      </label>
    </div>
  `;

  const radios = div.querySelectorAll(`input[name="${id}"]`);
  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (!userAnswers) {
        userAnswers = {};
      }
      userAnswers[id] = radio.value;
      saveUserAnswers();
    });
  });

  return div;
};

const parts = [
  { id: "section1", count: 6, part: 1 },
  { id: "section2", count: 25, part: 2 },
  { id: "section3", count: 39, part: 3 },
  { id: "section4", count: 30, part: 4 },
  { id: "section5", count: 30, part: 5 },
  { id: "section6", count: 16, part: 6 },
  { id: "section7", count: 54, part: 7 },
];
let questionIndex = 1;
parts.forEach(({ id, count, part }) => {
  const section = document.getElementById(id);
  for (let i = 1; i <= count; i++) {
    section.appendChild(createQuestion(`q${questionIndex}`, questionIndex, part));
    questionIndex++;
  }
});

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
      return;
    }
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.innerText = `Còn: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    updateProgressBar(); // Cập nhật thanh tiến trình
    timeLeft--;
    localStorage.setItem("timeLeft", timeLeft);
  }, 1000);
}

async function loadImages(part) {
  try {
    const res = await fetch(`/images?part=${part}`);
    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }
    let files = await res.json();
    console.log(`Images/PDFs for Part ${part} (before sorting):`, files);

    // Sort files based on numeric index in filename (e.g., partX_Y.extension)
    files.sort((a, b) => {
      const getIndex = (url) => {
        const match = url.match(/part\d+_(\d+)\.(jpg|jpeg|png|pdf)/i);
        return match ? parseInt(match[1]) : Infinity;
      };
      return getIndex(a) - getIndex(b);
    });
    console.log(`Images/PDFs for Part ${part} (after sorting):`, files);

    imageDisplay.innerHTML = `<h3 class="text-lg font-semibold mb-2">Part ${part}</h3>`;
    if (files.length === 0) {
      imageDisplay.innerHTML += `<p>Không có ảnh hoặc PDF cho Part ${part}</p>`;
      return;
    }

    files.forEach((url, index) => {
      const isPDF = url.endsWith('.pdf');
      if (isPDF) {
        const pdfContainer = document.createElement("div");
        pdfContainer.className = "pdf-container mb-4";
        pdfContainer.innerHTML = `
          <div class="pdf-toolbar mb-2 flex space-x-2">
            <button onclick="zoomPDF('pdf-${part}-${index}', 1.2)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Phóng to</button>
            <button onclick="zoomPDF('pdf-${part}-${index}', 0.8)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Thu nhỏ</button>
            <button onclick="zoomPDF('pdf-${part}-${index}', 1)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Đặt lại</button>
          </div>
          <iframe id="pdf-${part}-${index}" src="${url}" class="w-full h-[90vh] rounded" style="transform: scale(1); transform-origin: top left;"></iframe>
        `;
        imageDisplay.appendChild(pdfContainer);
      } else {
        const img = document.createElement("img");
        img.src = url;
        img.className = "w-full max-w-[1600px] max-h-[90vh] mb-4 rounded";
        img.onerror = () => {
          console.error(`Failed to load image: ${url}`);
          notification.innerText = `Lỗi khi tải ảnh: ${url}`;
        };
        img.onload = () => {
          console.log(`Image loaded successfully: ${url}`);
        };
        imageDisplay.appendChild(img);
      }
    });
  } catch (error) {
    console.error("Error loading images:", error);
    notification.innerText = `Lỗi khi tải ảnh hoặc PDF cho Part ${part}.`;
  }
}

function nextQuizPart(current) {
    audio.pause(); // THÊM DÒNG NÀY
    const nextPart = findNextVisiblePart(current, studentPartVisibility);
    if (nextPart === null) return;

    document.getElementById(`quiz-part${current}`).classList.add("hidden");
    document.getElementById(`quiz-part${nextPart}`).classList.remove("hidden");
    currentQuizPart = nextPart;
    loadAudio(nextPart);
    updateQuizNavigation(currentQuizPart, studentPartVisibility);
}

function prevQuizPart(current) {
    audio.pause(); // THÊM DÒNG NÀY
    const prevPart = findPrevVisiblePart(current, studentPartVisibility);
    if (prevPart === null) return;

    document.getElementById(`quiz-part${current}`).classList.add("hidden");
    document.getElementById(`quiz-part${prevPart}`).classList.remove("hidden");
    currentQuizPart = prevPart;
    loadAudio(prevPart);
    updateQuizNavigation(currentQuizPart, studentPartVisibility);
}

async function saveQuiz() {
    const notificationElement = document.getElementById("notification-create");
    const modal = document.getElementById("loading-modal");
    notificationElement.innerText = '';

    // --- BẮT ĐẦU KIỂM TRA DỮ LIỆU ĐẦU VÀO ---

    // 1. Kiểm tra Tên đề thi
    const quizName = document.getElementById("quiz-name").value.trim();
    if (!quizName) {
        notificationElement.innerText = "Lỗi: Vui lòng nhập tên đề thi!";
        return;
    }

    // 2. Kiểm tra File PDF
    const pdfFile = document.getElementById("quiz-pdf-file").files[0];
    if (!pdfFile) {
        notificationElement.innerText = "Lỗi: Vui lòng tải lên file PDF của đề thi!";
        return;
    }

    // 3. Kiểm tra File Nghe (bắt buộc đủ 4 file)
    const requiredAudioParts = [1, 2, 3, 4];
    for (const partNum of requiredAudioParts) {
        const audioInput = document.getElementById(`audio-file-part${partNum}`);
        if (!audioInput || audioInput.files.length === 0) {
            notificationElement.innerText = `Lỗi: Vui lòng tải lên file nghe cho Part ${partNum}!`;
            return;
        }
    }

    // 4. Kiểm tra Đáp án (đủ số lượng cho mỗi part)
    const answerKey = {};
    let questionIndex = 1;
    for (let part = 1; part <= 7; part++) {
        const answerKeyInput = document.getElementById(`answer-key-part${part}`).value.trim();
        if (!answerKeyInput) {
            notificationElement.innerText = `Lỗi: Vui lòng nhập đáp án cho Part ${part}!`;
            return;
        }
        const answers = answerKeyInput.split(",").map(a => a.trim().toUpperCase());
        const expectedCount = partAnswerCounts[part - 1];
        
        if (answers.length !== expectedCount) {
            notificationElement.innerText = `Lỗi ở Part ${part}: Yêu cầu ${expectedCount} đáp án, nhưng bạn đã nhập ${answers.length} đáp án.`;
            return;
        }
        if (!answers.every(a => ["A", "B", "C", "D"].includes(a))) {
            notificationElement.innerText = `Lỗi ở Part ${part}: Đáp án chứa ký tự không hợp lệ (chỉ chấp nhận A, B, C, D).`;
            return;
        }
        for (let i = 0; i < answers.length; i++) {
            answerKey[`q${questionIndex}`] = answers[i];
            questionIndex++;
        }
    }
    
    // --- KẾT THÚC KIỂM TRA ---
    
    // Nếu mọi thứ hợp lệ, tiến hành tạo FormData và gửi đi
    const formData = new FormData();
    formData.append("quizName", quizName);
    formData.append("quiz-pdf", pdfFile);
    formData.append("createdBy", user.email);

    requiredAudioParts.forEach(partNum => {
        const audioInput = document.getElementById(`audio-file-part${partNum}`);
        formData.append(`audio-part${partNum}`, audioInput.files[0]);
    });

    formData.append("answerKey", JSON.stringify(answerKey));
    modal.classList.remove("hidden");

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 phút
        const res = await fetch("/save-quiz", {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const result = await res.json();
        
        if (!res.ok) {
            throw new Error(result.message || "Lỗi từ server");
        }
        
        notification.innerText = result.message;
        backToQuizList();

    } catch (error) {
        console.error("Error saving quiz:", error);
        notificationElement.innerText = `Lỗi khi lưu đề thi: ${error.message}. Vui lòng thử lại.`;
    } finally {
        modal.classList.add("hidden");
    }
}

function nextAdminStep(step) {
  let notificationElement;

  if (step === 1) {
    notificationElement = document.getElementById("notification-audio");
    const quizName = document.getElementById("quiz-name").value.trim();
    if (!quizName) {
      notificationElement.innerText = "Vui lòng nhập tên đề thi!";
      return;
    }
    const audioFiles = [
      document.getElementById("audio-file-part1").files[0],
      document.getElementById("audio-file-part2").files[0],
      document.getElementById("audio-file-part3").files[0],
      document.getElementById("audio-file-part4").files[0],
    ];
    for (let i = 0; i < audioFiles.length; i++) {
      if (!audioFiles[i]) {
        notificationElement.innerText = `Vui lòng tải file nghe cho Part ${i + 1}!`;
        return;
      }
    }
    hideAllScreens();
    document.getElementById("admin-step-part1").classList.remove("hidden");
    notificationElement.innerText = "";
    currentAdminStep = step;
    saveAdminState();
    return;
  }

  if (step >= 2 && step <= 7) {
    const part = step - 1;
    notificationElement = document.getElementById(`notification-part${part}`);
    const imagesInput = document.getElementById(`images-part${part}`);
    if (!imagesInput.files.length) {
      notificationElement.innerText = `Vui lòng tải ít nhất một ảnh cho Part ${part}!`;
      return;
    }
    for (let file of imagesInput.files) {
      const validExtension = file.name.match(/\.(jpg|jpeg|png|pdf)$/i);
      if (!validExtension) {
        notificationElement.innerText = `File không hợp lệ cho Part ${part}: ${file.name}. Chỉ hỗ trợ jpg, jpeg, png, pdf.`;
        return;
      }
    }
    const answerKeyInput = document.getElementById(`answer-key-part${part}`).value.trim();
    if (!answerKeyInput) {
      notificationElement.innerText = `Vui lòng nhập đáp án cho Part ${part}!`;
      return;
    }
    const answers = answerKeyInput.split(",").map(a => a.trim().toUpperCase());
    const expectedCount = partAnswerCounts[part - 1];
    if (answers.length !== expectedCount) {
      notificationElement.innerText = `Đã nhập ${answers.length} đáp án, yêu cầu đúng ${expectedCount} đáp án cho Part ${part}!`;
      return;
    }
    if (!answers.every(a => ["A", "B", "C", "D"].includes(a))) {
      notificationElement.innerText = `Đáp án Part ${part} chỉ được chứa A, B, C, D!`;
      return;
    }
  }

  hideAllScreens();
  document.getElementById(`admin-step-part${step}`).classList.remove("hidden");
  notificationElement.innerText = "";
  currentAdminStep = step;
  saveAdminState();
}

function prevAdminStep(step) {
  hideAllScreens();
  let notificationElement;
  if (step === 1) {
    document.getElementById("admin-step-audio").classList.remove("hidden");
    notificationElement = document.getElementById("notification-audio");
  } else {
    document.getElementById(`admin-step-part${step - 1}`).classList.remove("hidden");
    notificationElement = document.getElementById(`notification-part${step - 1}`);
  }
  notificationElement.innerText = "";
  currentAdminStep = step - 1;
  saveAdminState();
}

async function submitQuiz() {
    audio.pause();

    if (!user || !user.name) {
        notification.innerText = "Lỗi: Vui lòng nhập tên lại.";
        showWelcomeScreen();
        return;
    }

    const formData = new FormData(quizForm);
    userAnswers = {};
    formData.forEach((val, key) => (userAnswers[key] = val));

    try {
        const currentQuizId = selectedQuizId || localStorage.getItem("selectedQuizId");
        const res = await fetch("/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user.name, answers: userAnswers, quizId: currentQuizId }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `Lỗi server: ${res.status}`);
        }

        const result = await res.json();
        
        // LẤY VÀ LƯU LẠI ANSWER KEY ĐỂ DÙNG CHO MÀN HÌNH XEM LẠI
        const answerRes = await fetch(`/answer-key?quizId=${currentQuizId}`);
        answerKey = await answerRes.json();
        
        resultScore.innerText = `Điểm: ${result.score}/200`;
        resultTime.innerText = `Thời gian nộp: ${new Date().toLocaleString()}`;
        
        quizForm.querySelector("button[type=submit]").disabled = true;
        clearInterval(timerInterval);
        
        if (isAdminControlled && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "submitted", username: user.name }));
        }

        localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
        localStorage.removeItem("currentScreen");
        localStorage.removeItem("timeLeft");
        
        showResultScreen();

    } catch (error) {
        console.error("Error submitting quiz:", error);
        notification.innerText = "Lỗi khi nộp bài. Đáp án của bạn vẫn được lưu. Vui lòng thử lại.";
    }
}

async function fetchDirectResults() {
  const retries = 3;
  const delay = 2000;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("/direct-results");
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      const results = await res.json();
      directResultsBody.innerHTML = "";
      if (results.length === 0) {
        directResultsBody.innerHTML = "<tr><td colspan='3' class='border p-2 text-center'>Chưa có kết quả nào.</td></tr>";
      } else {
        results.forEach(result => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td class="border p-2">${result.username || 'Unknown'}</td>
            <td class="border p-2">${result.score || 0}</td>
            <td class="border p-2">${result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</td>
          `;
          directResultsBody.appendChild(tr);
        });
      }
      directResultsTable.classList.remove("hidden");
      return;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        notification.innerText = "Lỗi khi tải kết quả kiểm tra trực tiếp. Vui lòng kiểm tra kết nối và thử lại.";
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function loadQuizPdf(pdfUrl, displayDivId) {
    const displayElement = document.getElementById(displayDivId);
    if (!displayElement) {
        console.error(`Display element with ID '${displayDivId}' not found.`);
        return;
    }

    if (!pdfUrl) {
        displayElement.innerHTML = `<p class="p-4">Không có file PDF nào cho đề thi này.</p>`;
        return;
    }
    
    // Tạo ID duy nhất cho iframe để các nút zoom hoạt động chính xác
    const iframeId = `${displayDivId}-iframe`;

    displayElement.innerHTML = `
        <div class="pdf-toolbar mb-2 flex space-x-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
            <button onclick="zoomPDF('${iframeId}', 1.2)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Phóng to</button>
            <button onclick="zoomPDF('${iframeId}', 0.8)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Thu nhỏ</button>
            <button onclick="zoomPDF('${iframeId}', 1)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Đặt lại</button>
        </div>
        <iframe id="${iframeId}" src="${pdfUrl}" class="w-full h-[85vh] rounded" style="transform: scale(1); transform-origin: top left;"></iframe>
    `;
}

function saveUserAnswers() {
  if (!userAnswers) {
    userAnswers = {};
  }
  try {
    localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
    console.log("User answers saved:", userAnswers);
  } catch (error) {
    console.error("Error saving user answers to localStorage:", error);
    notification.innerText = "Lỗi khi lưu đáp án. Vui lòng thử lại.";
  }
}

function clearUserAnswers() {
  localStorage.removeItem("userAnswers");
  userAnswers = null;
}

function handleWebSocketMessage(event) {
    try {
        if (!event.data) { return; }
        const message = JSON.parse(event.data);

        if (message.type === "participantUpdate") {
            const count = message.count || 0;
            const participants = message.participants || [];
            
            participantCount.innerText = `Số người tham gia: ${count}`;
            directParticipantCount.innerText = `Số người tham gia: ${count}`;

            const container = document.getElementById('participant-list-container');
            const list = document.getElementById('participant-list');
            const listCount = document.getElementById('participant-list-count');
            
            // THAY ĐỔI: Thêm điều kiện kiểm tra màn hình hiện tại
            if (isAdmin && !quizListScreen.classList.contains('hidden') && container && list && listCount) {
                container.classList.remove('hidden');
                listCount.innerText = count;
                list.innerHTML = '';
                if (participants.length > 0) {
                    participants.forEach(name => {
                        const li = document.createElement('li');
                        li.textContent = name;
                        list.appendChild(li);
                    });
                } else {
                    list.innerHTML = '<li>Chưa có học sinh nào tham gia.</li>';
                }
            } else if(container) {
                // Nếu không phải admin hoặc không ở đúng màn hình thì ẩn đi
                container.classList.add('hidden');
            }
        } 
        else if (message.type === "quizAssigned") {
            if (!isAdmin) {
                loadQuizzes();
            }
        } 
        else if (message.type === "submitted" || message.type === "submittedCount") {
            const count = message.count !== undefined ? message.count : 0;
            submittedCount.innerText = `Số bài đã nộp: ${count}`;
            directSubmittedCount.innerText = `Số bài đã nộp: ${count}`;
            
            if (isAdmin && message.results) {
                resultsBody.innerHTML = "";
                message.results.forEach(result => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td class="border p-2">${result.username || 'Unknown'}</td>
                        <td class="border p-2">${result.score || 0}</td>
                        <td class="border p-2">${new Date(result.submittedAt).toLocaleString() || 'N/A'}</td>
                    `;
                    resultsBody.appendChild(tr);
                });
                resultsTable.classList.remove("hidden");
            }
        } 
        else if (message.type === "start") {
            isAdminControlled = true;
            initialTimeLimit = message.timeLimit || 7200;
            timeLeft = message.timeLimit || 7200;
            const visibility = message.partVisibility;
            const pdfUrl = message.quizPdfUrl;

            localStorage.setItem("directTestState", JSON.stringify({
                isDirectTestMode: true,
                quizId: message.quizId,
                timeLimit: message.timeLimit,
                startTime: message.startTime,
            }));

            if (!isAdmin) {
                hideAllScreens();
                quizContainer.classList.remove("hidden");
                timerDisplay.classList.remove("hidden");
                audio.classList.remove("hidden");
                
                selectedQuizId = message.quizId;
                localStorage.setItem("selectedQuizId", message.quizId);
                localStorage.setItem("currentScreen", "quiz-container");
                localStorage.setItem("timeLeft", timeLeft);
                
                loadQuizPdf(pdfUrl, 'image-display');
                
                applyPartVisibility(visibility);
                const firstVisiblePart = findFirstVisiblePart(visibility) || 1;

                loadAudio(firstVisiblePart);
                startTimer();
                updateProgressBar();
                currentQuizPart = firstVisiblePart;
                updateQuizNavigation(currentQuizPart, studentPartVisibility);

                downloadNotice.classList.add("hidden");
                notification.innerText = "Bài thi đã bắt đầu!";
            }
        } 
        else if (message.type === "end") {
            isTestEnded = true;
            localStorage.removeItem("directTestState");
            clearInterval(timerInterval);
            if (!isAdmin) {
                submitQuiz();
                notification.innerText = "Bài thi đã kết thúc!";
            } else {
                fetchDirectResults();
            }
        } 
        else if (message.type === "quizStatus") {
            quizStatus.innerText = message.quizId ? `Đề thi hiện tại: ${message.quizName}` : "Chưa có đề thi được chọn.";
            if (!isAdmin) {
                loadQuizzes();
            }
        } 
        else if (message.type === "error") {
            notification.innerText = message.message;
        }
    } catch (error) {
        console.error("Error handling WebSocket message:", error);
        notification.innerText = "Lỗi khi xử lý thông tin từ server.";
    }
}

async function showReviewAnswers() {
    try {
        const reviewScreen = document.getElementById("review-answers");
        if (!reviewScreen) {
            console.error("Element with ID 'review-answers' not found in DOM");
            return;
        }

        // ---- THAY ĐỔI QUAN TRỌNG ----
        // Lấy ID đề thi từ biến toàn cục, nếu không có thì lấy từ localStorage
        const quizIdForReview = selectedQuizId || localStorage.getItem("selectedQuizId");

        if (!quizIdForReview) {
            notification.innerText = "Lỗi: Không tìm thấy mã đề thi để xem lại đáp án.";
            return;
        }
        // ---- KẾT THÚC THAY ĐỔI ----

        const quizRes = await fetch(`/get-quiz?quizId=${quizIdForReview}`);
        const quizData = await quizRes.json();
        
        if (!quizData || !quizData.quizPdfUrl) {
            notification.innerText = "Không tìm thấy thông tin đề thi để xem lại.";
            return;
        }

        // Phần còn lại của hàm giữ nguyên như cũ để xử lý đáp án
        if (!userAnswers) {
            const savedAnswers = localStorage.getItem("userAnswers");
            if (savedAnswers) userAnswers = JSON.parse(savedAnswers);
        }
        if (!answerKey) {
            const answerRes = await fetch(`/answer-key?quizId=${quizIdForReview}`);
            if (!answerRes.ok) throw new Error("Không thể lấy đáp án đúng");
            answerKey = await answerRes.json();
        }
        if (!answerKey || !userAnswers) {
            notification.innerText = "Lỗi: Không thể tải đáp án hoặc câu trả lời của bạn.";
            return;
        }

        hideAllScreens();
        reviewScreen.classList.remove("hidden");
        document.getElementById("review-score").innerText = resultScore.innerText;
        document.getElementById("review-time").innerText = resultTime.innerText;
        notification.innerText = "";
        
        await loadQuizPdf(quizData.quizPdfUrl, 'review-image-display');
    currentReviewPart = 1;

    const parts = [
      { id: "review-section1", count: 6, part: 1 },
      { id: "review-section2", count: 25, part: 2 },
      { id: "review-section3", count: 39, part: 3 },
      { id: "review-section4", count: 30, part: 4 },
      { id: "review-section5", count: 30, part: 5 },
      { id: "review-section6", count: 16, part: 6 },
      { id: "review-section7", count: 54, part: 7 },
    ];
    let questionIndex = 1;

    parts.forEach(({ id, count, part }) => {
      const section = document.getElementById(id);
      if (!section) {
        console.error(`Section with ID '${id}' not found`);
        return;
      }
      section.innerHTML = "";
      for (let i = 1; i <= count; i++) {
        const qId = `q${questionIndex}`;
        const userAnswer = userAnswers[qId] || "Chưa chọn";
        const correctAnswer = answerKey[qId] || "N/A";
        const isCorrect = userAnswer === correctAnswer && userAnswer !== "Chưa chọn";
        let answerClass = "";
        if (isCorrect) {
          answerClass = "correct-answer";
        } else if (userAnswer === "Chưa chọn") {
          answerClass = "unselected-answer";
        } else {
          answerClass = "wrong-answer";
        }

        console.log(`Question ${qId}: User answer = ${userAnswer}, Correct answer = ${correctAnswer}, Class = ${answerClass}`);

        const div = document.createElement("div");
        div.className = "question-block";
        div.innerHTML = `
          <p class="question-text font-semibold">Câu ${questionIndex} (Part ${part})</p>
          <div class="answer-options">
            <div class="${answerClass}">
              <p>Đáp án của bạn: <span class="font-bold">${userAnswer}</span></p>
              <p>Đáp án đúng: <span class="font-bold">${correctAnswer}</span></p>
            </div>
          </div>
        `;
        section.appendChild(div);
        questionIndex++;
      }
    });

    const firstPart = document.getElementById("review-part1");
    if (!firstPart) {
      console.error("Element with ID 'review-part1' not found");
      notification.innerText = "Lỗi: Không thể hiển thị phần đầu tiên.";
      return;
    }
    firstPart.classList.remove("hidden");
    downloadNotice.classList.add("hidden");
  } catch (error) {
    console.error("Error showing review answers:", error);
    notification.innerText = "Lỗi khi hiển thị đáp án. Vui lòng thử lại.";
  }
}

function nextReviewPart(current) {
  if (current >= 7) return;
  document.getElementById(`review-part${current}`).classList.add("hidden");
  document.getElementById(`review-part${current + 1}`).classList.remove("hidden");
  currentReviewPart = current + 1;
  loadReviewImages(current + 1);
}

function prevReviewPart(current) {
  if (current <= 1) return;
  document.getElementById(`review-part${current}`).classList.add("hidden");
  document.getElementById(`review-part${current - 1}`).classList.remove("hidden");
  currentReviewPart = current - 1;
  loadReviewImages(current - 1);
}

async function loadReviewImages(part) {
  try {
    const res = await fetch(`/images?part=${part}`);
    if (!res.ok) {
      console.error(`Failed to fetch images for Part ${part}, status: ${res.status}`);
      throw new Error(`Không thể tải ảnh hoặc PDF cho Part ${part}`);
    }
    let files = await res.json();
    console.log(`Images/PDFs for Part ${part} (before sorting):`, files);

    // Sort files based on numeric index in filename (e.g., partX_Y.extension)
    files.sort((a, b) => {
      const getIndex = (url) => {
        const match = url.match(/part\d+_(\d+)\.(jpg|jpeg|png|pdf)/i);
        return match ? parseInt(match[1]) : Infinity;
      };
      return getIndex(a) - getIndex(b);
    });
    console.log(`Images/PDFs for Part ${part} (after sorting):`, files);

    const reviewImageDisplay = document.getElementById("review-image-display");
    if (!reviewImageDisplay) {
      console.error("Element with ID 'review-image-display' not found");
      throw new Error("Không tìm thấy khu vực hiển thị ảnh");
    }
    reviewImageDisplay.innerHTML = `<h3 class="text-lg font-semibold mb-2">Part ${part}</h3>`;

    if (!files || files.length === 0) {
      console.warn(`No images or PDFs found for Part ${part}`);
      reviewImageDisplay.innerHTML += `<p>Không có ảnh hoặc PDF cho Part ${part}</p>`;
      return;
    }

    files.forEach((url, index) => {
      console.log(`Processing file: ${url}`);
      const isPDF = url.endsWith('.pdf');
      if (isPDF) {
        const pdfContainer = document.createElement("div");
        pdfContainer.className = "pdf-container mb-4";
        pdfContainer.innerHTML = `
          <div class="pdf-toolbar mb-2 flex space-x-2">
            <button onclick="zoomPDF('review-pdf-${part}-${index}', 1.2)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Phóng to</button>
            <button onclick="zoomPDF('review-pdf-${part}-${index}', 0.8)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Thu nhỏ</button>
            <button onclick="zoomPDF('review-pdf-${part}-${index}', 1)" class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Đặt lại</button>
          </div>
          <iframe id="review-pdf-${part}-${index}" src="${url}" class="w-full h-[90vh] rounded" style="transform: scale(1); transform-origin: top left;"></iframe>
        `;
        reviewImageDisplay.appendChild(pdfContainer);
      } else {
        const img = document.createElement("img");
        img.src = url;
        img.className = "w-full max-w-[1600px] max-h-[90vh] mb-4 rounded";
        img.onerror = () => {
          console.error(`Failed to load image: ${url}`);
          notification.innerText = `Lỗi khi tải ảnh: ${url}`;
        };
        img.onload = () => {
          console.log(`Image loaded successfully: ${url}`);
        };
        reviewImageDisplay.appendChild(img);
      }
    });
  } catch (error) {
    console.error("Error loading review images:", error);
    notification.innerText = `Lỗi khi tải ảnh hoặc PDF cho Part ${part}: ${error.message}`;
  }
}


// PDF Zoom Function
function zoomPDF(iframeId, scaleFactor) {
  const iframe = document.getElementById(iframeId);
  if (!iframe) {
    console.error(`Iframe with ID ${iframeId} not found`);
    return;
  }
  const currentScale = parseFloat(iframe.style.transform.replace('scale(', '').replace(')', '') || 1);
  let newScale = currentScale * scaleFactor;
  if (scaleFactor === 1) newScale = 1; // Reset to original size
  if (newScale < 0.5) newScale = 0.5; // Minimum zoom
  if (newScale > 2) newScale = 2; // Maximum zoom
  iframe.style.transform = `scale(${newScale})`;
}

async function logout() {
    try {
        if (user && user.name && socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "logout", username: user.name }));
        }
    } catch (error) {
        console.error("Error during server logout notification:", error);
    }
    
    stopHeartbeat();
    
    // XÓA TOÀN BỘ DỮ LIỆU CỦA TRANG WEB TRONG LOCALSTORAGE
    localStorage.clear();
    
    // Reset các biến và hiển thị màn hình chào mừng
    user = null;
    isAdmin = false;
    selectedQuizId = null;
    userAnswers = null;
    
    showWelcomeScreen();
}

document.addEventListener('DOMContentLoaded', function () {
  const toggleInput = document.getElementById('toggle-dark-mode');
  const body = document.body;

  if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    toggleInput.checked = true;
  }

  toggleInput.addEventListener('change', function () {
    body.classList.toggle('dark-mode');

    const theme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);

    if (typeof saveAdminState === 'function') {
      saveAdminState(theme);
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
    if (await restoreAdminState()) {
        console.log("Admin state restored");
    } else {
        const savedUser = localStorage.getItem("user");
        const savedQuizId = localStorage.getItem("selectedQuizId");
        const savedScreen = localStorage.getItem("currentScreen");

        if (savedUser && savedQuizId && savedScreen === "quiz-container") {
            user = JSON.parse(savedUser);
            isAdmin = false;

            const quizRes = await fetch(`/get-quiz?quizId=${savedQuizId}`);
            if (!quizRes.ok) {
                console.error("Failed to fetch quiz data on restore, logging out.");
                logout();
                return;
            }
            const quizData = await quizRes.json();
            
            const savedAnswers = localStorage.getItem("userAnswers");
            userAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};
            timeLeft = parseInt(localStorage.getItem("timeLeft")) || 7200;
            selectedQuizId = savedQuizId;

            hideAllScreens();
            quizContainer.classList.remove("hidden");
            timerDisplay.classList.remove("hidden");
            audio.classList.remove("hidden");
            
            await loadQuizPdf(quizData.quizPdfUrl, 'image-display');

            Object.keys(userAnswers).forEach(questionId => {
                const radio = document.querySelector(`input[name="${questionId}"][value="${userAnswers[questionId]}"]`);
                if (radio) radio.checked = true;
            });
            
            applyPartVisibility(quizData.partVisibility);
            const firstVisiblePart = findFirstVisiblePart(quizData.partVisibility) || 1;
            await loadAudio(firstVisiblePart);
            startTimer();
            currentQuizPart = firstVisiblePart;
            updateQuizNavigation(currentQuizPart, studentPartVisibility);
            
            downloadNotice.classList.add("hidden");
            initializeWebSocket();
        } 
        else if (savedUser) {
            user = JSON.parse(savedUser);
            isAdmin = false;
            hideAllScreens();
            quizListScreen.classList.remove("hidden");
            adminOptions.classList.add("hidden");
            adminControls.classList.add("hidden");
            downloadNotice.classList.add("hidden");
            initializeWebSocket();
            await loadQuizzes();
        } else {
            showWelcomeScreen();
        }
    }

    assignBtn.addEventListener("click", assignQuiz);
    directTestBtn.addEventListener("click", startDirectTest);
    endDirectTestBtn.addEventListener("click", endDirectTest);
    quizForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (confirm("Bạn có chắc muốn nộp bài không?")) {
            submitQuiz();
        }
    });
});

document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    document.getElementById("loading-screen").classList.add("hidden");
  }, 2000);
});
