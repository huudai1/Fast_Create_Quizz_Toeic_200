// quiz.js
let user = null;
let isAdmin = false;
let timeLeft = 7200;
let timerInterval = null;
let isAdminControlled = false;
let selectedQuizId = null;
let isDirectTestMode = false;
let isTestEnded = false;
let userAnswers = null; // Lưu đáp án người dùng
let answerKey = null; // Lưu đáp án đúng
let currentAnswerPart = 1; // Phần hiện tại trong màn hình đáp án
const answerScreen = document.getElementById("answer-screen");
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

function showResultScreen() {
  hideAllScreens();
  resultScreen.classList.remove("hidden");
}

// Hàm hiển thị màn hình đáp án
async function showAnswerScreen() {
  const answerNotification = document.getElementById("answer-notification");
  const answerScreen = document.getElementById("answer-screen");

  if (!userAnswers || !answerKey) {
    answerNotification.innerText = "Không thể hiển thị đáp án. Dữ liệu không đầy đủ.";
    return;
  }

  try {
    hideAllScreens();
    answerScreen.classList.remove("hidden");
    answerNotification.innerText = "";
    currentAnswerPart = 1;

    await loadAnswerImages();
    await loadAnswerQuestions();
    updateAnswerPartVisibility();
  } catch (error) {
    console.error("Error in showAnswerScreen:", error);
    answerNotification.innerText = "Lỗi khi hiển thị màn hình đáp án. Vui lòng thử lại.";
  }
}

// Hàm tải hình ảnh cho màn hình đáp án
async function loadAnswerImages() {
  const answerImageDisplay = document.getElementById("answer-image-display");
  const answerNotification = document.getElementById("answer-notification");

  try {
    answerImageDisplay.innerHTML = "";
    for (let part = 1; part <= 7; part++) {
      const res = await fetch(`/images?part=${part}`);
      if (!res.ok) {
        throw new Error(`Không thể tải hình ảnh cho Part ${part}`);
      }
      const files = await res.json();
      const section = document.createElement("div");
      section.id = `answer-images-part${part}`;
      section.className = part === 1 ? "" : "hidden";
      section.innerHTML = `<h3 class="text-lg font-semibold mb-2">Part ${part}</h3>`;
      if (files.length === 0) {
        section.innerHTML += `<p class="text-gray-500">Không có hình ảnh hoặc PDF cho Part ${part}</p>`;
      }
      files.forEach((url) => {
        const isPDF = url.endsWith('.pdf');
        if (isPDF) {
          const embed = document.createElement("embed");
          embed.src = url;
          embed.type = "application/pdf";
          embed.className = "w-full h-[600px] rounded mb-4";
          section.appendChild(embed);
        } else {
          const imgElement = document.createElement("img");
          imgElement.src = url;
          imgElement.alt = `Image for Part ${part}`;
          imgElement.className = "w-full max-w-[600px] mb-4 rounded";
          section.appendChild(imgElement);
        }
      });
      answerImageDisplay.appendChild(section);
    }
  } catch (error) {
    console.error("Error in loadAnswerImages:", error);
    answerNotification.innerText = `Lỗi khi tải hình ảnh/PDF: ${error.message}`;
  }
}

// Hàm tải câu hỏi và đáp án
async function loadAnswerQuestions() {
  try {
    const questionSection = document.getElementById("answer-question-section");
    if (!questionSection) {
      throw new Error("Phần tử answer-question-section không tồn tại");
    }
    questionSection.innerHTML = "";

    let questionIndex = 1;
    for (let part = 1; part <= 7; part++) {
      const partDiv = document.createElement("div");
      partDiv.id = `answer-part${part}`;
      partDiv.className = part === 1 ? "" : "hidden";
      partDiv.innerHTML = `<h2 class="text-2xl font-semibold mb-2">Part ${part}</h2>`;
      const sectionDiv = document.createElement("div");
      sectionDiv.id = `answer-section${part}`;
      sectionDiv.className = "space-y-4";

      const questionCount = partAnswerCounts[part - 1];
      let correctCount = 0;

      for (let j = 0; j < questionCount; j++) {
        const qId = `q${questionIndex}`;
        const questionDiv = document.createElement("div");
        questionDiv.className = "p-2 rounded border";
        const userAnswer = userAnswers[qId];
        const correctAnswer = answerKey[qId];

        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect && correctAnswer) correctCount++;
        questionDiv.classList.add(isCorrect ? "bg-green-100" : "bg-red-100");

        questionDiv.innerHTML = `
          <p class="font-semibold">Câu ${questionIndex}: Đáp án của bạn: ${userAnswer || "Không chọn"}</p>
          <p>Đáp án đúng: ${correctAnswer || "Không có"}</p>
        `;
        sectionDiv.appendChild(questionDiv);
        questionIndex++;
      }

      partDiv.innerHTML += `<p class="text-sm text-gray-600 mt-2">Số câu đúng: ${correctCount}/${questionCount}</p>`;
      partDiv.appendChild(sectionDiv);
      questionSection.appendChild(partDiv);
    }

    const navDiv = document.createElement("div");
    navDiv.className = "flex space-x-4 sticky bottom-0 bg-gray-100 p-4";
    navDiv.innerHTML = `
      <button type="button" onclick="prevAnswerPart()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Phần trước</button>
      <button type="button" onclick="nextAnswerPart()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Phần tiếp theo</button>
      <button onclick="showResultScreen()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Quay lại</button>
    `;
    questionSection.appendChild(navDiv);
  } catch (error) {
    console.error("Error in loadAnswerQuestions:", error);
    answerNotification.innerText = `Lỗi khi tải câu hỏi: ${error.message}`;
  }
}


