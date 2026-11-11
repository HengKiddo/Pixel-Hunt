const mongoose = require('mongoose');

// This schema defines the structure for all usable skills in the game.
const skillItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    levelRequirement: { type: Number, default: 1 },
    
    // Skill-specific properties
    effect: {
        type: { type: String, required: true, enum: ['HEAL', 'DAMAGE_BOOST', 'DEFENSE_BOOST'] },
        amount: { type: Number, default: 0 },       // For HEAL
        multiplier: { type: Number, default: 0 },  // For BOOSTS
        duration: { type: Number, default: 0 },    // How many turns a BOOST lasts
    },
    cooldown: { type: Number, default: 3 }, // How many turns before it can be used again
});

module.exports = mongoose.model('SkillItem', skillItemSchema);
