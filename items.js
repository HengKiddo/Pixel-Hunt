const allItems = [
    // Legendary
    { name: 'Golden Gryphon', emoji: '🦅', value: 10000, rarity: 'legendary', type: 'animal', message: "A mythical Golden Gryphon appears from the clouds! You manage to claim one of its valuable feathers!" },
    { name: 'Celestial Dragon', emoji: '🐉', value: 15000, rarity: 'legendary', type: 'animal', message: "Unbelievable! You encounter a Celestial Dragon and it blesses you with a priceless scale!" },
    { name: 'LootLama', emoji:'🦙' , value: 20000, rarity: 'legendary', type: 'animal', message: 'What the hell, God bless you'},
    { name: 'Two-Hump Camel', emoji:'🐫' , value: 25000, rarity: 'legendary', type: 'animal', message: 'A world legendary rare animal, You are the best '},
    // Epic
    { name: 'Manticore', emoji: '🦁', value: 2500, rarity: 'epic', type: 'animal', message: "A fearsome Manticore confronts you! After a tough battle, you claim its prized tail." },
    { name: 'Obsidian Golem', emoji: '🗿', value: 3000, rarity: 'epic', type: 'animal', message: "Deep in a cave, you awaken an Obsidian Golem and harvest its precious core." },
    { name: 'OX', emoji: '🐂', value: 5000, rarity: 'epic', type: 'animal', message: "An ox, a bovine used as a draft animal." },
    { name: 'Generic Bird', emoji: '🐦', value: 5000, rarity: 'epic', type: 'animal', message: "A generic bird not everyone can see." },
    // Rare
    { name: 'Bison', emoji: '🦬', value: 750, rarity: 'rare', type: 'animal', message: "A rare sight! You successfully hunt a massive bison." },
    { name: 'Giant Eagle', emoji: '🦅', value: 600, rarity: 'rare', type: 'animal', message: "You find the nest of a Giant Eagle and take one of its enormous eggs." },
    { name: 'Hedgehog', emoji: '🦔', value: 800, rarity: 'rare', type: 'animal', message:" A hedgehog. A small, spiny mammal you can kept as a pet "},
    { name: 'Kangaroo', emoji: '🦘', value: 700, rarity: 'rare', type: 'animal', message: "A kangaroo with a large tail and legs"},
    { name: 'Poodle', emoji: '🐩', value: 850, rarity: 'rare', type: 'animal', message: "A cute poodle is rare"},
    // Uncommon
    { name: 'Boar', emoji: '🐗', value: 200, rarity: 'uncommon', type: 'animal', message: "A wild boar charges at you, but you stand your ground and won!" },
    { name: 'Deer', emoji: '🦌', value: 300, rarity: 'uncommon', type: 'animal', message: "After some patient tracking, you hunt a deer." },
    { name: 'Bird', emoji: '🐤', value: 250, rarity: 'uncommon', type: 'animal', message: "Small baby bird." },
    { name: 'Gooes', emoji: '🪿', value: 300, rarity: 'uncommon', type: 'animal', message: "Gooes Gooes Gooes Gooes." },
    // Common
    { name: 'Rabbit', emoji: '🐰', value: 100, rarity: 'common', type: 'animal', message: "You easily catch a swift rabbit." },
    { name: 'Duck', emoji: '🦆', value: 150, rarity: 'common', type: 'animal', message: "You snag a few ducks by the lake." },
    { name: 'Cat', emoji: '🐈', value: 200, rarity: 'common', type: 'animal', message: "You found a losing cat"},
    { name: 'Dog', emoji: '🐕', value: 200, rarity: 'common', type: 'animal', message: "That dos is your pet"},
    // Nothing
    { name: 'Nothing', emoji: '🍃', value: 0, rarity: 'nothing', type: 'nothing', message: "You spend hours tracking, but the trail goes cold. You find nothing." },
    // Penalty
    { name: 'ចោរ', emoji: '🥷', value: -15000, rarity: 'penalty', type: 'penalty', message: "You stumble upon a bear! It claws you before you escape, and you drop some coins." },
    { name: 'Wolf Pack', emoji: '🐺', value: -1000, rarity: 'penalty', type: 'penalty', message: "A pack of wolves surrounds you! You get away, but not without losing some coins." },
    { name: 'Sad Time', emoji: '😔', value: -1000, rarity: 'penalty', type: 'penalty', message: "You found a sad people! You gonna be sad too because you losing some coins. "},
    { name: 'Stop Please', emoji: '🛑', value: -500, rarity: 'penalty', type: 'penalty', message: "You come so long far way and it time to rest"},
    
];
module.exports = allItems;
