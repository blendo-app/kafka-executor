module.exports = {
    testPathIgnorePatterns: ["docs", "coverage", "<rootDir>/build/", "<rootDir>/config/"],
    coveragePathIgnorePatterns: ["<rootDir>/__tests__/"],
    "moduleFileExtensions": [
        "ts",
        "js"
    ],
    "transform": {
        "\\.(ts)$": "ts-jest"
    },
    "testRegex": "/__tests__/.*\\.test.(ts|js)$",
};