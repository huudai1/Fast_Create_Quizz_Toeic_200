// quiz.js
let user = null;
let isAdmin = false;
let timeLeft = 7200;
let timerInterval = null;
let isAdminControlled = false;
let selectedQuizId = null;
let isDirectTestMode = false;
let isTestEnded = false;
const welcomeScreen = document.getElementById("welcome-screen");
const adminLogin = document.getElementById("admin-login");
const studentLogin = document.getElementById("student-login");
const studentNameForm = document.getElementById("student-name-form");
const quizListScreen = document.getElementById("quiz-list-screen");
const adminOptions = document.getElementById("admin-options");
const adminControls = document.getElementById("admin-controls");
const uploadQuizzesSection = document.getElementById("upload-quizzes");
const historyScreen = document.getElementById("history-screen");
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

const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
let socket = null;
let currentAdminStep = 0;
let currentQuizPart = 0;
const partAnswerCounts = [6, 25, 39, 30, 30, 16, 54];

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
  if (!historyScreen.classList.contains("hidden")) return "history-screen";
  if (!quizContainer.classList.contains("hidden")) return "quiz-container";
  if (!resultScreen.classList.contains("hidden")) return "result-screen";
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
      } else if (state.screen === "history-screen") {
        historyScreen.classList.remove("hidden");
        await loadHistory();
      } else if (state.screen.startsWith("admin-step-")) {
        document.getElementById(state.screen).classList.remove("hidden");
      }

      initializeWebSocket();
      downloadNotice.classList.add("hidden");
      return true;
    }
  }
  return false;
}

function hideAllScreens() {
  welcomeScreen.classList.add("hidden");
  adminLogin.classList.add("hidden");
  studentLogin.classList.add("hidden");
  quizListScreen.classList.add("hidden");
  directTestScreen.classList.add("hidden");
  uploadQuizzesSection.classList.add("hidden");
  historyScreen.classList.add("hidden");
  quizContainer.classList.add("hidden");
  resultScreen.classList.add("hidden");
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
  currentQuizPart = 0;
  if (socket) {
    socket.close();
    socket = null;
  }
  clearState();
  downloadNotice.classList.remove("hidden");
  startDownloadNotice();
}

function showHistoryScreen() {
  hideAllScreens();
  historyScreen.classList.remove("hidden");
  loadHistory();
  saveAdminState();
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

  // Hiển thị modal và vô hiệu hóa nút Tải lên
  modal.classList.remove("hidden");
  uploadButton.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Timeout 60 giây
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

    // Hiển thị thông báo thành công
    notificationElement.innerText = result.message || "Tải lên đề thi thành công!";
    if (res.ok) {
      console.log("Upload successful, calling backToQuizList()");
      backToQuizList();
      
      // Thêm thông báo reload nếu chưa thấy đề
      setTimeout(() => {
        notificationElement.innerText = "Đã tải lên thành công! Nếu chưa thấy đề, vui lòng làm mới trang.";
        // Tự động reload sau 5 giây nếu người dùng không thao tác
        setTimeout(() => {
          if (confirm("Bạn có muốn làm mới trang để xem đề thi mới?")) {
            window.location.reload();
          }
        }, 5000);
      }, 1000); // Hiển thị thông báo sau 1 giây để tránh chồng lấn
    } else {
      throw new Error(result.message || "Server returned an error");
    }
  } catch (error) {
    console.error("Error uploading quizzes:", error);
    notificationElement.innerText = `Lỗi khi tải lên đề thi: ${error.message}. Vui lòng thử lại.`;
  } finally {
    // Ẩn modal và kích hoạt lại nút Tải lên
    modal.classList.add("hidden");
    uploadButton.disabled = false;
  }
}

