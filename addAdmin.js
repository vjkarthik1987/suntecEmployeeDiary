
const Employee           = require('./models/Employee');
const mongoose           = require('mongoose');
const username = 'aravindanv';
async function addAdmin(username){
    let employee = await Employee.find({username: username}).exec();
    employee = employee[0];
    console.log(employee);
    employee.isAdmin = true;
    console.log(employee);
    await employee.save();
}

addAdmin(username);

