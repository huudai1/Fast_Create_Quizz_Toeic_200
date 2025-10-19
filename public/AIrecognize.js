// File: public/AIrecognize.js
let lastAiResult = null;
// Hàm hiển thị cửa sổ pop-up (modal) của AI
function showAiModal(quizType = 'toeic') { // Mặc định là 'toeic'
    const modal = document.getElementById('ai-recognize-modal');
    if (modal) {
        // --- Reset trạng thái của modal ---
        document.getElementById('ai-file-input').value = ''; // Xóa file cũ
        document.getElementById('ai-status').textContent = ''; // Xóa thông báo cũ
        document.getElementById('ai-result-container').classList.add('hidden'); // Ẩn kết quả cũ

        // --- Lấy nút "Bắt đầu nhận diện" BÊN TRONG modal ---
        const recognizeButton = modal.querySelector('button[onclick^="handle"]'); // Tìm nút có onclick bắt đầu bằng "handle"

        // --- QUAN TRỌNG: Gán ĐÚNG hàm xử lý cho nút đó ---
        if (quizType === 'custom') {
            // Nếu là đề tùy chỉnh, khi bấm nút "Bắt đầu" sẽ gọi handleCustomAiRecognition
            recognizeButton.onclick = handleCustomAiRecognition;
            // Và hiển thị giao diện ban đầu phù hợp (chỉ 1 ô lớn và nút Copy All)
            displayAiResults({}, true); // Gọi với data rỗng, isCustom = true
        } else { // Mặc định là TOEIC
            // Nếu là đề TOEIC, khi bấm nút "Bắt đầu" sẽ gọi handleAiRecognition
            recognizeButton.onclick = handleAiRecognition;
            // Và hiển thị giao diện ban đầu cho TOEIC (7 ô parts)
            displayAiResults({}, false); // Gọi với data rỗng, isCustom = false
        }
        // --------------------------------------------------

        modal.classList.remove('hidden'); // Hiển thị modal
    }
}

