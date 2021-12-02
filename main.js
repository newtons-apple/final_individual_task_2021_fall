const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const mongoose = require("mongoose");
const axios = require("axios");
const uuid = require('uuid');
const {encryptPassword, setAuth} = require("./utils");

const { User, Coin, Asset,Key } = require('./models');
const app = express();

const port = 3000;

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.get('/',  async (req, res)=> {
    res.send({message:'welcome coin world'})
    // res.send(apiRes.data);
})


/**
 * 완료
 * name: string. 4-12글자. alphanumeric
email: string. 100자 미만. email형식
password: 8-16글자.
회원가입 시 유저에게 10,000$를 제공한다.
 */
app.post('/register',
    body('email').isEmail().isLength({max:99}),
    body('name').custom((value)=>{
        if(!/^[0-9a-zA-Z]+$/.test(value)) {
            throw new Error('이름은 대소문자, 숫자만 가능합니다.')
            }
        if(value.length<4||value.length>12){
            throw new Error(' 이름은 4글자에서 12글자 까지 되어야 합니다.')
            }
        return true
    }),
    body('password').isLength({ min: 8,max:16 }),
    async(req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    let user = null;
    try {
        user = new User({name: name, email: email, password: encryptedPassword});
        await user.save();
    } catch (err) {
        console.log(err.stack)
        return res.status(400).send({error: 'Check your email, email may be duplicated'});
    }

    // 달러주기
    const usdAsset = new Asset({name: 'USD', balance: 10000, user});
    await usdAsset.save();
    //user.update({$push:{assets:usdAsset}})
    

    const coins = await Coin.find({isActive: true});
    for(const coin of coins) {
        const asset = new Asset({name: coin.name, balance: 0, user});
        await asset.save();
       // user.update({$push:{assets:asset}})
    }

    res.send({_id: user._id });
})

/**
 * 완료.
 * request {email password}
로그인 시 마다 새로운 키 생성해서 저장
 */
app.post('/login',async (req, res )=> {
    const { email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    const user = await User.findOne({email, password: encryptedPassword});

    if (user === null)
        return res.status(404).send({error:'비밀번호가 틀립니다.'});
    //새로운 키 생성해서 저장. 임의의 publickey ,secretkey 생성
    const pubKey = encryptPassword(uuid.v4())
    const secKey = encryptPassword(uuid.v4())

    const key = new Key({publicKey:pubKey, secretKey:secKey,user:user});
    await key.save()
    res.send({ publicKey: pubKey,secretKey:secKey });
})

/**
 * 완료
 * 코인 목록 불러오는 함수
 * response : ['bitcoin','ripple', 'dogecoin', 'ethereum']
 */
app.get('/coins',async(req,res)=>{
    const coins = await Coin.find({isActive: true})
    console.log(coins)
    const coinNames = coins.map((coin)=>coin.name)
    console.log(coinNames)
    res.send({coins:coinNames})

})

/**
 * 본인 자산 조회
 * :auth_required
 * response : {"usd": 3000, "bitcoin": 1, "ripple": 2, "dogecoin": 3, "ethereum": 4}
 */

app.get('/balance', setAuth, async (req, res) => {
    const user = req.user;
    console.log('hihi')
    try{
        const assets = await Asset.find({ user });
        res.send(assets);
    }catch(err){
        console.error(err)
    }

});

app.post('/coin/:coinName/buy', setAuth, async(req, res) => {
    const coinId = 'bitcoin';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const apiRes = await axios.get(url);
    const price = apiRes.data[coinId].usd;
    const { quantity } = req.body;
})

app.listen(port, ()=> {
    console.log(`listening at port: ${port}...`);
})
