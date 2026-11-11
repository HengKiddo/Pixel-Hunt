const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    emoji: { type: String, required: true },
    value: { type: Number, required: true }, // This is the price/payout
    rarity: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true, enum: ['animal', 'penalty', 'nothing'] }
});

module.exports = mongoose.model('Item', itemSchema);