// Hàm điều chỉnh hiển thị phần đáp án
function updateAnswerPartVisibility() {
  try {
    for (let i = 1; i <= 7; i++) {
      const part = document.getElementById(`answer-part${i}`);
      const imagePart = document.getElementById(`answer-images-part${i}`);
      if (part) part.classList.toggle("hidden", i !== currentAnswerPart);
      if (imagePart) imagePart.classList.toggle("hidden", i !== currentAnswerPart);
    }
    const h3 = document.querySelector("#answer-image-display h3");
    if (h3) {
      h3.innerText = `Part ${currentAnswerPart}`;
    } else {
      console.warn("h3 element in #answer-image-display not found");
    }
  } catch (error) {
    console.error("Error in updateAnswerPartVisibility:", error);
    answerNotification.innerText = "Lỗi khi cập nhật hiển thị phần đáp án.";
  }
}

// Hàm chuyển đến phần trước
function prevAnswerPart(current) {
  if (currentAnswerPart > 1) {
    currentAnswerPart--;
    updateAnswerPartVisibility();
  }
}

// Hàm chuyển đến phần tiếp theo
function nextAnswerPart(current) {
  if (currentAnswerPart < 7) {
    currentAnswerPart++;
    updateAnswerPartVisibility();
  }
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
      currentAdminStep: currentAdminStep,
      currentAnswerPart: currentAnswerPart
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
  if (!answerScreen.classList.contains("hidden")) return "answer-screen"; // Thêm điều kiện cho answer-screen
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
      } else if (state.screen === "answer-screen") { // Thêm điều kiện cho answer-screen
        answerScreen.classList.remove("hidden");
        // Khôi phục trạng thái nếu cần (ví dụ: hiển thị phần đáp án hiện tại)
        currentAnswerPart = state.currentAnswerPart || 1;
        await loadAnswerImages();
        await loadAnswerQuestions();
        updateAnswerPartVisibility();
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
  answerScreen.classList.add("hidden");
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
  clearUserAnswers(); // Xóa userAnswers khi quay lại màn hình chính
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
          directTestMessage.innerText = `Kiểm tra trực tiếp đang diễn ra! (Thời gian còn lại: ${Math.floor(remainingTime / 60)}:${remainingTime % 60 < 10 ? "0" : ""}${remainingTime % 60})`;
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
      currentQuizPart = 0;
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

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: "start", 
          quizId: selectedQuizId,
          timeLimit: timeLimitSeconds,
          startTime: startTime 
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
      localStorage.removeItem("directTest");
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

      // Khôi phục userAnswers từ localStorage
      const savedAnswers = localStorage.getItem("userAnswers");
      userAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};

      // Điền lại các đáp án đã chọn
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

      // Lưu trạng thái bài thi
      localStorage.setItem("selectedQuizId", quizId);
      localStorage.setItem("currentScreen", "quiz-container");
      localStorage.setItem("timeLeft", timeLeft);

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

  // Thêm sự kiện change cho radio buttons
  const radios = div.querySelectorAll(`input[name="${id}"]`);
  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (!userAnswers) {
        userAnswers = {}; // Khởi tạo nếu chưa có
      }
      userAnswers[id] = radio.value;
      saveUserAnswers(); // Lưu ngay sau khi chọn đáp án
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
    localStorage.setItem("timeLeft", timeLeft); // Lưu thời gian còn lại
  }, 1000);
}

