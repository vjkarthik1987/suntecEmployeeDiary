const express            = require('express');
const ejsMate            = require('ejs-mate');
const path               = require('path');
const bodyParser         = require('body-parser');
const session            = require('express-session');
const flash              = require('express-flash');
const methodOverride     = require('method-override');
const passport           = require('passport');
const LocalStrategy      = require('passport-local');
const mongoose           = require('mongoose');
const app                = express();

const DiaryEntry         = require('./models/DiaryEntry');
const Outcome            = require('./models/Outcome');
const Employee           = require('./models/Employee');
const DeletedEmployee    = require('./models/DeletedEmployee');
const Note               = require('./models/Note');
const allowedWeekStrings = require('./models/allowedWeekStrings')

const isLoggedIn         = require('./middlewares/isLoggedIn');
const isAdmin            = require('./middlewares/isAdmin');
const catchAsync         = require('./utils/catchAsync');
const ExpressError       = require('./utils/ExpressError');

require('dotenv').config();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    next();
})
app.use(methodOverride('_method'))

// Passport configuration
passport.use(new LocalStrategy(Employee.authenticate()));
passport.serializeUser(Employee.serializeUser());
passport.deserializeUser(Employee.deserializeUser());

//Main routes
app.get('/', (req, res) => {
    if(req.user) {
        res.redirect('/home');
    }
    else {
        res.render('./gen/index');
    }
})

app.get('/home', isLoggedIn, catchAsync(async (req, res) => {
    const currentUserID = req.user._id;
    const diaryEntries = await DiaryEntry.find({ employee: currentUserID })
        .sort({ _id: -1 })
        .limit(6)
        .exec();
    const outcomes = await Outcome.find({ employee: currentUserID })
        .sort({ _id: -1 })
        .limit(6)
        .exec();
    const outcomeCount = await Outcome.countDocuments({ employee: currentUserID });
    const user = req.user;

    //Calculate average self rating
    const aggregateResult = await Outcome.aggregate([
        {
            $match: { employee: currentUserID }
        },
        {
            $group: {
                _id: null,
                averageSelfRating: { $avg: "$selfRating" }
            }
        }
    ]);
    let averageSelfRating = 0;
    if (aggregateResult.length > 0) {
        averageSelfRating = Math.round(aggregateResult[0].averageSelfRating*100)/100;
    }

    //Calculate average manager rating
    const aggregateManagerResult = await Outcome.aggregate([
        {
            $match: { employee: currentUserID }
        },
        {
            $group: {
                _id: null,
                averageManagerRating: { $avg: "$managerRating" }
            }
        }
    ]);
    let averageManagerRating = 0;
    if (aggregateResult.length > 0) {
        averageManagerRating = Math.round(aggregateManagerResult[0].averageManagerRating*100)/100;
    }

    res.render('./gen/home', {diaryEntries, outcomes, outcomeCount, averageSelfRating, averageManagerRating, user});
}))

//Diary Entry routes
app.get('/diaryEntry/new', isLoggedIn, catchAsync(async(req, res) => {
    const user = req.user;
    const existingDiaryEntries = await DiaryEntry.find({ employee: user._id }).distinct('forWeek');
    res.render('./diaryEntry/newDiaryEntry',{allowedWeekStrings, existingDiaryEntries})
}))

app.post('/diaryEntry/', isLoggedIn, catchAsync(async(req, res) => {
    const {forWeek, thisWeek, learnings, nextWeek, noOutcome} = req.body;
    const timeLogged = new Date();
    const newDiaryEntry = new DiaryEntry({
        forWeek, thisWeek, learnings, nextWeek, timeLogged, employee: req.user._id,
    })
    await newDiaryEntry.save();
    req.user.diaryEntries.push(newDiaryEntry._id);
    await req.user.save();
    req.flash('success', 'Diary Entry added successfully')
    if(noOutcome){
        res.redirect('/home');
    }
    else {
        res.redirect('/outcome/new')
    }
}))

//Outcome routes
app.get('/outcome/new', isLoggedIn, catchAsync(async(req, res) => {
    res.render('./outcome/newOutcome');
}))

