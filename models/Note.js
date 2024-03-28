const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

mongoose.connect('mongodb://127.0.0.1:27017/suntecED');

const NoteSchema = new Schema({
    type: {
        type: String,
        default:'note'
    },
    date: Date,
    note: String,
    employee:{
        type:Schema.Types.ObjectId,
        ref: 'Employee',
    },
    timeLogged:Date,
})

const Note = mongoose.model('Note', NoteSchema);

module.exports = Note;