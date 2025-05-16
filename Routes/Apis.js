const rooter= require('express').Router();
const conn=require("../db/connection");
const util=require("util");//helper in queries 
// const bcrypt=require("bcrypt");
const { body, validationResult } = require('express-validator'); 
// const crypto = require("crypto");
const CryptoJS = require('crypto-js');
const adminAuth =require("../middleware/admin");
// const timeAuth =require("../middleware/timeAuth");
// const upload = require("../middleware/uploadImages");
const { Vonage } = require('@vonage/server-sdk');
const fs = require("fs");
require('dotenv').config();

//================================= get inActive users =================================//
async function decryptNumber(encrypted,key) {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return parseInt(plaintext);
}



const vonage = new Vonage({
    apiKey: process.env.vonage_API_KEY,
    apiSecret: process.env.vonage_API_SECRET
})
const from = process.env.vonage_FROM
const to = process.env.vonage_TO// because we use a free trial account so we can send messages only for this phone 

async function sendOTP(text) {
    await vonage.sms.send({to, from, text})
        .then(resp => { console.log('Message sent successfully'); console.log(resp); })
        .catch(err => { console.log('There was an error sending the messages.'); console.error(err); });
}


rooter.get("/inactive",adminAuth,async (req,res)=>{// completed
    try{
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const userss=await query("select * from users where status = 0");

    if(!userss[0]){
        return res.status(404).json({
                errors: [{
                    msg:"No users have an in-active state !"
                }]
                
            })
    }
    else {
        const fun = async (elemn) => {
            const userRimage=await query("select RImage from recognitionandotp where USER_ID=? ",elemn.id)
            console.log(userRimage[0])
            delete elemn.status;
            elemn.nationalID = await decryptNumber(elemn.nationalID,elemn.email);
            delete elemn.password;
            elemn.image_ID = "http://" + req.hostname + ":4000/upload/" + elemn.image_ID;
            elemn.image_R = "http://" + req.hostname + ":4000/upload/" + userRimage[0].RImage;
            
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
// rooter.get("/inactive",adminAuth,async (req,res)=>{// completed
//     try{
//         const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//         const now = new Date();
//         const selection = await query("select *  from initiatselection where id=1");
//         const times = {
//             start_time: selection[0].startTime,
//             end_time: selection[0].endTime,
//             now :now
//         }
//         res.status(200).json(times);
//     } catch (err) {
//         res.status(500).json({
//             errors:[{
//                 msg:"something went wrong :"+err
//             }]
//         });
//     }
// });

//================================= set in-Active users to active state  =================================//

const AIValidationRules = [body('id').isInt().notEmpty().withMessage("id is required with an integer form")];

rooter.post("/:operation",AIValidationRules, adminAuth, async (req, res) => {//completed
    try{
        const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
        const { id } = req.body;

//check user exists AND check if the user is in-active
        const usere= await query("select status from users where id= ?",id);
        if ((!Boolean(usere.length))) {
            
            return res.status(400).json({
                errors: [{
                    msg:"user not found or other admins rejects him "
                }]
                
            })
        }
        if (usere[0].status) {
            return res.status(400).json({
                errors: [{
                    msg:"The user has already activated please refresh the page"
                }]
            })
        }
        if (req.params.operation == 1) {
            await query("update users set status = 1 where id =? ", id);
            // sendOTP("Your account is activated now you can vote whenever there is a selection")
            return res.status(200).json({
                msg: " user activated successfuly"
            });
        } else {
            if (req.params.operation == 0) {
            fs.unlinkSync("./upload/" +usere[0].image_ID);//delete image
                await query("delete from users where id = ? ", id);
            // sendOTP("Unfortunately, the administrator has deleted your account, please go to the nearest police station to take appropriate action")
            return res.status(200).json({
                msg: " user deleted successfuly",
                
            });
        } else{
        return res.status(400).json({
            errors: [{
                msg:"invalid operation !"
            }]
            
        })
    }}

    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});



//========================== END ==========================//
module.exports= rooter;
// Define a route for handling registration requests

// rooter.post("",(req,res)=>{
//     try{
        
//     }catch(err){
//         res.status(500).json({
//             errors:{
//                 msg:"something went wrong :"+err
//             }
//         });
//     }
// });

// //================================= view transactions  =================================//
// rooter.get("/view",adminAuth,async (req,res)=>{//  completed
//     try{
//         const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//         const items=await query("select * from usersitems where itemstatus = ?",0);

//         const configurePro = async (ele)=>{
//             let seller=await query("select userName from users where id = ?",ele.id_user);
//             ele.userName=seller[0].userName;
//             delete ele.itemstatus;
//             delete ele.id_user;
//         };
//         //because map is synchronous and you are trying to asynchronous operation in it it returns
//         //array of promises so you maust put await on promise.all to achive all promises at once
//         await Promise.all( items.map(configurePro));
//         res.status(200).json(items);
        
//     }catch(err){
//         res.status(500).json({
//             errors:[{
//                 msg:"something went wrong :"+err
//             }]
//         });
//     }
// });