app.post('/outcome', isLoggedIn, catchAsync(async (req, res) => {
    const { outcomeHeading, outcome, effort, selfRating } = req.body;
    const planEndDate = new Date(req.body.planEndDate);
    const actualEndDate = new Date(req.body.actualEndDate);
    const saveAndAddAnother = req.body.saveAndAddAnother === 'true';
    const newOutcome = new Outcome({
        outcome,
        outcomeHeading,
        effort,
        selfRating,
        employee: req.user._id,
        planEndDate,
        actualEndDate
    });
    await newOutcome.save();
    req.user.outcomes.push(newOutcome._id);
    await req.user.save();
    req.flash('success', 'Outcome added successfully')
    if (saveAndAddAnother) {
        req.flash('success', 'Outcome saved successfully');
        res.redirect('/outcome/new');
    } else {
        res.redirect('/home');
    }
}))

//Note
app.get('/note/new', isLoggedIn, (req, res) => {
    res.render('./note/newNote');
})

app.post('/note', isLoggedIn, catchAsync(async (req, res) => {
    const {note} = req.body;
    const date = new Date(req.body.date);
    const timeLogged = new Date();
    const employee = req.user._id;
    const newNote = new Note({
        date,
        note,
        employee,
        timeLogged,
    });
    await newNote.save();
    req.user.notes.push(newNote._id);
    await req.user.save();
    req.flash('success', 'Note added successfully');
    res.redirect('/home');
}))

//Auth
app.get('/auth/login', catchAsync(async(req, res) => {
    res.render('./auth/login')
}))

app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { 
            return next(err); 
        }
        if (!user) { 
            req.flash('error', 'Invalid email or password');
            return res.redirect('/auth/login');
        }
        req.logIn(user, (err) => {
            if (err) { 
                return next(err); 
            }
            req.flash('success', 'Logged in successfully');
            return res.redirect('/home');
        });
    })(req, res, next);
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            // Handle error if logout fails
            console.error(err);
            req.flash('error', 'Logout failed');
            res.redirect('/'); // Redirect to the home page or any other appropriate route
        } else {
            req.flash('success', 'Goodbye!');
            res.redirect('/'); // Redirect to the home page or any other appropriate route
        }
    });
});

//Employee routes
app.get('/employee/diaryEntries', isLoggedIn, catchAsync(async(req, res) => {
    const id = req.user._id;
    const employee = await Employee.findById(id).populate({
        path: 'diaryEntries',
        options: { sort: { _id: -1 } } // Sort by _id field in descending order
    });
    const employeeNotes = await Employee.findById(id). populate({
        path:'notes',
        options: { sort: {_id: -1}}
    });
    res.render('./employee/diaryEntries', {employee, employeeNotes});
}))

app.get('/employee/outcomes', isLoggedIn, catchAsync(async(req, res) => {
    const id = req.user._id;
    const employee = await Employee.findById(id).populate({
        path: 'outcomes',
        options: { sort: { _id: -1 } } // Sort by _id field in descending order
    });
    res.render('./employee/outcomes', {employee});
}))

app.get('/employee/profile', isLoggedIn, catchAsync(async(req, res) => {
    const id = req.user._id;
    const employee = await Employee.findById(id);
    const diaryEntriesCount = employee.diaryEntries.length;
    const outcomeCount = employee.outcomes.length;
    res.render('./employee/profile', {employee, diaryEntriesCount, outcomeCount});
}))

app.get('/employee/changePassword', isLoggedIn, (req, res) => {
    res.render('./employee/changePassword');
})

app.post('/employee/changePassword', isLoggedIn, catchAsync(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Check if the new password matches the confirm password
    if (newPassword !== confirmPassword) {
        req.flash('error','New password and confirm password do not match');
        return res.redirect('/employee/changePassword');
    }

    // Use Passport's changePassword method to update the password
    req.user.changePassword(oldPassword, newPassword, (err) => {
        if (err) {
            req.flash('error', 'Incorrect old password');
            return res.redirect('/employee/changePassword');
        }

        req.flash('success', 'Password updated successfully');
        res.redirect('/home');
    });
}));