// Hàm đóng cửa sổ pop-up
function closeAiModal() {
    const modal = document.getElementById('ai-recognize-modal');
    if (modal) modal.classList.add('hidden');
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
function displayAiResults(data, isCustom) {
    const resultContainer = document.getElementById('ai-result-container');
    const copyAllButton = document.querySelector('#ai-result-container button[onclick="copyAllAiAnswers()"]');

    // Lấy tất cả các div chứa Part 1-7 và nút copy của chúng
    const partDivs = [];
    for (let i = 1; i <= 7; i++) {
        const partDiv = document.getElementById(`ai-result-part${i}`)?.closest('.flex'); // Tìm div cha
        if (partDiv) {
            partDivs.push(partDiv);
        }
    }

    if (isCustom && data.answers) {
        // --- HIỂN THỊ CHO ĐỀ TÙY CHỈNH ---
        // Ẩn các part 2-7
        partDivs.forEach((div, index) => {
            if (index > 0) { // Bỏ qua part 1
                div.classList.add('hidden');
            } else {
                 div.classList.remove('hidden'); // Đảm bảo part 1 hiện
                 // Cập nhật label và textarea của part 1
                 const label = div.querySelector('label');
                 const textarea = div.querySelector('textarea');
                 const copyButton = div.querySelector('button');
                 if(label) label.textContent = `Tất cả (${data.answers.split(',').length} câu):`;
                 if(textarea) textarea.value = data.answers;
                 if(copyButton) copyButton.classList.add('hidden'); // Ẩn nút copy riêng của part 1
            }
        });

        // Hiện nút "Copy All"
        if (copyAllButton) copyAllButton.classList.remove('hidden');

    } else if (!isCustom && data.part1 !== undefined) {
        // --- HIỂN THỊ CHO ĐỀ TOEIC ---
        // Hiện tất cả các part 1-7 và điền dữ liệu
        partDivs.forEach((div, index) => {
            const partNum = index + 1;
            div.classList.remove('hidden');
            const label = div.querySelector('label');
            const textarea = div.querySelector('textarea');
            const copyButton = div.querySelector('button');

            if(label) label.textContent = `Part ${partNum}:`; // Đặt lại label
            if(textarea) textarea.value = data[`part${partNum}`] || '';
            if(copyButton) copyButton.classList.remove('hidden'); // Hiện nút copy riêng
        });

        // Ẩn nút "Copy All"
        if (copyAllButton) copyAllButton.classList.add('hidden');

    } else {
        // Trường hợp lỗi hoặc dữ liệu không đúng định dạng
        console.error("Dữ liệu AI trả về không hợp lệ:", data);
        document.getElementById('ai-status').textContent = 'Lỗi: Dữ liệu AI trả về không đúng định dạng.';
        document.getElementById('ai-status').className = 'text-center font-medium text-red-500';
        resultContainer.classList.add('hidden'); // Ẩn luôn kết quả
        return; // Dừng hàm
    }

    // Hiển thị container chứa kết quả
    resultContainer.classList.remove('hidden');
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
    const textarea = document.getElementById('ai-result-part1');
    if (textarea && textarea.value) {
        navigator.clipboard.writeText(textarea.value)
            .then(() => {
                alert('Đã sao chép tất cả đáp án!');
            })
            .catch(err => {
                console.error('Lỗi khi sao chép:', err);
                alert('Không thể sao chép tự động. Vui lòng thử lại hoặc sao chép thủ công.');
            });
    } else {
        alert('Không có nội dung để sao chép.');
    }
}

async function handleCustomAiRecognition() {
    // Lấy đúng input file từ modal AI
    const fileInput = document.getElementById('ai-file-input');
    const files = fileInput.files;
    const statusEl = document.getElementById('ai-status');
    const resultContainer = document.getElementById('ai-result-container');
    const recognizeButton = document.querySelector('#ai-recognize-modal button[onclick^="handle"]'); // Lấy nút "Bắt đầu"

    if (!files || files.length === 0) {
        statusEl.textContent = 'Vui lòng chọn ít nhất một file ảnh hoặc PDF.';
        statusEl.className = 'text-center font-medium text-red-500';
        return;
    }
    // Lấy totalQuestions đã lưu khi admin nhập ở Bước 1
    if (!customQuizTotalQuestions || customQuizTotalQuestions <= 0) {
         statusEl.textContent = 'Lỗi: Không tìm thấy tổng số câu. Vui lòng quay lại Bước 1.';
         statusEl.className = 'text-center font-medium text-red-500';
         return;
    }


    statusEl.textContent = 'Đang nhận diện, vui lòng đợi... 🧠';
    statusEl.className = 'text-center font-medium text-blue-600';
    resultContainer.classList.add('hidden');
    recognizeButton.disabled = true; // Vô hiệu hóa nút

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('answer_files', files[i]);
    }
    // ---- THÊM totalQuestions VÀO FORMDATA ----
    formData.append('totalQuestions', customQuizTotalQuestions);
    // ------------------------------------------

    try {
        const response = await fetch('/recognize-answers', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); // Cố gắng đọc lỗi JSON
            throw new Error(errorData.message || `Lỗi server: ${response.status}`);
        }

        const data = await response.json();

        // --- Gọi hàm hiển thị kết quả (sẽ sửa ở bước c) ---
        displayAiResults(data, true); // Thêm cờ true để biết đây là Custom Quiz
        // ----------------------------------------------------

        statusEl.textContent = 'Nhận diện thành công! ✅';
        statusEl.className = 'text-center font-medium text-green-600';

    } catch (error) {
        console.error('AI Recognition Error:', error);
        statusEl.textContent = `Lỗi: ${error.message}`;
        statusEl.className = 'text-center font-medium text-red-500';
    } finally {
        recognizeButton.disabled = false; // Kích hoạt lại nút
         // Cân nhắc xóa file đã chọn: fileInput.value = '';
    }
}

async function handleAiRecognition() {
    const fileInput = document.getElementById('ai-file-input');
    const files = fileInput.files;
    const statusEl = document.getElementById('ai-status');
    const resultContainer = document.getElementById('ai-result-container');
    const recognizeButton = document.querySelector('#ai-recognize-modal button[onclick^="handle"]');

    if (!files || files.length === 0) {
        statusEl.textContent = 'Vui lòng chọn ít nhất một file ảnh hoặc PDF.';
        statusEl.className = 'text-center font-medium text-red-500';
        return;
    }

    statusEl.textContent = 'Đang nhận diện, vui lòng đợi... 🧠';
    statusEl.className = 'text-center font-medium text-blue-600';
    resultContainer.classList.add('hidden');
    recognizeButton.disabled = true;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('answer_files', files[i]);
    }
    // KHÔNG thêm totalQuestions cho TOEIC

    try {
        const response = await fetch('/recognize-answers', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Lỗi server: ${response.status}`);
        }

        const data = await response.json();
        // --- Gọi hàm hiển thị kết quả ---
        displayAiResults(data, false); // Cờ false cho TOEIC
        // ---------------------------------

        statusEl.textContent = 'Nhận diện thành công! ✅';
        statusEl.className = 'text-center font-medium text-green-600';

    } catch (error) {
        console.error('AI Recognition Error:', error);
        statusEl.textContent = `Lỗi: ${error.message}`;
        statusEl.className = 'text-center font-medium text-red-500';
    } finally {
        recognizeButton.disabled = false;
    }
}