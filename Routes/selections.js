const selectionRooter= require('express').Router();
const conn=require("../db/connection");
const util=require("util");//helper in queries 
// const bcrypt=require("bcrypt");
const { body, validationResult } = require('express-validator'); 
// const crypto = require("crypto");
const CryptoJS = require('crypto-js');
const adminAuth =require("../middleware/admin");
// const timeAuth =require("../middleware/timeAuth");
// const upload =require("../middleware/uploadImages");
const fs = require("fs");

//================================= get inActive users =================================//
async function decryptNumber(encrypted,key) {
    const bytes = CryptoJS.AES.decrypt(encrypted, key); 
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return parseInt(plaintext);
}

//========================== CREATE SELECTION ===========================//
const selectionValidationRules = [
    body('nameSelection').isString().notEmpty().withMessage('Name is required').isLength({ min: 3 , max:40 }).withMessage('name must be at least 3 characters long and 40 in maximum'),
    body("startTime").notEmpty().withMessage("time required").isISO8601().withMessage("time must be in this format 0000-00-00"),
    body("endTime").notEmpty().withMessage("time required").isISO8601().withMessage("time must be in this format 0000-00-00"),
];
function incrementDate(dateInput,increment) {
        var dateFormatTotime = new Date(dateInput);
        var increasedDate = new Date(dateFormatTotime.getTime() +(increment *86400000));
        return increasedDate;
}
        
