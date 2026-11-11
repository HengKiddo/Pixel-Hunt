const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    aliases: { type: [String], default: [] }, // For commands to easily find the item
    price: { type: Number, required: true },
    type: { type: String, required: true }, // e.g., 'rob bag', 'wall'
    stats: {
        robSuccessRate: { type: Number, default: null },
        robDefendPercent: { type: Number, default: null },
        robReduceCountdown: { type: Number, default: null }
    }
});

// Check if the model already exists before compiling it
const ShopItem = mongoose.models.ShopItem || mongoose.model('ShopItem', shopItemSchema);

module.exports = ShopItem;
