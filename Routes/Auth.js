const router= require('express').Router();
const conn=require("../db/connection");
const util=require("util");//helper in queries 
const bcrypt=require("bcrypt");
const { body, validationResult } = require('express-validator'); 
const crypto = require("crypto");
const CryptoJS = require('crypto-js');
const upload = require("../middleware/uploadImages");
// const upload = require("../middleware/uploadimaages2");
const fs = require("fs");
// const adminAuth = require("../middleware/admin");
const path = require("path");
const { promises } = require('dns');
//==========================================  Registeration  ==========================================//

const registrationValidationRules = [
    body('userName').isString().notEmpty().withMessage('userName is required').isLength({ min: 8 , max:20 }).withMessage('name must be at least 8 characters long and 20 in maximum'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('opassword').isLength({ min: 8 , max:20 }).withMessage('Password must be at least 8 characters long and 20 in maximum'),
    body('phone').isLength({ min: 11 , max:11 }).withMessage('phone number must be 11 number'),
    body('nationalID').isLength({ min: 14 , max:14 }).withMessage('please enter valid national ID')
];
async function encryptNumber(number,key) {
    const ciphertext = CryptoJS.AES.encrypt(number.toString(), key);
    return ciphertext.toString();
}

async function decryptNumber(encrypted,key) {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return parseInt(plaintext);
}


router.post("/register",upload.array("images"),registrationValidationRules,async (req,res)=>{// completed
    try {
        if (!req.files[0] && !req.files[1]) {
        return res.status(400).json({
            errors: [{
                msg:"Two images required"
            }]
        })
    } 
//============ Extract data from the request body ============
    const {  email, opassword, phone, type, userName, nationalID } = req.body;
        // Check if there are any validation errors
    const errors = validationResult(req);
        if (!errors.isEmpty()) {
            await Promise.all(req.files.map(async (ele) => {
            await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
        }))
        // await fs.unlink("./upload/" + req.files[1].filename);//delete image
        return res.status(400).json({ errors: errors.array() });
    }
//============ check phone number ============
    const phone2=phone.toString();
    const phone3= phone2.substring(0,3);
        if (!(phone3 == "011" || phone3 == "012" || phone3 == "010")) {
            await Promise.all(req.files.map(async (ele) => {
            await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
        }))
        return res.status(400).json({ errors:{
            msg:"phone number must starts with 012 or 011 or 010",
        } });
    }
        
//============ check if the user name exists ============
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const userNameExists= await query("select * from users where userName=?",userName);
        if (userNameExists[0]) {
            console.log(path.join(__dirname))
        await Promise.all(req.files.map(async (ele) => {
            await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
        }))
            
        return res.status(400).json({
            msg:"invalid user name"
        });
    }
//============ check email existes in users && userpinding ============
    const emailexists=await query("select * from users where email = ?",email);
        if (emailexists[0]) {
        await Promise.all(req.files.map(async (ele) => {
            await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
        }))
        return res.status(400).json({
            errors:{
                msg:"email already exists !"
            }
        })
    }
//============ check phone existes in users && userpinding ============
    const phoneExists=await query("select * from users where phone = ?",phone);
        if (phoneExists[0]) {
        await Promise.all(req.files.map(async (ele) => {
            await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
        }))
        return res.status(400).json({
            errors:{
                msg:"phone already exists !"
            }
        })
    }
//============ check National id existes in users && userpinding ============
        const usersess = await query("select email,nationalID  from users")
        let erorres=false;
        await Promise.all(usersess.map(async (ele) => {
            console.log(await decryptNumber(ele.nationalID, ele.email))
            if (nationalID == await decryptNumber(ele.nationalID, ele.email)) {
                erorres = true;
            }
        }))
        if (erorres) {
        await Promise.all(req.files.map(async (ele) => {
            await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
        }))
        return res.status(400).json({
            errors:{
                msg:"national ID already exists !"
            }
        })
    }
        // return res.status(200).json("hello");


    
//============ Implement logic for registering user ============
    const userData={
        userName:userName,
        email:email,
        password:await bcrypt.hash(opassword,10),
        token:crypto.randomBytes(16).toString("hex"),//to now is an admin or not and is loged or not 
        type:type,
        phone: phone,
        image_ID: req.files[0].filename,
        }
        userData.nationalID=await encryptNumber(nationalID,userData.email),
        await query("insert into users set ?", userData);
        
        
        const alluserData = await query("select * from users where phone=? ", phone);
        const auth56 = {
            USER_ID: alluserData[0].id,
            RImage:req.files[1].filename
        }
        await query("insert into recognitionandotp set ?", auth56);
//============ Return success response without password ============

    delete userData.password;
    // delete userData.status;
        return res.status(200).json({
        msg:"registered successfully waiting for admin approval and when i happen we will send you a SMS message to conform or refuse "
    });
    } catch(err){
        return res.status(500).json({
            errors:{
                msg:"something went wrong :"+err
            }
        });
    }
});

//========================================== LOGIN ==========================================//
// the purpose of login to get the token from the db of a spicific user to use it in APIs that permitted to this user //
// the type of login api is post not get for security reasons














const loginValidationRules = [body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 8 , max:20 }).withMessage('Password must be at least 8 characters long and 20 in maximum')];

