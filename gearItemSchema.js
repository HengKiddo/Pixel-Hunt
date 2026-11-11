const mongoose = require('mongoose');

// The generic schema for items to be sold in the shop
const shopItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    levelRequirement: { type: Number, default: 1 },
    effects: {
        robSuccessRate: { type: Number, default: 0 },
        robDefendRate: { type: Number, default: 0 },
        robCooldownReduction: { type: Number, default: 0 }
    }
});

module.exports = mongoose.model('ShopItem', shopItemSchema);

// The specific schema for gear with robbery-focused stats
const gearItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true, enum: ['Weapon', 'Armor', 'Helmet'] },
    description: { type: String, default: '' },
    price: { type: Number, default: 0 },
    levelRequirement: { type: Number, default: 1 },
    attack: { type: Number, default: 0 },
    defense: { type: Number, default: 0 },
    hp: { type: Number, default: 0 },
    critChance: { type: Number, default: 0 },
    critDamage: { type: Number, default: 0 },
    critDefense: { type: Number, default: 0 },

});


module.exports = mongoose.model('GearItem', gearItemSchema);