async function downloadQuizzes(quizId) {
  const loadingModal = document.getElementById('loading-modal');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Hiển thị modal
  loadingModal.classList.remove('hidden');

  try {
    const url = `/download-quiz-zip/${quizId}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';

    // Theo dõi tiến trình tải xuống
    xhr.onprogress = function(event) {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        progressBar.style.width = `${percentComplete}%`;
        progressText.innerText = `${Math.round(percentComplete)}%`;
      }
    };

    // Khi tải xong
    xhr.onload = function() {
      if (xhr.status === 200) {
        const blob = xhr.response;
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `quiz_${quizId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        // Cập nhật thông báo
        notification.innerText = "Đã tải xuống file ZIP chứa đề thi.";

        // Ẩn modal sau khi tải xong
        setTimeout(() => {
          loadingModal.classList.add('hidden');
          progressBar.style.width = '0%'; // Reset thanh tiến trình
          progressText.innerText = '0%'; // Reset text
        }, 1000); // Hiển thị thêm 1 giây trước khi ẩn
      } else {
        throw new Error(`HTTP error! Status: ${xhr.status}`);
      }
    };

    // Xử lý lỗi
    xhr.onerror = function() {
      throw new Error('Network error occurred');
    };

    xhr.send();
  } catch (error) {
    console.error("Error downloading quiz:", error);
    notification.innerText = "Lỗi khi tải xuống file ZIP. Vui lòng thử lại.";
    loadingModal.classList.add('hidden'); // Ẩn modal nếu có lỗi
    progressBar.style.width = '0%'; // Reset thanh tiến trình
    progressText.innerText = '0%'; // Reset text
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
    let currentQuizId = selectedQuizId;
    try {
      const statusRes = await fetchWithRetry('/quiz-status');
      const status = await statusRes.json();
      currentQuizId = status.quizId || currentQuizId;
      quizStatus.innerText = status.quizId ? `Đề thi hiện tại: ${status.quizName}` : "Chưa có đề thi được chọn.";
    } catch (statusError) {
      console.warn("Failed to fetch quiz status:", statusError);
    }
    quizList.innerHTML = "";
    if (quizzes.length === 0) {
      quizList.innerHTML = "<p>Chưa có đề thi nào.</p>";
    } else {
      quizzes.forEach(quiz => {
        const div = document.createElement("div");
        div.className = "flex items-center space-x-2";
        const isSelected = currentQuizId === quiz.quizId;
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
    notification.innerText = "Không thể tải danh sách đề thi. Vui lòng thử lại.";
    quizList.innerHTML = "<p>Lỗi khi tải danh sách đề thi. Vui lòng làm mới trang.</p>";
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
      body: JSON.stringify({ quizId: selectedQuizId, timeLimit: timeLimitSeconds }),
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
    const res = await fetch("/select-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: selectedQuizId }),
    });
    const result = await res.json();
    if (res.ok) {
      isDirectTestMode = true;
      isTestEnded = false;
      hideAllScreens();
      directTestScreen.classList.remove("hidden");
      directResultsTable.classList.add("hidden");
      endDirectTestBtn.disabled = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "start", timeLimit: timeLimitSeconds }));
      }
      notification.innerText = "Đã bắt đầu kiểm tra trực tiếp.";
      saveAdminState();
    } else {
      notification.innerText = result.message;
    }
  } catch (error) {
    console.error("Error starting direct test:", error);
    notification.innerText = "Lỗi khi bắt đầu kiểm tra trực tiếp. Vui lòng thử lại.";
  }
}

