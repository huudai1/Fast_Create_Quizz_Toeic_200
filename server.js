const express = require("express");
const { WebSocketServer } = require("ws");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const archiver = require("archiver");
const unzipper = require("unzipper");


// --- 1. KHỞI TẠO BIẾN TOÀN CỤC ---
let activeAdminSocket = null;
const app = express();
const port = process.env.PORT || 3000;
const quizzesFile = path.join(__dirname, "quizzes.json");
const resultsFile = path.join(__dirname, "results.json");
let quizzes = [];
let currentQuiz = null;
let results = [];
let clients = new Set();

app.use(express.json());
app.use(express.static("public"));


app.get('/quiz-state/:quizId', (req, res) => {
    const { quizId } = req.params;
    const quiz = quizzes.find(q => q.quizId === quizId);
    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json({ partVisibility: quiz.partVisibility || Array(7).fill(true) });
});

app.get('/quiz-pdf', (req, res) => {
    if (!currentQuiz) {
        return res.status(404).json({ message: 'No quiz selected' });
    }
    res.json({ pdfPath: currentQuiz.pdfPath || null });
});


app.post('/submit', async (req, res) => {
    if (!currentQuiz) {
        return res.status(404).json({ message: 'No quiz selected' });
    }
    const { username, answers } = req.body;
    if (!username || !answers) {
        return res.status(400).json({ message: 'Username and answers are required' });
    }
    let score = 0;
    const answerKey = currentQuiz.answerKey;
    for (const qId in answerKey) {
        if (answers[qId] === answerKey[qId]) {
            score++;
        }
    }
    const result = {
        quizId: currentQuiz.quizId, username, score,
        answers, timestamp: Date.now()
    };
    results.push(result);
    await saveResults();
    const quizResults = results.filter(r => r.quizId === currentQuiz.quizId);
    broadcast({ type: 'submitted', count: quizResults.length, results: quizResults.map(r => ({ username: r.username, score: r.score, submittedAt: new Date(r.timestamp) })) });
    res.json({ score });
});

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

app.get('/answer-key', (req, res) => {
    if (!currentQuiz) {
        return res.status(404).json({ message: 'No quiz selected' });
    }
    res.json(currentQuiz.answerKey);
});

// Endpoint để xóa database
app.delete('/delete-quiz/:quizId', async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const quizIndex = quizzes.findIndex((quiz) => quiz.quizId === quizId);
        if (quizIndex === -1) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const quiz = quizzes[quizIndex];

        // Xóa file audio
        for (let part in quiz.audio) {
            const audioPath = path.join(__dirname, 'public', quiz.audio[part]);
            try {
                if (fsSync.existsSync(audioPath)) await fs.unlink(audioPath);
            } catch (err) { console.error(`Error deleting audio file ${audioPath}:`, err); }
        }

        // SỬA LỖI: Xóa file PDF duy nhất
        if (quiz.pdfPath) {
            const pdfFullPath = path.join(__dirname, 'public', quiz.pdfPath);
            try {
                if (fsSync.existsSync(pdfFullPath)) await fs.unlink(pdfFullPath);
            } catch (err) { console.error(`Error deleting PDF file ${pdfFullPath}:`, err); }
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
    upload.fields([
        { name: 'quiz-pdf', maxCount: 1 },
        { name: 'audio-part1', maxCount: 1 },
        { name: 'audio-part2', maxCount: 1 },
        { name: 'audio-part3', maxCount: 1 },
        { name: 'audio-part4', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const { quizName, answerKey, createdBy } = req.body;
            if (!quizName || !answerKey || !createdBy || !req.files['quiz-pdf']) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            const pdfFile = req.files['quiz-pdf'][0];
            const pdfPath = `/uploads/images/${pdfFile.filename}`;

            const audioPaths = {};
            for (let i = 1; i <= 4; i++) {
                if (req.files[`audio-part${i}`]) {
                    const audioFile = req.files[`audio-part${i}`][0];
                    audioPaths[`part${i}`] = `/uploads/audio/${audioFile.filename}`;
                }
            }

            const quiz = {
                quizId: uuidv4(),
                quizName,
                pdfPath: pdfPath,
                audio: audioPaths,
                answerKey: JSON.parse(answerKey),
                createdBy,
                partVisibility: [true, true, true, true, true, true, true],
                isAssigned: false
            };

            quizzes.push(quiz);
            await saveQuizzes();
            res.json({ message: 'Quiz saved successfully!' });
        } catch (err) {
            console.error('Error saving quiz:', err);
            res.status(500).json({ message: 'Error saving quiz' });
        }
    }
);

app.get('/download-quiz-zip/:quizId', async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const quiz = quizzes.find((q) => q.quizId === quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const zip = archiver('zip', { zlib: { level: 9 } });
        res.attachment(`quiz_${quizId}.zip`);
        zip.pipe(res);

        // Dùng một bản sao của quiz để loại bỏ các đường dẫn tuyệt đối không cần thiết
        const quizToSave = { ...quiz };
        const quizJson = JSON.stringify(quizToSave, null, 2);
        zip.append(quizJson, { name: 'quizzes.json' });

        // Thêm file audio vào zip
        for (let part in quiz.audio) {
            const audioPath = quiz.audio[part];
            const fullPath = path.join(__dirname, 'public', audioPath);
            if (fsSync.existsSync(fullPath)) {
                zip.file(fullPath, { name: `audio/${path.basename(audioPath)}` });
            }
        }

        // SỬA LỖI: Thêm file PDF duy nhất vào zip
        if (quiz.pdfPath) {
            const pdfFullPath = path.join(__dirname, 'public', quiz.pdfPath);
            if (fsSync.existsSync(pdfFullPath)) {
                zip.file(pdfFullPath, { name: `pdf/${path.basename(pdfFullPath)}` });
            }
        }

        await zip.finalize();
    } catch (err) {
        console.error('Error creating ZIP:', err);
        res.status(500).json({ message: 'Error creating ZIP file' });
    }
});

app.post('/assign-quiz', async (req, res) => {
    const { quizId, timeLimit } = req.body;
    if (!quizId || !timeLimit) {
        return res.status(400).json({ message: 'Quiz ID and time limit are required' });
    }
    const quiz = quizzes.find((q) => q.quizId === quizId);
    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
    }
    quiz.isAssigned = true;
    await saveQuizzes();

    // Gửi tin nhắn tới tất cả client để cập nhật
    broadcast({ type: 'quizAssigned', quizId: quiz.quizId, isAssigned: true });

    res.json({ message: 'Quiz assigned successfully!' });
});

