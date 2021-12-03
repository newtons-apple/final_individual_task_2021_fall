const crypto = require('crypto');
const User = require("./models/User");
var jwt = require('jsonwebtoken');
const { Key } = require('./models');
const axios = require('axios')

const encryptPassword = (password) => {
    return crypto.createHash('sha512').update(password).digest('base64');
}

//유효한 토큰인지 확인
const setAuth = async (req, res, next) => {
    const authorization = req.headers.authorization;
    const [bearer, token] = authorization.split(' ');
    if (bearer !== 'Bearer')
        return res.status(400).json({error: 'Wrong Authorization'});
    const {publicKey} = jwt.decode(token)
    const keys = await Key.findOne({publicKey:publicKey})
    if(!keys)
        return res.status(404).json({error: 'invalid token'})
    
    const user = await User.findById( keys.user );

    if (!user)
        return res.json({error: 'invalid token'}).status(404);

    try{
        jwt.verify(token,keys.secretKey)
    }catch(err){
        console.log(err)
            if(err.name==='TokenExpiredError')
            return res.status(401).json({error:'token expired'})
            
        if(err)
            console.log(err)
            return res.status(402).json({error:'invalid token'})
            next(err)
        }
    
    req.user = user;
    return next();


}

const getCoinPrice = async(coinId)=> {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const apiRes = await axios.get(url)
    const price = apiRes.data[coinId].usd
        return price
    
}

module.exports = {
    encryptPassword,
    setAuth,
    getCoinPrice
}
