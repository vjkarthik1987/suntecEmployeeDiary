const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

mongoose.connect('mongodb://127.0.0.1:27017/suntecED');

const OutcomeSchema = new Schema({
    outcomeHeading: String,
    outcome: String,
    effort: Number,
    selfRating: Number,
    planEndDate: Date,
    actualEndDate: Date,
    managerFeedback: String,
    managerRating: Number,
    employee:{
        type:Schema.Types.ObjectId,
        ref: 'Employee',
    },
})

const Outcome = mongoose.model('Outcome', OutcomeSchema);

module.exports = Outcome