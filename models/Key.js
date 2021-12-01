const mongoose = require('mongoose');
const { Schema } = mongoose;

const keySchema = new Schema({
    name: String,
    balance: Number,
    user: { type: Schema.Types.ObjectId, ref: 'User' },
});

keySchema.index({ name: 1, user: 1 }, { unique: true });
const Key = mongoose.model('Key', keySchema);

module.exports = Key;
