<<<<<<< HEAD
// Bắt đầu toàn bộ ứng dụng chỉ sau khi HTML đã tải xong
document.addEventListener("DOMContentLoaded", () => {
=======
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
  if (!document.getElementById("admin-step-audio").classList.contains("hidden")) return "admin-step-audio";
  for (let i = 1; i <= 7; i++) {
    if (!document.getElementById(`admin-step-part${i}`).classList.contains("hidden")) {
      return `admin-step-part${i}`;
    }
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
      if (state.screen === "quiz-list-screen") {
        quizListScreen.classList.remove("hidden");
        adminOptions.classList.remove("hidden");
        adminControls.classList.remove("hidden");
        if (selectedQuizId) {
          assignBtn.classList.remove("hidden");
          directTestBtn.classList.remove("hidden");
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
      } else if (state.screen.startsWith("admin-step-")) {
        document.getElementById(state.screen).classList.remove("hidden");
      }

      initializeWebSocket();
      if (isAdmin) {
        startHeartbeat(); // ⭐ Add this line
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
>>>>>>> parent of 3b91775 (big update for each part)
    
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

<<<<<<< HEAD
    // =================================================================================
    // CÁC HÀM QUẢN LÝ GIAO DIỆN (UI FUNCTIONS)
    // =================================================================================
=======
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
  notification.innerText = "";
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
  selectedQuizId = null;
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

window.handleAdminCredentialResponse = async (response) => {
  try {
    if (!response.credential) {
      throw new Error("No credential received from Google Sign-In.");
    }
    const profile = JSON.parse(atob(response.credential.split('.')[1]));
    if (!profile.email) {
      throw new Error("Unable to retrieve email from Google profile.");
    }
    user = { name: profile.name, email: profile.email };
    isAdmin = true;
    hideAllScreens();
    quizListScreen.classList.remove("hidden");
    adminOptions.classList.remove("hidden");
    adminControls.classList.remove("hidden");
    initializeWebSocket();
    await loadQuizzes();
    downloadNotice.classList.add("hidden");
    saveAdminState();
    startHeartbeat();
  } catch (error) {
    console.error("Error during Admin login:", error);
    notification.innerText = "Đăng nhập Admin thất bại. Vui lòng thử lại hoặc kiểm tra Client ID.";
    showWelcomeScreen();
  }
};

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
  document.getElementById("admin-step-audio").classList.remove("hidden");
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

  console.log("Selected file:", file ? file.name : null);
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
  formData.append("createdBy", user.email);
  console.log("FormData prepared, createdBy:", user.email);

  modal.classList.remove("hidden");
  uploadButton.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const endpoint = file.name.endsWith('.zip') ? '/upload-quizzes-zip' : '/upload-quizzes';
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    console.log("Response status:", res.status, "OK:", res.ok);
    let result;
    try {
      result = await res.json();
      console.log("Server response:", result);
    } catch (jsonError) {
      console.error("Error parsing JSON:", jsonError);
      throw new Error("Phản hồi server không hợp lệ");
    }

    if (!res.ok) {
      throw new Error(result.message || "Server returned an error");
    }

    notificationElement.innerText = result.message || "Tải lên đề thi thành công!";
    console.log("Upload successful, calling backToQuizList()");
    backToQuizList();
>>>>>>> parent of 3b91775 (big update for each part)
    
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
<<<<<<< HEAD

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
=======
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
>>>>>>> parent of 3b91775 (big update for each part)

    // =================================================================================
    // LOGIC NGHIỆP VỤ & KẾT NỐI MÁY CHỦ
    // =================================================================================
    
<<<<<<< HEAD
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
=======
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
      hideAllScreens();
      quizContainer.classList.remove("hidden");
      timerDisplay.classList.remove("hidden");
      audio.classList.remove("hidden");

      const savedAnswers = localStorage.getItem("userAnswers");
      userAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};

      if (userAnswers) {
        Object.keys(userAnswers).forEach(questionId => {
          const radio = document.querySelector(`input[name="${questionId}"][value="${userAnswers[questionId]}"]`);
          if (radio) {
            radio.checked = true;
          } else {
            console.warn(`Radio button for ${questionId} with value ${userAnswers[questionId]} not found`);
          }
        });
      }

      localStorage.setItem("selectedQuizId", quizId);
      localStorage.setItem("currentScreen", "quiz-container");
      localStorage.setItem("timeLeft", timeLeft);

      await loadAudio(1);
      await loadImages(1);
      startTimer();
      currentQuizPart = 1;
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
    return;
  }
  try {
    const audioRes = await fetch(`/quiz-audio?part=part${part}`);
    const data = await audioRes.json();
    if (data.audio) {
      audioSource.src = data.audio;
      audio.load();
    } else {
      notification.innerText = `Không tìm thấy file nghe cho Part ${part}!`;
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
  if (current >= 7) return;
  document.getElementById(`quiz-part${current}`).classList.add("hidden");
  document.getElementById(`quiz-part${current + 1}`).classList.remove("hidden");
  currentQuizPart = current + 1;
  loadImages(current + 1);
  loadAudio(current + 1);
}

function prevQuizPart(current) {
  if (current <= 1) return;
  document.getElementById(`quiz-part${current}`).classList.add("hidden");
  document.getElementById(`quiz-part${current - 1}`).classList.remove("hidden");
  currentQuizPart = current - 1;
  loadImages(current - 1);
  loadAudio(current - 1);
}

async function saveQuiz() {
  const notificationElement = document.getElementById("notification-part7");
  const saveButton = document.querySelector('#admin-step-part7 button[onclick="saveQuiz()"]');
  const modal = document.getElementById("loading-modal");
  const quizName = document.getElementById("quiz-name").value.trim();
  console.log("Quiz name:", quizName);
  if (!quizName) {
    notificationElement.innerText = "Vui lòng nhập tên đề thi!";
    return;
  }

  const formData = new FormData();
  const audioFiles = [
    document.getElementById("audio-file-part1").files[0],
    document.getElementById("audio-file-part2").files[0],
    document.getElementById("audio-file-part3").files[0],
    document.getElementById("audio-file-part4").files[0],
  ];
  console.log("Audio files:", audioFiles.map(f => f ? f.name : null));
  for (let i = 0; i < audioFiles.length; i++) {
    if (!audioFiles[i]) {
      notificationElement.innerText = `Vui lòng tải file nghe cho Part ${i + 1}!`;
      return;
    }
    formData.append(`audio-part${i + 1}`, audioFiles[i]);
  }

  for (let i = 1; i <= 7; i++) {
    const files = document.getElementById(`images-part${i}`).files;
    console.log(`Images for Part ${i}:`, files.length, Array.from(files).map(f => f.name));
    if (!files.length) {
      notificationElement.innerText = `Vui lòng tải ít nhất một ảnh cho Part ${i}!`;
      return;
    }
    // Validate and rename files to partX_Y.extension
    Array.from(files).forEach((file, index) => {
      const extension = file.name.match(/\.(jpg|jpeg|png|pdf)$/i)?.[0].toLowerCase();
      if (!extension) {
        notificationElement.innerText = `File không hợp lệ cho Part ${i}: ${file.name}. Chỉ hỗ trợ jpg, jpeg, png, pdf.`;
        return;
      }
      const newName = `part${i}_${index + 1}${extension}`;
      console.log(`Renaming file for Part ${i}: ${file.name} -> ${newName}`);
      const renamedFile = new File([file], newName, { type: file.type });
      formData.append(`images-part${i}`, renamedFile);
    });
  }

  const answerKey = {};
  let questionIndex = 1;
  for (let part = 1; part <= 7; part++) {
    const answerKeyInput = document.getElementById(`answer-key-part${part}`).value.trim();
    console.log(`Answer key for Part ${part}:`, answerKeyInput);
    if (!answerKeyInput) {
      notificationElement.innerText = `Vui lòng nhập đáp án cho Part ${part}!`;
      return;
    }
    const answers = answerKeyInput.split(",").map(a => a.trim().toUpperCase());
    if (answers.length !== partAnswerCounts[part - 1]) {
      notificationElement.innerText = `Đã nhập ${answers.length} đáp án, yêu cầu đúng ${partAnswerCounts[part - 1]} đáp án cho Part ${part}!`;
      return;
    }
    if (!answers.every(a => ["A", "B", "C", "D"].includes(a))) {
      notificationElement.innerText = `Đáp án Part ${part} chỉ được chứa A, B, C, D!`;
      return;
    }
    for (let i = 0; i < partAnswerCounts[part - 1]; i++) {
      answerKey[`q${questionIndex}`] = answers[i];
      questionIndex++;
    }
  }
  console.log("Answer key object:", answerKey);
  formData.append("answerKey", JSON.stringify(answerKey));
  formData.append("quizName", quizName);
  console.log("User object:", user);
  formData.append("createdBy", user.email);
  console.log("FormData prepared, createdBy:", user.email);

  modal.classList.remove("hidden");
  saveButton.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const res = await fetch("/save-quiz", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const result = await res.json();
    console.log("Server response:", result);
    notificationElement.innerText = result.message;
    if (res.ok) {
      backToQuizList();
    } else {
      throw new Error(result.message || "Server returned an error");
    }
  } catch (error) {
    console.error("Error saving quiz:", error);
    notificationElement.innerText = `Lỗi khi lưu đề thi: ${error.message}. Vui lòng thử lại.`;
  } finally {
    modal.classList.add("hidden");
    saveButton.disabled = false;
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
  if (!user || !user.name) {
    console.error("No user logged in");
    notification.innerText = "Lỗi: Vui lòng nhập tên lại.";
    showWelcomeScreen();
    return;
  }

  const formData = new FormData(quizForm);
  userAnswers = {};
  formData.forEach((val, key) => (userAnswers[key] = val));

  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.name, answers: userAnswers }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Lỗi server: ${res.status}`);
    }

    const result = await res.json();
>>>>>>> parent of 3b91775 (big update for each part)
    
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

<<<<<<< HEAD
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
=======
    hideAllScreens();
    resultScreen.classList.remove("hidden");
    timerDisplay.classList.add("hidden");
    audio.classList.add("hidden");
    resultScore.innerText = `Điểm: ${result.score}/200`;
    resultTime.innerText = `Thời gian nộp: ${new Date().toLocaleString()}`;
    quizForm.querySelector("button[type=submit]").disabled = true;
    clearInterval(timerInterval);

    if (isAdminControlled && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "submitted", username: user.name }));
    }

    localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
    localStorage.removeItem("selectedQuizId");
    localStorage.removeItem("currentScreen");
    localStorage.removeItem("timeLeft");

    downloadNotice.classList.remove("hidden");
    showDownloadNotice();
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
    if (!event.data) {
      console.warn("Received empty WebSocket message");
      return;
    }
    const message = JSON.parse(event.data);
    if (message.type === "quizStatus") {
      quizStatus.innerText = message.quizId ? `Đề thi hiện tại: ${message.quizName}` : "Chưa có đề thi được chọn.";
      selectedQuizId = message.quizId;
      if (isAdmin && message.quizId) {
        assignBtn.classList.remove("hidden");
        directTestBtn.classList.remove("hidden");
      }
      loadQuizzes();
    } else if (message.type === "participants" || message.type === "participantCount") {
      participantCount.innerText = `Số người tham gia: ${message.count || 0}`;
      directParticipantCount.innerText = `Số người tham gia: ${message.count || 0}`;
    } else if (message.type === "submitted" || message.type === "submittedCount") {
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
            <td class="border p-2">${result.submittedAt ? new Date(result.submittedAt).toLocaleString() : 'N/A'}</td>
          `;
          resultsBody.appendChild(tr);
        });
        resultsTable.classList.remove("hidden");
      }
    } else if (message.type === "start") {
      isAdminControlled = true;
      initialTimeLimit = message.timeLimit || 7200; // Lưu thời gian ban đầu
      timeLeft = message.timeLimit || 7200;
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
        loadAudio(1);
        loadImages(1);
        startTimer();
        updateProgressBar(); // Cập nhật thanh tiến trình
        currentQuizPart = 1;
        downloadNotice.classList.add("hidden");
        notification.innerText = "Bài thi đã bắt đầu!";
      }
    } else if (message.type === "end") {
      isTestEnded = true;
      localStorage.removeItem("directTestState");
      clearInterval(timerInterval);
      directTestProgressBar.style.width = "0%";
      directTestTimer.innerText = "Kiểm tra đã kết thúc!";
      if (!isAdmin) {
        submitQuiz();
        notification.innerText = "Bài thi đã kết thúc!";
      } else {
        fetchDirectResults();
      }
    } else if (message.type === "error") {
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
      notification.innerText = "Lỗi: Không tìm thấy màn hình xem đáp án.";
      return;
    }

    if (!userAnswers) {
      const savedAnswers = localStorage.getItem("userAnswers");
      if (savedAnswers) {
        userAnswers = JSON.parse(savedAnswers);
        console.log("User answers restored from localStorage:", userAnswers);
      }
    }

    console.log("Current answerKey:", answerKey);
    if (!answerKey) {
      console.warn("Answer key is not loaded, attempting to fetch...");
      try {
        const answerRes = await fetch("/answer-key");
        if (!answerRes.ok) {
          console.error("Failed to fetch answer key, status:", answerRes.status);
          throw new Error("Không thể lấy đáp án đúng");
>>>>>>> parent of 3b91775 (big update for each part)
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
<<<<<<< HEAD
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
=======

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
    if (user && user.name) {
      await fetch("/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.name }),
      });
    }
  } catch (error) {
    console.error("Error during logout:", error);
  }
  clearUserAnswers();
  stopHeartbeat();
  localStorage.removeItem("user");
  localStorage.removeItem("selectedQuizId");
  localStorage.removeItem("currentScreen");
  localStorage.removeItem("timeLeft");
  showWelcomeScreen();
}
>>>>>>> parent of 3b91775 (big update for each part)

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