async function loadImages(part) {
  try {
    const res = await fetch(`/images?part=${part}`);
    const files = await res.json();
    imageDisplay.innerHTML = `<h3 class="text-lg font-semibold mb-2">Part ${part}</h3>`;
    files.forEach(url => {
      const isPDF = url.endsWith('.pdf');
      if (isPDF) {
        const embed = document.createElement("embed");
        embed.src = url;
        embed.type = "application/pdf";
        embed.className = "w-full h-[600px] mb-4"; // Điều chỉnh kích thước phù hợp
        imageDisplay.appendChild(embed);
      } else {
        const img = document.createElement("img");
        img.src = url;
        img.className = "w-full max-w-[400px] mb-4 rounded";
        imageDisplay.appendChild(img);
      }
    });
  } catch (error) {
    console.error("Error loading images:", error);
    notification.innerText = `Lỗi khi tải ảnh hoặc PDF cho Part ${part}.`;
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

function hideAllQuizParts() {
  for (let i = 1; i <= 7; i++) {
    const part = document.getElementById(`quiz-part${i}`);
    if (part) {
      part.classList.add("hidden");
    }
  }
}

// Hàm chuyển đến phần tiếp theo
function nextQuizPart(current) {
  if (current >= 7) return;
  hideAllQuizParts(); // Ẩn tất cả các phần
  document.getElementById(`quiz-part${current + 1}`).classList.remove("hidden");
  currentQuizPart = current;
  loadImages(current + 1);
  loadAudio(current + 1);
}

// Hàm quay lại phần trước
function prevQuizPart(current) {
  if (current <= 1) return;
  hideAllQuizParts(); // Ẩn tất cả các phần
  document.getElementById(`quiz-part${current - 1}`).classList.remove("hidden");
  currentQuizPart = current;
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
    
    // Lấy đáp án đúng từ server
    const answerRes = await fetch("/answer-key");
    if (!answerRes.ok) {
      throw new Error("Không thể lấy đáp án đúng");
    }
    answerKey = await answerRes.json();

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

    // Xóa trạng thái bài thi sau khi nộp thành công
    clearUserAnswers();
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

function saveUserAnswers() {
  if (!userAnswers) {
    userAnswers = {}; // Khởi tạo nếu chưa có
  }
  try {
    localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
    console.log("User answers saved:", userAnswers);
  } catch (error) {
    console.error("Error saving user answers to localStorage:", error);
    notification.innerText = "Lỗi khi lưu đáp án. Vui lòng thử lại.";
  }
}

// Xóa userAnswers khỏi localStorage
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
        currentQuizPart = 0;
        downloadNotice.classList.add("hidden");
        notification.innerText = "Bài thi đã bắt đầu!";
      }
    } else if (message.type === "end") {
      isTestEnded = true;
      localStorage.removeItem("directTestState");
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
  localStorage.removeItem("user");
  localStorage.removeItem("selectedQuizId");
  localStorage.removeItem("currentScreen");
  localStorage.removeItem("timeLeft");
  showWelcomeScreen();
}

document.addEventListener("DOMContentLoaded", async () => {
  if (await restoreAdminState()) {
    console.log("Admin state restored");
  } else {
    const savedUser = localStorage.getItem("user");
    const savedAnswers = localStorage.getItem("userAnswers");
    const savedQuizId = localStorage.getItem("selectedQuizId");
    const savedScreen = localStorage.getItem("currentScreen");
    const directTestState = localStorage.getItem("directTestState");

    if (savedUser && savedAnswers && savedQuizId && savedScreen === "quiz-container") {
      user = JSON.parse(savedUser);
      userAnswers = JSON.parse(savedAnswers);
      selectedQuizId = savedQuizId;
      isAdmin = false;
      hideAllScreens();
      quizContainer.classList.remove("hidden");
      timerDisplay.classList.remove("hidden");
      audio.classList.remove("hidden");
      Object.keys(userAnswers).forEach(questionId => {
        const radio = document.querySelector(`input[name="${questionId}"][value="${userAnswers[questionId]}"]`);
        if (radio) radio.checked = true;
        else console.warn(`Radio button for ${questionId} with value ${userAnswers[questionId]} not found`);
      });
      timeLeft = parseInt(localStorage.getItem("timeLeft")) || 7200;
      await loadAudio(1);
      await loadImages(1);
      startTimer();
      currentQuizPart = 0;
      downloadNotice.classList.add("hidden");
      initializeWebSocket();
    } else if (savedUser) {
      user = JSON.parse(savedUser);
      isAdmin = false;
      hideAllScreens();
      quizListScreen.classList.remove("hidden");
      adminOptions.classList.add("hidden");
      adminControls.classList.add("hidden");
      downloadNotice.classList.add("hidden");
      initializeWebSocket();
      await loadQuizzes();
    } else if (directTestState && !savedUser) {
      showStudentLogin();
      notification.innerText = "Kiểm tra trực tiếp đang diễn ra. Vui lòng đăng nhập để tham gia.";
    } else {
      showWelcomeScreen();
    }
  }
  assignBtn.addEventListener("click", assignQuiz);
  directTestBtn.addEventListener("click", startDirectTest);
  endDirectTestBtn.addEventListener("click", endDirectTest);
  quizForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuiz();
  });
});