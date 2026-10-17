/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/src/generated/",
    "<rootDir>/test/",
  ],
  collectCoverageFrom: ["src/**/*.(t|j)s", "!src/generated/**"],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
}
