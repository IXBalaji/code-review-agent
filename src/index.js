#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
import { PRReviewService } from './services/PRReviewService.js';
import { setupConfig } from './setup.js';
import { logger } from './utils/logger.js';
import inquirer from 'inquirer';

// Load environment variables
config();

const program = new Command();

program
  .name('pr-reviewer')
  .description('Automated PR code review utility for Angular and .NET projects')
  .version('1.0.0');

program
  .command('setup')
  .description('Setup configuration for GitHub and OpenAI')
  .action(async () => {
    try {
      await setupConfig();
      console.log(chalk.green('✓ Configuration setup completed!'));
    } catch (error) {
      console.error(chalk.red('✗ Setup failed:', error.message));
      process.exit(1);
    }
  });

program
  .command('review')
  .description('Review a specific PR')
  .option('-p, --pr <number>', 'PR number to review')
  .option('-o, --owner <string>', 'Repository owner')
  .option('-r, --repo <string>', 'Repository name')
  .option('-u, --url <string>', 'PR URL (e.g., https://github.com/owner/repo/pull/123)')
  .option('--dry-run', 'Show review comments without posting to GitHub')
  .action(async (options) => {
    try {
      let prNumber, owner, repo;

      // If URL is provided, parse it
      if (options.url) {
        const parsed = parsePRUrl(options.url);
        if (!parsed) {
          console.error(chalk.red('✗ Invalid PR URL format. Expected: https://github.com/owner/repo/pull/123'));
          process.exit(1);
        }
        ({ owner, repo, prNumber } = parsed);
        console.log(chalk.blue(`📋 Parsed PR URL: ${owner}/${repo}#${prNumber}`));
      } else {
        // Use provided options or environment variables
        prNumber = options.pr || process.env.PR_NUMBER;
        owner = options.owner || process.env.GITHUB_OWNER;
        repo = options.repo || process.env.GITHUB_REPO;
      }

      // If still missing information, prompt user
      if (!prNumber || !owner || !repo) {
        const answers = await promptForPRDetails(prNumber, owner, repo);
        prNumber = prNumber || answers.prNumber;
        owner = owner || answers.owner;
        repo = repo || answers.repo;
      }

      if (!prNumber || !owner || !repo) {
        console.error(chalk.red('✗ PR number, repository owner, and name are required.'));
        process.exit(1);
      }

      const reviewService = new PRReviewService();
      await reviewService.reviewPR({
        owner,
        repo,
        prNumber: parseInt(prNumber),
        dryRun: options.dryRun || false
      });

      console.log(chalk.green('✓ PR review completed successfully!'));
    } catch (error) {
      logger.error('Review failed:', error);
      console.error(chalk.red('✗ Review failed:', error.message));
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('Interactive mode to review a PR')
  .action(async () => {
    try {
      console.log(chalk.blue('🤖 Welcome to PR Code Review Utility - Interactive Mode\n'));

      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'inputMethod',
          message: 'How would you like to specify the PR?',
          choices: [
            { name: 'Paste PR URL', value: 'url' },
            { name: 'Enter details manually', value: 'manual' }
          ]
        }
      ]);

      let prNumber, owner, repo;

      if (answers.inputMethod === 'url') {
        const urlAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'prUrl',
            message: 'Enter the PR URL:',
            validate: (input) => {
              if (!input.trim()) return 'PR URL is required';
              const parsed = parsePRUrl(input.trim());
              if (!parsed) return 'Invalid PR URL format. Expected: https://github.com/owner/repo/pull/123';
              return true;
            }
          }
        ]);

        const parsed = parsePRUrl(urlAnswer.prUrl);
        ({ owner, repo, prNumber } = parsed);
        console.log(chalk.green(`✓ Parsed: ${owner}/${repo}#${prNumber}\n`));
      } else {
        const manualAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'owner',
            message: 'Repository owner (username/organization):',
            default: process.env.GITHUB_OWNER,
            validate: (input) => input.trim() ? true : 'Repository owner is required'
          },
          {
            type: 'input',
            name: 'repo',
            message: 'Repository name:',
            default: process.env.GITHUB_REPO,
            validate: (input) => input.trim() ? true : 'Repository name is required'
          },
          {
            type: 'input',
            name: 'prNumber',
            message: 'PR number:',
            validate: (input) => {
              const num = parseInt(input);
              return num > 0 ? true : 'Please enter a valid PR number';
            }
          }
        ]);

        ({ owner, repo, prNumber } = manualAnswers);
        prNumber = parseInt(prNumber);
      }

      const dryRunAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'dryRun',
          message: 'Run in dry-run mode? (show reviews without posting to GitHub)',
          default: true
        }
      ]);

      console.log(chalk.blue('\n🔍 Starting PR review...\n'));

      const reviewService = new PRReviewService();
      await reviewService.reviewPR({
        owner,
        repo,
        prNumber,
        dryRun: dryRunAnswer.dryRun
      });

      console.log(chalk.green('\n✓ PR review completed successfully!'));
    } catch (error) {
      logger.error('Interactive review failed:', error);
      console.error(chalk.red('✗ Review failed:', error.message));
      process.exit(1);
    }
  });

program
  .command('webhook')
  .description('Start webhook server for automated PR reviews')
  .option('-p, --port <number>', 'Port to run webhook server', '3000')
  .action(async (options) => {
    try {
      const { WebhookServer } = await import('./services/WebhookServer.js');
      const server = new WebhookServer(parseInt(options.port));
      await server.start();
      console.log(chalk.green(`✓ Webhook server started on port ${options.port}`));
    } catch (error) {
      logger.error('Webhook server failed:', error);
      console.error(chalk.red('✗ Webhook server failed:', error.message));
      process.exit(1);
    }
  });

// Utility functions
function parsePRUrl(url) {
  try {
    // Support various GitHub PR URL formats
    const patterns = [
      /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
      /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pulls\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          prNumber: parseInt(match[3])
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function promptForPRDetails(existingPrNumber, existingOwner, existingRepo) {
  const questions = [];

  if (!existingOwner) {
    questions.push({
      type: 'input',
      name: 'owner',
      message: 'Repository owner (username/organization):',
      default: process.env.GITHUB_OWNER,
      validate: (input) => input.trim() ? true : 'Repository owner is required'
    });
  }

  if (!existingRepo) {
    questions.push({
      type: 'input',
      name: 'repo',
      message: 'Repository name:',
      default: process.env.GITHUB_REPO,
      validate: (input) => input.trim() ? true : 'Repository name is required'
    });
  }

  if (!existingPrNumber) {
    questions.push({
      type: 'input',
      name: 'prNumber',
      message: 'PR number:',
      validate: (input) => {
        const num = parseInt(input);
        return num > 0 ? true : 'Please enter a valid PR number';
      }
    });
  }

  if (questions.length === 0) {
    return {};
  }

  return await inquirer.prompt(questions);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
});

program.parse();