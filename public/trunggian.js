// =========================================================================
// KHAI BÁO BIẾN TOÀN CỤC
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

// Lấy tất cả các element một lần ở đây
const welcomeScreen = document.getElementById("welcome-screen");
const adminLogin = document.getElementById("admin-login");
const studentLogin = document.getElementById("student-login");
const quizListScreen = document.getElementById("quiz-list-screen");
const adminOptions = document.getElementById("admin-options");
const adminControls = document.getElementById("admin-controls");
const uploadQuizzesSection = document.getElementById("upload-quizzes");
const quizList = document.getElementById("quiz-list");
const quizContainer = document.getElementById("quiz-container");
const customQuizContainer = document.getElementById("custom-quiz-container");
const quizStatus = document.getElementById("quiz-status");
const participantCount = document.getElementById("participant-count");
const submittedCount = document.getElementById("submitted-count");
const directTestScreen = document.getElementById("direct-test-screen");
const directParticipantCount = document.getElementById("direct-participant-count");
const directSubmittedCount = document.getElementById("direct-submitted-count");
const directResultsTable = document.getElementById("direct-results-table");
const directResultsBody = document.getElementById("direct-results-body");
const resultsTable = document.getElementById("results-table");
const resultsBody = document.getElementById("results-body");
const imageDisplay = document.getElementById("image-display");
const audio = document.getElementById("audio");
const audioSource = document.getElementById("audio-source");
const timerDisplay = document.getElementById("timer");
const resultScreen = document.getElementById("result-screen");
const resultScore = document.getElementById("result-score");
const resultTime = document.getElementById("result-time");
const downloadNotice = document.getElementById("download-notice");

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
// CÁC HÀM QUẢN LÝ GIAO DIỆN (UI)
// =========================================================================

function hideAllScreens() {
    const screenIds = [
        'welcome-screen', 'admin-login', 'student-login', 'quiz-list-screen',
        'admin-step-create-quiz', 'custom-quiz-creator-screen', 'quiz-container',
        'custom-quiz-container', 'result-screen', 'review-answers', 'statistics-screen',
        'direct-test-screen', 'upload-quizzes'
    ];
    screenIds.forEach(id => {
        const screen = document.getElementById(id);
        if (screen) {
            screen.classList.add('hidden');
        } else {
            console.warn(`Không tìm thấy màn hình với ID: ${id}`);
        }
    });
}

function showWelcomeScreen() {
    hideAllScreens();
    if (welcomeScreen) welcomeScreen.classList.remove("hidden");
    const welcomeNotification = document.getElementById('welcome-notification');
    if (welcomeNotification) welcomeNotification.innerText = "";
    user = null;
    isAdmin = false;
    selectedQuizId = null;
    if (socket) {
        socket.close();
        socket = null;
    }
    localStorage.clear();
}

function showAdminLogin() {
    hideAllScreens();
    if (adminLogin) adminLogin.classList.remove("hidden");
}

function showStudentLogin() {
    hideAllScreens();
    if (studentLogin) studentLogin.classList.remove("hidden");
}

function createNewQuiz() {
    const modal = document.getElementById('create-quiz-choice-modal');
    if (modal) modal.classList.remove('hidden');
}

function showToeicQuizCreator() {
    const modal = document.getElementById('create-quiz-choice-modal');
    if (modal) modal.classList.add('hidden');
    hideAllScreens();
    const creator = document.getElementById("admin-step-create-quiz");
    if (creator) creator.classList.remove("hidden");
}

function showCustomQuizCreator() {
    const modal = document.getElementById('create-quiz-choice-modal');
    if (modal) modal.classList.add('hidden');
    hideAllScreens();
    const creator = document.getElementById('custom-quiz-creator-screen');
    if (creator) {
        creator.classList.remove('hidden');
        const form = document.getElementById('custom-quiz-form');
        if (form) form.reset();
        const container = document.getElementById('listening-ranges-container');
        if (container) container.innerHTML = '';
    }
}

