const isAdmin = (req, res, next) => {
    if(!req.user.isAdmin) {
        req.flash('error', 'You must be an admin to access this page');
        return res.redirect('/home');
    }
    next();
}

module.exports = isAdmin;