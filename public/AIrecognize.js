// File: public/AIrecognize.js
let lastAiResult = null;
// Hàm hiển thị cửa sổ pop-up (modal) của AI
function showAiModal() {
    const modal = document.getElementById('ai-recognize-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Nếu đã có kết quả từ lần trước, hiển thị lại ngay lập tức
        if (lastAiResult) {
            displayAiResults(lastAiResult);
            const statusElement = document.getElementById('ai-status');
            statusElement.textContent = 'Hiển thị kết quả nhận diện gần nhất. Bạn có thể chọn file mới để chạy lại.';
            statusElement.className = 'text-yellow-600 dark:text-yellow-400';
        }
    }
}

// Hàm đóng cửa sổ pop-up
function closeAiModal() {
    const modal = document.getElementById('ai-recognize-modal');
    if (modal) {
        modal.classList.add('hidden');
        // Không xóa kết quả nữa, chỉ đơn giản là ẩn cửa sổ đi
    }
}

// Hàm xử lý khi người dùng chọn file và bấm nút "Nhận diện"
async function handleAiRecognition(totalQuestions = null) {
    const fileInput = document.getElementById('ai-file-input');
    const statusElement = document.getElementById('ai-status');
    const resultContainer = document.getElementById('ai-result-container');

    if (fileInput.files.length === 0) {
        statusElement.textContent = 'Vui lòng chọn một hoặc nhiều file ảnh/PDF.';
        statusElement.className = 'text-red-500';
        return;
    }

    const formData = new FormData();
    for (const file of fileInput.files) {
        formData.append('answer_files', file);
    }

    if (totalQuestions) {
        formData.append('totalQuestions', totalQuestions);
    }

    // Reset trạng thái trước khi gửi yêu cầu mới
    lastAiResult = null;
    statusElement.textContent = 'Đang phân tích, vui lòng chờ...';
    statusElement.className = 'text-blue-500';
    resultContainer.classList.add('hidden');

    try {
        const res = await fetch('/recognize-answers', {
            method: 'POST',
            body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.message || 'Lỗi từ server');
        }
        
        // LƯU KẾT QUẢ VÀO BIẾN LƯU TRỮ
        lastAiResult = result;
        
        statusElement.textContent = 'Đã nhận diện thành công! Vui lòng sao chép và dán vào các ô đáp án.';
        statusElement.className = 'text-green-500';
        displayAiResults(result);

    } catch (error) {
        console.error('Error during AI recognition:', error);
        statusElement.textContent = `Lỗi: ${error.message}`;
        statusElement.className = 'text-red-500';
    }
}

// Hàm hiển thị kết quả AI trả về ra 7 ô text
function displayAiResults(data) {
    const resultContainer = document.getElementById('ai-result-container');
    resultContainer.classList.remove('hidden');

    for (let i = 1; i <= 7; i++) {
        const partKey = `part${i}`;
        const textArea = document.getElementById(`ai-result-part${i}`);
        if (textArea) {
            textArea.value = data[partKey] || ''; // Hiển thị kết quả hoặc chuỗi rỗng nếu không có
        }
    }
}

// Hàm helper để sao chép nội dung vào clipboard
function copyAnswer(partNumber) {
    const textArea = document.getElementById(`ai-result-part${partNumber}`);
    if (textArea && textArea.value) {
        navigator.clipboard.writeText(textArea.value).then(() => {
            // Có thể thêm hiệu ứng thông báo "Đã sao chép!" ở đây nếu muốn
            alert(`Đã sao chép đáp án Part ${partNumber}`);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
}

function copyAllAiAnswers() {
    let allAnswers = [];
    for (let i = 1; i <= 7; i++) {
        const textArea = document.getElementById(`ai-result-part${i}`);
        if (textArea && textArea.value) {
            // Tách các đáp án trong từng part và thêm vào mảng lớn
            const partAnswers = textArea.value.split(',').filter(ans => ans.trim() !== '');
            allAnswers.push(...partAnswers);
        }
    }

    if (allAnswers.length > 0) {
        const finalString = allAnswers.join(',');
        navigator.clipboard.writeText(finalString).then(() => {
            alert(`Đã sao chép ${allAnswers.length} đáp án!`);
        }).catch(err => {
            console.error('Failed to copy all answers: ', err);
        });
    } else {
        alert('Không có đáp án nào để sao chép.');
    }
}

function handleCustomAiRecognition() {
    const totalQuestionsInput = document.getElementById('custom-total-questions');
    const totalQuestions = totalQuestionsInput.value;

    if (!totalQuestions || parseInt(totalQuestions) <= 0) {
        alert('Vui lòng nhập Tổng số câu trước khi dùng AI nhận diện!');
        return;
    }

    // Mở modal và bắt đầu nhận diện, truyền đi tổng số câu
    showAiModal(); 
    handleAiRecognition(totalQuestions);
}