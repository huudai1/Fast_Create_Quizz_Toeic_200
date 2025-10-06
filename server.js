const express = require("express");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const archiver = require("archiver");
const unzipper = require("unzipper");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public", {
  index: "index.html",
  setHeaders: (res, path) => {
    console.log(`Serving file: ${path}`);
  }
}));

const quizzesFile = path.join(__dirname, "quizzes.json");
const resultsFile = path.join(__dirname, "results.json");

let quizzes = [];
let currentQuiz = null;
let results = [];
let clients = new Set();

// Ensure directories exist
const ensureDirectories = async () => {
  const directories = [
    path.join(__dirname, "public/uploads/audio"),
    path.join(__dirname, "public/uploads/images"),
    path.join(__dirname, "temp")
  ];
  for (const dir of directories) {
    try {
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    } catch (err) {
      console.error(`Error creating directory ${dir}:`, err);
    }
  }
};

ensureDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, "public/uploads/audio");
    } else if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, "public/uploads/images");
    } else {
      cb(null, "temp");
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage });
const memoryUpload = multer({ storage: multer.memoryStorage() });

async function saveQuizzes() {
  try {
    await fs.writeFile(quizzesFile, JSON.stringify(quizzes, null, 2));
  } catch (err) {
    console.error("Error saving quizzes:", err);
  }
}

async function loadQuizzes() {
  try {
    if (fsSync.existsSync(quizzesFile)) {
      const data = await fs.readFile(quizzesFile, "utf8");
      quizzes = JSON.parse(data);
    } else {
      quizzes = [];
      await saveQuizzes();
    }
  } catch (err) {
    console.error("Error loading quizzes:", err);
    quizzes = [];
  }
}

async function saveResults() {
  try {
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("Error saving results:", err);
  }
}

async function loadResults() {
  try {
    if (fsSync.existsSync(resultsFile)) {
      const data = await fs.readFile(resultsFile, "utf8");
      results = JSON.parse(data);
    } else {
      results = [];
      await saveResults();
    }
  } catch (err) {
    console.error("Error loading results:", err);
    results = [];
  }
}

loadQuizzes();
loadResults();

// Endpoint để lấy trạng thái đề thi
app.get('/quiz-status', async (req, res) => {
  try {
    if (!currentQuiz) {
      return res.status(200).json({ quizId: null, quizName: null });
    }
    res.status(200).json({ quizId: currentQuiz.quizId, quizName: currentQuiz.quizName });
  } catch (err) {
    console.error('Error fetching quiz status:', err);
    res.status(500).json({ message: 'Error fetching quiz status' });
  }
});

// Endpoint để lấy kết quả kiểm tra trực tiếp
app.get('/direct-results', async (req, res) => {
  try {
    if (!currentQuiz) {
      return res.status(200).json([]);
    }
    const quizResults = results.filter(r => r.quizId === currentQuiz.quizId).map(result => ({
      username: result.username,
      score: result.score,
      submittedAt: new Date(result.timestamp)
    }));
    res.status(200).json(quizResults);
  } catch (err) {
    console.error('Error fetching direct results:', err);
    res.status(500).json({ message: 'Error fetching direct results' });
  }
});