function backToQuizList() {
    hideAllScreens();
    if (quizListScreen) quizListScreen.classList.remove("hidden");
    if (isAdmin) {
        if (adminOptions) adminOptions.classList.remove("hidden");
        if (adminControls) adminControls.classList.remove("hidden");
    }
    loadQuizzes();
}

function showUploadQuizzes() {
    hideAllScreens();
    const uploadSection = document.getElementById('upload-quizzes');
    if (uploadSection) uploadSection.classList.remove("hidden");
}

// =========================================================================
// LOGIC ĐỀ THI TÙY CHỈNH (CUSTOM QUIZ)
// =========================================================================

function addListeningRange() {
    const container = document.getElementById('listening-ranges-container');
    if (!container) return;

    const rangeId = Date.now();
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
    if (!notificationElement || !modal) return;
    notificationElement.innerText = '';

    const quizName = document.getElementById('custom-quiz-name').value.trim();
    const totalQuestions = parseInt(document.getElementById('custom-total-questions').value);
    const pdfFile = document.getElementById('custom-quiz-pdf').files[0];
    const answerKeyInput = document.getElementById('custom-answer-key').value.trim();

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
    formData.append('quizType', 'custom');
    formData.append('quizName', quizName);
    formData.append('totalQuestions', totalQuestions);
    formData.append('pdfFile', pdfFile);
    formData.append('answerKey', answerKeyInput);
    if (user && user.email) formData.append('createdBy', user.email);

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
        listeningRanges.push({ from: parseInt(from), to: parseInt(to) });
        formData.append(`audio_file_${i}`, audioFile);
    }
    formData.append('listeningRanges', JSON.stringify(listeningRanges));

    modal.classList.remove('hidden');

    try {
        const res = await fetch('/save-quiz', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message);
        backToQuizList();
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
        if (customQuizContainer) customQuizContainer.classList.remove('hidden');
        
        const customTitle = document.getElementById('custom-quiz-title');
        if (customTitle) customTitle.innerText = currentCustomQuizData.quizName;
        
        await loadQuizPdf(currentCustomQuizData.quizPdfUrl, 'custom-image-display');
        createCustomQuestionElements(currentCustomQuizData.totalQuestions);
        setupCustomAudioPlayer(currentCustomQuizData.listeningRanges);
        
        timeLeft = currentCustomQuizData.timeLimit || 7200; 
        startTimer();
    } catch (error) {
        const notif = document.getElementById('quiz-list-notification');
        if (notif) notif.innerText = error.message;
    }
}

function createCustomQuestionElements(totalQuestions) {
    const container = document.getElementById('custom-question-list');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 1; i <= totalQuestions; i++) {
        const questionDiv = createQuestion(`custom_q${i}`, i, '');
        questionDiv.dataset.questionNumber = i;
        container.appendChild(questionDiv);
    }
}

function setupCustomAudioPlayer(listeningRanges) {
    const questionList = document.getElementById('custom-question-list');
    const audioPlayer = document.getElementById('custom-audio-player');
    const audioSource = document.getElementById('custom-audio-source');

    if (!questionList || !audioPlayer || !audioSource || !listeningRanges || listeningRanges.length === 0) {
        if (audioPlayer) audioPlayer.classList.add('hidden');
        return;
    }

    questionList.addEventListener('scroll', () => {
        const questions = questionList.querySelectorAll('[data-question-number]');
        let activeRange = null;

        for (const q of questions) {
            const rect = q.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
                const qNum = parseInt(q.dataset.questionNumber);
                activeRange = listeningRanges.find(r => qNum >= r.from && qNum <= r.to);
                break;
            }
        }

        if (activeRange && activeRange.audioUrl) {
            if (!audioSource.src.endsWith(activeRange.audioUrl)) {
                audioSource.src = activeRange.audioUrl;
                audioPlayer.load();
                audioPlayer.play();
            }
            audioPlayer.classList.remove('hidden');
        } else {
            audioPlayer.classList.add('hidden');
            audioPlayer.pause();
        }
    });
}

