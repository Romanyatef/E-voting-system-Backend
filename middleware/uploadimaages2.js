const multer = require('multer');
const path = require("path");

const storage = multer.diskStorage({
destination: function (req, file, cb) {
        cb(null,'upload/')
    },
    
filename: function (req, file, cb) {
    // const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    // cb(null, file.fieldname + '-' + uniqueSuffix)
    cb(null, Date.now() + path.extname(file.originalname));
    }
})


const upload = multer({ storage: storage ,limits: { fileSize: 1024 * 1024 * 2 }}).array('images');

module.exports = upload;