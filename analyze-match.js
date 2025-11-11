// Analyze which cities match "Groftok" better than "Rostock"

const fs = require('fs');

// Levenshtein distance implementation (same as in script.js)
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,    // deletion
                    dp[i][j - 1] + 1,    // insertion
                    dp[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }

    return dp[m][n];
}

// Normalize text (same as in script.js)
function normalizeText(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '');
}

// Read cities list
const cities = fs.readFileSync('german-cities.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

const transcription = "Öbsylon";
const normalized = normalizeText(transcription);

console.log(`Analyzing matches for transcription: "${transcription}" (normalized: "${normalized}")`);
console.log(`Total cities: ${cities.length}\n`);

// Calculate similarity for all cities
const results = cities.map(city => {
    const normalizedCity = normalizeText(city);
    const distance = levenshteinDistance(normalized, normalizedCity);
    const maxLength = Math.max(normalized.length, normalizedCity.length);
    const similarity = 1 - (distance / maxLength);

    return {
        city,
        normalizedCity,
        distance,
        similarity: similarity * 100
    };
});

// Sort by similarity (best match first)
results.sort((a, b) => b.similarity - a.similarity);

// Show top 20 matches
console.log('Top 20 matches:');
console.log('================');
for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    console.log(`${(i+1).toString().padStart(2)}. ${r.city.padEnd(30)} (${r.similarity.toFixed(1)}%, distance=${r.distance})`);
}

// Find Rostock
const rostockResult = results.find(r => normalizeText(r.city) === normalizeText('Rostock'));
if (rostockResult) {
    const rostockRank = results.indexOf(rostockResult) + 1;
    console.log(`\nRostock rank: #${rostockRank} (${rostockResult.similarity.toFixed(1)}%, distance=${rostockResult.distance})`);

    // Count how many cities are better matches
    const betterMatches = results.filter(r => r.similarity > rostockResult.similarity);
    console.log(`Cities matching better than Rostock: ${betterMatches.length}`);
}
