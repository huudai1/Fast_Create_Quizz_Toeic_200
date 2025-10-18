const mongoose = require('mongoose');

// Đây là "luật" cho một Bài nộp
const resultSchema = new mongoose.Schema({
    // ID của sự kiện (lấy từ models/Event.js)
    // Dùng để nhóm các bài nộp theo đúng lần thi
    eventId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Event', 
        index: true,
        default: null // Sẽ là null nếu học sinh tự làm (không phải thi trực tiếp)
    }, 
    quizId: { 
        type: String, 
        index: true 
    },
    username: String,
    score: Number,
    totalQuestions: Number, // Tổng số câu của đề thi (để tính % điểm)
    answers: mongoose.Schema.Types.Mixed, // Lưu {q1: 'A', ...}
    submittedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;