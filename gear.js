// Starter battle gear. Your old bot's gear data was not in the zip, so these stats are a new starter set.
// If your database already has GearItem documents they are kept and this file is NOT used.
module.exports = [
 { itemId:'wooden_sword',  name:'Wooden Sword',  type:'Weapon', description:'A simple training sword.',        price:100000,  levelRequirement:1,  attack:5 },
 { itemId:'iron_sword',    name:'Iron Sword',    type:'Weapon', description:'Sharp and reliable.',             price:500000,  levelRequirement:10, attack:12, critChance:3 },
 { itemId:'dragon_blade',  name:'Dragon Blade',  type:'Weapon', description:'Forged in dragon fire.',          price:5000000, levelRequirement:40, attack:30, critChance:8, critDamage:2.0 },
 { itemId:'leather_armor', name:'Leather Armor', type:'Armor',  description:'Light and flexible.',             price:100000,  levelRequirement:1,  defense:4, hp:20 },
 { itemId:'steel_armor',   name:'Steel Armor',   type:'Armor',  description:'Heavy plates of steel.',          price:600000,  levelRequirement:10, defense:10, hp:50 },
 { itemId:'dragon_armor',  name:'Dragon Armor',  type:'Armor',  description:'Scales that shrug off crits.',    price:6000000, levelRequirement:40, defense:22, hp:120, critDefense:15 },
 { itemId:'leather_cap',   name:'Leather Cap',   type:'Helmet', description:'Better than nothing.',            price:60000,   levelRequirement:1,  defense:2, hp:10 },
 { itemId:'steel_helm',    name:'Steel Helm',    type:'Helmet', description:'Solid head protection.',          price:400000,  levelRequirement:10, defense:6, hp:30 },
 { itemId:'dragon_helm',   name:'Dragon Helm',   type:'Helmet', description:'A crown of scales.',              price:4000000, levelRequirement:40, defense:14, hp:70, critDefense:10 },
];
