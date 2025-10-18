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
const Quiz = require('./models/Quiz');
const Event = require('./models/Event');
const Result = require('./models/Result');
const mongoose = require('mongoose'); // <--- THÊM DÒNG NÀY
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;

app.use(express.json());
app.use(express.static("public", {
  index: "index.html",
  setHeaders: (res, path) => {
    console.log(`Serving file: ${path}`);
  }
}));


const connectDB = async () => {
  try {
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to MongoDB successfully!');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1); // Thoát app nếu không kết nối được DB
  }
};



let clients = new Set();
let currentDirectEvent = null;

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




app.get('/statistics', async (req, res) => {
    try {
        const { quizId } = req.query;
        if (!quizId) {
            return res.status(400).json({ message: 'Quiz ID is required' });
        }

        // Find the quiz to get total questions and answer key
        const quiz = await Quiz.findOne({ quizId: quizId });
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }
        const totalQuestions = quiz.totalQuestions || 200; // Get actual total questions
        const answerKey = quiz.answerKey;

        // Find all results for this quizId
        const quizResults = await Result.find({ quizId: quizId });

        let totalScore = 0;
        const totalSubmissions = quizResults.length;

        if (totalSubmissions === 0) {
            return res.status(200).json({
                averageScore: 0,
                totalQuestions: totalQuestions, // Return total questions even if no submissions
                questionStats: []
            });
        }

        // Initialize question stats
        const questionStatsMap = new Map();
        for (let i = 1; i <= totalQuestions; i++) {
            const qId = quiz.type === 'custom' ? `custom_q${i}` : `q${i}`;
            questionStatsMap.set(qId, { questionId: qId, wrongCount: 0, totalCount: 0 });
        }

        // Calculate stats from results
        quizResults.forEach((result) => {
            totalScore += result.score || 0;
            for (let i = 1; i <= totalQuestions; i++) {
                 const qId = quiz.type === 'custom' ? `custom_q${i}` : `q${i}`;
                 const stat = questionStatsMap.get(qId);
                 if (stat) {
                     stat.totalCount++;
                     const userAnswer = result.answers ? result.answers[qId] : null;

                     let correctAnswer;
                     if (quiz.type === 'custom') {
                          // Custom quiz answer key is "A,B,C,..."
                          const correctAnswersArray = answerKey.split(',');
                          correctAnswer = correctAnswersArray[i-1]; // Index is i-1
                     } else {
                          // TOEIC answer key is {q1: 'A', ...}
                          correctAnswer = answerKey[qId];
                     }

                     // Check if answer exists and is wrong
                     if (userAnswer && userAnswer.trim().toUpperCase() !== correctAnswer?.trim().toUpperCase()) {
                         stat.wrongCount++;
                     }
                }
            }
        });

        const averageScore = totalScore / totalSubmissions;
        const questionStats = Array.from(questionStatsMap.values());

        res.status(200).json({
            averageScore: averageScore,
            totalQuestions: totalQuestions,
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
        await Quiz.deleteMany({});
        await Event.deleteMany({});
        await Result.deleteMany({});

        // Xóa file vật lý (giữ nguyên logic cũ của bạn là tốt)
        // (Bạn có thể thêm logic xóa file trong public/uploads ở đây nếu muốn)

        broadcast({ type: 'quizStatus', quizExists: false });
        res.status(200).json({ message: 'Đã xóa sạch database!' });
    } catch (err) {
        console.error('Error clearing database:', err);
        res.status(500).json({ message: 'Error clearing database' });
    }
});

// Endpoint để giao bài
app.post('/assign-quiz', async (req, res) => {
    const { quizId, timeLimit, partVisibility } = req.body;
    if (!quizId) return res.status(400).json({ message: 'Quiz ID is required' });

    try {
        const quiz = await Quiz.findOneAndUpdate(
            { quizId: quizId }, // Tìm đề bằng quizId
            { // Cập nhật các trường này
                isAssigned: true,
                timeLimit: timeLimit,
                partVisibility: partVisibility
            },
            { new: true } // Trả về tài liệu đã được cập nhật
        );

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        broadcast({ type: 'quizAssigned', quizId: quiz.quizId });
        res.json({ message: 'Quiz assigned successfully!' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi khi giao bài' });
    }
});

app.get('/quizzes', async (req, res) => {
    try {
        const allQuizzes = await Quiz.find({}, 'quizName quizId type'); // Chỉ lấy các trường cần thiết
        res.json(allQuizzes);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi khi tải danh sách đề thi' });
    }
});

app.post(
    '/save-quiz',
    upload.fields([
        { name: 'quiz-pdf', maxCount: 1 }, { name: 'audio-part1', maxCount: 1 },
        { name: 'audio-part2', maxCount: 1 }, { name: 'audio-part3', maxCount: 1 },
        { name: 'audio-part4', maxCount: 1 }, { name: 'pdfFile', maxCount: 1 },
        ...Array(10).fill(0).map((_, i) => ({ name: `audio_file_${i}`, maxCount: 1 }))
    ]),
    async (req, res) => {
        try {
            const { quizType } = req.body;
            let quizData; // Dữ liệu để tạo quiz mới

            if (quizType === 'custom') {
                // Logic đề tùy chỉnh
                const { quizName, totalQuestions, answerKey, createdBy, listeningRanges } = req.body;
                const pdfFile = req.files['pdfFile'][0];
                const listeningRangesParsed = JSON.parse(listeningRanges);

                listeningRangesParsed.forEach((range, index) => {
                    const audioFile = req.files[`audio_file_${index}`][0];
                    range.audioUrl = `/uploads/audio/${audioFile.filename}`;
                });

                quizData = {
                    quizId: uuidv4(), // Tạo quizId mới
                    quizName,
                    type: 'custom',
                    totalQuestions: parseInt(totalQuestions),
                    quizPdfUrl: `/uploads/images/${pdfFile.filename}`,
                    answerKey, // Lưu chuỗi "A,B,C"
                    listeningRanges: listeningRangesParsed,
                    createdBy,
                };
            } else {
                // Logic đề TOEIC
                const { quizName, answerKey, createdBy } = req.body;
                if (!quizName || !answerKey || !createdBy || !req.files['quiz-pdf']) {
                    return res.status(400).json({ message: "Thiếu thông tin cho đề TOEIC." });
                }

                const quizPdfFile = req.files['quiz-pdf'][0];
                const audioPaths = {};
                for (let i = 1; i <= 4; i++) {
                    if (req.files[`audio-part${i}`]) {
                        const audioFile = req.files[`audio-part${i}`][0];
                        audioPaths[`part${i}`] = `/uploads/audio/${audioFile.filename}`;
                    }
                }

                quizData = {
                    quizId: uuidv4(), // Tạo quizId mới
                    quizName,
                    type: 'toeic',
                    totalQuestions: 200, // Mặc định cho TOEIC
                    quizPdfUrl: `/uploads/images/${quizPdfFile.filename}`,
                    audio: audioPaths,
                    answerKey: JSON.parse(answerKey), // Lưu object {q1: 'A'}
                    createdBy,
                    isAssigned: false
                };
            }

            // LƯU VÀO DATABASE
            const newQuiz = new Quiz(quizData);
            await newQuiz.save();

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
        return res.status(400).json({ message: 'Thiếu thông tin' });
    }

    try {
        const quiz = await Quiz.findOne({ quizId: quizId });
        if (!quiz || quiz.type !== 'custom') {
            return res.status(404).json({ message: 'Không tìm thấy đề tùy chỉnh' });
        }

        // Tính điểm (logic cũ của bạn)
        let score = 0;
        const correctAnswers = quiz.answerKey.split(',');
        for (let i = 0; i < quiz.totalQuestions; i++) {
            const questionId = `custom_q${i + 1}`;
            const userAnswer = answers[questionId];
            const correctAnswer = correctAnswers[i];
            if (userAnswer && userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()) {
                score++;
            }
        }

        // KIỂM TRA xem có thuộc EVENT nào đang chạy không
        let currentEventId = null;
        if (currentDirectEvent && currentDirectEvent.quizId === quizId) {
            currentEventId = currentDirectEvent.eventId;
        }

        // Tạo và LƯU KẾT QUẢ (SIÊU NHANH)
        const newResult = new Result({
            eventId: currentEventId,
            quizId: quizId,
            username: username,
            score: score,
            totalQuestions: quiz.totalQuestions,
            answers: answers,
            submittedAt: new Date()
        });
        await newResult.save();

        // Broadcast (nếu là thi trực tiếp)
        if(currentEventId) {
            const eventResults = await Result.find({ eventId: currentEventId });
            broadcast({
                type: 'submitted',
                count: eventResults.length,
                results: eventResults.map(r => ({
                    username: r.username,
                    score: r.score,
                    submittedAt: r.submittedAt
                }))
            });
        }

        res.json({ score });
    } catch (err) {
        console.error("Error submitting custom quiz:", err);
        res.status(500).json({ message: 'Lỗi khi nộp bài' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        // Sắp xếp theo ngày bắt đầu, mới nhất lên trước
        const events = await Event.find({}).sort({ startTime: -1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi khi tải lịch sử' });
    }
});

// API 2: Lấy chi tiết kết quả của MỘT sự kiện
app.get('/api/history/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;
        
        const event = await Event.findById(eventId); // Lấy thông tin của event
        
        res.json({ event, results });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi khi tải chi tiết lịch sử' });
    }
});

app.delete('/delete-quiz/:quizId', async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const quiz = await Quiz.findOneAndDelete({ quizId: quizId });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // (Thêm logic xóa file PDF/audio trong /public/uploads nếu bạn muốn)

        // Xóa luôn kết quả và sự kiện liên quan (để giữ DB sạch)
        await Event.deleteMany({ quizId: quizId });
        await Result.deleteMany({ quizId: quizId });

        broadcast({ type: 'quizStatus', quizExists: false });
        res.json({ message: 'Quiz deleted successfully!' });
    } catch (err) {
        console.error('Error deleting quiz:', err);
        res.status(500).json({ message: 'Error deleting quiz' });
    }
});

app.get('/download-quiz-zip/:quizId', async (req, res) => { // Thêm async
    try {
        const { quizId } = req.params;
        const quiz = await Quiz.findOne({ quizId: quizId }); // Dùng await và Model Quiz
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const zip = archiver('zip', { zlib: { level: 9 } });
        // Chuyển Mongoose document thành object thường NẾU CẦN trước khi sửa đổi
        const quizDataForZip = quiz.toObject ? quiz.toObject() : { ...quiz }; 

        const safeQuizName = quizDataForZip.quizName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeQuizName || 'quiz'}.zip`;
        res.attachment(fileName);
        zip.pipe(res);

        // Xóa các trường của DB trước khi zip
        delete quizDataForZip._id; 
        delete quizDataForZip.__v; 
        delete quizDataForZip.createdAt;
        // Giữ lại quizId để nhất quán khi import lại, hoặc xóa nếu không cần:
        // delete quizDataForZip.quizId; 

        zip.append(JSON.stringify(quizDataForZip, null, 2), { name: 'key/quizzes.json' });

        // Thêm file PDF (Logic giữ nguyên)
        if (quizDataForZip.quizPdfUrl) {
            const pdfPath = path.join(__dirname, 'public', quizDataForZip.quizPdfUrl);
            if (fsSync.existsSync(pdfPath)) {
                zip.file(pdfPath, { name: 'pdf/de_thi.pdf' });
            }
        }

        // Xử lý audio (Logic giữ nguyên)
         if (quizDataForZip.type === 'custom' && quizDataForZip.listeningRanges) {
             quizDataForZip.listeningRanges.forEach((range, index) => {
                 if (range.audioUrl) {
                     const audioPath = path.join(__dirname, 'public', range.audioUrl);
                     if (fsSync.existsSync(audioPath)) {
                         const ext = path.extname(audioPath); // Lấy đuôi file gốc
                         zip.file(audioPath, { name: `audio/range_${index}${ext}` }); // Dùng đuôi file gốc
                     }
                 }
             });
         } else if (quizDataForZip.audio) {
             for (let i = 1; i <= 4; i++) {
                 const partKey = `part${i}`;
                 if (quizDataForZip.audio[partKey]) {
                     const audioPath = path.join(__dirname, 'public', quizDataForZip.audio[partKey]);
                     if (fsSync.existsSync(audioPath)) {
                          const ext = path.extname(audioPath); // Lấy đuôi file gốc
                         zip.file(audioPath, { name: `audio/${partKey}${ext}` }); // Dùng đuôi file gốc
                     }
                 }
             }
         }

        await zip.finalize();
    } catch (err) {
        console.error('Error creating ZIP:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Lỗi khi tạo file ZIP' });
        }
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

        const newQuiz = new Quiz(quizData);
        await newQuiz.save();
        res.json({ message: 'Tải lên đề thi từ ZIP thành công!' });
    } catch (err) {
        console.error('Error uploading ZIP:', err);
        res.status(500).json({ message: err.message || 'Lỗi khi xử lý ZIP' });
    } finally {
        if (zipPath && fsSync.existsSync(zipPath)) await fs.unlink(zipPath);
        if (fsSync.existsSync(extractPath)) await fs.rm(extractPath, { recursive: true, force: true });
    }
});

app.post('/select-quiz', async (req, res) => {
    const { quizId } = req.body;
    if (!quizId) return res.status(400).json({ message: 'Quiz ID is required' });

    try {
        const quiz = await Quiz.findOne({ quizId: quizId });
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // KHÔNG GÁN VÀO BIẾN TOÀN CỤC NỮA (currentQuiz = quiz)

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
            partVisibility: quiz.partVisibility,
            quizPdfUrl: quiz.quizPdfUrl,
            quizType: quiz.type
        });
    } catch (err) {
         res.status(500).json({ message: 'Lỗi khi chọn đề' });
    }
});

app.get('/answer-key', async (req, res) => {
    const { quizId } = req.query;
    if (!quizId) return res.status(400).json({ message: 'Quiz ID is required' });

    try {
        const quiz = await Quiz.findOne({ quizId: quizId }, 'answerKey'); // Chỉ lấy trường answerKey
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }
        res.json(quiz.answerKey);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

app.get('/quiz-audio', async (req, res) => {
    const { part, quizId } = req.query;
    if (!quizId) return res.status(400).json({ message: 'Quiz ID is required' });

    try {
        const quiz = await Quiz.findOne({ quizId: quizId }, 'audio');
        if (!quiz || !quiz.audio) {
            return res.status(404).json({ message: 'No audio available' });
        }
        res.json({ audio: quiz.audio[part] });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

app.post('/submit', async (req, res) => {
    const { username, answers, quizId } = req.body;
    if (!username || !answers || !quizId) {
        return res.status(400).json({ message: 'Thiếu thông tin' });
    }

    try {
        const quiz = await Quiz.findOne({ quizId: quizId });
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Tính điểm (logic cũ của bạn)
        let score = 0;
        const answerKey = quiz.answerKey;
        for (let i = 1; i <= 200; i++) {
            const userAnswer = answers[`q${i}`];
            const correctAnswer = answerKey[`q${i}`];
            if (userAnswer && userAnswer === correctAnswer) {
                score++;
            }
        }

        // KIỂM TRA xem có thuộc EVENT nào đang chạy không
        let currentEventId = null;
        if (currentDirectEvent && currentDirectEvent.quizId === quizId) {
            currentEventId = currentDirectEvent.eventId;
        }

        // Tạo và LƯU KẾT QUẢ (SIÊU NHANH)
        const newResult = new Result({
            eventId: currentEventId,
            quizId: quizId,
            username: username,
            score: score,
            totalQuestions: 200,
            answers: answers,
            submittedAt: new Date()
        });
        await newResult.save(); // Đây là thao tác ghi vào DB

        // Broadcast (logic cũ, nhưng giờ lấy từ DB)
        if(currentEventId) {
            const eventResults = await Result.find({ eventId: currentEventId });
            broadcast({
                type: 'submitted',
                count: eventResults.length,
                results: eventResults.map(r => ({
                    username: r.username,
                    score: r.score,
                    submittedAt: r.submittedAt
                }))
            });
        }

        res.json({ score });
    } catch (err) {
        console.error("Error submitting quiz:", err);
        res.status(500).json({ message: 'Lỗi khi nộp bài' });
    }
});



app.get('/get-quiz', async (req, res) => {
    const { quizId } = req.query;
    try {
        const quiz = await Quiz.findOne({ quizId: quizId });
        if (quiz) {
            res.json(quiz);
        } else {
            res.status(404).json({ message: 'Quiz not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
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


app.get('/quizzes/assigned', async (req, res) => {
    try {
        const assignedQuizzes = await Quiz.find({ isAssigned: true });
        res.json(assignedQuizzes);
    } catch (err) {
        console.error('Error fetching assigned quizzes:', err);
        res.status(500).json({ message: 'Error fetching assigned quizzes' });
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

const startServer = async () => {
    await connectDB();

    const server = app.listen(port, () => { // <--- server created here
        console.log(`Server running on port ${port}`);
    });

    // MOVE WSS CODE HERE ---->
    const wss = new WebSocketServer({ server }); // <--- Now uses the correct 'server'

    // Define broadcastParticipantList INSIDE startServer or make wss global (less ideal)
    function broadcastParticipantList() {
        const participants = [];
        wss.clients.forEach(client => { // <--- Now 'wss' is defined
            if (client.username) {
                participants.push(client.username);
            }
        });
        broadcast({ // 'broadcast' function needs to be accessible too
            type: 'participantUpdate',
            participants: participants,
            count: participants.length
        });
    }



  wss.on('connection', (ws) => {
    clients.add(ws);

    // Gửi trạng thái của sự kiện đang chạy (nếu có)
    if (currentDirectEvent) {
        const elapsedTime = Math.floor((Date.now() - currentDirectEvent.startTime.getTime()) / 1000);
        const remainingTime = currentDirectEvent.timeLimit - elapsedTime;

        if (remainingTime > 0) {
            ws.send(JSON.stringify({
                type: 'directTestInProgress',
                quizId: currentDirectEvent.quizId,
                quizName: currentDirectEvent.quizName,
                quizType: currentDirectEvent.quizType
            }));
        }
    }

    broadcastParticipantList(); // Giữ nguyên hàm này

    ws.on('message', async (message) => { // Thêm async ở đây
        try {
            const msg = JSON.parse(message);

            if (msg.type === 'login') {
                ws.username = msg.username;
                broadcastParticipantList();
            } 
            else if (msg.type === 'start') {
                // KHI ADMIN BẮT ĐẦU THI -> TẠO EVENT MỚI
                const quiz = await Quiz.findOne({ quizId: msg.quizId });
                if (quiz) {
                    const newEvent = new Event({
                        quizId: quiz.quizId,
                        quizName: quiz.quizName,
                        quizType: quiz.type,
                        startTime: new Date(msg.startTime),
                        status: 'running',
                    });
                    await newEvent.save();

                    // Lưu event hiện tại vào RAM
                    currentDirectEvent = {
                        eventId: newEvent._id, // QUAN TRỌNG
                        quizId: quiz.quizId,
                        quizName: quiz.quizName,
                        quizType: quiz.type,
                        startTime: newEvent.startTime,
                        timeLimit: msg.timeLimit // timeLimit không lưu trong DB event
                    };

                    // Gửi tin nhắn broadcast như cũ
                    broadcast({
                        type: 'start',
                        ...msg, // Gửi tất cả thông tin cũ
                        quizType: quiz.type // Gửi thêm quizType
                    });
                }
            } 
            else if (msg.type === 'end') {
                // KHI ADMIN KẾT THÚC THI -> CẬP NHẬT EVENT
                if (currentDirectEvent) {
                    await Event.findByIdAndUpdate(currentDirectEvent.eventId, {
                        status: 'completed',
                        endTime: new Date()
                    });
                    currentDirectEvent = null; // Xóa event khỏi RAM
                }

                // Lấy kết quả cho event vừa kết thúc và broadcast
                // (Bạn có thể bỏ qua phần này nếu không cần thiết)

                broadcast({ type: 'end' });
            } 
            else if (msg.type === 'heartbeat') {
                broadcast({ type: 'heartbeat_pulse' });
            }

        } catch (err) {
            console.error('Error processing WebSocket message:', err);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        broadcastParticipantList();
    });
});
};

function broadcast(message) {
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN is 1
      client.send(JSON.stringify(message));
    }
  });
}

startServer();