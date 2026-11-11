const mongoose = require('mongoose');

// Define a schema for items that have a name and quantity.
// This is necessary because inventorygearrob will contain objects, not just strings.
const gearItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, default: 1 }
}, { _id: false }); // Prevents Mongoose from creating an ID for each item in the array

const profileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    passHash: { type: String, default: '' },
    passSalt: { type: String, default: '' },
    balance: { type: Number, default: 1000000 },
    isAdmin: { type: Boolean, default: false },
    dailyLastUsed: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    // I've fixed the typo here from 'invetoryrob' to 'inventoryrob'
    inventoryrob: { type: Object, default: {} },
    // This is the CRUCIAL change: It's now an array of objects
    // that follow the gearItemSchema, which matches the code in robgearshop.js
    inventorygearrob: { type: [gearItemSchema], default: [] },
    equippedItems: {
        type: Object,
        default: {
            robGear: null, // For equipable robbing gear like 'thieves_gloves'
            policeGear: null, // For equipable police gear like 'police_level_1'
        },
    },
    canRob: { type: Boolean, default: false },
    // New field to track the equipped robbing gear
    equippedRobGear: { type: String, default: null },
    // The last time the user ran a command
    lastCommand: { type: Date, default: null },

    // --- User limit transfer ---
    dailyTransferSent: { type: Number, default: 0 },
    dailyReceiveGot: { type: Number, default: 0 },
    lastTransferTimestamp: { type: Number, default: 0 },
    lastReceiveTimestamp: { type: Number, default: 0 },

    // --- Hunting system ---
    huntLastUsed: { type: Number, default: 0 },
    inventory: { type: Array, default: [] },
    shovels: { type: [String], default: [] },
    equippedShovel: { type: String, default: null },
    // Exp
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },

    autohunt: {
        startTime: { type: Number, default: 0 },
        endTime: { type: Number, default: 0 },
        skills: {
            worker: { type: Number, default: 1 },
            workerXP: { type: Number, default: 1 },
            strategy: { type: Number, default: 1 },
            radar: { type: Number, default: 1 },
            duration: { type: Number, default: 1 }
        }
    },

    // --- Quests system ---
    quests: {
        daily: [
            {
                questId: String,
                questType: String,
                description: String,
                target: Number,
                progress: Number,
                reward: Number,
                completed: Boolean
            }
        ],
        lastUpdated: { type: Number, default: 0 }
    },
    // Battle gear
    gear: {
        weapon: { type: String, default: "none" },
        armor: { type: String, default: "none" },
        helmet: { type: String, default: "none" },
        skill: { type: String, default: "none" },
        inventory: { type: Array, default: [] }
    }
});

const model = mongoose.model('GlobalProfile', profileSchema);

module.exports = model;
