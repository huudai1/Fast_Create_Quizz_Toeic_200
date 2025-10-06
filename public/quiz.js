// =========================================================================
// PHẦN 1: KHAI BÁO BIẾN TOÀN CỤC (Giữ nguyên)
// =========================================================================
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
let initialTimeLimit = null;
let currentCustomQuizData = null;

let partVisibility = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
let studentPartVisibility = null;

const ADMIN_PASSWORD = "admin123";

let welcomeScreen, adminLogin, studentLogin, quizListScreen, adminOptions, adminControls,
    uploadQuizzesSection, quizzesFileInput, quizList, quizContainer, customQuizContainer, quizStatus,
    participantCount, submittedCount, assignBtn, directTestBtn, directTestScreen,
    endDirectTestBtn, directParticipantCount, directSubmittedCount, directResultsTable,
    directResultsBody, resultsTable, resultsBody, imageDisplay, audio, audioSource,
    timerDisplay, quizForm, resultScreen, resultScore, resultTime, downloadNotice,
    reviewScreen, staticScreen, adminLoginForm, adminPasswordInput, notificationAdmin;

const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
let socket = null;
let currentQuizPart = 1;
const partAnswerCounts = [6, 25, 39, 30, 30, 16, 54];
const parts = [
    { id: "section1", count: 6, part: 1 }, { id: "section2", count: 25, part: 2 },
    { id: "section3", count: 39, part: 3 }, { id: "section4", count: 30, part: 4 },
    { id: "section5", count: 30, part: 5 }, { id: "section6", count: 16, part: 6 },
    { id: "section7", count: 54, part: 7 },
];




// =========================================================================
// PHẦN 2: DÁN TẤT CẢ CÁC HÀM CHỨC NĂNG VÀO ĐÂY
// =========================================================================

 //=========================================================================
    //DANH SÁCH CÁC HÀM CẦN DÁN VÀO ĐÂY TỪ FILE CŨ CỦA BẠN
//=========================================================================

// --- QUẢN LÝ GIAO DIỆN ---
function hideAllScreens() {
    // Liệt kê ID của tất cả các màn hình chính
    const screenIds = [
        'welcome-screen',
        'admin-login',
        'student-login',
        'quiz-list-screen',
        'admin-step-create-quiz',
        'custom-quiz-creator-screen',
        'quiz-container',
        'custom-quiz-container',
        'result-screen',
        'review-answers',
        'statistics-screen',
        'direct-test-screen',
        'upload-quizzes'
    ];

    // Vòng lặp qua từng ID
    screenIds.forEach(id => {
        const screen = document.getElementById(id);
        // Quan trọng: Chỉ thực hiện ẩn nếu tìm thấy phần tử đó
        if (screen) {
            screen.classList.add('hidden');
        } else {
            console.warn(`Không tìm thấy màn hình với ID: ${id}`); // Báo cho bạn biết nếu có ID nào bị thiếu
        }
    });
}


