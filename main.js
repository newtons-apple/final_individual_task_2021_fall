const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const mongoose = require("mongoose");
const axios = require("axios");
const {encryptPassword, setAuth} = require("./utils");
var jwt = require('jsonwebtoken');
var token = jwt.sign({ foo: 'bar' }, 'shhhhh');
const { User, Coin, Asset,Key } = require('./models');
const app = express();

const port = 3000;

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.get('/',  async (req, res)=> {

    // res.send(apiRes.data);
})

app.get('/coins', async(req, res) => {
    const coins = await Coin.find({isActive: true});
    res.send(coins);
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

    const coins = await Coin.find({isActive: true});
    for(const coin of coins) {
        const asset = new Asset({name: coin.name, balance: 0, user});
        await asset.save();
    }

    res.send({_id: user._id });
})

/**
 * 진행중
 * request
email
password
로그인 시 마다 새로운 키 생성해서 저장
response
{key: {key}}
key 제작 시 임의의 publicKey, secretKey를 생성 및 database에 저장. 클라이언트에게 두 값을 모두 전달. (로그인 시 publicKey, secretKey라는 키를 전달)
클라이언트는 매 요청 제작시마다, token을 생성한다고 가정. data에는 퍼블릭 키를 전달, expiresIn은 60으로 설정하고 값 전달.
jwt.sign({publicKey: 'pubKey' }, 'secretKey',  { expiresIn: 60 });
서버에서는 publicKey로 등록된 secretKey를 검색하여, 해당 토큰이 1) 유효한지 2) 시간이 유효한지를 검사하여 token의 valid를 체크.
 */
app.post('/login',async (req, res )=> {
    const { email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    const user = await User.findOne({email, password: encryptedPassword});

    if (user === null)
        return res.sendStatus(404);
    const key = new Key({name: name, email: email, password: encryptedPassword});
    user.key = encryptPassword(crypto.randomBytes(20));
    await user.save();

    res.send({ key: user.key });
})

app.get('/balance', setAuth, async (req, res) => {
    const user = req.user;

    const assets = await Asset.find({ user });
    res.send(assets);
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
