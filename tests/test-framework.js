/**
 * Simple test framework for VoxAlpha
 * Minimal testing utilities without external dependencies
 */

class TestRunner {
    constructor() {
        this.tests = [];
        this.beforeAllHooks = [];
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    beforeAll(fn) {
        this.beforeAllHooks.push(fn);
    }

    describe(suiteName, fn) {
        console.log(`\n📦 ${suiteName}`);
        fn();
    }

    it(testName, fn) {
        this.tests.push({ name: testName, fn });
    }

    async run() {
        console.log('🧪 Running tests...\n');

        // Run beforeAll hooks
        for (const hook of this.beforeAllHooks) {
            await hook();
        }

        // Run tests
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`  ✅ ${test.name}`);
                this.results.passed++;
            } catch (error) {
                console.error(`  ❌ ${test.name}`);
                console.error(`     ${error.message}`);
                this.results.failed++;
                this.results.errors.push({
                    test: test.name,
                    error: error.message
                });
            }
        }

        // Print summary
        console.log('\n' + '─'.repeat(50));
        console.log(`\n📊 Test Results:`);
        console.log(`   Passed: ${this.results.passed}`);
        console.log(`   Failed: ${this.results.failed}`);
        console.log(`   Total:  ${this.tests.length}`);

        if (this.results.failed > 0) {
            console.log('\n❌ Some tests failed');
            return false;
        } else {
            console.log('\n✅ All tests passed!');
            return true;
        }
    }
}

// Global test runner instance
const testRunner = new TestRunner();

// Export test utilities
export function describe(suiteName, fn) {
    testRunner.describe(suiteName, fn);
}

export function it(testName, fn) {
    testRunner.it(testName, fn);
}

export function beforeAll(fn) {
    testRunner.beforeAll(fn);
}

// Expectation API
export function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
            }
        },

        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
            }
        },

        toBeDefined() {
            if (actual === undefined) {
                throw new Error('Expected value to be defined');
            }
        },

        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null, but got ${JSON.stringify(actual)}`);
            }
        },

        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy value, but got ${JSON.stringify(actual)}`);
            }
        },

        toBeFalsy() {
            if (actual) {
                throw new Error(`Expected falsy value, but got ${JSON.stringify(actual)}`);
            }
        },

        toHaveProperty(property) {
            if (!(property in actual)) {
                throw new Error(`Expected object to have property "${property}"`);
            }
        },

        toContain(item) {
            if (!actual.includes(item)) {
                throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
            }
        },

        toHaveLength(length) {
            if (actual.length !== length) {
                throw new Error(`Expected length ${length}, but got ${actual.length}`);
            }
        },

        toThrow() {
            try {
                actual();
                throw new Error('Expected function to throw an error');
            } catch (error) {
                // Expected
            }
        },

        toBeGreaterThan(value) {
            if (actual <= value) {
                throw new Error(`Expected ${actual} to be greater than ${value}`);
            }
        },

        toBeLessThan(value) {
            if (actual >= value) {
                throw new Error(`Expected ${actual} to be less than ${value}`);
            }
        }
    };
}

// Run tests when this module is loaded
if (typeof window !== 'undefined') {
    window.runTests = () => testRunner.run();
}

export { testRunner };
