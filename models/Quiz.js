const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Đây là "luật" cho một Đề thi
const quizSchema = new mongoose.Schema({
    // Chúng ta giữ quizId để tương thích 100% với file quiz.js
    quizId: { 
        type: String, 
        default: uuidv4, 
        unique: true, 
        index: true 
    },
    quizName: String,
    type: { 
        type: String, 
        enum: ['toeic', 'custom'], 
        default: 'toeic' 
    },
    quizPdfUrl: String,
    
    // Dùng cho đề TOEIC
    audio: {
        part1: String,
        part2: String,
        part3: String,
        part4: String,
    },
    answerKey: mongoose.Schema.Types.Mixed, // Dùng Mixed để chấp nhận cả {q1: 'A'} và "A,B,C"
    
    // Dùng cho đề Custom
    totalQuestions: Number,
    listeningRanges: [
        {
            from: Number,
            to: Number,
            audioUrl: String
        }
    ],

    // Dùng cho client
    isAssigned: { type: Boolean, default: false },
    timeLimit: Number,
    partVisibility: mongoose.Schema.Types.Mixed,

    // Thông tin quản lý
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
});

// Tạo model
const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;