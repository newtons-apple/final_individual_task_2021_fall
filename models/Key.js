const mongoose = require('mongoose');
const { Schema } = mongoose;

const keySchema = new Schema({
    publicKey: String,
    secretKey: String,
    user: { type: Schema.Types.ObjectId, ref: 'User' },
});

keySchema.index({ publickey: 1}, { unique: true });
const Key = mongoose.model('Key', keySchema);

module.exports = Key;


//1. 로그인시 pubkey와 secret키를 생성해서 client에게 전달한다.
//2. client는 요청때 pubkey와 secret키를 활용해서 token을 만들어서 헤더에 넣어서 보낸다.
//3. 서버에서 decode -> publicKey로 등록된 secretKey를 검색한다
//4. secretkey로 토큰의 유효성을 검증한다.

//jwt.sign({pub: 'pubKey' }, 'secretKey',  { expiresIn: 60*60 });-> 테스트 할때는 3600초로 하자.
//jwt decode라이브러리 사용 가능
//publickey와 secretKey를 randombyte로 만들면 될까요? 길이는 똑같이 20으로 한다.
