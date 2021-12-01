const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const mongoose = require("mongoose");
const axios = require("axios");
const {encryptPassword, setAuth} = require("./utils");

const { User, Coin, Asset } = require('./models');
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

app.post('/register',
    body('email').isEmail().isLength({max:99}),
    body('name').custom((value)=>{
        if(!/^[0-9a-zA-Z]+$/.test(value)||value.length<4||value.length>12) {
            throw new Error('이름은 대소문자, 숫자만 가능합니다.')
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
        return res.status(400).send({error: 'email is duplicatedeeef'});
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

app.post('/login',async (req, res )=> {
    const { email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    const user = await User.findOne({email, password: encryptedPassword});

    if (user === null)
        return res.sendStatus(404);

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
