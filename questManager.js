const profileModel = require('./profileSchema');

// This is the master list of all possible daily quests.
const allQuests = [
    { questId: 'HUNT_EPIC_5', questType: 'hunt', description: 'Hunt 5 Epic creatures', target: 5, reward: 50000, condition: (rarity) => rarity === 'epic' },
    { questId: 'HUNT_LEGENDARY_2', questType: 'hunt', description: 'Hunt 2 Legendary creatures', target: 2, reward: 200000, condition: (rarity) => rarity === 'legendary' },
    { questId: 'HUNT_COMMON_20', questType: 'hunt', description: 'Hunt 20 Common creatures', target: 20, reward: 10000, condition: (rarity) => rarity === 'common' },
    // We will add the slot machine quest later, once that command is also upgraded.
];

// This function shuffles an array.
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

module.exports = {
    // This function will get the daily quests for a user, generating new ones if it's a new day.
    async getQuests(userId) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        let profile = await profileModel.findOne({ userId });

        if (!profile.quests || profile.quests.lastUpdated < startOfDay) {
            // Generate 5 new random quests for the day
            const shuffledQuests = shuffle([...allQuests]);
            const newDailyQuests = shuffledQuests.slice(0, 5).map(q => ({
                questId: q.questId,
                questType: q.questType,
                description: q.description,
                target: q.target,
                progress: 0,
                reward: q.reward,
                completed: false,
            }));

            profile = await profileModel.findOneAndUpdate(
                { userId },
                { $set: { quests: { daily: newDailyQuests, lastUpdated: now.getTime() } } },
                { new: true }
            );
        }
        return profile.quests.daily;
    },

    // This function will be called by your other commands to update quest progress.
    async updateQuestProgress(userId, questType, data) {
        const quests = await this.getQuests(userId);
        let updated = false;

        for (const quest of quests) {
            if (quest.questType === questType && !quest.completed) {
                const questInfo = allQuests.find(q => q.questId === quest.questId);
                if (questInfo && questInfo.condition(data)) {
                    quest.progress += 1;
                    updated = true;
                }
            }
        }

        if (updated) {
            await profileModel.updateOne({ userId }, { $set: { 'quests.daily': quests } });
        }
    }
};