//Manager routes
app.get('/manager/reporteeList', isLoggedIn, catchAsync(async (req, res) => {
    try {
        const currentUserEmail = req.user.email;
        const reporteeList = await Employee.find({ managerEmail: currentUserEmail }).exec();

        const employeeData = [];

        for (const reportee of reporteeList) {
            const totalOutcomes = await Outcome.countDocuments({ employee: reportee._id }).exec();
            const totalDiaryEntries = await DiaryEntry.countDocuments({ employee: reportee._id }).exec();

            const aggregateResultSelfRating = await Outcome.aggregate([
                { $match: { employee: reportee._id } },
                { $group: { _id: null, averageSelfRating: { $avg: "$selfRating" } } }
            ]).exec();

            let averageSelfRating = 0;
            if (aggregateResultSelfRating.length > 0) {
                averageSelfRating = Math.round(aggregateResultSelfRating[0].averageSelfRating * 100) / 100;
            }

            const aggregateResultManagerRating = await Outcome.aggregate([
                { $match: { employee: reportee._id, managerRating: { $ne: null } } },
                { $group: { _id: null, averageManagerRating: { $avg: "$managerRating" } } }
            ]).exec();

            let averageManagerRating = 0;
            if (aggregateResultManagerRating.length > 0) {
                averageManagerRating = Math.round(aggregateResultManagerRating[0].averageManagerRating * 100) / 100;
            }

            const pendingManagerRatingOutcomes = totalOutcomes - await Outcome.countDocuments({ employee: reportee._id, managerRating: { $ne: null } }).exec();

            employeeData.push({
                employee: reportee,
                totalOutcomes,
                totalDiaryEntries,
                averageSelfRating,
                averageManagerRating,
                pendingManagerRatingOutcomes
            });
        }

        res.render('./manager/reporteeList', { employeeData });
    } catch (error) {
        console.error("Error fetching reportee list:", error);
        req.flash('error', 'Failed to fetch reportee list');
        res.redirect('/home'); // Redirect to home page or handle the error appropriately
    }
}));

app.get('/manager/employee/:id', isLoggedIn, catchAsync(async(req, res) => {
    const id = req.params.id;
    const employee = await Employee.find({_id:id}).populate('diaryEntries').populate('outcomes');
    res.render('./manager/singleEmployee', {employee});
}))

app.get('/manager/employee/:employeeID/outcome/:outcomeID/giveFeedback', isLoggedIn, catchAsync(async(req, res) => {
    const employeeID = req.params.employeeID;
    const outcomeID = req.params.outcomeID;
    const employee = await Employee.findById(employeeID).populate('outcomes');
    const outcome = await employee.outcomes.find(outcome => outcome._id.toString() === outcomeID);
    res.render('./manager/giveFeedback', {employee, outcome});
}))

app.patch('/manager/employee/:employeeID/outcome/:outcomeID', isLoggedIn, catchAsync(async(req, res) => {
    const {managerFeedback, managerRating}  = req.body;
    const employeeID = req.params.employeeID;
    const outcomeID = req.params.outcomeID;
    const employee = await Employee.findById(employeeID).populate('outcomes');
    const outcome = await employee.outcomes.find(outcome => outcome._id.toString() === outcomeID);
    outcome.managerFeedback = managerFeedback;
    outcome.managerRating = managerRating;
    await outcome.save();
    await employee.save();
    const redirectUrl = "/manager/employee/"+employeeID;
    res.redirect(redirectUrl);
}))

app.get('/manager/employee/:id/diary', isLoggedIn, catchAsync(async (req, res) => {
    try {
        const id = req.params.id;
        const employee = await Employee.findById(id)
            .populate({
                path: 'diaryEntries',
                options: { sort: { _id: -1 } }
            })
            .populate({
                path: 'notes',
                options: { sort: { _id: -1 } }
            })
            .exec();
            res.render('./manager/employeeDiary', {employee})
    } catch (error) {
        console.error("Error:", error);
        // Handle the error appropriately
        res.status(500).send("Internal Server Error");
    }
}));

//Admin routes
app.get('/admin/home', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    res.render('./admin/adminHome');
}))

