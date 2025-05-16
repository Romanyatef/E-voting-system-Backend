const candidateRooter= require('express').Router();
const conn=require("../db/connection");
const util=require("util");//helper in queries 
// const bcrypt=require("bcrypt");
const { body, validationResult } = require('express-validator'); 
// const crypto = require("crypto");
const CryptoJS = require('crypto-js');
const adminAuth =require("../middleware/admin");
// const timeAuth =require("../middleware/timeAuth");
const upload =require("../middleware/uploadImages");
const fs = require("fs");

//================================= get inActive users =================================//
async function decryptNumber(encrypted,key) {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return parseInt(plaintext);
}



//========================== CREATE CANDIDATE ===========================//
candidateRooter.post("", adminAuth, upload.single("image"),body('name').isString().notEmpty().withMessage('Name is required').isLength({ min: 3 , max:40 }).withMessage('name must be at least 3 characters long and 40 in maximum'), async (req, res) => {//  completed
    try {
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
// ============ check verification ============
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
        fs.unlinkSync("./upload/" + req.file.filename);//delete image
        return res.status(400).json({ errors: errors.array() });
        }
    const nameExists= await query("select * from candidates where name=?",req.body.name);
        if (nameExists[0]) {
        fs.unlinkSync("./upload/" + req.file.filename);//delete image        
        return res.status(401).json({
            msg:"invalid name"
        });
    }
        if (!req.file) {
            return res.status(400).json({
                errors: [{
                    msg:"image required"
                }]
            })
        }
        const admin2 = res.locals.admin;
// ============ insert candidate ============
        const candidate1 = {
            adminID:admin2.id,
            name: req.body.name,
            image_url: req.file.filename,
        }
        await query("insert into candidates set ?",candidate1);
        return res.status(200).json({
            msg:"candidate created successfully "
        });
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

//========================== UPDATE CANDIDATE ===========================//
candidateRooter.put("/:id", adminAuth, upload.single("image"),//completed
    body('name').isString().notEmpty().withMessage('Name is required').isLength({ min: 3, max: 40 }).withMessage('name must be at least 3 characters long and 40 in maximum'),
    async (req, res) => {// 
    try {
// ============ check verification ============
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
        fs.unlinkSync("./upload/" + req.file.filename);//delete image
        return res.status(400).json({ errors: errors.array() });
        }
        
        const admin = res.locals.admin;
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]

// ============ check if candidate exists ============
        const candidate2 = await query("select * from candidates where id=?", req.params.id);
        if (!candidate2[0]) { 
        fs.unlinkSync("./upload/" + req.file.filename);//delete image
            return res.status(404).json({
                errors: [{
                    msg:"candidate not found"
                }]
            })
        }

// ============ prebare candidate check if image sended candidate ============
const candidate1 = {
            adminID:admin.id,
            name: req.body.name,
        }

if (req.file) {
    candidate1.image_url = req.file.filename;
    fs.unlinkSync("./upload/" + candidate2[0].image_url);//delete image
        }
// ============ update candidate ============
        
        await query("update candidates set ? where id=?",[candidate1,candidate2[0].id]);
        return res.status(200).json({
            msg:"candidate updated successfully "
        });
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
    });

//========================== VIEW ALL CANDIDATES ========================//
candidateRooter.get("/view",adminAuth,async (req,res)=>{//completed 
    try{
        const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        
        const candidates = await query("select * from candidates");
        if (!(candidates[0])) { 
            return res.status(404).json({
            errors:[{
                msg:"no candidates in the selection"
            }]
        });
        }
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

//========================== DELETE CANDIDATE ===========================//
candidateRooter.delete("/:id",adminAuth, async (req, res) => {//completed 
    try {
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
// ============ check if candidate exists ============
        const candidate2 = await query("select * from candidates where id=?", req.params.id);
        if (!candidate2[0]) { 
            return res.status(404).json({
                errors: [{
                    msg:"candidate not found"
                }]
            })
        } else {
            if (candidate2[0].voteCStatus==1) {
                res.status(400).json({
                    errors: [{
                        msg:"the candidate is activated you can't delete the candidate"
                    }]
                })
            }
        }

fs.unlinkSync("./upload/" + candidate2[0].image_url);//delete image

// ============ delete candidate ============
        
        await query("delete from candidates  where id=?",candidate2[0].id);
        return res.status(200).json({
            msg:"candidate deleted successfully "
        });
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});


//========================== ACTIVE OR INACTIVE CANDIDATES IN SELECTION ==========================//
candidateRooter.post("/candidate/:operation",adminAuth,async (req,res)=>{//completed
    try {
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//============ check if a selection is active ============
        const selection9= await query("select * from initiatselection where voteStatus = 1");
        if ((Boolean(selection9.length))) {
            return res.status(400).json({
            errors: [{
                msg:`no alter during the selection : ${selection9[0].nameSelection} `
            }]
        })
        }
//======== check verification on array of candidate IDs ========
        if ((!Boolean(req.body.candidateids.length))) {
            return res.status(400).json({
                    errors: [{
                        msg: "please enter candidate id"
                    }]
                })
        }
        var IDs = [];
        let errore=false
        await Promise.all(req.body.candidateids.map(async (ele) => {
            if ((!Number.isInteger(ele))) {
                
                IDs.push(ele);
                errore = true;
            }
        }))
        if (errore) {
            return res.status(400).json({
                    errors: [{
                        msg: `must all ids of the candidates be in numeric form : ${IDs} `
                    }]
                })
        }


        await Promise.all(req.body.candidateids.map(async (ele) => {
            let candidateExists = await query("select * from candidates where id=?", ele)
            if (!candidateExists[0]) {
                IDs.push(ele);
                errore = true;
                
            }
        }))

        if (errore) {
            return res.status(400).json({
                    errors: [{
                        msg: `no candidates with that ids: [${IDs}] `//if you want make a buffer to store the ids and loop in this ids tell ed
                    }]
                })
        }

        
//============ operation execution ============

        if (req.params.operation == 1) {
                await Promise.all(req.body.candidateids.map(async (ele) => {
                    const activated = await query("select * from candidates where voteCStatus =1 && id=? ", ele);
                    if (activated[0]) {
                    // return res.status(400).json({
                    //         msg: `candidate activated already:${ele} please enter after this id again`
                
                    //     });
                        errore = true;
                        IDs.push(ele);
                    }
                    await query("update candidates set voteCStatus =1 where id=?", ele);
                }))
            if (errore) {
                if (req.body.candidateids.length == IDs.length) {
                    return res.status(200).json({
                            msg: `the candidates that you provided they are already activated`
                    });
                        
                } else {
                        return res.status(200).json({
                            msg: `candidates activated successfuly but there are some candidates that already activated like:[${IDs}]`
                        });
                    }
                    
            } else {
                    return res.status(200).json({
                        msg: " candidates activated successfuly"                
                    });
            }
                
            } else {
            if (req.params.operation == 0) {
                    await Promise.all(req.body.candidateids.map(async (ele) => {
                    const inactivated = await query("select * from candidates where voteCStatus =0 && id=? ", ele);
                    if (inactivated[0]) {
                        errore = true;
                        IDs.push(ele);
                    }
                    await query("update candidates set voteCStatus =0 where id=?", ele)
                }))
                if (errore) {
                    if (req.body.candidateids.length == IDs.length) {
                    return res.status(200).json({
                            msg: `the candidates that you provided they are already inactivated`
                    });
                        
                    } else {
                        return res.status(200).json({
                            msg: `candidates inactivated successfuly but there are some candidates that already inactivated like: [${IDs}]`
                        });
                        
                }
                    
            } else {
                    return res.status(200).json({
                        msg: " candidates inactivated successfuly"                
                    });
                }
                
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

module.exports= candidateRooter;




//========================== ACTIVE OR INACTIVE CANDIDATE(extra) ==========================//
// candidateRooter.post("selection/:operation",adminAuth,async (req,res)=>{//
//     try{
//         const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
//         const {id}=req.body;
//         const selection9= await query("select * from initiatselection where id= ?",id);
//         if ((!Boolean(selection9.length))) {
//             res.status(404).json({
//                 errors: [{
//                     msg:"selection not found!! "
//                 }]
            
//             })
//         }
        
//         const currentTime2 = new Date();
//         if (currentTime2 >= selection9[0].startTime && currentTime2 <= selection9[0].endTime) {
//             if(req.params.operation==1 &&selection9[0].voteStatus ==0){
//                 await query("update initiatselection set voteStatus  = 1 where id =? ",id);
//                 res.status(200).json({
//                     msg: " selection activated successfuly"
                
//                 });
//             }else{ if(req.params.operation==0&&selection9[0].voteStatus ==1){
//                 await query("update initiatselection set voteStatus  = 0 where id =? ",id);
//                 res.status(200).json({
//                     msg: " selection inactivated successfuly"
                
//                 });
//             } else{
//                 res.status(400).json({
//                     errors: [{
//                         msg:"invalid operation !"
//                     }]
        
//                 })
//         }}
//         }
//         return res.status(400).json({
//             errors: [{
//                 msg:"the selection you give me is finished"
//             }]
//         })
//     }catch(err){
//         res.status(500).json({
//             errors:[{
//                 msg:"something went wrong :"+err
//             }]
//         });
//     }
// });