function showWelcomeScreen() {
    hideAllScreens();
    welcomeScreen.classList.remove("hidden");
    const welcomeNotification = document.getElementById('welcome-notification');
    if (welcomeNotification) welcomeNotification.innerText = "";
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


function createNewQuiz() {
    showCreateQuizChoice();
}

function showToeicQuizCreator() {
    document.getElementById('create-quiz-choice-modal').classList.add('hidden');
    hideAllScreens();
    document.getElementById("admin-step-create-quiz").classList.remove("hidden");
}

function showCustomQuizCreator() {
    hideAllScreens();
    document.getElementById('custom-quiz-creator-screen').classList.remove('hidden');
    // Reset form khi mở
    document.getElementById('custom-quiz-form').reset();
    document.getElementById('listening-ranges-container').innerHTML = '';
}

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

function showUploadQuizzes() {
  hideAllScreens();
  uploadQuizzesSection.classList.remove("hidden");
  downloadNotice.classList.add("hidden");
  saveAdminState();
}

function showResultScreen() {
  hideAllScreens();
  resultScreen.classList.remove("hidden");
}



// --- QUẢN LÝ TRẠNG THÁI & WEBSOCKET ---
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


function handleWebSocketMessage(event) {
    try {
        if (!event.data) { return; }
        const message = JSON.parse(event.data);

        const safeUpdateText = (element, text) => {
            if (element) {
                element.innerText = text;
            }
        };

        if (message.type === "participantUpdate") {
            const count = message.count || 0;
            safeUpdateText(participantCount, `Số người tham gia: ${count}`);
            safeUpdateText(directParticipantCount, `Số người tham gia: ${count}`);

            const container = document.getElementById('participant-list-container');
            const list = document.getElementById('participant-list');
            const listCount = document.getElementById('participant-list-count');
            
            // THAY ĐỔI: Thêm điều kiện kiểm tra màn hình hiện tại
            if (isAdmin && !quizListScreen.classList.contains('hidden') && container && list && listCount) {
                container.classList.remove('hidden');
                listCount.innerText = count;
                list.innerHTML = '';
                if (message.participants && message.participants.length > 0) { // Sửa ở đây
                    message.participants.forEach(name => { // Và sửa ở đây
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
            safeUpdateText(submittedCount, `Số bài đã nộp: ${count}`);
            safeUpdateText(directSubmittedCount, `Số bài đã nộp: ${count}`);
            
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
            const statusText = message.quizId ? `Đề thi hiện tại: ${message.quizName}` : "Chưa có đề thi được chọn.";
            safeUpdateText(quizStatus, statusText);
            if (!isAdmin) {
                loadQuizzes();
            }
        } 
        else if (message.type === "error") {
            notification.innerText = message.message;
        }
    } catch (error) {
        console.error("Error handling WebSocket message:", error);
        // Tìm một nơi an toàn để hiển thị lỗi, ví dụ như quiz-list-notification
        const notificationElement = document.getElementById('quiz-list-notification');
        if(notificationElement) {
            notificationElement.innerText = "Lỗi khi xử lý thông tin từ server.";
        }
    }
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

function clearState() {
  localStorage.removeItem("adminState");
}

// --- CHỨC NĂNG ADMIN & DỮ LIỆU ---
async function loadQuizzes() {
    const url = isAdmin ? `/quizzes` : '/quizzes/assigned'; // Cập nhật API endpoint
    try {
        const res = await fetchWithRetry(url);
        const quizzes = await res.json();
        quizList.innerHTML = "";
        
        if (quizzes.length === 0) {
            quizList.innerHTML = "<p>Chưa có đề thi nào.</p>";
        } else {
            quizzes.forEach(quiz => {
                const div = document.createElement("div");
                div.className = "p-4 border rounded-lg flex justify-between items-center";
                
                // Hiển thị loại đề
                const quizTypeLabel = quiz.type === 'custom' ? '[Tùy chỉnh]' : '[TOEIC]';
                
                if (isAdmin) {
                    div.innerHTML = `
                        <div>
                            <span class="text-lg font-medium">${quiz.quizName}</span>
                            <span class="text-sm text-gray-500 ml-2">${quizTypeLabel}</span>
                        </div>
                        <div>
                            <button onclick="selectQuiz('${quiz.quizId}')" class="bg-blue-500 text-white px-2 py-1 rounded text-sm">Chọn</button>
                            <button onclick="downloadQuizzes('${quiz.quizId}')" class="bg-purple-500 text-white px-2 py-1 rounded text-sm">Tải xuống</button>
                            <button onclick="deleteQuiz('${quiz.quizId}')" class="bg-red-500 text-white px-2 py-1 rounded text-sm">Xóa</button>
                        </div>
                    `;
                } else { // Giao diện học sinh
                    // Dựa vào loại đề để gọi đúng hàm start
                    const startFunction = quiz.type === 'custom' ? `startCustomQuiz('${quiz.quizId}')` : `startQuiz('${quiz.quizId}')`;
                    div.innerHTML = `
                        <div>
                            <span class="text-lg font-medium">${quiz.quizName}</span>
                             <span class="text-sm text-gray-500 ml-2">${quizTypeLabel}</span>
                        </div>
                        <button onclick="${startFunction}" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Bắt đầu làm bài</button>
                    `;
                }
                quizList.appendChild(div);
            });
        }
    } catch (error) {
        console.error("Error loading quizzes:", error);
        quizList.innerHTML = "<p>Lỗi khi tải danh sách đề thi.</p>";
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

async function showStatistics() {
    // Sử dụng một biến cục bộ để tìm element, không dùng biến global 'notification' nữa
    const notificationElement = document.getElementById('quiz-list-notification');

    if (!selectedQuizId) {
        if (notificationElement) notificationElement.innerText = "Vui lòng chọn một đề thi trước!";
        return;
    }

    try {
        const res = await fetch(`/statistics?quizId=${selectedQuizId}`);
        if (!res.ok) {
            throw new Error(`Lỗi từ server: ${res.status}`);
        }
        const data = await res.json();

        hideAllScreens();
        const statisticsScreen = document.getElementById("statistics-screen");
        if (statisticsScreen) statisticsScreen.classList.remove("hidden");

        const notificationStatistics = document.getElementById("notification-statistics");
        if (notificationStatistics) notificationStatistics.innerText = "";

        const averageScore = data.averageScore || 0;
        const totalQuestions = data.totalQuestions || 200;
        const averageScoreBar = document.getElementById("average-score-bar");
        const averageScoreText = document.getElementById("average-score-text");

        if (averageScoreBar && averageScoreText) {
            const percentage = totalQuestions > 0 ? (averageScore / totalQuestions) * 100 : 0;
            averageScoreBar.style.width = `${percentage}%`;
            averageScoreText.innerText = `Điểm trung bình: ${averageScore.toFixed(2)}/${totalQuestions}`;
        }

        const statisticsBody = document.getElementById("statistics-body");
        if (statisticsBody) {
            statisticsBody.innerHTML = "";
            if (data.questionStats) {
                data.questionStats.forEach(stat => {
                    const tr = document.createElement("tr");
                    const wrongPercentage = stat.totalCount > 0 ? ((stat.wrongCount / stat.totalCount) * 100).toFixed(2) : 0;
                    tr.innerHTML = `
                        <td class="border p-2">${stat.questionNumber}</td>
                        <td class="border p-2">${stat.wrongCount}</td>
                        <td class="border p-2">${stat.totalCount}</td>
                        <td class="border p-2">${wrongPercentage}%</td>
                    `;
                    statisticsBody.appendChild(tr);
                });
            }
        }

    } catch (error) {
        console.error("Error fetching statistics:", error);
        backToQuizList();
        setTimeout(() => {
            if (notificationElement) notificationElement.innerText = "Lỗi khi tải thống kê. Đề thi này có thể chưa có ai làm.";
        }, 100);
    }
}

// --- CHỨC NĂNG KIỂM TRA TRỰC TIẾP ---
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


// --- LOGIC ĐỀ THI TOEIC ---
function generateQuizQuestions() {
    // Đây chính là đoạn code bị xóa ở trên, giờ được đặt trong hàm
    let questionIndex = 1;
    parts.forEach(({ id, count, part }) => {
        const section = document.getElementById(id);
        if (section) { // Kiểm tra xem section có tồn tại không
            section.innerHTML = ''; // Xóa câu hỏi cũ trước khi tạo mới
            for (let i = 1; i <= count; i++) {
                section.appendChild(createQuestion(`q${questionIndex}`, questionIndex, part));
                questionIndex++;
            }
        }
    });
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
            generateQuizQuestions();

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

function updateQuizNavigation(current, visibility) {
    const prevBtn = document.getElementById('prev-button');
    const nextBtn = document.getElementById('next-button');
    if (!prevBtn || !nextBtn) return;
    const nextVisible = findNextVisiblePart(current, visibility);
    const prevVisible = findPrevVisiblePart(current, visibility);
    prevBtn.disabled = !prevVisible;
    nextBtn.disabled = !nextVisible;
}

// --- LOGIC ĐỀ THI TÙY CHỈNH ---
function addListeningRange() {
    const container = document.getElementById('listening-ranges-container');
    const rangeId = Date.now(); // Tạo ID duy nhất cho mỗi dòng
    const newRangeDiv = document.createElement('div');
    newRangeDiv.className = 'flex items-center space-x-2 p-2 border-t';
    newRangeDiv.id = `range-${rangeId}`;
    newRangeDiv.innerHTML = `
        <label>Từ câu:</label>
        <input type="number" class="w-20 border p-1 rounded from-question" min="1">
        <label>Đến câu:</label>
        <input type="number" class="w-20 border p-1 rounded to-question" min="1">
        <label>File nghe:</label>
        <input type="file" class="audio-file" accept="audio/*">
        <button type="button" onclick="document.getElementById('range-${rangeId}').remove()" class="bg-red-500 text-white px-2 py-1 rounded text-xs">Xóa</button>
    `;
    container.appendChild(newRangeDiv);
}

async function saveCustomQuiz() {
    const notificationElement = document.getElementById('custom-notification');
    const modal = document.getElementById('loading-modal');
    notificationElement.innerText = '';

    const quizName = document.getElementById('custom-quiz-name').value.trim();
    const totalQuestions = parseInt(document.getElementById('custom-total-questions').value);
    const pdfFile = document.getElementById('custom-quiz-pdf').files[0];
    const answerKeyInput = document.getElementById('custom-answer-key').value.trim();

    // --- Validation ---
    if (!quizName || !totalQuestions || !pdfFile || !answerKeyInput) {
        notificationElement.innerText = 'Vui lòng điền đầy đủ Tên, Số câu, File PDF và Đáp án.';
        return;
    }
    const answers = answerKeyInput.split(',');
    if (answers.length !== totalQuestions) {
        notificationElement.innerText = `Số lượng đáp án (${answers.length}) không khớp với tổng số câu (${totalQuestions}).`;
        return;
    }
    
    const formData = new FormData();
    formData.append('quizType', 'custom'); // Đánh dấu đây là đề tùy chỉnh
    formData.append('quizName', quizName);
    formData.append('totalQuestions', totalQuestions);
    formData.append('pdfFile', pdfFile);
    formData.append('answerKey', answerKeyInput);
    formData.append('createdBy', user.email);

    const listeningRanges = [];
    const rangeDivs = document.querySelectorAll('#listening-ranges-container > div');
    for (let i = 0; i < rangeDivs.length; i++) {
        const div = rangeDivs[i];
        const from = div.querySelector('.from-question').value;
        const to = div.querySelector('.to-question').value;
        const audioFile = div.querySelector('.audio-file').files[0];
        if (!from || !to || !audioFile) {
            notificationElement.innerText = `Vui lòng điền đầy đủ thông tin và file nghe cho tất cả các khoảng nghe.`;
            return;
        }
        const rangeData = { from: parseInt(from), to: parseInt(to) };
        listeningRanges.push(rangeData);
        formData.append(`audio_file_${i}`, audioFile);
    }
    formData.append('listeningRanges', JSON.stringify(listeningRanges));

    modal.classList.remove('hidden');

    try {
        const res = await fetch('/save-quiz', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        backToQuizList();
        setTimeout(() => { notification.innerText = "Tạo đề thi tùy chỉnh thành công!"; }, 100);
    } catch (error) {
        notificationElement.innerText = `Lỗi: ${error.message}`;
    } finally {
        modal.classList.add('hidden');
    }
}

async function startCustomQuiz(quizId) {
    try {
        const res = await fetch(`/get-quiz?quizId=${quizId}`);
        if (!res.ok) throw new Error("Không thể tải thông tin đề thi.");
        
        currentCustomQuizData = await res.json();
        
        hideAllScreens();
        document.getElementById('custom-quiz-container').classList.remove('hidden');
        
        // Setup giao diện làm bài
        document.getElementById('custom-quiz-title').innerText = currentCustomQuizData.quizName;
        await loadQuizPdf(currentCustomQuizData.quizPdfUrl, 'custom-image-display');
        createCustomQuestionElements(currentCustomQuizData.totalQuestions);
        setupCustomAudioPlayer(currentCustomQuizData.listeningRanges);
        
        // Setup timer (lấy từ hàm assignQuiz - cần cập nhật server)
        timeLeft = currentCustomQuizData.timeLimit || 7200; 
        startTimer();

    } catch (error) {
        notification.innerText = error.message;
    }
}

function createCustomQuestionElements(totalQuestions) {
    const container = document.getElementById('custom-question-list');
    container.innerHTML = '';
    for (let i = 1; i <= totalQuestions; i++) {
        const questionDiv = createQuestion(`custom_q${i}`, i, ''); // Dùng lại hàm createQuestion cũ
        questionDiv.dataset.questionNumber = i; // Đánh dấu số câu
        container.appendChild(questionDiv);
    }
}

function setupCustomAudioPlayer(listeningRanges) {
    const questionList = document.getElementById('custom-question-list');
    const audioPlayer = document.getElementById('custom-audio-player');
    const audioSource = document.getElementById('custom-audio-source');

    if (!listeningRanges || listeningRanges.length === 0) {
        audioPlayer.classList.add('hidden');
        return;
    }

    // Theo dõi vị trí cuộn của người dùng
    questionList.addEventListener('scroll', () => {
        const questions = questionList.querySelectorAll('[data-question-number]');
        let activeRange = null;

        // Tìm xem câu hỏi đang hiển thị trên màn hình thuộc khoảng nghe nào
        for (const q of questions) {
            const rect = q.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
                const qNum = parseInt(q.dataset.questionNumber);
                activeRange = listeningRanges.find(r => qNum >= r.from && qNum <= r.to);
                break;
            }
        }

        if (activeRange) {
            // Nếu audio source chưa đúng, thay đổi nó
            if (audioSource.src.includes(activeRange.audioUrl) === false) {
                audioSource.src = activeRange.audioUrl;
                audioPlayer.load();
                audioPlayer.play();
            }
            audioPlayer.classList.remove('hidden');
        } else {
            // Nếu không nằm trong khoảng nghe, ẩn và dừng audio
            audioPlayer.classList.add('hidden');
            audioPlayer.pause();
        }
    });
}

async function submitCustomQuiz() {
    audio.pause(); // Dừng âm thanh nếu có
    clearInterval(timerInterval); // Dừng đồng hồ

    if (!user || !user.name || !currentCustomQuizData) {
        notification.innerText = "Lỗi: Mất thông tin người dùng hoặc đề thi.";
        showWelcomeScreen();
        return;
    }

    const formData = new FormData(document.getElementById('custom-quiz-form-student'));
    const userAnswers = {};
    formData.forEach((val, key) => (userAnswers[key] = val));

    try {
        const res = await fetch("/submit-custom", { // <-- Sử dụng một endpoint mới
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: user.name,
                answers: userAnswers,
                quizId: currentCustomQuizData.quizId
            }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Lỗi server');
        }

        const result = await res.json();

        // Hiển thị màn hình kết quả chỉ với điểm số
        hideAllScreens();
        resultScreen.classList.remove("hidden");
        resultScore.innerText = `Điểm: ${result.score}/${currentCustomQuizData.totalQuestions}`;
        resultTime.innerText = `Thời gian nộp: ${new Date().toLocaleString()}`;
        
        // Vô hiệu hóa nút xem đáp án cho đề tùy chỉnh
        const reviewButton = resultScreen.querySelector('button[onclick="showReviewAnswers()"]');
        if(reviewButton) reviewButton.classList.add('hidden');


    } catch (error) {
        console.error("Error submitting custom quiz:", error);
        notification.innerText = `Lỗi khi nộp bài: ${error.message}.`;
    }
}

// --- XEM LẠI BÀI & TIỆN ÍCH ---
async function showReviewAnswers() {
  try {
    const reviewScreen = document.getElementById("review-answers");
    const notification = document.getElementById("notification"); // đảm bảo tồn tại
    const downloadNotice = document.getElementById("download-notice");
    const resultScore = document.getElementById("result-score");
    const resultTime = document.getElementById("result-time");

    if (!reviewScreen) {
      console.error("Element with ID 'review-answers' not found in DOM");
      return;
    }

    // Lấy ID đề thi từ biến toàn cục hoặc localStorage
    const quizIdForReview = window.selectedQuizId || localStorage.getItem("selectedQuizId");
    if (!quizIdForReview) {
      if (notification) notification.innerText = "Lỗi: Không tìm thấy mã đề thi để xem lại đáp án.";
      return;
    }

    // Lấy thông tin đề thi
    const quizRes = await fetch(`/get-quiz?quizId=${quizIdForReview}`);
    const quizData = await quizRes.json();
    if (!quizData || !quizData.quizPdfUrl) {
      if (notification) notification.innerText = "Không tìm thấy thông tin đề thi để xem lại.";
      return;
    }

    // Lấy đáp án người dùng
    let userAnswers = JSON.parse(localStorage.getItem("userAnswers") || "{}");

    // Lấy đáp án đúng
    const answerRes = await fetch(`/answer-key?quizId=${quizIdForReview}`);
    if (!answerRes.ok) throw new Error("Không thể lấy đáp án đúng");
    const answerKey = await answerRes.json();

    if (!userAnswers || !answerKey) {
      if (notification) notification.innerText = "Lỗi: Không thể tải đáp án hoặc câu trả lời của bạn.";
      return;
    }

    // Ẩn tất cả màn hình, hiển thị màn hình review
    hideAllScreens();
    reviewScreen.classList.remove("hidden");
    if (resultScore) document.getElementById("review-score").innerText = resultScore.innerText;
    if (resultTime) document.getElementById("review-time").innerText = resultTime.innerText;
    if (notification) notification.innerText = "";

    await loadQuizPdf(quizData.quizPdfUrl, 'review-image-display');

    let currentReviewPart = 1;
    let questionIndex = 1;

    const parts = [
      { id: "review-section1", count: 6, part: 1 },
      { id: "review-section2", count: 25, part: 2 },
      { id: "review-section3", count: 39, part: 3 },
      { id: "review-section4", count: 30, part: 4 },
      { id: "review-section5", count: 30, part: 5 },
      { id: "review-section6", count: 16, part: 6 },
      { id: "review-section7", count: 54, part: 7 },
    ];

    for (const partObj of parts) {
      const section = document.getElementById(partObj.id);
      if (!section) {
        console.warn(`Section ${partObj.id} not found`);
        continue;
      }
      section.innerHTML = "";
      const count = partObj.count;
      const part = partObj.part;

      for (let i = 1; i <= count; i++) {
        const qId = `q${questionIndex}`;
        const userAnswer = userAnswers[qId] || "Chưa chọn";
        const correctAnswer = answerKey[qId] || "N/A";
        let answerClass = "";

        if (userAnswer === correctAnswer && userAnswer !== "Chưa chọn") answerClass = "correct-answer";
        else if (userAnswer === "Chưa chọn") answerClass = "unselected-answer";
        else answerClass = "wrong-answer";

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
    }

    const firstPart = document.getElementById("review-part1");
    if (firstPart) firstPart.classList.remove("hidden");
    if (downloadNotice) downloadNotice.classList.add("hidden");

  } catch (error) {
    console.error("Error showing review answers:", error);
    const notification = document.getElementById("notification");
    if (notification) notification.innerText = "Lỗi khi hiển thị đáp án. Vui lòng thử lại.";
  }
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

// --- LOGIC ẨN/HIỆN PART ---
function togglePartVisibility(part) {
    partVisibility[part] = !partVisibility[part];
    renderPartVisibilityControls();
}

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

function resetAndShowPartControls() {
    partVisibility = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
    renderPartVisibilityControls();
    document.getElementById('part-visibility-controls').classList.remove('hidden');
}

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



// =========================================================================
// PHẦN 3: HÀM KHỞI CHẠY ỨNG DỤNG (Giữ nguyên, không sửa)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // --- Gán giá trị cho các biến element SAU KHI DOM đã tải xong ---
    welcomeScreen = document.getElementById("welcome-screen");
    adminLogin = document.getElementById("admin-login");
    studentLogin = document.getElementById("student-login");
    quizListScreen = document.getElementById("quiz-list-screen");
    adminOptions = document.getElementById("admin-options");
    adminControls = document.getElementById("admin-controls");
    uploadQuizzesSection = document.getElementById("upload-quizzes");
    quizzesFileInput = document.getElementById("quizzes-file");
    quizList = document.getElementById("quiz-list");
    quizContainer = document.getElementById("quiz-container");
    customQuizContainer = document.getElementById("custom-quiz-container");
    notification = document.getElementById("notification"); // Dùng cho các thông báo chung
    quizStatus = document.getElementById("quiz-status");
    participantCount = document.getElementById("participant-count");
    submittedCount = document.getElementById("submitted-count");
    assignBtn = document.getElementById("assignBtn");
    directTestBtn = document.getElementById("directTestBtn");
    directTestScreen = document.getElementById("direct-test-screen");
    endDirectTestBtn = document.getElementById("endDirectTestBtn");
    directParticipantCount = document.getElementById("direct-participant-count");
    directSubmittedCount = document.getElementById("direct-submitted-count");
    directResultsTable = document.getElementById("direct-results-table");
    directResultsBody = document.getElementById("direct-results-body");
    resultsTable = document.getElementById("results-table");
    resultsBody = document.getElementById("results-body");
    imageDisplay = document.getElementById("image-display");
    audio = document.getElementById("audio");
    audioSource = document.getElementById("audio-source");
    timerDisplay = document.getElementById("timer");
    quizForm = document.getElementById("quizForm");
    resultScreen = document.getElementById("result-screen");
    resultScore = document.getElementById("result-score");
    resultTime = document.getElementById("result-time");
    downloadNotice = document.getElementById("download-notice");
    reviewScreen = document.getElementById("review-answers");
    staticScreen = document.getElementById("statistics-screen");
    adminLoginForm = document.getElementById("admin-login-form");
    adminPasswordInput = document.getElementById("admin-password");
    notificationAdmin = document.getElementById("notification-admin");

    // --- Logic khởi chạy ---
    setTimeout(() => {
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");
    }, 1500);

    showWelcomeScreen(); // Luôn bắt đầu ở màn hình chào mừng để reset trạng thái

    // --- Gán sự kiện ---
    const toggleInput = document.getElementById('toggle-dark-mode');
    if (toggleInput) {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            toggleInput.checked = true;
        }
        toggleInput.addEventListener('change', function () {
            document.body.classList.toggle('dark-mode');
            const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
            localStorage.setItem('theme', theme);
        });
    }

    if (adminLoginForm) {
        adminLoginForm.onsubmit = async (e) => {
            e.preventDefault();
            if (adminPasswordInput && adminPasswordInput.value === ADMIN_PASSWORD) {
                isAdmin = true;
                user = { name: "Admin", email: "admin@example.com" };
                hideAllScreens();
                if (quizListScreen) quizListScreen.classList.remove("hidden");
                if (adminOptions) adminOptions.classList.remove("hidden");
                if (adminControls) adminControls.classList.remove("hidden");
                initializeWebSocket();
                await loadQuizzes(); // Tải quizzes sau khi đăng nhập
            } else {
                if (notificationAdmin) notificationAdmin.innerText = "Mật khẩu không đúng!";
            }
        };
    }
    
    const studentNameForm = document.getElementById("student-name-form");
    if (studentNameForm) {
        studentNameForm.onsubmit = async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById("student-name");
            const name = nameInput ? nameInput.value.trim() : '';
            if (name) {
                user = { name };
                isAdmin = false;
                localStorage.setItem("user", JSON.stringify(user));
                hideAllScreens();
                if (quizListScreen) quizListScreen.classList.remove("hidden");
                if (adminOptions) adminOptions.classList.add("hidden");
                if (adminControls) adminControls.classList.add("hidden");
                initializeWebSocket();
                await loadQuizzes(); // Tải quizzes sau khi đăng nhập
            }
        };
    }
    
    if (quizForm) {
        quizForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if (confirm("Bạn có chắc muốn nộp bài không?")) {
                submitQuiz();
            }
        });
    }
    
    const customQuizForm = document.getElementById('custom-quiz-form-student');
    if (customQuizForm) {
        customQuizForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (confirm("Bạn có chắc muốn nộp bài không?")) {
                submitCustomQuiz();
            }
        });
    }
});