const skillsToLoad = [
    {
        itemId: 'minor_heal',
        name: 'Minor Heal',
        description: 'A basic healing spell that restores 30 HP.',
        price: 15000,
        levelRequirement: 3,
        effect: { type: 'HEAL', amount: 30 },
        cooldown: 4, // 4 turns
    },
    {
        itemId: 'power_strike',
        name: 'Power Strike',
        description: 'Boosts your next attack by 50%.',
        price: 25000,
        levelRequirement: 5,
        effect: { type: 'DAMAGE_BOOST', multiplier: 1.5, duration: 1 }, // Lasts for 1 attack
        cooldown: 5, // 5 turns
    },
    {
        itemId: 'stone_skin',
        name: 'Stone Skin',
        description: 'Increases your defense by 20 for 3 turns.',
        price: 30000,
        levelRequirement: 8,
        effect: { type: 'DEFENSE_BOOST', amount: 20, duration: 3 }, // Lasts for 3 turns
        cooldown: 6, // 6 turns
    },
];
module.exports = skillsToLoad;
