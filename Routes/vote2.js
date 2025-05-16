const rootervoter2= require('express').Router();
const conn= require("../db/connection.js");
const util= require("util");//helper in queries 
const { body, validationResult } = require('express-validator'); 
// const voterAuth = require("../middleware/voterAuth.js");
// const timeAuth = require("../middleware/timeAuth.js");
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const recognized = require("../middleware/recognized.js");
const upload = require("../middleware/uploadImages.js");
const adminAuth = require("../middleware/admin");
var facepp = require('face-plusplus-node');
const detectEndpoint = "https://api-us.faceplusplus.com/facepp/v3/detect";
const compareEndpoint = "https://api-cn.faceplusplus.com/facepp/v3/compare";
require('dotenv').config();
facepp.setApiKey(process.env.facepp_API_KEY);
facepp.setApiSecret(process.env.facepp_API_SECRET);





async function generateOTP(token) {
  const buffer = Buffer.from(token, 'base64');
  var time = Math.floor(Date.now() / 30000); // 30-second intervals
  const data = Buffer.alloc(8);
  for (let i = 8; i--; time >>>= 8) {
    data[i] = time;
  }
  const hmac = crypto.createHmac('sha1', buffer);
  hmac.update(data);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = ((digest[offset] & 0x7f) << 24 |
                (digest[offset + 1] & 0xff) << 16 |
                (digest[offset + 2] & 0xff) << 8 |
                (digest[offset + 3] & 0xff)) % 1000000;
  return code.toString().padStart(8, '0');
}


const { Vonage } = require('@vonage/server-sdk');
const { configDotenv } = require('dotenv');

const vonage = new Vonage({
  apiKey: "9da37787",
  apiSecret: "wybDaYkHH5pM4Pzs"
})
const from = "Vonage APIs"
const to = "201223958299"// because we use a free trial account so we can send messages only for this phone 

async function sendOTP(text) {
    await vonage.sms.send({to, from, text})
        .then(resp => { console.log('Message sent successfully'); console.log(resp); })
        .catch(err => { console.log('There was an error sending the messages.'); console.error(err); });
}

//============================== compare faces  ==============================
rootervoter2.post("/compareFaces33",upload.single('image'),recognized, async (req, res) => {
    try {
        
      if (!req.file) {
            return res.status(400).json({
                errors: [{
                    msg:"image required"
                }]
            })
      }
      const {  register  } = req.body;
      
      const query = util.promisify(conn.query).bind(conn);
      var faceResponse1;
      var faceResponse2;
      const USER = res.locals.voter; 
      
      var parameters1 = {  

        return_attributes: 'ethnicity,beauty,eyegaze',

        image_base64: fs.readFileSync(path.join(__dirname, `../upload/${USER.image_ID}`)).toString('base64')
      };
      var parameters2 = {  

        return_attributes: 'ethnicity,beauty,eyegaze',

        image_base64: fs.readFileSync(path.join(__dirname, `../upload/${req.file.filename}`)).toString('base64')

      };
      facepp.post('/detect', parameters1, function (err, res1) {
        if (res1) {
          faceResponse1 = res1;
          facepp.post('/detect', parameters2, function (err, res2) {
            if (res2) {
              faceResponse2 = res2;
              // res.status(200).json(faceResponse2);
              const faceCount1 = faceResponse1.face_num;
              const faceCount2 = faceResponse2.face_num;
        if (faceCount1 !== 1 || faceCount2 !== 1) {
          return res.status(400).json({
            errors: [{
              msg:"Must be one face in each image"
            }]
            
        });
        } else {
          
          var parameters = {
            face_token1: faceResponse1.faces[0].face_token,
            face_token2: faceResponse2.faces[0].face_token,
          };

          facepp.post('/compare', parameters, async function (err, res3) {
            if (res3) {
                  if (res3.confidence >= 80) {
                //     res.status(200).json({
          
                //       images: [{ ...faceResponse1 }, { ...faceResponse2 }],
                //       result: res3.confidence >= 80
                //     }
                // )
                    const generatedOTP = await generateOTP(USER.token);
                    const text = `your verification code is: "${generatedOTP}"`
                    // await sendOTP(text);//sending message
                    
                    const user = {
                      VRecognized:1,
                      VImage: req.file.filename,
                      OTP:generatedOTP
                    }
                    console.log(generatedOTP,USER.id,req.file.filename);
                    await query("update recognitionandotp set ?  where USER_ID =?",[user,USER.id])
                    return res.status(200).json({
                      msg:"we send verification code to your phone please enter the code and vote"
                    });
                  } else {
                    return res.status(400).json({
            errors: [{
              msg:"You are not authorized"
            }]
            
        });
              }
              

            } else {
              return res.status(500).json({
            errors: [{
              msg:err
            }]
            
        });
              
            }
          })
        }
            } else {
              return res.status(500).json({
            errors: [{
              msg:err
            }]
            
        });
            }
          })

        } else {
          return res.status(500).json({
            errors: [{
              msg:err
            }]
            
        });
        }



      })


    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal server error");
    }
});

