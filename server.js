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

app.use(express.json());
app.use(express.static("public", {
  index: "index.html",
  setHeaders: (res, path) => {
    console.log(`Serving file: ${path}`);
  }
}));

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

        const quizResults = results.filter((r) => r.quizId === quizId);

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

app.delete('/delete-quiz/:quizId', async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const quizIndex = quizzes.findIndex((quiz) => quiz.quizId === quizId);
        if (quizIndex === -1) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const quiz = quizzes[quizIndex];

        for (let part in quiz.audio) {
            const audioPath = path.join(__dirname, 'public', quiz.audio[part]);
            try {
                if (fsSync.existsSync(audioPath)) await fs.unlink(audioPath);
            } catch (err) { console.error(`Error deleting audio file ${audioPath}:`, err); }
        }

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
  broadcast({ type: 'quizStatus', quizId: quiz.quizId, quizName: quiz.quizName, quizExists: true });
  res.json({ message: 'Quiz assigned successfully!' });
});

app.get('/quizzes', async (req, res) => {
    const email = req.query.email;
    if (email) {
        res.json(quizzes.filter((quiz) => quiz.createdBy === email));
    } else {
        res.json(quizzes.filter(q => q.isAssigned));
    }
});


app.post(
  '/save-quiz',
  upload.fields([
    { name: 'audio-part1', maxCount: 1 },
    { name: 'audio-part2', maxCount: 1 },
    { name: 'audio-part3', maxCount: 1 },
    { name: 'audio-part4', maxCount: 1 },
    { name: 'images-part1' },
    { name: 'images-part2' },
    { name: 'images-part3' },
    { name: 'images-part4' },
    { name: 'images-part5' },
    { name: 'images-part6' },
    { name: 'images-part7' },
  ]),
  async (req, res) => {
    try {
      const { quizName, answerKey, createdBy } = req.body;
      if (!quizName || !answerKey || !createdBy) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const audioPaths = {};
      for (let i = 1; i <= 4; i++) {
        if (req.files[`audio-part${i}`]) {
          const audioFile = req.files[`audio-part${i}`][0];
          audioPaths[`part${i}`] = `/uploads/audio/${audioFile.filename}`;
        }
      }

      const images = {};
      for (let i = 1; i <= 7; i++) {
        const partImages = req.files[`images-part${i}`] || [];
        images[`part${i}`] = partImages.map((file) => `/uploads/images/${file.filename}`);
      }

      const quiz = {
        quizId: uuidv4(),
        quizName,
        audio: audioPaths,
        images,
        answerKey: JSON.parse(answerKey),
        createdBy,
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

        const quizToSave = { ...quiz };
        const quizJson = JSON.stringify(quizToSave, null, 2);
        zip.append(quizJson, { name: 'quizzes.json' });

        for (let part in quiz.audio) {
            const audioPath = quiz.audio[part];
            const fullPath = path.join(__dirname, 'public', audioPath);
            if (fsSync.existsSync(fullPath)) {
                zip.file(fullPath, { name: `audio/${path.basename(audioPath)}` });
            }
        }

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
  try {
    const quizId = req.params.quizId;
    const quiz = quizzes.find((q) => q.quizId === quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const zip = archiver('zip', { zlib: { level: 9 } });
    res.attachment(`quiz_${quizId}.zip`);
    zip.pipe(res);

    const quizJson = JSON.stringify(quiz, null, 2);
    zip.append(quizJson, { name: 'key/quizzes.json' });

    for (let i = 1; i <= 4; i++) {
      const audioPath = quiz.audio[`part${i}`];
      if (audioPath) {
        const fullPath = path.join(__dirname, 'public', audioPath.substring(1));
        if (fsSync.existsSync(fullPath)) {
          // Use original filename from quiz.audio
          const originalName = path.basename(audioPath);
          zip.file(fullPath, { name: `part${i}/audio/${originalName}` });
        }
      }
    }

    for (let i = 1; i <= 7; i++) {
      const images = quiz.images[`part${i}`] || [];
      for (let imagePath of images) {
        const fullPath = path.join(__dirname, 'public', imagePath.substring(1));
        if (fsSync.existsSync(fullPath)) {
          // Use original filename from quiz.images
          const originalName = path.basename(imagePath);
          zip.file(fullPath, { name: `part${i}/images/${originalName}` });
        }
      }
    }

    await zip.finalize();
  } catch (err) {
    console.error('Error creating ZIP:', err);
    res.status(500).json({ message: 'Error creating ZIP file' });
  }
};

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
    quiz.timeLimit = timeLimit; // Lưu thời gian vào đề thi
    await saveQuizzes();

    broadcast({ type: 'quizAssigned', quizId: quiz.quizId });
    res.json({ message: 'Quiz assigned successfully!' });
});

app.post(
    '/upload-quizzes-zip',
    upload.single('quizzes'),
    async (req, res) => {
        // ... (phần này không có lỗi, giữ nguyên)
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

    broadcast({
        type: 'quizStatus',
        quizId: quiz.quizId,
        quizName: quiz.quizName,
    });

    // *** BẮT ĐẦU SỬA LỖI & TÁI CẤU TRÚC ***
    // 1. Luôn đảm bảo thuộc tính partVisibility tồn tại
    if (!Array.isArray(quiz.partVisibility) || quiz.partVisibility.length !== 7) {
        quiz.partVisibility = Array(7).fill(true);
        saveQuizzes(); // Lưu lại nếu có thay đổi
    }

    // 2. Ngay khi chọn đề, gửi trạng thái ẩn/hiện của đề đó cho tất cả client
    broadcast({
        type: 'partVisibilityUpdate',
        quizId: quiz.quizId, // Gửi kèm ID để client biết update này cho đề nào
        visibility: quiz.partVisibility
    });
    // *** KẾT THÚC SỬA LỖI & TÁI CẤU TRÚC ***

    res.json({ message: 'Quiz selected successfully!', quizName: quiz.quizName, timeLimit: quiz.timeLimit });
});


app.get('/quiz-audio', (req, res) => {
    if (!currentQuiz || !currentQuiz.audio) {
        return res.status(404).json({ message: 'No audio available' });
  if (!currentQuiz || !currentQuiz.audio) {
    return res.status(404).json({ message: 'No audio available' });
  }
  const part = req.query.part || 'part1';
  res.json({ audio: currentQuiz.audio[part] });
};

app.get('/images', (req, res) => {
  if (!currentQuiz) {
    return res.status(404).json({ message: 'No quiz selected' });
  }
  const part = req.query.part || 1;
  res.json(currentQuiz.images[`part${part}`] || []);
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

  for (let i = 1; i <= 200; i++) {
    const userAnswer = answers[`q${i}`];
    const correctAnswer = answerKey[`q${i}`];
    if (userAnswer && userAnswer === correctAnswer) {
      score++;
    }
  }

  const result = {
    quizId: currentQuiz.quizId,
    username,
    score,
    answers, // Lưu trữ toàn bộ đáp án
    timestamp: Date.now()
  };
  results.push(result);
  await saveResults();

  const quizResults = results.filter((r) => r.quizId === currentQuiz.quizId);
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
    const part = req.query.part || 'part1';
    res.json({ audio: currentQuiz.audio[part] });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function broadcast(message) {
    clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(message));
        }
    });
}

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  broadcast({ type: 'participantCount', count: clients.size });
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

    if (currentQuiz) {
        ws.send(JSON.stringify({
            type: 'quizStatus',
            quizId: currentQuiz.quizId,
            quizName: currentQuiz.quizName,
        }));
        // Khi client mới kết nối, cũng gửi cho nó trạng thái ẩn/hiện mới nhất
        ws.send(JSON.stringify({
            type: 'partVisibilityUpdate',
            quizId: currentQuiz.quizId,
            visibility: currentQuiz.partVisibility
        }));

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'start') {
        broadcast({ type: 'start', timeLimit: msg.timeLimit });
      } else if (msg.type === 'end') {
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
      } else if (msg.type === 'requestQuizStatus') {
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
      } else if (msg.type === 'login') {
        // Lưu thông tin user nếu cần
      } else if (msg.type === 'quizSelected' || msg.type === 'quizAssigned') {
        // Xử lý các tin nhắn từ client nếu cần
      } else if (msg.type === 'heartbeat') { // ⭐ Add this new case
          console.log("Received heartbeat from a client.");
        // The client is still active, do nothing. The server's timeout logic is reset automatically.
        }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  });

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            switch (msg.type) {
                case 'adminLogin':
                    if (activeAdminSocket && activeAdminSocket.readyState === 1) {
                        ws.send(JSON.stringify({ type: 'adminLoginError', message: 'Một Admin khác đang đăng nhập!' }));
                    } else {
                        activeAdminSocket = ws;
                        ws.isAdmin = true;
                        ws.send(JSON.stringify({ type: 'adminLoginSuccess' }));
                    }
                    break;

                case 'adminLogout':
                    if (ws === activeAdminSocket) {
                        activeAdminSocket = null;
                    }
                    break;
                
                // *** BẮT ĐẦU SỬA LỖI & TÁI CẤU TRÚC ***
                case 'togglePartVisibility':
                    if (ws.isAdmin) {
                        const quiz = quizzes.find(q => q.quizId === msg.quizId);
                        if (quiz) {
                            if (!Array.isArray(quiz.partVisibility) || quiz.partVisibility.length !== 7) {
                                quiz.partVisibility = Array(7).fill(true);
                            }
                            
                            const partIndex = msg.part - 1;
                            if (partIndex >= 0 && partIndex < 7) {
                                quiz.partVisibility[partIndex] = !quiz.partVisibility[partIndex];
                                saveQuizzes();
                                // Broadcast lại cho tất cả client, kèm theo quizId
                                broadcast({ type: 'partVisibilityUpdate', quizId: quiz.quizId, visibility: quiz.partVisibility });
                            }
                        }
                    }
                    break;
                // *** KẾT THÚC SỬA LỖI & TÁI CẤU TRÚC ***

                case 'heartbeat':
                    break;

                default:
                    broadcast(msg);
                    break;
            }
        } catch (err) {
            console.error('Error processing WebSocket message:', err);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        if (ws === activeAdminSocket) {
            activeAdminSocket = null;
        }
        broadcast({ type: 'participantCount', count: clients.size });
    });
  ws.on('close', () => {
    clients.delete(ws);
    broadcast({ type: 'participantCount', count: clients.size });
  });

  app.get('/answer-key', (req, res) => {
  if (!currentQuiz) {
    return res.status(404).json({ message: 'No quiz selected' });
  }
  res.json(currentQuiz.answerKey);
});
};