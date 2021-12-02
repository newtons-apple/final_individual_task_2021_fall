const crypto = require('crypto');
const User = require("./models/User");
var jwt = require('jsonwebtoken');
const { Key } = require('./models');


const encryptPassword = (password) => {
    return crypto.createHash('sha512').update(password).digest('base64');
}

//유효한 토큰인지 확인
const setAuth = async (req, res, next) => {
    const authorization = req.headers.authorization;
    const [bearer, token] = authorization.split(' ');
    if (bearer !== 'Bearer')
        return res.status(400).send({error: 'Wrong Authorization'});
    const {publicKey} = jwt.decode(token)
    const keys = await Key.findOne({publicKey:publicKey})
    console.log(keys)
    if(!keys)
        return res.status(404).send({error: 'invalid token'})
    
    const user = await User.findById( keys.user );
    console.log(user)

    if (!user)
        return res.send({error: 'invalid token'}).status(404);

    try{
        jwt.verify(token,keys.secretKey)
    }catch(err){
        console.log(err,data)
            if(err.name==='TokenExpiredError')
            return res.status(401).send({error:'token expired'})
            
        if(err)
            console.log(err)
            return res.status(402).send({error:'invalid token'})
            next(err)
        }
    
    req.user = user;
    return next();


}
module.exports = {
    encryptPassword,
    setAuth,
}