app.get('/admin/userDetails', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    try {
        const employees = await Employee.find({}).populate({
            path: 'outcomes',
            select: 'selfRating managerRating',
            model: 'Outcome'
        }).exec();

        const distinctTeams = [...new Set(employees.map(employee => employee.team))];
        // Loop through each employee to calculate ratings
        for (let i = 0; i < employees.length; i++) {
            const manager = await Employee.findOne({ email: employees[i].managerEmail }).exec();
            if (manager) {
                employees[i].managerName = manager.name;
            } else {
                employees[i].managerName = 'Unknown'; // Set default if manager not found
            }

            let selfRatingSum = 0;
            let managerRatingSum = 0;

            for (let j = 0; j < employees[i].outcomes.length; j++) {
                selfRatingSum += employees[i].outcomes[j].selfRating;
                managerRatingSum += employees[i].outcomes[j].managerRating;
            }

            // Calculate average self rating and average manager rating
            employees[i].averageSelfRating = selfRatingSum / employees[i].outcomes.length;
            employees[i].averageManagerRating = managerRatingSum / employees[i].outcomes.length;
        }

        res.render('./admin/userDetails', { employees, distinctTeams });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.render('./gen/error');
    }
}));

app.get('/admin/pendingDiaryEntries/selectWeek', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    res.render('./admin/pendingDiaryEntries', {allowedWeekStrings});
}))

app.get('/admin/pendingDiaryEntries/list/:dateString', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const dateString = req.params.dateString;

    try {
        // Find all employees
        const employees = await Employee.find({}).exec();

        // Filter employees who have not entered a diary entry for the specified date string
        const employeesWithPendingDiaryEntries = await Promise.all(employees.map(async (employee) => {
            const diaryEntries = await DiaryEntry.find({ employee: employee._id, forWeek: dateString }).exec();
            if (diaryEntries.length === 0) {
                return employee;
            }
        }));

        // Remove undefined values from the array
        const filteredEmployees = employeesWithPendingDiaryEntries.filter(Boolean);

        res.render('./admin/pendingDiaryEntryList', { filteredEmployees, dateString });
    } catch (err) {
        console.error("Error fetching pending diary entries:", err);
        res.render('./gen/error');
    }
}));

app.get('/admin/pendingManagerRatings', catchAsync(async(req, res) => {
    res.render('./admin/pendingManagerRatings')
}))

app.get('/admin/employee/add', isLoggedIn, isAdmin, (req, res) => {
    res.render('./admin/addEmployee');
})

app.post('/admin/employee', isLoggedIn, isAdmin, catchAsync(async(req, res) => {
    const {empID, name, email, managerEmail, functionHeadEmail, role} = req.body;
    let isAdmin = false;
    const username = email.split('@')[0];
    if(req.body.isAdmin == 'true') {
        isAdmin = true;
    }
    const newEmployee = new Employee({
        empID,
        name,
        username,
        email,
        managerEmail,
        functionHeadEmail,
        role,
        isAdmin
    })
    const savedEmployee = await Employee.register(newEmployee, username);
    req.flash('success', "New Employee Registered Successfully. Please remind the new employee to change password");
    res.redirect('/home')
}))

app.get('/admin/deleteEmployee', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    res.render('./admin/deleteEmployee')
}))

app.get('/admin/search', catchAsync(async (req, res) => {
    const query = req.query.q;
    try {
        // Search for employees whose name matches the query
        const employees = await Employee.find({ name: { $regex: query, $options: 'i' } }).select('_id name');
        res.json(employees);
    } catch (error) {
        console.error('Error searching employees:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));

app.get('/admin/:id', catchAsync(async (req, res) => {
    const employeeId = req.params.id;
    try {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        // Extract the fields you need and send them in the response
        const { name, email, team, managerEmail } = employee;
        res.json({ name, email, team, managerEmail });
    } catch (error) {
        console.error('Error fetching employee details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));

app.delete('/admin/:id', catchAsync(async (req, res) => {
    const employeeId = req.params.id;
    try {
        // Delete the employee by ID
        const deletedEmployee = await Employee.findByIdAndDelete(employeeId);
        if (!deletedEmployee) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));

app.use((err, req, res, next) => {
    res.render('./gen/error');
})

//Start server
app.listen(3000, () => {
    console.log('Started server');
})