app.post(
  '/upload-quizzes-zip',
  upload.single('quizzes'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No ZIP file uploaded' });
      }

      const zipPath = req.file.path;
      const extractPath = path.join(__dirname, 'temp', uuidv4());
      await fs.mkdir(extractPath, { recursive: true });

      await new Promise((resolve, reject) => {
        fsSync.createReadStream(zipPath)
          .pipe(unzipper.Extract({ path: extractPath }))
          .on('close', resolve)
          .on('error', reject);
      });

      const quizzesJsonPath = path.join(extractPath, 'key', 'quizzes.json');
      if (!fsSync.existsSync(quizzesJsonPath)) {
        await fs.rm(extractPath, { recursive: true, force: true });
        await fs.unlink(zipPath);
        return res.status(400).json({ message: 'Missing key/quizzes.json in ZIP' });
      }

      const quizData = JSON.parse(await fs.readFile(quizzesJsonPath, 'utf8'));
      const newQuizId = uuidv4();
      quizData.quizId = newQuizId;

      for (let i = 1; i <= 4; i++) {
        const audioSrcPath = path.join(extractPath, `part${i}`, 'audio', `part${i}.mp3`);
        if (fsSync.existsSync(audioSrcPath)) {
          const audioDestPath = path.join(__dirname, 'public/uploads/audio', `${newQuizId}_part${i}.mp3`);
          await fs.copyFile(audioSrcPath, audioDestPath);
          quizData.audio[`part${i}`] = `/uploads/audio/${path.basename(audioDestPath)}`;
        } else {
          delete quizData.audio[`part${i}`];
        }
      }

      for (let i = 1; i <= 7; i++) {
  const imagesDir = path.join(extractPath, `part${i}`, 'images');
  quizData.images[`part${i}`] = [];
  if (fsSync.existsSync(imagesDir)) {
    const imageFiles = await fs.readdir(imagesDir);
    for (const imageFile of imageFiles) {
      const imageSrcPath = path.join(imagesDir, imageFile);
      const imageDestPath = path.join(__dirname, 'public/uploads/images', `${newQuizId}_part${i}_${imageFile}`);
      await fs.copyFile(imageSrcPath, imageDestPath);
      quizData.images[`part${i}`].push(`/uploads/images/${path.basename(imageDestPath)}`);
    }
  }
}

      quizzes.push(quizData);
      await saveQuizzes();

      await fs.rm(extractPath, { recursive: true, force: true });
      await fs.unlink(zipPath);

      res.json({ message: 'Quiz uploaded successfully!' });
    } catch (err) {
      console.error('Error uploading ZIP:', err);
      res.status(500).json({ message: 'Error uploading ZIP file' });
    }
  }
);

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

  // Gửi trạng thái chung của đề thi
  broadcast({
    type: 'quizStatus',
    quizId: quiz.quizId,
    quizName: quiz.quizName,
    quizExists: true
  });

  // *** BẮT ĐẦU THAY ĐỔI ***
  // Khởi tạo partVisibility nếu chưa có (dành cho các đề cũ)
  if (!quiz.partVisibility) {
    quiz.partVisibility = Array(7).fill(true);
  }
  // Gửi trạng thái ẩn/hiện ngay lập tức khi chọn đề
  broadcast({
    type: 'partVisibilityUpdate',
    visibility: quiz.partVisibility
  });
  // *** KẾT THÚC THAY ĐỔI ***

  res.json({ message: 'Quiz selected successfully!', quizName: quiz.quizName });
});

