const conn=require("../db/connection");
const util=require("util");//helper in queries 
//======================================LOGIN IS FULFILLED======================================//
const authorized=async (req,res) => {
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const { token }=req.headers;
    const query1="select * from users where token = ?";
    const user=await query(query1,{token});
    if(user[0]){
        next();
    }
    else{
        return res.status(403).json({
            msg:"you are not authorized to access this route !",
        });
    }
};


module.exports = authorized;