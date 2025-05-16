const conn=require("../db/connection");
const util=require("util");//helper in queries 

const adminAuth=async (req,res,next) => {
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const { token }=req.headers;
    const admin=await query("select * from users where token = ?",token);
    if(admin[0] && admin[0].type==1 && admin[0].status==1 ){
        res.locals.admin=admin[0];
        next();
    }
    else{
        return res.status(403).json({
            msg:"you are not authorized to access this route !",
        });
    }
};


module.exports = adminAuth;
// 