const conn=require("../db/connection");
const util=require("util");//helper in queries 

const timeAuth=async (req,res,next) => {
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const { selectionName } = req.body;
    const currentTime = new Date();
    const query1 = "select * from initiatselection where nameSelection = ?";
    const selection = await query(query1, selectionName);
    if (selection[0] && selection[0].voteStatus == 1  ) {
        if (currentTime >= selection[0].startTime && currentTime <= selection[0].endTime) {
            res.locals.selection=selection[0];
            next();
        }
        else {
            await query("update initiatselection set voteStatus = 0 && finished=1 where id=? ", selection[0].id)
            //make history of the selection and set winner and count 
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
            await query("update candidates set voteCStatus =0 where id=?", ele.id)
                return res.status(403).json({
                    errors: [{
                    msg:"the selection has ended !",
                }]
        });    
        }))
        }
        
    }
    else{
        return res.status(403).json({
            errors: [{
                    msg:"you there are some operation happens to this selection know or no selection with that name and active !",//not modified
                }]
        });
    }
};


module.exports = timeAuth;

