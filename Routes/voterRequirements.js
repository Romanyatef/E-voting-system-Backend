const rootervoter= require('express').Router();
const conn= require("../db/connection.js");
const util= require("util");//helper in queries 
// const bcrypt= require("bcrypt");
const { body, validationResult } = require('express-validator'); 
const recognized = require("../middleware/recognized.js");
const timeAuth = require("../middleware/timeAuth.js");
const upload = require("../middleware/uploadImages");
// const facepp = require("facepp");
const path = require('path');
const fs = require('fs');

async function decryptNumber(encrypted,key) {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return parseInt(plaintext);
}
const voteValidationRules = [
    body('selectionName').isString().notEmpty().withMessage('selection name is required').isLength({ min: 8, max: 20 }).withMessage('name must be at least 8 characters long and 20 in maximum'),
    body("name").isString().notEmpty().withMessage("name required"),
    body("otp").isInt().notEmpty().withMessage("virification code is required"),
];

rootervoter.post("/vote",voteValidationRules,timeAuth,recognized,async (req,res)=>{//completedTwo 
    try{
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        //check verification
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
        }
    // check if the user is voted before 
        const voter1 = res.locals.voter;
        if (voter1.voted) {
            return res.status(400).json({
                errors: [{
                    msg:"you voted before"
                }]
            })
        }
        const userverification=await query("select * from recognitionandotp where USER_ID=? ",voter1.id)

        if (!(Boolean(userverification[0].VRecognized) && parseInt(userverification[0].OTP) == parseInt(req.body.otp))) {
            return res.status(400).json({
                errors: [{
                    msg:"you are not authorized you should first to check face matching is satisfied or wrong verification code"
                }]
            })
        }
        const candidateExists = await query("select * from candidates where name = ?&& voteCStatus=1", req.body.name);
        if(!candidateExists[0]){
            return res.status(404).json({
                errors: [{
                msg:"candidate not found!!"
            }]
            })
        } else {
            if (candidateExists[0].voteCStatus == 0) {
                return res.status(404).json({
                errors: [{
                msg:"The candidate, you provided was not elected!!"
            }]
            })
            }
        }
        const uee = {
            candidate:req.body.name,
            voted:1,
                }
                await query("update users set ? where id =?",[uee,voter1.id]);
        
        return res.status(200).json({
                        msg:"You voted sussessfully "
                });
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

// ================================= view active candidates  ==================================//
rootervoter.get("/view/hello",recognized,async (req,res)=>{//completed 
    try{
        const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        
        const candidates = await query("select * from candidates where voteCStatus=1");
        if (!(candidates[0])) { 
            return res.status(404).json({
            errors:[{
                msg:"no candidates"
            }]
        });
        }
        console.log("hello")
        candidates.map((candidate0) => {
            candidate0.image_url = "http://" + req.hostname + ":4000/upload/"+candidate0.image_url;
        })
        return res.status(200).json(candidates);
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

// ================================= view profile(not good)  ==================================//
rootervoter.get("/profile",recognized,async (req,res)=>{// 
    try{
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        const voter3 = res.locals.voter;
    const userss=await query("select * from users where id = ?",voter3.id);

    if(!userss[0]){
        return res.status(404).json({
                errors: [{
                    msg:"No user !"
                }]
               
            })
    }
    else{
        const fun= async (elemn)=>{
            delete elemn.status;

            elemn.nationalID = await decryptNumber(elemn.nationalID,elemn.image_ID);
            delete elemn.password;
            elemn.image_ID = "http://" + req.hostname + ":4000/upload/"+elemn.image_ID;
        };
        await Promise.all(userss.map(fun));
        
        return res.status(200).json(userss);
    }
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

// ================================= update profile ==================================//
// rootervoter.put("/updateProfile", voterAuth,
//     body('name').isString().notEmpty().withMessage('Name is required').isLength({ min: 3, max: 40 }).withMessage('name must be at least 3 characters long and 40 in maximum'),
//     async (req, res) => {//
//     try {
// // ============ check verification ============
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//         return res.status(400).json({ errors: errors.array() });
//         }
        
//         const admin = res.locals.admin;
//         const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]

// // ============ check if candidate exists ============
//         const candidate2 = await query("select * from candidates where id=?", req.params.id);
//         if (!candidate2[0]) {
//         fs.unlinkSync("./upload/" + req.file.filename);//delete image
//             return res.status(404).json({
//                 errors: [{
//                     msg:"candidate not found"
//                 }]
//             })
//         }

// // ============ prebare candidate check if image sended candidate ============
// const candidate1 = {
//             adminID:admin.id,
//             name: req.body.name,
//         }

// if (req.file) {
//     candidate1.image_url = req.file.filename;
//     fs.unlinkSync("./upload/" + candidate2[0].image_url);//delete image
//         }
// // ============ update candidate ============
        
//         await query("update candidates set ? where id=?",[candidate1,candidate2[0].id]);
//         res.status(200).json({
//             msg:"candidate updated successfully "
//         });
        
//     }catch(err){
//         res.status(500).json({
//             errors:[{
//                 msg:"something went wrong :"+err
//             }]
//         });
//     }
//     });
// ================================= recognize user ==================================//

// async function compare_faces(img1Path, img2Path) {
//     // Load the images from file paths
//     const img1 = await cv.imreadAsync(path.join(__dirname, '..', 'public', img1Path));
//     const img2 = await cv.imreadAsync(path.join(__dirname, '..', 'public', img2Path));
//   // Convert the images to grayscale
//     const gray1 = await cv.cvtColorAsync(img1, cv.COLOR_BGR2GRAY);
//     const gray2 = await cv.cvtColorAsync(img2, cv.COLOR_BGR2GRAY);

//   // Detect faces in the images
//     const faceClassifier = new cv.CascadeClassifier(cv.HAAR_FRONTALFACE_ALT2);
//     const faces1 = await faceClassifier.detectMultiScaleAsync(gray1);
//     const faces2 = await faceClassifier.detectMultiScaleAsync(gray2);

//   // Check that there is exactly one face in each image
//     if (faces1.length !== 1 || faces2.length !== 1) {
//         return false;
//     }

//   // Extract SIFT features from the faces
//     const sift = cv.SIFT_create();
//     const [kp1, des1] = await sift.detectAndComputeAsync(gray1.getRegion(faces1[0]));
//     const [kp2, des2] = await sift.detectAndComputeAsync(gray2.getRegion(faces2[0]));

//   // Match the SIFT features between the faces
//     const bf = new cv.BFMatcher(cv.NORM_L2, false);
//     const matches = bf.knnMatch(des1, des2, 2);

//   // Apply ratio test to filter out false matches
//     const goodMatches = [];
//     matches.forEach(([m, n]) => {
//         if (m.distance < 0.75 * n.distance) {
//             goodMatches.push(m);
//         }
//     });

//   // Calculate the ratio of the number of good matches to the total number of matches
//     const matchRatio = goodMatches.length / matches.length;

//   // Return true if the match ratio is above a threshold, indicating that the faces belong to the same person
//     return matchRatio > 0.5;
// }

// rootervoter.post("/recognize",upload.single("image"),voterAuth,async (req,res)=>{// 
//     try {
//         if (!req.file) {
//             return res.status(400).json({
//                 errors: [{
//                     msg:"image required"
//                 }]
//             })
//         }
//         const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//         const voter = res.locals.voter;       
        
//         result =await  compare_faces(req.file.filename, voter.image_ID);
//         if (!result) {
//             fs.unlinkSync("./upload/" + req.file.filename);//delete image
//             res.status(400).json({
//                 errors: [{
//                     msg:"user not recognized: please enter new one with one face in it"
//                 }]
//             })
//         }
//         await query("update users set image_taked=? && recognized=1  where id=?", [req.file.filename, voter.id]);
//     }catch(err){
//         res.status(500).json({
//             errors:[{
//                 msg:"something went wrong :"+err
//             }]
//         });
//     }
// });
module.exports= rootervoter; 
//api for view all candidates that are in active state

        // if (!(req.params.id)||!Number.isInteger(parseInt(req.params.id))) {
        //     res.status(400).json({ errors: [{
        //             msg:"id must be exist and in numeric form"
        //     }] });
        // }
        //check if candidate exists 

        // const Item1= await query("select * from usersitems where id=?",req.params.id);
        // if((!Item1[0])&&(Item1[0].itemstatus==0)){
                // res.status(404).json({
                // errors: [{
                //     msg:"item not found:"+(!Boolean(Item1[0])),
                //     msg2:"or the bidding on this item is finished :"+ (!Boolean(Item1[0].itemstatus))
                // }]
                        // });
                // }
                // else{
            //         const now = new Date();
            //         const auctionEndDate = Item1[0].time;
            //         if (now >= auctionEndDate) {
            //             await query("update usersItems set itemstatus= ? where id =?",[0,req.params.id]);
            //             res.status(400).json({
            //                 errors: [{
            //                     msg:"Auction has ended"
            // }]
            //             });
            //         }else{
                
                        // const price2 =Item1[0].price;
                        // if(parseInt(req.body.price)>price2){
                            // const bidderName=res.locals.bidder.userName;
                            // itemHistory={
                            //     item_id:req.params.id,
                            //     price:req.body.price,
                            //     name_bidder: bidderName,
                            // }
    
                        // await query("insert into itemhistorypurcase set ?",itemHistory);
    