// ================================= Get uncounted votes=================================
rootervoter2.get("/uncountedvotes",adminAuth,async (req,res)=>{// completed
    try{
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const votes=await query("select image_ID , id, candidate from users where voteCounted = 0 && voted=1");

    if(!votes[0]){
      return  res.status(404).json({
                errors: [{
                    msg:"No users have voted for any candidate !"
                }]
                
            })
    }
    else{
        const fun= async (elemn)=>{
            const VeImage = await query("select VImage from recognitionandotp where USER_ID=? ",elemn.id);
            elemn.registerImage = "http://" + req.hostname + ":4000/upload/" + VeImage[0].VImage;
            elemn.image_ID = "http://" + req.hostname + ":4000/upload/" + elemn.image_ID;
        };
        await Promise.all(votes.map(fun));
        
        return res.status(200).json(votes);
    }
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

//================================= accept or reject votes   =================================//
const countValidationRules = [body('id').isInt().notEmpty().withMessage("id is required with an integer form")];
rootervoter2.post("/count/:operation",countValidationRules, adminAuth, async (req, res) => {//completed
    try{
        const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        
      const { id } = req.body;
      const errors = validationResult(req);
        if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
//check user exists
//check if the user is in-active
        const usere= await query("select * from users where id= ?",id);
        if ((!Boolean(usere.length))) {
            
            return res.status(400).json({
                errors: [{
                    msg:"user not found !"
                }]
                
            })
      }
      if (usere[0].voteCounted) {
        res.status(400).json({
          errors: [{
            msg:"this vote is already counted please refresh the page"
          }]
        })
        return;
      }
      if (req.params.operation == 1) {
            const candidateCount=await query("select count , id from candidates where name=? ",usere[0].candidate)
          // console.log(candidateCount);
          await query("update candidates set  count = ?  where id =?",[candidateCount[0].count+1,candidateCount[0].id]);
          // sendOTP(`your vote was counted successfully check if your candidate is :${name} if not please go to the nearest police station to make the appropriate action `);//send confirmation message to the user
          await query("update users set voteCounted = 1 where id =? ", id);  
          return res.status(200).json({
            msg: " user counted successfuly"
            
        });
    } else {
        if (req.params.operation == 0) {
          await query("update users set voteCounted = 1 where id =? ", id);
          // sendOTP(`your voice is not counted ,please do to the nearest police station to make the appropriate action your candidate is: ${name} `);//send refuse message to the user
            return res.status(200).json({
                msg: " user uncounted successfuly",
                
            });
        } else{
        return res.status(400).json({
                errors: [{
                    msg:"invalid operation !"
                }]

            })
                }
            }

    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});







module.exports= rootervoter2;