router.post("/login",loginValidationRules,async (req,res)=>{// completed
    try{
    //============ Extract data from the request body ============
    const {email, password} = req.body;
    //============ Check if there are any validation errors ============
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    //============ check email existes in users ============
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const user=await query("select * from users where email = ?",[email]);
    if(user.length == 0){
        return res.status(404).json({
            errors:{
                msg:"email or password not found or your account refused !"
            }
        });
    }
    
    //============ compare hashed password ============
    const checkedPassword=await bcrypt.compare(password, user[0].password);
    const checkIsActive=user[0].status;
    if(checkedPassword && checkIsActive){
//============ Return success response without (password && status) ============
        delete user[0].status;
        delete user[0].password;
        delete user[0].nationalID;
        delete user[0].image_ID;
        delete user[0].candidate;
        return res.status(200).json(user[0])

    }
    else{
        return res.status(400).json({
            errors:[{
                msg:"email or password not found !"
            },{
                msg2:"or your account is not activated "
            }]
        });
    }

    } catch(err){
        return res.status(500).json({
            errors:{
                msg:"something went wrong :"+err
            }
        });
        console.log(err);
    }
});

//================================= END =================================//


// router.post("",(req,res)=>{
//     try{
        
//     }catch(err){
//         res.status(500).json({
//             errors:{
//                 msg:"something went wrong :"+err
//             }
//         });
//     }
// });



// const upload = multer({ dest: 'uploads/' });
// router.post("/register", upload.single("image"),registrationValidationRules,async (req,res)=>{// completed
//     try {
//         if (!req.file) {
//             return res.status(400).json({
//                 errors: [{
//                     msg:"image required"
//                 }]
//             })
//         }
// //============ Extract data from the request body ============
//     const {  email, opassword, phone, type, userName, nationalID } = req.body;
//         // Check if there are any validation errors
//     const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(400).json({ errors: errors.array() });
//     }
// //============ check phone number ============
//     const phone2=phone.toString();
//     const phone3= phone2.substring(0,3);
//         if (!(phone3 == "011" || phone3 == "012" || phone3 == "010")) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(400).json({ errors:{
//             msg:"phone number must starts with 012 or 011 or 010",
//         } });
//     }
    
// //============ check if the user name exists ============
//     const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//     const userNameExists= await query("select * from users where userName=?",userName);
//         if (userNameExists[0]) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(401).json({
//             msg:"invalid user name"
//         });
//     }

// //============ check email existes in users && userpinding ============
//     const emailexists=await query("select * from users where email = ?",email);
//         if (emailexists[0]) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(400).json({
//             errors:{
//                 msg:"email already exists !"
//             }
//         })
//     }
// //============ check phone existes in users && userpinding ============
//     const phoneExists=await query("select * from users where phone = ?",phone);
//         if (phoneExists[0]) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(400).json({
//             errors:{
//                 msg:"phone already exists !"
//             }
//         })
//     }
// //============ check National id existes in users && userpinding ============
//     const nationalIDExists=await query("select * from users where nationalID = ?",await encryptNumber(nationalID,email));
//         if (nationalIDExists[0]) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(400).json({
//             errors:{
//                 msg:"national ID already exists !"
//             }
//         })
//     }
    

    
// //============ Implement logic for registering user ============
//     const userData={
//         userName:userName,
//         email:email,
//         password:await bcrypt.hash(opassword,10),
//         token:crypto.randomBytes(16).toString("hex"),//to now is an admin or not and is loged or not 
//         type:type,
//         phone: phone,
//         image_ID: req.file.filename,
//         }
//         userData.nationalID=await encryptNumber(nationalID,userData.email),
//     await query("insert into users set ?",userData);
// //============ Return success response without password ============

