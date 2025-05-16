const conn=require("../db/connection");
const util=require("util");//helper in queries 

const voterAuth=async (req,res,next) => {
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const { token }=req.headers;
    const query1="select * from users where token = ?";
    const voter=await query(query1,token);
    if(voter[0]  && voter[0].status==1){
        res.locals.voter=voter[0];
        next();
    }
    else{
        return res.status(403).json({
            msg:"you are not authorized to access this route !",
        });
    }
};


module.exports = voterAuth;