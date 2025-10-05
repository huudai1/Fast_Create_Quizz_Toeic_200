// File: public/AIrecognize.js

// Hàm hiển thị cửa sổ pop-up (modal) của AI
function showAiModal() {
    const modal = document.getElementById('ai-recognize-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

// Hàm đóng cửa sổ pop-up
function closeAiModal() {
    const modal = document.getElementById('ai-recognize-modal');
    if (modal) {
        modal.classList.add('hidden');
        // Reset lại giao diện modal khi đóng
        document.getElementById('ai-file-input').value = '';
        document.getElementById('ai-result-container').classList.add('hidden');
        document.getElementById('ai-status').textContent = '';
    }
}

// Hàm xử lý khi người dùng chọn file và bấm nút "Nhận diện"
async function handleAiRecognition() {
    const fileInput = document.getElementById('ai-file-input');
    const statusElement = document.getElementById('ai-status');
    const resultContainer = document.getElementById('ai-result-container');

    if (fileInput.files.length === 0) {
        statusElement.textContent = 'Vui lòng chọn một file ảnh hoặc PDF.';
        statusElement.className = 'text-red-500';
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('answer_file', file);

    // Hiển thị trạng thái đang xử lý
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
        
        // Hiển thị kết quả thành công
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