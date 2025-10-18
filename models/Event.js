const mongoose = require('mongoose');

// Đây là "luật" cho một Sự kiện Thi (Lịch sử)
const eventSchema = new mongoose.Schema({
    // Chúng ta lưu quizId (String) để dễ dàng truy vấn
    quizId: { 
        type: String, 
        index: true 
    }, 
    quizName: String, // Lưu tên để hiển thị lịch sử cho nhanh
    quizType: String,
    startTime: { 
        type: Date, 
        default: Date.now 
    },
    endTime: Date,
    status: { 
        type: String, 
        enum: ['running', 'completed'], 
        default: 'running' 
    }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;