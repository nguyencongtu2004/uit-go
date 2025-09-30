#!/usr/bin/env node

/**
 * UIT-Go Kafka Testing Suite
 * Integrated testing for Event-Driven Architecture
 */

const { spawn, exec } = require('child_process');
const path = require('path');

class KafkaTestSuite {
  constructor() {
    this.testDir = path.join(__dirname, '..', 'test', 'test-kafka');
    this.rootDir = path.join(__dirname, '..');
  }

  async runCommand(command, cwd = this.rootDir, description = '') {
    return new Promise((resolve, reject) => {
      console.log(`🚀 ${description || command}`);

      const child = exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ ${description || command} failed:`, error.message);
          reject(error);
          return;
        }

        if (stdout) console.log(stdout);
        if (stderr) console.warn(stderr);

        console.log(`✅ ${description || command} completed`);
        resolve();
      });
    });
  }

  async checkKafkaHealth() {
    try {
      console.log('\n🏥 Checking Kafka health...');
      await this.runCommand('docker compose ps kafka', this.rootDir, 'Check Kafka container status');

      // Test connectivity
      await this.runCommand(
        `docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list`,
        this.rootDir,
        'Test Kafka connectivity'
      );

      console.log('✅ Kafka is healthy and ready for testing');
      return true;
    } catch (error) {
      console.error('❌ Kafka health check failed:', error.message);
      console.log('\n💡 Try running: docker compose up -d kafka');
      return false;
    }
  }

  async setupTopics() {
    try {
      console.log('\n📋 Setting up Kafka topics...');
      await this.runCommand(
        'node scripts/setup-kafka-topics.js',
        this.rootDir,
        'Setup official Kafka topics'
      );
      return true;
    } catch (error) {
      console.warn('⚠️ Official topic setup failed, trying direct setup...');
      try {
        await this.runCommand(
          'node direct-setup-topics.js',
          this.testDir,
          'Setup topics directly'
        );
        return true;
      } catch (directError) {
        console.error('❌ Topic setup failed:', directError.message);
        return false;
      }
    }
  }

  async testDockerNetwork() {
    try {
      console.log('\n🐳 Testing Docker network connectivity...');
      await this.runCommand(
        `docker run --rm --network uit-go_uit-go-network -v ${this.testDir}:/workspace -w /workspace node:18-alpine sh -c "npm install kafkajs --silent && node test-kafka-docker.js"`,
        this.rootDir,
        'Docker network test'
      );
      return true;
    } catch (error) {
      console.error('❌ Docker network test failed:', error.message);
      return false;
    }
  }

  async testHostConnectivity() {
    try {
      console.log('\n💻 Testing host machine connectivity...');
      await this.runCommand(
        'node test-event-flow.js',
        this.testDir,
        'Host connectivity test'
      );
      return true;
    } catch (error) {
      console.error('❌ Host connectivity test failed:', error.message);
      return false;
    }
  }

  async testProducerConsumer() {
    try {
      console.log('\n🔄 Testing Producer-Consumer flow...');
      await this.runCommand(
        'node test-producer-consumer.js',
        this.testDir,
        'Producer-Consumer test'
      );
      return true;
    } catch (error) {
      console.error('❌ Producer-Consumer test failed:', error.message);
      return false;
    }
  }

  async runLoadTest() {
    try {
      console.log('\n🏋️ Running load test simulation...');
      await this.runCommand(
        'node scripts/test-event-flow.js',
        this.rootDir,
        'Load test (1000 drivers + 100 trips)'
      );
      return true;
    } catch (error) {
      console.error('❌ Load test failed:', error.message);
      return false;
    }
  }

  async runFullTestSuite() {
    console.log('🎯 UIT-Go Kafka Testing Suite');
    console.log('='.repeat(50));

    const results = {
      health: false,
      topics: false,
      dockerNetwork: false,
      hostConnectivity: false,
      producerConsumer: false,
      loadTest: false
    };

    // 1. Health check
    results.health = await this.checkKafkaHealth();
    if (!results.health) {
      console.log('\n❌ Cannot proceed without healthy Kafka. Please fix and retry.');
      return false;
    }

    // 2. Setup topics
    results.topics = await this.setupTopics();

    // 3. Docker network test
    results.dockerNetwork = await this.testDockerNetwork();

    // 4. Host connectivity test
    results.hostConnectivity = await this.testHostConnectivity();

    // 5. Producer-Consumer test
    results.producerConsumer = await this.testProducerConsumer();

    // 6. Load test (optional)
    const runLoadTest = process.argv.includes('--load-test');
    if (runLoadTest) {
      results.loadTest = await this.runLoadTest();
    }

    // Results summary
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));
    console.log(`🏥 Kafka Health:       ${results.health ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📋 Topic Setup:        ${results.topics ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🐳 Docker Network:     ${results.dockerNetwork ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`💻 Host Connectivity:  ${results.hostConnectivity ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🔄 Producer-Consumer:  ${results.producerConsumer ? '✅ PASS' : '❌ FAIL'}`);
    if (runLoadTest) {
      console.log(`🏋️ Load Test:          ${results.loadTest ? '✅ PASS' : '❌ FAIL'}`);
    }

    const allBasicTestsPassed = results.health && results.topics &&
      results.dockerNetwork && results.hostConnectivity &&
      results.producerConsumer;

    if (allBasicTestsPassed) {
      console.log('\n🎉 All tests passed! Event-Driven Architecture is ready!');
      console.log('\n🚀 Ready for UIT-Go load testing:');
      console.log('   - 1000 drivers updating location every 5 seconds');
      console.log('   - 100 concurrent trips');
      console.log('   - Real-time event processing');
      console.log('\n💡 Run with --load-test flag for full load testing');
      return true;
    } else {
      console.log('\n❌ Some tests failed. Please check the issues above.');
      return false;
    }
  }

  async runSingleTest(testName) {
    console.log(`🎯 Running single test: ${testName}`);

    const tests = {
      'health': () => this.checkKafkaHealth(),
      'topics': () => this.setupTopics(),
      'docker': () => this.testDockerNetwork(),
      'host': () => this.testHostConnectivity(),
      'producer-consumer': () => this.testProducerConsumer(),
      'load': () => this.runLoadTest()
    };

    if (tests[testName]) {
      const success = await tests[testName]();
      process.exit(success ? 0 : 1);
    } else {
      console.error(`❌ Unknown test: ${testName}`);
      console.log('Available tests: health, topics, docker, host, producer-consumer, load');
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const tester = new KafkaTestSuite();

  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🎯 UIT-Go Kafka Testing Suite

Usage:
  node scripts/test-kafka.js [options] [test-name]

Options:
  --help, -h        Show this help
  --load-test       Include load testing in full suite
  
Test Names (for single test):
  health            Check Kafka health
  topics            Setup Kafka topics
  docker            Test Docker network connectivity
  host              Test host machine connectivity  
  producer-consumer Test producer-consumer flow
  load              Run load test simulation

Examples:
  node scripts/test-kafka.js                    # Run full test suite
  node scripts/test-kafka.js --load-test        # Full suite + load test
  node scripts/test-kafka.js health             # Single health check
  node scripts/test-kafka.js docker             # Single Docker test
`);
    return;
  }

  // Single test
  if (args.length > 0 && !args[0].startsWith('--')) {
    await tester.runSingleTest(args[0]);
    return;
  }

  // Full test suite
  const success = await tester.runFullTestSuite();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = KafkaTestSuite;