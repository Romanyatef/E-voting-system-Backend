const express = require('express');
const app= express();
const conn=require("./db/connection");
const util=require("util");//helper in queries 
const imageAuth = require("./middleware/imageAuth");
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// const bodyParser = require('body-parser');// the replace for it is express

//========================== Global Medelmares ==========================//

app.use(express.urlencoded({extended: true  }));// to acess URL encoded 
app.use(express.json());
const cors=require("cors");
app.use(cors());//ALLOWS HTTP REQUESTS BETWEEN LOCAL HOSTS("FRONTEND","BACKEND")

//========================== REQUIRED MODULES ==========================//

const Apis=require('./Routes/Apis.js');
const Auth=require('./Routes/Auth');
const voterRequirements=require("./Routes/voterRequirements.js");
const vote2 = require("./Routes/vote2.js")
const selectionRooter = require("./Routes/selections");
const candidateRooter = require("./Routes/candidates");
//========================== MAKE PUBLIC FOLDER ==========================//
app.use("/upload/:filename",express.static(path.join(__dirname, '/upload')));
//========================== RUN THE APP ==========================//

app.get("/upload/:filename",imageAuth, (req, res) => {
    const filePath = path.join(__dirname, '/upload', req.params.filename);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
})
app.listen(process.env.PORT,process.env.HOST,()=>{
    console.log("the web server is running");
})

//========================== API ROUTES [ENDPOINTS] ==========================//
app.use("/apis",Apis);
app.use("/auth",Auth);
app.use("/voter", voterRequirements);
app.use("/vote", vote2);
app.use("/selection", selectionRooter);
app.use("/candidate", candidateRooter);
// app.use("/*",voter);
function incrementDate(dateInput,increment) { 
        var increasedDate = new Date(dateInput.getTime() +(increment *86400000));
        return increasedDate;
        }
//========================== MAKE SELECTION STATE  ==========================//
//make function that loops on selections to check state and start
const query = util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
const updateState = async () => {
    try {
        // Get the current date and time
        const now = new Date();
        selections = await query("select * from initiatselection where finished=0");
        // Execute the update query
        if (!selections[0]) {
            console.log("no selections");
        }
        await Promise.all(selections.map(async (ele) => {
            if (now>ele.endTime) {
                await query('update initiatselection set finished = 1,voteStatus=0 where id=?', ele.id);
                console.log(`a selection is finished due to time Scheduling to this selection :${ele.nameSelection}`)
                const candidates2 = await query("select * from candidates where voteCStatus=1");
                await Promise.all(candidates2.map(async (ele) => {
                    var newSelectionHistory = {
                        selectionId: selection[0].id,
                        candidateName: ele.name,
                        count: ele.count,
                    } 
                await query("insert into selectionshistory set ?", newSelectionHistory);
                }))
                // make all candidates status =0
            
            await Promise.all(candidates2.map(async (ele) => {
                await query("update candidates set voteCStatus =0 where id=?", ele.id);
        }))
                
            }
            // console.log(now >= incrementDate(ele.startTime,1));
            // console.log(now );
            // console.log(incrementDate(ele.startTime,1));
            // console.log(ele.startTime);
            
            if (ele.voteStatus == 0 && now >= incrementDate(ele.startTime,1) && now <= incrementDate(ele.endTime,1)) {
                await query('update initiatselection set voteStatus = 1 where id=?', ele.id);
                console.log(ele.endTime);
                console.log(`a selection is activated due to time Scheduling to this selection :${ele.nameSelection}`)
            }
        }))
    } catch (err) {
        console.log("something went wrong :" + err);
    };
}
// Schedule the update function to run every minute
setInterval(updateState, 60000 * 1000); // 60 seconds * 1000 milliseconds = 1 minute