async function submitCustomQuiz() {
    const customAudio = document.getElementById('custom-audio-player');
    if (customAudio) customAudio.pause();
    clearInterval(timerInterval);

    if (!user || !user.name || !currentCustomQuizData) {
        showWelcomeScreen();
        return;
    }

    const form = document.getElementById('custom-quiz-form-student');
    if (!form) return;
    const formData = new FormData(form);
    const userAnswers = {};
    formData.forEach((val, key) => (userAnswers[key] = val));

    try {
        const res = await fetch("/submit-custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: user.name,
                answers: userAnswers,
                quizId: currentCustomQuizData.quizId
            }),
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Lỗi server');

        const result = await res.json();
        hideAllScreens();
        if (resultScreen) resultScreen.classList.remove("hidden");
        if (resultScore) resultScore.innerText = `Điểm: ${result.score}/${currentCustomQuizData.totalQuestions}`;
        if (resultTime) resultTime.innerText = `Thời gian nộp: ${new Date().toLocaleString()}`;
        
        const reviewButton = resultScreen.querySelector('button[onclick="showReviewAnswers()"]');
        if (reviewButton) reviewButton.classList.add('hidden');
    } catch (error) {
        console.error("Error submitting custom quiz:", error);
        alert(`Lỗi khi nộp bài: ${error.message}.`);
    }
}