//     delete userData.password;
//     // delete userData.status;
//         return res.status(200).json({
//         msg:"registered successfully waiting for admin approval"
//     });
//     } catch(err){
//         res.status(500).json({
//             errors:{
//                 msg:"something went wrong :"+err
//             }
//         });
//         console.log(err);
//     }
// });



module.exports = router;





// router.post("/register",upload.array("images"),registrationValidationRules,async (req,res)=>{// completed
//     try {
//         if (!req.files[0] && !req.files[1]) {
//         return res.status(400).json({
//             errors: [{
//                 msg:"Two images required"
//             }]
//         })
//     } 
// //============ Extract data from the request body ============
//     const {  email, opassword, phone, type, userName, nationalID } = req.body;
//         // Check if there are any validation errors
//     const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             await Promise.all(req.files.map(async (ele) => {
//             await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
//         }))
//         // await fs.unlink("./upload/" + req.files[1].filename);//delete image
//         return res.status(400).json({ errors: errors.array() });
//     }
// //============ check phone number ============
//     const phone2=phone.toString();
//     const phone3= phone2.substring(0,3);
//         if (!(phone3 == "011" || phone3 == "012" || phone3 == "010")) {
//             await Promise.all(req.files.map(async (ele) => {
//             await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
//         }))
//         return res.status(400).json({ errors:{
//             msg:"phone number must starts with 012 or 011 or 010",
//         } });
//     }
        
// //============ check if the user name exists ============
//     const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//     const userNameExists= await query("select * from users where userName=?",userName);
//         if (userNameExists[0]) {
//             console.log(path.join(__dirname))
//         await Promise.all(req.files.map(async (ele) => {
//             await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
//         }))
            
//         return res.status(400).json({
//             msg:"invalid user name"
//         });
//     }
// //============ check email existes in users && userpinding ============
//     const emailexists=await query("select * from users where email = ?",email);
//         if (emailexists[0]) {
//         await Promise.all(req.files.map(async (ele) => {
//             await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
//         }))
//         return res.status(400).json({
//             errors:{
//                 msg:"email already exists !"
//             }
//         })
//     }
// //============ check phone existes in users && userpinding ============
//     const phoneExists=await query("select * from users where phone = ?",phone);
//         if (phoneExists[0]) {
//         await Promise.all(req.files.map(async (ele) => {
//             await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
//         }))
//         return res.status(400).json({
//             errors:{
//                 msg:"phone already exists !"
//             }
//         })
//     }
// //============ check National id existes in users && userpinding ============
//         const usersess = await query("select email,nationalID  from users")
//         let erorres=false;
//         await Promise.all(usersess.map(async (ele) => {
//             console.log(await decryptNumber(ele.nationalID, ele.email))
//             if (nationalID == await decryptNumber(ele.nationalID, ele.email)) {
//                 erorres = true;
//             }
//         }))
//         if (erorres) {
//         await Promise.all(req.files.map(async (ele) => {
//             await fs.promises.unlink(path.join(__dirname,"../upload/" + ele.filename),);//delete image
//         }))
//         return res.status(400).json({
//             errors:{
//                 msg:"national ID already exists !"
//             }
//         })
//     }
//         // return res.status(200).json("hello");


    
// //============ Implement logic for registering user ============
//     const userData={
//         userName:userName,
//         email:email,
//         password:await bcrypt.hash(opassword,10),
//         token:crypto.randomBytes(16).toString("hex"),//to now is an admin or not and is loged or not 
//         type:type,
//         phone: phone,
//         image_ID: req.files[0].filename,
//         }
//         userData.nationalID=await encryptNumber(nationalID,userData.email),
//         await query("insert into users set ?", userData);
        
        
//         const alluserData = await query("select * from users where phone=? ", phone);
//         const auth56 = {
//             USER_ID: alluserData[0].id,
//             RImage:req.files[1].filename
//         }
//         await query("insert into recognitionandotp set ?", auth56);
// //============ Return success response without password ============

//     delete userData.password;
//     // delete userData.status;
//         return res.status(200).json({
//         msg:"registered successfully waiting for admin approval"
//     });
//     } catch(err){
//         return res.status(500).json({
//             errors:{
//                 msg:"something went wrong :"+err
//             }
//         });
//         console.log(err);
//     }
// });