app.get('/statistics', async (req, res) => {
  try {
    const quizId = req.query.quizId;
    if (!quizId) {
      return res.status(400).json({ message: 'Quiz ID is required' });
    }

    const quiz = quizzes.find((q) => q.quizId === quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Lấy tất cả kết quả của quizId
    const quizResults = results.filter((r) => r.quizId === quizId);
    
    // Tính điểm trung bình
    let totalScore = 0;
    let totalSubmissions = quizResults.length;
    if (totalSubmissions === 0) {
      return res.status(200).json({
        averageScore: 0,
        questionStats: []
      });
    }

    quizResults.forEach((result) => {
      totalScore += result.score || 0;
    });
    const averageScore = totalScore / totalSubmissions;

    // Tính thống kê đúng/sai cho từng câu hỏi
    const questionStats = [];
    for (let i = 1; i <= 200; i++) {
      const questionId = `q${i}`;
      let wrongCount = 0;
      quizResults.forEach((result) => {
        const userAnswer = result.answers ? result.answers[questionId] : null;
        const correctAnswer = quiz.answerKey[questionId];
        if (userAnswer && userAnswer !== correctAnswer) {
          wrongCount++;
        }
      });
      questionStats.push({
        questionId: questionId,
        wrongCount: wrongCount,
        totalCount: totalSubmissions
      });
    }

    res.status(200).json({
      averageScore: averageScore,
      questionStats: questionStats
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// Endpoint để xóa database
app.delete('/clear-database', async (req, res) => {
  try {
    quizzes = [];
    results = [];
    currentQuiz = null;
    await saveQuizzes();
    await saveResults();
    broadcast({ type: 'quizStatus', quizExists: false });
    res.status(200).json({ message: 'Database cleared successfully!' });
  } catch (err) {
    console.error('Error clearing database:', err);
    res.status(500).json({ message: 'Error clearing database' });
  }
});

// Endpoint để giao bài
app.post('/assign-quiz', async (req, res) => {
    const { quizId, timeLimit, partVisibility } = req.body;
    if (!quizId || !timeLimit) {
        return res.status(400).json({ message: 'Quiz ID and time limit are required' });
    }
    const quiz = quizzes.find((q) => q.quizId === quizId);
    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
    }
    quiz.isAssigned = true;
    quiz.timeLimit = timeLimit;
    quiz.partVisibility = partVisibility || { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true };
    await saveQuizzes();

    // THÊM DÒNG NÀY ĐỂ GỬI THÔNG BÁO TỚI TẤT CẢ HỌC SINH
    broadcast({ type: 'quizAssigned', quizId: quiz.quizId });

    res.json({ message: 'Quiz assigned successfully!' });
});

app.get('/quizzes', async (req, res) => {
  const email = req.query.email;
  if (email) {
    res.json(quizzes.filter((quiz) => quiz.createdBy === email));
  } else {
    if (!currentQuiz) {
      res.json([]);
    } else {
      res.json([currentQuiz]);
    }
  }
});

app.post(
    '/save-quiz',
    // 1. Middleware upload.fields được định nghĩa MỘT LẦN DUY NHẤT ở đây
    // Nó chứa tất cả các trường file có thể có cho CẢ HAI loại đề
    upload.fields([
        // Fields cho đề TOEIC
        { name: 'quiz-pdf', maxCount: 1 },
        { name: 'audio-part1', maxCount: 1 },
        { name: 'audio-part2', maxCount: 1 },
        { name: 'audio-part3', maxCount: 1 },
        { name: 'audio-part4', maxCount: 1 },
        
        // Fields cho đề tùy chỉnh
        { name: 'pdfFile', maxCount: 1 },
        ...Array(10).fill(0).map((_, i) => ({ name: `audio_file_${i}`, maxCount: 1 }))
    ]),
    // 2. Chỉ có MỘT HÀM xử lý request duy nhất
    async (req, res) => {
        try {
            const { quizType } = req.body;
            let newQuiz; // Khai báo một biến để lưu quiz mới

            // 3. Sử dụng if/else để quyết định logic tạo quiz
            if (quizType === 'custom') {
                // Logic lưu đề tùy chỉnh (đã đúng)
                const { quizName, totalQuestions, answerKey, createdBy, listeningRanges } = req.body;
                const pdfFile = req.files['pdfFile'][0];
                
                const listeningRangesParsed = JSON.parse(listeningRanges);
                listeningRangesParsed.forEach((range, index) => {
                    const audioFile = req.files[`audio_file_${index}`][0];
                    range.audioUrl = `/uploads/audio/${audioFile.filename}`;
                });
                
                newQuiz = {
                    quizId: uuidv4(),
                    quizName,
                    type: 'custom',
                    totalQuestions: parseInt(totalQuestions),
                    quizPdfUrl: `/uploads/images/${pdfFile.filename}`,
                    answerKey,
                    listeningRanges: listeningRangesParsed,
                    createdBy,
                };
            } else {
                // Logic xử lý đề TOEIC được đưa trực tiếp vào đây
                const { quizName, answerKey, createdBy } = req.body;
                if (!quizName || !answerKey || !createdBy || !req.files['quiz-pdf']) {
                    return res.status(400).json({ message: "Thiếu các trường thông tin cần thiết cho đề TOEIC." });
                }

                const quizPdfFile = req.files['quiz-pdf'][0];
                const audioPaths = {};
                for (let i = 1; i <= 4; i++) {
                    if (req.files[`audio-part${i}`]) {
                        const audioFile = req.files[`audio-part${i}`][0];
                        audioPaths[`part${i}`] = `/uploads/audio/${audioFile.filename}`;
                    }
                }

                newQuiz = {
                    quizId: uuidv4(),
                    quizName,
                    quizPdfUrl: `/uploads/images/${quizPdfFile.filename}`,
                    audio: audioPaths,
                    answerKey: JSON.parse(answerKey),
                    createdBy,
                    isAssigned: false
                };
            }

            // 4. Phần xử lý chung cho cả 2 loại đề
            quizzes.push(newQuiz);
            await saveQuizzes();
            res.json({ message: 'Lưu đề thi thành công!' });

        } catch (err) {
            console.error('Error saving quiz:', err);
            res.status(500).json({ message: 'Lỗi khi lưu đề thi' });
        }
    }
);

app.post('/submit-custom', async (req, res) => {
    const { username, answers, quizId } = req.body;

    if (!username || !answers || !quizId) {
        return res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
    }

    const quiz = quizzes.find(q => q.quizId === quizId);
    if (!quiz || quiz.type !== 'custom') {
        return res.status(404).json({ message: 'Không tìm thấy đề thi tùy chỉnh' });
    }

    let score = 0;
    // Đáp án đúng là một chuỗi "A,B,C,...", chúng ta cần chuyển nó thành mảng
    const correctAnswers = quiz.answerKey.split(',');

    // Lặp qua tổng số câu của đề thi
    for (let i = 0; i < quiz.totalQuestions; i++) {
        const questionId = `custom_q${i + 1}`;
        const userAnswer = answers[questionId];
        const correctAnswer = correctAnswers[i];
        
        if (userAnswer && userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()) {
            score++;
        }
    }

    const result = {
        quizId,
        username,
        score,
        answers,
        timestamp: Date.now()
    };
    results.push(result);
    await saveResults();

    // Gửi thông báo cập nhật kết quả (nếu cần)
    // broadcast(...);

    res.json({ score });
});

app.delete('/delete-quiz/:quizId', async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quizIndex = quizzes.findIndex((quiz) => quiz.quizId === quizId);
    if (quizIndex === -1) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const quiz = quizzes[quizIndex];
    for (let part in quiz.audio) {
      const audioPath = path.join(__dirname, 'public', quiz.audio[part].substring(1));
      try {
        if (fsSync.existsSync(audioPath)) {
          await fs.unlink(audioPath);
        }
      } catch (err) {
        console.error(`Error deleting audio file ${audioPath}:`, err);
      }
    }

    for (let part in quiz.images) {
      for (let imagePath of quiz.images[part]) {
        const fullPath = path.join(__dirname, 'public', imagePath.substring(1));
        try {
          if (fsSync.existsSync(fullPath)) {
            await fs.unlink(fullPath);
          }
        } catch (err) {
          console.error(`Error deleting image file ${fullPath}:`, err);
        }
      }
    }

    quizzes.splice(quizIndex, 1);
    if (currentQuiz && currentQuiz.quizId === quizId) {
      currentQuiz = null;
      broadcast({ type: 'quizStatus', quizExists: false });
    }
    await saveQuizzes();
    res.json({ message: 'Quiz deleted successfully!' });
  } catch (err) {
    console.error('Error deleting quiz:', err);
    res.status(500).json({ message: 'Error deleting quiz' });
  }
});

app.get('/download-quiz-zip/:quizId', async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = quizzes.find((q) => q.quizId === quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const zip = archiver('zip', { zlib: { level: 9 } });
        const safeQuizName = quiz.quizName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeQuizName || 'quiz'}.zip`;
        res.attachment(fileName);
        zip.pipe(res);

        // Tạo file quizzes.json không chứa ID
        const quizJsonData = { ...quiz };
        delete quizJsonData.quizId;
        zip.append(JSON.stringify(quizJsonData, null, 2), { name: 'key/quizzes.json' });

        // Thêm file PDF
        if (quiz.quizPdfUrl) {
            const pdfPath = path.join(__dirname, 'public', quiz.quizPdfUrl);
            if (fsSync.existsSync(pdfPath)) {
                zip.file(pdfPath, { name: 'pdf/de_thi.pdf' });
            }
        }

        // Xử lý audio dựa trên loại đề
        if (quiz.type === 'custom' && quiz.listeningRanges) {
            // Đề tùy chỉnh: thêm audio theo từng khoảng nghe
            quiz.listeningRanges.forEach((range, index) => {
                if (range.audioUrl) {
                    const audioPath = path.join(__dirname, 'public', range.audioUrl);
                    if (fsSync.existsSync(audioPath)) {
                        zip.file(audioPath, { name: `audio/range_${index}.mp3` });
                    }
                }
            });
        } else if (quiz.audio) {
            // Đề TOEIC: thêm audio theo part
            for (let i = 1; i <= 4; i++) {
                const partKey = `part${i}`;
                if (quiz.audio[partKey]) {
                    const audioPath = path.join(__dirname, 'public', quiz.audio[partKey]);
                    if (fsSync.existsSync(audioPath)) {
                        zip.file(audioPath, { name: `audio/${partKey}.mp3` });
                    }
                }
            }
        }

        await zip.finalize();
    } catch (err) {
        console.error('Error creating ZIP:', err);
        res.status(500).json({ message: 'Lỗi khi tạo file ZIP' });
    }
});

app.post('/upload-quizzes-zip', upload.single('quizzes'), async (req, res) => {
    const tempPath = path.join(__dirname, 'temp');
    const extractPath = path.join(tempPath, uuidv4());
    const zipPath = req.file ? req.file.path : null;

    try {
        if (!req.file) return res.status(400).json({ message: 'No ZIP file' });
        await fs.mkdir(extractPath, { recursive: true });

        // Giải nén file
        await new Promise((resolve, reject) => {
            fsSync.createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: extractPath }))
                .on('close', resolve).on('error', reject);
        });

        const quizzesJsonPath = path.join(extractPath, 'key', 'quizzes.json');
        if (!fsSync.existsSync(quizzesJsonPath)) {
            throw new Error('File ZIP không hợp lệ: thiếu key/quizzes.json');
        }
        
        const quizData = JSON.parse(await fs.readFile(quizzesJsonPath, 'utf8'));
        const newQuizId = uuidv4();
        quizData.quizId = newQuizId;
        quizData.createdBy = req.body.createdBy;

        // Xử lý PDF
        const pdfSrcPath = path.join(extractPath, 'pdf', 'de_thi.pdf');
        if (fsSync.existsSync(pdfSrcPath)) {
            const pdfDestFilename = `${newQuizId}_de_thi.pdf`;
            await fs.copyFile(pdfSrcPath, path.join(__dirname, 'public/uploads/images', pdfDestFilename));
            quizData.quizPdfUrl = `/uploads/images/${pdfDestFilename}`;
        } else {
            throw new Error('File ZIP không hợp lệ: thiếu pdf/de_thi.pdf');
        }

        // Xử lý audio dựa trên loại đề
        if (quizData.type === 'custom' && quizData.listeningRanges) {
            for (let i = 0; i < quizData.listeningRanges.length; i++) {
                const audioSrcPath = path.join(extractPath, 'audio', `range_${i}.mp3`);
                if (fsSync.existsSync(audioSrcPath)) {
                    const newAudioFilename = `${newQuizId}_range_${i}.mp3`;
                    await fs.copyFile(audioSrcPath, path.join(__dirname, 'public/uploads/audio', newAudioFilename));
                    quizData.listeningRanges[i].audioUrl = `/uploads/audio/${newAudioFilename}`;
                }
            }
        } else { // Mặc định là đề TOEIC
            const newAudioPaths = {};
            for (let i = 1; i <= 4; i++) {
                const partKey = `part${i}`;
                const audioSrcPath = path.join(extractPath, 'audio', `${partKey}.mp3`);
                if (fsSync.existsSync(audioSrcPath)) {
                    const newAudioFilename = `${newQuizId}_${partKey}.mp3`;
                    await fs.copyFile(audioSrcPath, path.join(__dirname, 'public/uploads/audio', newAudioFilename));
                    newAudioPaths[partKey] = `/uploads/audio/${newAudioFilename}`;
                }
            }
            quizData.audio = newAudioPaths;
        }

        quizzes.push(quizData);
        await saveQuizzes();
        res.json({ message: 'Tải lên đề thi từ ZIP thành công!' });
    } catch (err) {
        console.error('Error uploading ZIP:', err);
        res.status(500).json({ message: err.message || 'Lỗi khi xử lý ZIP' });
    } finally {
        if (zipPath && fsSync.existsSync(zipPath)) await fs.unlink(zipPath);
        if (fsSync.existsSync(extractPath)) await fs.rm(extractPath, { recursive: true, force: true });
    }
});

app.post('/select-quiz', (req, res) => {
    const { quizId } = req.body;
    if (!quizId) {
        return res.status(400).json({ message: 'Quiz ID is required' });
    }
    const quiz = quizzes.find((q) => q.quizId === quizId);
    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
    }
    currentQuiz = quiz;
    broadcast({
        type: 'quizStatus',
        quizId: quiz.quizId,
        quizName: quiz.quizName,
        quizExists: true
    });
    res.json({
        message: 'Quiz selected successfully!',
        quizName: quiz.quizName,
        timeLimit: quiz.timeLimit,
        partVisibility: quiz.partVisibility, // <-- THÊM DẤU PHẨY BỊ THIẾU Ở ĐÂY
        quizPdfUrl: quiz.quizPdfUrl
    });
});
app.get('/answer-key', (req, res) => {
    const { quizId } = req.query; // Lấy quizId từ client gửi lên
    if (!quizId) {
        return res.status(400).json({ message: 'Quiz ID is required' });
    }
    const quiz = quizzes.find(q => q.quizId === quizId); // Tìm đúng quiz trong danh sách
    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found for the given ID' });
    }
    res.json(quiz.answerKey); // Trả về answerKey của quiz tìm được
});
app.get('/quiz-audio', (req, res) => {
    // THAY ĐỔI: Lấy quizId từ query
    const { part, quizId } = req.query;

    if (!quizId) {
        return res.status(400).json({ message: 'Quiz ID is required' });
    }
    const quiz = quizzes.find(q => q.quizId === quizId);

    if (!quiz || !quiz.audio) {
        return res.status(404).json({ message: 'No audio available for this quiz' });
    }
    
    res.json({ audio: quiz.audio[part] });
});

app.get('/images', (req, res) => {
  if (!currentQuiz) {
    return res.status(404).json({ message: 'No quiz selected' });
  }
  const part = req.query.part || 1;
  res.json(currentQuiz.images[`part${part}`] || []);
});

app.post('/submit', async (req, res) => {
    // THAY ĐỔI: Thêm quizId vào các tham số nhận được
    const { username, answers, quizId } = req.body;

    if (!username || !answers || !quizId) {
        return res.status(400).json({ message: 'Username, answers, and quizId are required' });
    }

    // THAY ĐỔI: Tìm đúng quiz dựa trên quizId, không dùng currentQuiz
    const quiz = quizzes.find(q => q.quizId === quizId);
    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
    }

    let score = 0;
    const answerKey = quiz.answerKey;

    for (let i = 1; i <= 200; i++) {
        const userAnswer = answers[`q${i}`];
        const correctAnswer = answerKey[`q${i}`];
        if (userAnswer && userAnswer === correctAnswer) {
            score++;
        }
    }

    const result = {
        quizId: quizId,
        username,
        score,
        answers,
        timestamp: Date.now()
    };
    results.push(result);
    await saveResults();

    const quizResults = results.filter((r) => r.quizId === quizId);
    broadcast({
        type: 'submitted',
        count: quizResults.length,
        results: quizResults.map((r) => ({
            username: r.username,
            score: r.score,
            submittedAt: new Date(r.timestamp)
        }))
    });

    res.json({ score });
});

app.get('/results', (req, res) => {
  res.json(results);
});

app.post('/reset', async (req, res) => {
  results = [];
  await saveResults();
  broadcast({ type: 'submitted', count: 0, results: [] });
  res.json({ message: 'Quiz reset successfully!' });
});

app.get('/download-quizzes', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename=quizzes.json');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(quizzes, null, 2));
});

app.post(
  '/upload-quizzes',
  upload.fields([{ name: 'quizzes', maxCount: 1 }]),
  async (req, res) => {
    try {
      if (!req.files.quizzes) {
        return res.status(400).json({ message: 'No quizzes.json file uploaded' });
      }
      const file = req.files.quizzes[0];
      const data = await fs.readFile(file.path, 'utf8');
      const uploadedQuizzes = JSON.parse(data);
      quizzes = uploadedQuizzes;
      await saveQuizzes();
      await fs.unlink(file.path);
      res.json({ message: 'Quizzes uploaded successfully!' });
    } catch (err) {
      console.error('Error uploading quizzes:', err);
      res.status(500).json({ message: 'Error uploading quizzes' });
    }
  }
);

app.get('/get-quiz', (req, res) => {
    const { quizId } = req.query;
    const quiz = quizzes.find(q => q.quizId === quizId);
    if (quiz) {
        res.json(quiz);
    } else {
        res.status(404).json({ message: 'Quiz not found' });
    }
});
// Gemini endpoint
app.post('/recognize-answers', memoryUpload.array('answer_files', 10), async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not configured.");
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded.' });
        }

        // Lấy tổng số câu từ request. Nếu không có, nó là null.
        const { totalQuestions } = req.body;
        
        let prompt;
        let isCustomQuiz = !!totalQuestions; // True nếu có totalQuestions

        if (isCustomQuiz) {
            // ================================================================
            // ====> PROMPT MỚI CHO ĐỀ TÙY CHỈNH <====
            // ================================================================
            prompt = `Từ tài liệu được cung cấp, hãy trích xuất chính xác ${totalQuestions} đáp án.
            QUY TẮC CỰC KỲ QUAN TRỌNG:
            1. Chỉ lấy các chữ cái đáp án (A, B, C, hoặc D). Bỏ qua mọi văn bản khác.
            2. Trả về kết quả cuối cùng CHỈ LÀ một đối tượng JSON hợp lệ, không chứa markdown hay giải thích.
            3. Cấu trúc JSON phải là: { "answers": "A,B,C,D,..." } trong đó chuỗi chứa tất cả các đáp án, ngăn cách bởi dấu phẩy, không có khoảng trắng.`;

        } else {
            // ================================================================
            // ====> PROMPT CŨ CHO ĐỀ TOEIC <====
            // ================================================================
            prompt = `Từ các tài liệu được cung cấp, hãy trích xuất các đáp án từ câu 1 đến câu 200.
            QUY TẮC CỰC KỲ QUAN TRỌNG:
            1. Chỉ lấy các chữ cái đáp án (A, B, C, hoặc D). Bỏ qua mọi văn bản khác.
            2. Phân chia 200 đáp án đó thành 7 phần theo đúng số lượng sau:
               - Part 1: 6 câu, Part 2: 25 câu, Part 3: 39 câu, Part 4: 30 câu, Part 5: 30 câu, Part 6: 16 câu, Part 7: 54 câu
            3. Với mỗi phần, định dạng chuỗi đáp án thành các chữ cái viết hoa, ngăn cách bởi dấu phẩy, KHÔNG có khoảng trắng.
            4. Trả về kết quả cuối cùng CHỈ LÀ một đối tượng JSON hợp lệ, không chứa bất kỳ ký tự markdown nào. Cấu trúc JSON phải là:
               { "part1": "...", "part2": "...", "part3": "...", "part4": "...", "part5": "...", "part6": "...", "part7": "..." }`;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const contentParts = [{ text: prompt }]; 
        for (const file of req.files) {
            contentParts.push({
                inlineData: { data: file.buffer.toString("base64"), mimeType: file.mimetype }
            });
        }

        const result = await model.generateContent({ contents: [{ parts: contentParts }] });
        const responseText = result.response.text();
        
        console.log("Gemini raw response:", responseText);

        const jsonString = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
        let data = JSON.parse(jsonString);

        // Nếu là đề tùy chỉnh, chúng ta cần chuyển đổi cấu trúc một chút để frontend dễ xử lý
        if (isCustomQuiz && data.answers) {
            const allAnswers = data.answers.split(',');
            data = {
                part1: allAnswers.join(','), // Gộp tất cả vào part1 để copy cho dễ
                part2: '', part3: '', part4: '', part5: '', part6: '', part7: ''
            };
        }
        
        res.json(data);

    } catch (error) {
        console.error('Error with Gemini API:', error);
        res.status(500).json({ message: error.message || 'Lỗi khi nhận diện bằng AI.' });
    }
});


app.post(
  '/upload-files',
  upload.fields([
    { name: 'audio', maxCount: 100 },
    { name: 'images', maxCount: 100 },
  ]),
  async (req, res) => {
    try {
      const audioFiles = req.files.audio || [];
      const imageFiles = req.files.images || [];
      const audioPaths = audioFiles.map((file) => `/uploads/audio/${file.filename}`);
      const imagePaths = imageFiles.map((file) => `/uploads/images/${file.filename}`);
      res.json({ audio: audioPaths, images: imagePaths });
    } catch (err) {
      console.error('Error uploading files:', err);
      res.status(500).json({ message: 'Error uploading files' });
    }
  }
);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Internal Server Error');
    }
  });
});

function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

function broadcast(message) {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}


function broadcastParticipantList() {
    const participants = [];
    // wss.clients là một Set chứa tất cả các kết nối WebSocket đang hoạt động
    wss.clients.forEach(client => {
        // Chỉ thêm vào danh sách nếu client đó đã đăng nhập bằng tên
        if (client.username) {
            participants.push(client.username);
        }
    });
    // Gửi danh sách cập nhật tới tất cả mọi người
    broadcast({
        type: 'participantUpdate',
        participants: participants,
        count: participants.length
    });
}

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });


wss.on('connection', (ws) => {
    clients.add(ws);
    
    // Gửi thông tin trạng thái ban đầu cho người mới kết nối
    broadcastParticipantList();
    if (currentQuiz) {
        const quizResults = results.filter(r => r.quizId === currentQuiz.quizId);
        ws.send(JSON.stringify({
            type: 'submitted',
            count: quizResults.length,
            results: quizResults.map(r => ({
                username: r.username,
                score: r.score,
                submittedAt: new Date(r.timestamp)
            }))
        }));
        ws.send(JSON.stringify({
            type: 'quizStatus',
            quizId: currentQuiz.quizId,
            quizName: currentQuiz.quizName,
            quizExists: true
        }));
    }

    // Xử lý các tin nhắn từ client
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            if (msg.type === 'login') {
                ws.username = msg.username;
                broadcastParticipantList();
            } 
            else if (msg.type === 'start') {
                const quiz = quizzes.find(q => q.quizId === msg.quizId);
                if (quiz) {
                    broadcast({
                        type: 'start',
                        timeLimit: msg.timeLimit,
                        quizId: msg.quizId,
                        startTime: msg.startTime,
                        partVisibility: msg.partVisibility,
                        quizPdfUrl: quiz.quizPdfUrl
                    });
                }
            } 
            else if (msg.type === 'end') {
                if (currentQuiz) {
                    const quizResults = results.filter(r => r.quizId === currentQuiz.quizId);
                    broadcast({
                        type: 'submitted',
                        count: quizResults.length,
                        results: quizResults.map(r => ({
                            username: r.username,
                            score: r.score,
                            submittedAt: new Date(r.timestamp)
                        }))
                    });
                }
                broadcast({ type: 'end' });
            } 
            else if (msg.type === 'requestQuizStatus') {
                if (currentQuiz) {
                    ws.send(JSON.stringify({
                        type: 'quizStatus',
                        quizId: currentQuiz.quizId,
                        quizName: currentQuiz.quizName,
                        quizExists: true
                    }));
                } else {
                    ws.send(JSON.stringify({ type: 'quizStatus', quizExists: false }));
                }
            } 
            else if (msg.type === 'heartbeat') {
                console.log("Received heartbeat from a client.");
            }
        } catch (err) {
            console.error('Error processing WebSocket message:', err);
        }
    });

    // Xử lý khi client ngắt kết nối
    ws.on('close', () => {
        clients.delete(ws);
        broadcastParticipantList();
    });
});