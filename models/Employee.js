const mongoose              = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose')
const Schema                = mongoose.Schema;

mongoose.connect('mongodb://127.0.0.1:27017/suntecED');

const EmployeeSchema = new Schema({
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
    assignedOutcomes: [{
        type: Schema.Types.ObjectId,
        ref: 'AssignedOutcome',
    }],
    isAdmin: Boolean,    
})

EmployeeSchema.plugin(passportLocalMongoose);

const Employee = mongoose.model('Employee', EmployeeSchema);

module.exports = Employee;