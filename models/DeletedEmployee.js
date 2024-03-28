const mongoose              = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose')
const Schema                = mongoose.Schema;

mongoose.connect('mongodb://127.0.0.1:27017/suntecED');

const DeletedEmployeeSchema = new Schema({
    empID: String,
    name: String,
    email: {
        type:String,
        unique: true,
        required: true,
    },
    managerEmail: String,
    functionHeadEmail: String,
    team: String,
    function: String,
    role: String,
    diaryEntries: [{
        type: Schema.Types.ObjectId,
        ref:'DiaryEntry',
    }],
    outcomes: [{
        type: Schema.Types.ObjectId,
        ref: 'Outcome',
    }],
    notes:[{
        type: Schema.Types.ObjectId,
        ref: 'Note',
    }],
    isAdmin: Boolean,    
})

DeletedEmployeeSchema.plugin(passportLocalMongoose);

const DeletedEmployee = mongoose.model('DeletedEmployee', DeletedEmployeeSchema);

module.exports = DeletedEmployee;