async function endDirectTest() {
  if (isTestEnded) {
    notification.innerText = "Kiểm tra đã kết thúc!";
    return;
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "end" }));
    isTestEnded = true;
    endDirectTestBtn.disabled = true;
    await fetchDirectResults();
    saveAdminState();
  } else {
    notification.innerText = "Không thể gửi tín hiệu kết thúc. Kết nối WebSocket không hoạt động.";
    await fetchDirectResults();
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
      await loadAudio(1);
      await loadImages(1);
      startTimer();
      currentQuizPart = 0;
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
  div.className = "bg-gray-50 p-4 rounded border";
  div.innerHTML = `
    <label class="font-semibold">Câu ${num} (Part ${part})</label>
    <div class="mt-2 space-y-2">
      <label class="block"><input type="radio" name="${id}" value="A" class="mr-2"> A</label>
      <label class="block"><input type="radio" name="${id}" value="B" class="mr-2"> B</label>
      <label class="block"><input type="radio" name="${id}" value="C" class="mr-2"> C</label>
      <label class="block"><input type="radio" name="${id}" value="D" class="mr-2"> D</label>
    </div>
  `;
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
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
      return;
    }
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.innerText = `Thời gian còn lại: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    timeLeft--;
  }, 1000);
}

async function loadImages(part) {
  try {
    const res = await fetch(`/images?part=${part}`);
    const images = await res.json();
    imageDisplay.innerHTML = `<h3 class="text-lg font-semibold mb-2">Part ${part}</h3>`;
    images.forEach(url => {
      const img = document.createElement("img");
      img.src = url;
      img.className = "w-full max-w-[400px] mb-4 rounded"; // Đồng bộ với CSS
      imageDisplay.appendChild(img);
    });
  } catch (error) {
    console.error("Error loading images:", error);
    notification.innerText = `Lỗi khi tải ảnh cho Part ${part}.`;
  }
}

function nextAdminStep(step) {
  let notificationElement;

  // Xác định phần tử notification dựa trên bước
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
    for (let file of files) {
      formData.append(`images-part${i}`, file);
    }
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

  // Hiển thị modal và vô hiệu hóa nút Lưu
  modal.classList.remove("hidden");
  saveButton.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Timeout 60 giây
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
    // Ẩn modal và kích hoạt lại nút Lưu
    modal.classList.add("hidden");
    saveButton.disabled = false;
  }
}

function nextQuizPart(current) {
  if (current >= 7) return;
  document.getElementById(`quiz-part${current}`).classList.add("hidden");
  document.getElementById(`quiz-part${current + 1}`).classList.remove("hidden");
  currentQuizPart = current;
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

async function submitQuiz() {
  if (!user || !user.name) {
    console.error("No user logged in");
    notification.innerText = "Lỗi: Vui lòng nhập tên lại.";
    showWelcomeScreen();
    return;
  }

  const formData = new FormData(quizForm);
  const answers = {};
  formData.forEach((val, key) => answers[key] = val);

  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.name, answers }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Lỗi server: ${res.status}`);
    }

    const result = await res.json();
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

    downloadNotice.classList.remove("hidden");
    showDownloadNotice();
  } catch (error) {
    console.error("Error submitting quiz:", error);
    notification.innerText = "Lỗi khi nộp bài. Vui lòng thử lại.";
  }
}

async function loadHistory() {
  try {
    const res = await fetch("/history");
    const results = await res.json();
    historyBody.innerHTML = "";
    results.forEach(result => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2"><input type="checkbox" class="result-checkbox" data-id="${result.id}"></td>
        <td class="border p-2">${result.username}</td>
        <td class="border p-2">${result.score}</td>
        <td class="border p-2">${new Date(result.submittedAt).toLocaleString()}</td>
      `;
      historyBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error loading history:", error);
    notification.innerText = "Lỗi khi tải lịch sử điểm. Vui lòng thử lại.";
  }
}

async function deleteSelectedResults() {
  const checkboxes = document.querySelectorAll(".result-checkbox:checked");
  const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
  if (ids.length === 0) {
    notification.innerText = "Vui lòng chọn ít nhất một kết quả để xóa!";
    return;
  }
  if (!confirm(`Bạn có chắc muốn xóa ${ids.length} kết quả đã chọn?`)) return;
  try {
    const res = await fetch("/delete-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const result = await res.json();
    notification.innerText = result.message;
    if (res.ok) {
      loadHistory();
    }
  } catch (error) {
    console.error("Error deleting results:", error);
    notification.innerText = "Lỗi khi xóa kết quả. Vui lòng thử lại.";
  }
}

function toggleSelectAll() {
  const selectAll = document.getElementById("select-all");
  const checkboxes = document.querySelectorAll(".result-checkbox");
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
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
      timeLeft = message.timeLimit || 7200;
      if (!isAdmin) {
        hideAllScreens();
        quizContainer.classList.remove("hidden");
        timerDisplay.classList.remove("hidden");
        audio.classList.remove("hidden");
        loadAudio(1);
        loadImages(1);
        startTimer();
        currentQuizPart = 0;
        downloadNotice.classList.add("hidden");
        notification.innerText = "Bài thi đã bắt đầu!";
      }
    } else if (message.type === "end") {
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
    notification.innerText = "Lỗi khi xử lý thông tin từ server. Vui lòng kiểm tra kết nối.";
  }
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
  showWelcomeScreen();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (await restoreAdminState()) {
    console.log("Admin state restored");
  } else {
    showWelcomeScreen();
  }
  assignBtn.addEventListener("click", assignQuiz);
  directTestBtn.addEventListener("click", startDirectTest);
  endDirectTestBtn.addEventListener("click", endDirectTest);
  quizForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuiz();
  });
});