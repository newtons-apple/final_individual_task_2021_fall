const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const mongoose = require("mongoose");
const axios = require("axios");
const uuid = require('uuid');
var jwt = require('jsonwebtoken');

const {encryptPassword, setAuth, getCoinPrice} = require("./utils");

const { User, Coin, Asset,Key } = require('./models');
const app = express();

const port = 3000;

app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.get('/',  async (req, res)=> {
    res.json({message:'welcome coin world'})
    // res.send(apiRes.data);
})


/**
 * 완료
 * name: string. 4-12글자. alphanumeric
email: string. 100자 미만. email형식
password: 8-16글자.
회원가입 시 유저에게 10,000$를 제공한다.
 * 수정사항: db에 oid 추가
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
try{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
    }

    const { name, email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    let user = null;
    try {
        user = new User({name: name, email: email, password: encryptedPassword});
        await user.save();
    } catch (err) {
        console.log(err.stack)
        return res.status(400).json({error: 'Check your email, email may be duplicated'});
    }

    // 달러주기
    const usdAsset = new Asset({name: 'USD', balance: 10000, user});
    await usdAsset.save();
    user.assets=[...user.assets,usdAsset]
    //user.update({$push:{assets:usdAsset}})

    const coins = await Coin.find({isActive: true});
    for(const coin of coins) {
        const asset = new Asset({name: coin.name, balance: 0, user});
        await asset.save();
        user.assets=[...user.assets,asset]
       // user.update({$push:{assets:asset}})
    }
    await user.save()

    res.json({_id: user._id });
    }catch(err){
        console.log(err)
        return res.status(400).json({ error: err});
    }
})

/**
 * 완료.
 * request {email password}
로그인 시 마다 새로운 키 생성해서 저장
 * db에 oid 추가
 */
app.post('/login',async (req, res )=> {
    const { email, password } = req.body;
    const encryptedPassword = encryptPassword(password);
    const user = await User.findOne({email, password: encryptedPassword});

    if (user === null)
        return res.status(404).json({error:'비밀번호와 이메일을 확인해주세요'});
    //새로운 키 생성해서 저장. 임의의 publickey ,secretkey 생성
    const pubKey = encryptPassword(uuid.v4())
    const secKey = encryptPassword(uuid.v4())

    const key = new Key({publicKey:pubKey, secretKey:secKey,user:user});
    await key.save()
    user.keys = [...user.keys,key]
    user.save()
    res.json({ publicKey: pubKey,secretKey:secKey });
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
    res.json({coins:coinNames})

})

/**
 * 완료
 * 본인 자산 조회
 * :auth_required
 * response : {"usd": 3000, "bitcoin": 1, "ripple": 2, "dogecoin": 3, "ethereum": 4}
 * 수정사항: balance 는 각 1개씩, asset 관계 조정.
 * 
 */

app.get('/balance', setAuth,async (req, res) => {
    const user = req.user;
    try{
        const assets = await Asset.find({ user });
        const assetToObject =assets.reduce((p,c)=>{
            console.log(p)
            const a = {...p}
            if(c.balance){
                a[c.name] = c.balance
            }
        //     if(a[c.name])
        //         a[c.name]+=c.balance
        //     else
                
        return(a)},{})
        res.json(assetToObject);
    }catch(err){
        console.error(err)
    }

});
/**
 * 완료.
 * 시세조회
 */
app.get('/coins/:coin_name',async(req,res)=>{
    try{
        const coinName = req.params.coin_name
    const price = await getCoinPrice(coinName)
       
    res.json({price:price})

    }catch(err){
        console.log(err)
        return res.status(404).json({error:'취급하지 않는 코인입니다.'})
    }
 
})

/**
 * 완료
 * 코인 구매
 * 1.user의 usd잔고를 불러온다.
 * 2.코인 가격을 찾는다
 * 3. usd 잔고>=코인가격 x 개수 확인한다.
 * 4. 맞으면 db업데이트, 틀리면 error리턴.
 * 
 * 추가: 전량구매
 */
app.post('/coins/:coin_name/buy', setAuth, async(req, res) => {
    try{
        const coinId = req.params.coin_name
        const user = req.user
        const { quantity,all } = req.body;
        if(!quantity &&!all){
            return res.status(400).json({error:'제대로 된 값을 넣어주세요'})
        }
        const price = await getCoinPrice(coinId)
        
        const assets = await Asset.find({ user });
        const myDollar = assets.filter((asset)=>asset.name==='USD')[0]
        const myCoin = assets.filter((asset)=>asset.name===coinId)[0]
        //전량구매
        if(all){
            const quantity = myDollar.balance/price
            myDollar.balance =0
            await myDollar.save()
            myCoin.balance +=quantity
            await myCoin.save()
            return res.json({price,quantity})
        }


        //개별구매
        
        console.log(price*quantity)
        if(myDollar.balance>=price*quantity){
            myDollar.balance -= price*quantity
            await myDollar.save()
            myCoin.balance += quantity
            await myCoin.save();
            return res.json({price,quantity})
        }else{
            return res.status(400).json({error:'잔금이 부족합니다.'})
        }
        

    }catch(err){
        console.error(err)
        return res.status(400).json({error:'잘못된 요청입니다.'})
    }


})

/**
 * 완료
 * 팔기
 * 0. 요청이 소수점 4번째자리까지인지 확인하기
 * 1. 가격 가져오기
 * 2. 잔고 가져오기
 * 3. 자산 초과시 엘 리터
 * 4. db 업데이트
 * 
 * 전량판매수정중
 */
app.post('/coins/:coin_name/sell',setAuth,async(req,res)=>{
    try{
        
        const {quantity,all} = req.body
        const coinId = req.params.coin_name
        const user = req.user
        if(!quantity&&!all){
            return res.status(400).json({error:'제대로 된 값을 넣어주세요'})
        }
        if(quantity){
            const [integerPart, decimalPart] = quantity.toString().split('.');
            console.log(integerPart,decimalPart)
            if(decimalPart&&decimalPart.length>4){
            return res.status(400).json({error:'소수점5자리이상을 입력할 수 없습니다.'})


        }}
        const price = await getCoinPrice(coinId)

        const assets = await Asset.find({user})
        const myDollar = assets.filter((asset)=>asset.name==='USD')[0]
        const myCoin = assets.filter((asset)=>asset.name===coinId)[0]
        const totalPrice = myCoin.balance*price
        //전량판매

        if(all){
            console.log('all')
            if(!myCoin.balance){
            return res.status(400).json({error:'자산을 초과해서 판매할 수 없습니다'})
        }
            const quantity =myCoin.balance
            myCoin.balance =0
            await myCoin.save()
            myDollar.balance +=totalPrice
            await myDollar.save()
            return res.json({price,quantity})
        }


        if(quantity>myCoin.balance){
            return res.status(400).json({error:'자산을 초과해서 판매할 수 없습니다'})
        }
        myDollar.balance +=totalPrice
        await myDollar.save()
        myCoin.balance -= quantity
        await myCoin.save()
        return res.json({price,quantity})
    }catch(err){
        console.error(err)
        return res.json({error:'잘못된 요청입니다.'})
    }
})



/**
 * jwt 발생기
 */
app.get('/jwt',async(req,res)=>{
    console.log()
    const{publicKey,secretKey} = req.body
    try{
        const token = await jwt.sign({publicKey},secretKey,{expiresIn:9000})
        res.json(token)
    }catch(err){
        console.error(err)
        res.status(400).json({error:err})
    }
    
    
})

app.listen(port, ()=> {
    console.log(`listening at port: ${port}...`);
})
