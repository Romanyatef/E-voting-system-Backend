const conn=require("../db/connection");
const util=require("util");//helper in queries 

const sellerAuth=async (req,res,next) => {
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const seller=await query("select * from users where token = ?",req.headers.token);
    if(seller[0] && seller[0].type=="seller" && seller[0].status==1){
        res.locals.seller=seller[0];
        next();
    }
    else{
        res.status(403).json({
            msg:"you are not authorized to access this route !"
        });
    }
};


module.exports = sellerAuth;
