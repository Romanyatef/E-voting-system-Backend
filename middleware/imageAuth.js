const conn=require("../db/connection");
const util=require("util");//helper in queries 

const imageAuth=async (req,res,next) => {
    const query=util.promisify(conn.query).bind(conn);//transform query into a promise to use [await/async]
    const { filename } = req.params;
    const user = await query("select id from users where image_ID=? ", filename);
    if (user[0]) {
        if (!req.headers.token) {
        return res.status(403).json({
            msg:"you are not authorized to access this route !",
        });
    }
    const { token } = req.headers;
    const query1 = "select * from users where token = ?";
        const userAuth = await query(query1, token);
        console.log(userAuth[0].image_ID==filename);
    if (userAuth[0] && userAuth[0].status == 1 && (userAuth[0].image_ID==filename||userAuth[0].type==1)) {
        // res.locals.userAuth=userAuth[0];
        next();
        }
    else {
        return res.status(403).json({
            msg:"you are not authorized to access this route !",
        }); 
        }

    }
        const imagea34 = await query("select USER_ID from recognitionandotp where RImage=? ", filename);
        const imagea35 = await query("select USER_ID from recognitionandotp where VImage=? ", filename);
    if (imagea34[0] || imagea35[0]) {
        if (!req.headers.token) {
        return res.status(403).json({
            msg:"you are not authorized to access this route3 !",
        });
    }
    const { token } = req.headers;
    const query2 = "select type from users where token = ?";
        const userAuth2 = await query(query2, token);
    if (userAuth2[0] && userAuth2[0].type==1) {
        // res.locals.userAuth2=userAuth2[0];
        next();
        }
    else {
        return res.status(403).json({
            msg:"you are not authorized to access this route4 !",
        }); 
        }
    }
    const imagea36 = await query("select id from candidates where image_url=? ", filename);
    if (imagea36[0]) {
        next();
    }

    // console.log(!req.headers.token)
    
   
};


module.exports = imageAuth;