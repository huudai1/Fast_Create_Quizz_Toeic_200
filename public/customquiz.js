// File: public/customquiz.js

// --- PHẦN LOGIC CHO ADMIN TẠO ĐỀ TÙY CHỈNH ---

// Hiển thị màn hình tạo đề tùy chỉnh
function showCustomQuizCreator() {
    hideAllScreens();
    document.getElementById('custom-quiz-creator-screen').classList.remove('hidden');
    // Reset form khi mở
    document.getElementById('custom-quiz-form').reset();
    document.getElementById('listening-ranges-container').innerHTML = '';
}

// Thêm một dòng mới để định nghĩa khoảng nghe
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

// Lưu đề thi tùy chỉnh
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


// --- PHẦN LOGIC CHO HỌC SINH LÀM BÀI TÙY CHỈNH ---

let currentCustomQuizData = null; // Biến lưu thông tin đề tùy chỉnh

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

// Tạo danh sách câu hỏi liền mạch
function createCustomQuestionElements(totalQuestions) {
    const container = document.getElementById('custom-question-list');
    container.innerHTML = '';
    for (let i = 1; i <= totalQuestions; i++) {
        const questionDiv = createQuestion(`custom_q${i}`, i, ''); // Dùng lại hàm createQuestion cũ
        questionDiv.dataset.questionNumber = i; // Đánh dấu số câu
        container.appendChild(questionDiv);
    }
}

// Logic cho trình phát audio
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