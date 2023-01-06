// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

var baseConfig = require('@jupyterlab/galata/lib/playwright-config');

module.exports = {
  ...baseConfig,
  timeout: 90000,
  projects: [
    {
      name: 'documentation',
      testMatch: 'test/documentation/**',
      testIgnore: '**/.ipynb_checkpoints/**'
    }
  ],
  use: {
    ...baseConfig.use,
    launchOptions: {
      // Force slow motion
      slowMo: 30
    },
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write']
    }
  },
  // Switch to 'always' to keep raw assets for all tests
  preserveOutput: 'failures-only', // Breaks HTML report if use.video == 'on'
  // Try one retry as some tests are flaky
  retries: process.env.CI ? 2 : 0
};