app.get('/quiz-audio', (req, res) => {
  if (!currentQuiz || !currentQuiz.audio) {
    return res.status(404).json({ message: 'No audio available' });
  }
  const part = req.query.part || 'part1';
  res.json({ audio: currentQuiz.audio[part] });
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

function broadcast(message) {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('[DEBUG] Một client mới đã kết nối.');
    clients.add(ws);
    broadcast({ type: 'participantCount', count: clients.size });

    // Gửi trạng thái hiện tại cho client mới kết nối
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

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            console.log(`[SERVER LOG] Nhận được tin nhắn:`, msg); // Log mọi tin nhắn

            switch(msg.type) {
                case 'adminLogin':
                    console.log('[SERVER LOG] Đang xử lý yêu cầu adminLogin...');
                    console.log(`[SERVER LOG] Trạng thái activeAdminSocket hiện tại: ${activeAdminSocket ? 'ĐÃ CÓ NGƯỜI DÙNG' : 'NULL (TRỐNG)'}`);
                    if (activeAdminSocket && activeAdminSocket.readyState === 1) { // 1 is WebSocket.OPEN
                        console.log('[SERVER LOG] Lỗi: Đã có admin khác. Gửi adminLoginError.');
                        ws.send(JSON.stringify({ type: 'adminLoginError', message: 'Một Admin khác đang đăng nhập!' }));
                    } else {
                        console.log('[SERVER LOG] Thành công: Chấp nhận admin mới. Gửi adminLoginSuccess.');
                        activeAdminSocket = ws;
                        ws.isAdmin = true;
                        ws.send(JSON.stringify({ type: 'adminLoginSuccess' }));
                        console.log(`[SERVER LOG] Admin đã đăng nhập: ${msg.user ? msg.user.name : 'Unknown'}`);
                    }
                    break;

                case 'adminLogout':
                    if (ws === activeAdminSocket) {
                        console.log('[SERVER LOG] Admin đã đăng xuất. Reset activeAdminSocket.');
                        activeAdminSocket = null;
                    }
                    break;
                
                case 'togglePartVisibility':
                    console.log('[SERVER LOG] Processing togglePartVisibility...');
                    if (ws.isAdmin) {
                        const quiz = quizzes.find(q => q.quizId === msg.quizId);
                        if (quiz) {
                            console.log('[SERVER LOG] Found quiz:', quiz.quizName);
                            // Sửa lỗi: Nếu quiz cũ không có thuộc tính này, hãy tạo nó
                            if (!quiz.partVisibility) {
                                quiz.partVisibility = Array(7).fill(true);
                                console.log('[SERVER LOG] Initialized partVisibility for old quiz.');
                            }
                            
                            const partIndex = msg.part - 1;
                            if (partIndex >= 0 && partIndex < 7) {
                                quiz.partVisibility[partIndex] = !quiz.partVisibility[partIndex];
                                console.log(`[SERVER LOG] Part ${msg.part} visibility set to ${quiz.partVisibility[partIndex]}`);
                                saveQuizzes();
                                broadcast({ type: 'partVisibilityUpdate', visibility: quiz.partVisibility });
                                console.log('[SERVER LOG] Broadcasted partVisibilityUpdate.');
                            } else {
                                console.error(`[SERVER LOG] Invalid part number received: ${msg.part}`);
                            }
                        } else {
                            console.error(`[SERVER LOG] Quiz not found for ID: ${msg.quizId}`);
                        }
                    }
                    break;

                case 'heartbeat':
                    // Connection is alive, no action needed.
                    break;
                
                case 'start':
                    broadcast({ type: 'start', timeLimit: msg.timeLimit, quizId: msg.quizId, startTime: msg.startTime });
                    break;

                case 'end':
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
                    break;

                case 'requestQuizStatus':
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
                    break;
                
                case 'login':
                case 'quizSelected':
                case 'quizAssigned':
                case 'submitted':
                    // Các message này chỉ cần client gửi đi, server không cần xử lý đặc biệt
                    break;
            }
        } catch (err) {
            console.error('[SERVER LOG] Error processing WebSocket message:', err);
        }
    });

    ws.on('close', () => {
        console.log('[DEBUG] Một client đã ngắt kết nối.');
        clients.delete(ws);
        if (ws === activeAdminSocket) {
            activeAdminSocket = null;
            console.log("[DEBUG] Kết nối của Admin đã đóng. Reset activeAdminSocket về NULL.");
        }
        broadcast({ type: 'participantCount', count: clients.size });
    });
});