const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

mongoose.connect('mongodb://127.0.0.1:27017/suntecED');

const DiaryEntrySchema = new Schema({
    forWeek: String,
    thisWeek: String,
    learnings: String, 
    nextWeek: String,
    employee:{
        type:Schema.Types.ObjectId,
        ref: 'Employee',
    },
    timeLogged:Date,
})

const DiaryEntry = mongoose.model('DiaryEntry', DiaryEntrySchema);

module.exports = DiaryEntry;

