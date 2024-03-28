const mongoose           = require('mongoose');
const Employee           = require('../models/Employee');
const empData            = require('./empData');

async function addInitData() {
    for (const employee of empData) { 
        const username = employee.email.split('@')[0];
        const {empID, name, email, managerEmail, functionHeadEmail, role} = employee;
        const newEmployee = new Employee({
            empID,
            name,
            username,
            email,
            managerEmail,
            functionHeadEmail,
            role,
        })
        const savedEmployee = await Employee.register(newEmployee, username);
        console.log(savedEmployee.name, ' Saved');
    }
}

addInitData();