selectionRooter.post("/selections/new",selectionValidationRules ,adminAuth, async (req, res) => {//completed
    try {
        // ============ check verification ============
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        // ============ check if any selection is active ============
        const selection3 = await query("select * from initiatselection where voteStatus=1");
        if (selection3[0]) {
            return res.status(400).json({
                errors: [{
                    msg: "there is a selection still active"
                }]
            })
        }
        const selectionses = await query("select * from initiatselection where finished=0");
        const currentNowTime2 = new Date();
         //on time
        if ((new Date(req.body.startTime) >= new Date(req.body.endTime))) {
            return res.status(400).json({
                errors: [{
                    msg: "Must the end date be greater than the start date in at least a 1-day difference "
                }]
            })
        }
        if ((currentNowTime2 >= new Date(req.body.startTime))) {
                return res.status(400).json({
                errors: [{
                        msg:"Must the current date be smaller than the start time"
                    }]
            })
        } 
        
        var errore = false;
        await Promise.all(selectionses.map(async (ele) => {
            
            const date1 = incrementDate(ele.startTime,1);
            const date2 = incrementDate(ele.endTime,1);
            const date3 = new Date(req.body.startTime);
            const date4 = new Date(req.body.endTime);
            if (currentNowTime2 >= date1 && currentNowTime2 <= date2 ) {
                await query('update initiatselection set voteStatus = 1 where id=?', ele.id);
                errore = true;
            }
            
        }))
        if (errore) {
            return res.status(400).json({
                    errors: [{
                        msg: "there is a selection still active"
                    }]
                }) 
        }
        await Promise.all(selectionses.map(async (ele) => {
            
            const date1 = incrementDate(ele.startTime,1);
            const date2 = incrementDate(ele.endTime,1);
            const date3 = new Date(req.body.startTime);
            const date4 = new Date(req.body.endTime);

            if ((date3 > date1 && date3 < date2)||(date4 > date1 && date4 < date2)) {
                errore = true; 
        }
        }))
        if (errore) {
            return res.status(400).json({
                    errors: [{
                        msg: "there is a selection ahead in this time or near to it  "
                    }]
            })
        }
        //check if there are still uncounted votes for the previouse selection  
        const uncountedVotes2 = await query("select id from users where voteCounted=0 &&voted=1 ");
        console.log(uncountedVotes2[0]);
        if (uncountedVotes2[0]) {
            return res.status(400).json({
                errors: [{
                    msg:"please count the uncounted votes to the previous selection"
                }]
            })

        }
        //check if there are selection have the same name
        const selectionNameExists = await query("select id from initiatselection where nameSelection=? ", req.body.nameSelection);
        if (selectionNameExists[0]) {
            res.status(400).json({
                errors: [{
                    msg:"invalid selection name try other name"
                }]
            })
            return;
            
        }
        // on candidate ids
        if (!req.body.candidatesIDs || req.body.candidatesIDs.length == 0) {
            return res.status(400).json({
                errors: [{
                    msg: "candidate IDs required"
                }]
            })
            
        }
        await Promise.all(req.body.candidatesIDs.map(async (ele) => {
            if ((!Number.isInteger(ele))) {
                return res.status(400).json({
                    errors: [{
                        msg: "must all ids of the candidates be in numeric form "
                    }]
                })
            }
            let candidateExists = await query("select * from candidates where id=?", ele)
            if (!candidateExists) {
                return res.status(400).json({
                    errors: [{
                        msg: `no candidate with that id :${ele}`
                    }]
                })
            }
        }))
        
        const admin = res.locals.admin;
        
        const users3 = await query("select id from users");
        await Promise.all(users3.map(async (ele) => {
            newform = {
                voted: 0,
                candidate: "not voted",
                voteCounted:0
            }
            await query("update users set ? where id = ?",[newform,ele.id])
        }))
        //=============== insert new selection ========================================
        const newSelection = {
            admin_id: admin.id,
            nameSelection: req.body.nameSelection,
            startTime: req.body.startTime,
            endTime: req.body.endTime,
        }
        await query("insert into initiatselection set ?", newSelection);
        // make the selected candidtes active
        await Promise.all(req.body.candidatesIDs.map(async (ele) => {
            await query("update candidates set voteCStatus =1 where id=?",ele)
        }))

        return res.status(200).json({
            msg:"selection created successfully "
        });
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

//========================== (history) VIEW SELECTIONS ============================//
selectionRooter.get("/:id",adminAuth,async (req,res)=>{// 
    try{
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        const selectionhistory = await query(`select * from selectionshistory where selectionId=${req.params.id}`);
        
        if (!(selectionhistory[0])) { 
            return res.status(404).json({
            errors:[{
                msg:"no selection history for the selection"
            }]
        });
        }
        return res.status(200).json(selectionhistory);
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

//========================== view active SELECTION (current counts)============================//
selectionRooter.get("/selections/all",adminAuth,async (req,res)=>{//complete
    try{
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
        var selections999 = await query("select * from initiatselection where voteStatus=1");
        // loop on selections to see if there is an unactivated selectio must be activated 
        if (!selections999[0]) {
            const selections89 = await query("select * from initiatselection where voteStatus=0");
            if (selections89[0]) {
                const now = new Date();
                await Promise.all(selections89.map(async (ele) => {
                    if (ele.voteStatus == 0 && now > ele.startTime && now <= ele.endTime) {
                    await query('update initiatselection set voteStatus = 1 where id=?', ele.id);
                }
            }))
            }
            var selections999 = await query("select * from initiatselection where voteStatus=1");
            if (!selections999[0]) {
                return res.status(404).json({
                    errors: [{
                        msg:"no selections in this time"
                    }]
                })
        }}  
        //check if there is an activated candidates
        const currentrecord = await query("select * from candidates where voteCStatus= 1 ");
        if (!currentrecord[0]) {
            return res.status(404).json({
                errors: [{
                    msg:"no candidate is set to this selection"
                }]
            })
        }
        const selection76 = {
            name: selections999[0].nameSelection,
            currentrecords:currentrecord
        }
        return res.status(200).json(selection76);
        
    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});

//========================== DELETE SELECTIONS WITH HISTORY==========================//
selectionRooter.delete("/selections/:id", adminAuth, async (req, res) => {//half_complete 
    try {
        const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
// ============ check if selction exists ============
        const selection77 = await query("select * from initiatselection where id=?", req.params.id);
        if (!selection77[0]) { 
            return res.status(404).json({
                errors: [{
                    msg:"selection not found"
                }]
            })
        }
        
        selections346 = await query("select * from initiatselection");
        const now = new Date();
        await Promise.all(selections346.map(async (ele) => {
            if (ele.voteStatus == 0 && now > ele.startTime && now <= ele.endTime) {
                await query('update initiatselection set voteStatus = 1 where id=?', ele.id);
            }
        }))
        const selection55 = await query("select * from initiatselection where id=?", req.params.id);
        if (selection55[0].voteStatus) { 
            return res.status(404).json({
                errors: [{
                    msg:"selection is active no delete"
                }]
            })
        }
// ============ delete selection ============
        await query("delete from initiatselection  where id=?",req.params.id);
        return res.status(200).json({
            msg:"selection deleted successfully "
        });
        

    }catch(err){
        return res.status(500).json({
            errors:[{
                msg:"something went wrong :"+err
            }]
        });
    }
});


module.exports= selectionRooter;