// =========================================================================
// LOGIC ĐỀ THI TOEIC
// =========================================================================
function generateQuizQuestions() {
    let questionIndex = 1;
    parts.forEach(({ id, count, part }) => {
        const section = document.getElementById(id);
        if (section) {
            section.innerHTML = '';
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
        if (!res.ok) throw new Error(result.message);

        timeLeft = result.timeLimit || 7200;
        studentPartVisibility = result.partVisibility;
        
        generateQuizQuestions();
        
        hideAllScreens();
        if (quizContainer) quizContainer.classList.remove("hidden");
        if (timerDisplay) timerDisplay.classList.remove("hidden");
        if (audio) audio.classList.remove("hidden");
        
        await loadQuizPdf(result.quizPdfUrl, 'image-display');
        
        const savedAnswers = localStorage.getItem("userAnswers");
        userAnswers = savedAnswers ? JSON.parse(savedAnswers) : {};
        Object.keys(userAnswers).forEach(qId => {
            const radio = document.querySelector(`input[name="${qId}"][value="${userAnswers[qId]}"]`);
            if (radio) radio.checked = true;
        });

        localStorage.setItem("selectedQuizId", quizId);
        const firstVisiblePart = findFirstVisiblePart(studentPartVisibility) || 1;
        await loadAudio(firstVisiblePart);
        startTimer();
        currentQuizPart = firstVisiblePart;
        updateQuizNavigation(currentQuizPart, studentPartVisibility);
    } catch (error) {
        console.error("Error starting quiz:", error);
        const notif = document.getElementById('quiz-list-notification');
        if (notif) notif.innerText = `Lỗi khi bắt đầu bài thi: ${error.message}`;
    }
}

async function submitQuiz() {
    if (audio) audio.pause();
    clearInterval(timerInterval);

    if (!user || !user.name) {
        showWelcomeScreen();
        return;
    }
    
    const form = document.getElementById('quizForm');
    if(!form) return;
    const formData = new FormData(form);
    userAnswers = {};
    formData.forEach((val, key) => (userAnswers[key] = val));

    try {
        const currentQuizId = selectedQuizId || localStorage.getItem("selectedQuizId");
        const res = await fetch("/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user.name, answers: userAnswers, quizId: currentQuizId }),
        });
        if (!res.ok) throw new Error((await res.json()).message || `Lỗi server`);

        const result = await res.json();
        const answerRes = await fetch(`/answer-key?quizId=${currentQuizId}`);
        answerKey = await answerRes.json();
        
        if (resultScore) resultScore.innerText = `Điểm: ${result.score}/200`;
        if (resultTime) resultTime.innerText = `Thời gian nộp: ${new Date().toLocaleString()}`;
        
        localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
        
        hideAllScreens();
        if (resultScreen) resultScreen.classList.remove("hidden");
        const reviewButton = resultScreen.querySelector('button[onclick="showReviewAnswers()"]');
        if (reviewButton) reviewButton.classList.remove('hidden');

    } catch (error) {
        console.error("Error submitting quiz:", error);
        alert(`Lỗi khi nộp bài. Đáp án của bạn vẫn được lưu. Vui lòng thử lại. Error: ${error.message}`);
    }
}

// ... (Dán TẤT CẢ các hàm còn lại của bạn vào đây, ví dụ: loadAudio, loadImages, createQuestion, v.v...)
// Lưu ý: createQuestion đã được thêm vào bên dưới để ví dụ

const createQuestion = (id, num, part) => {
    const div = document.createElement("div");
    div.className = "question-block";
    div.innerHTML = `
      <p class="question-text font-semibold">Câu ${num}${part ? ` (Part ${part})` : ''}</p>
      <div class="answer-options">
        <label class="answer-item"><input type="radio" name="${id}" value="A" /><span>A</span></label>
        <label class="answer-item"><input type="radio" name="${id}" value="B" /><span>B</span></label>
        <label class="answer-item"><input type="radio" name="${id}" value="C" /><span>C</span></label>
        <label class="answer-item"><input type="radio" name="${id}" value="D" /><span>D</span></label>
      </div>`;
    
    const radios = div.querySelectorAll(`input[name="${id}"]`);
    radios.forEach(radio => {
        radio.addEventListener("change", () => {
            if (!userAnswers) userAnswers = {};
            userAnswers[id] = radio.value;
            saveUserAnswers();
        });
    });
    return div;
};

function saveUserAnswers() {
    if (userAnswers) {
        localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Tự động nộp bài tùy theo loại quiz đang làm
            if (document.getElementById('quiz-container').classList.contains('hidden')) {
                submitCustomQuiz();
            } else {
                submitQuiz();
            }
            return;
        }
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if(timerDisplay) timerDisplay.innerText = `Còn: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
        timeLeft--;
    }, 1000);
}

// =========================================================================
// HÀM KHỞI CHẠY ỨNG DỤNG (CHỈ CÓ MỘT)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // --- PHẦN 1: Tải trang và khôi phục trạng thái ---
    setTimeout(() => {
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) loadingScreen.classList.add("hidden");
    }, 1500);

    // ... (logic khôi phục trạng thái admin và student)
    // Chạy logic restore state trước tiên
    const isAdminRestored = false; // Giả sử chưa restore
    if (!isAdminRestored) {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
            user = JSON.parse(savedUser);
            isAdmin = false;
            hideAllScreens();
            if (quizListScreen) quizListScreen.classList.remove("hidden");
            if (adminOptions) adminOptions.classList.add("hidden");
            if (adminControls) adminControls.classList.add("hidden");
            initializeWebSocket();
            await loadQuizzes();
        } else {
            showWelcomeScreen();
        }
    }


    // --- PHẦN 2: Gán sự kiện cho các element chính ---
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

    const adminForm = document.getElementById("admin-login-form");
    if (adminForm) {
        adminForm.onsubmit = async (e) => {
            e.preventDefault();
            const passwordInput = document.getElementById("admin-password");
            if (passwordInput && passwordInput.value === ADMIN_PASSWORD) {
                isAdmin = true;
                user = { name: "Admin", email: "admin@example.com" };
                hideAllScreens();
                if (quizListScreen) quizListScreen.classList.remove("hidden");
                if (adminOptions) adminOptions.classList.remove("hidden");
                if (adminControls) adminControls.classList.remove("hidden");
                initializeWebSocket();
                await loadQuizzes();
            } else {
                const notif = document.getElementById("notification-admin");
                if (notif) notif.innerText = "Mật khẩu không đúng!";
            }
        };
    }

    const studentForm = document.getElementById("student-name-form");
    if (studentForm) {
        studentForm.onsubmit = async (e) => {
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
                await loadQuizzes();
            }
        };
    }
    
    const toeicQuizForm = document.getElementById("quizForm");
    if (toeicQuizForm) {
        toeicQuizForm.addEventListener("submit", (e) => {
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