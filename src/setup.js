import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export async function setupConfig() {
  console.log(chalk.blue('🔧 Setting up PR Code Review Utility\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'githubToken',
      message: 'Enter your GitHub Personal Access Token:',
      validate: (input) => {
        if (!input.trim()) {
          return 'GitHub token is required';
        }
        if (!input.startsWith('ghp_') && !input.startsWith('github_pat_')) {
          return 'Invalid GitHub token format';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'githubOwner',
      message: 'Enter GitHub repository owner (username/organization):',
      validate: (input) => input.trim() ? true : 'Repository owner is required'
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'Enter GitHub repository name:',
      validate: (input) => input.trim() ? true : 'Repository name is required'
    },
    {
      type: 'input',
      name: 'openaiApiKey',
      message: 'Enter your OpenAI API Key:',
      validate: (input) => {
        if (!input.trim()) {
          return 'OpenAI API key is required';
        }
        if (!input.startsWith('sk-')) {
          return 'Invalid OpenAI API key format';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'openaiModel',
      message: 'Select OpenAI model:',
      choices: [
        { name: 'GPT-3.5 Turbo (Recommended - Most Compatible)', value: 'gpt-3.5-turbo' },
        { name: 'GPT-3.5 Turbo 16K', value: 'gpt-3.5-turbo-16k' },
        { name: 'GPT-4 (Requires API access)', value: 'gpt-4' },
        { name: 'GPT-4 Turbo (Requires API access)', value: 'gpt-4-turbo-preview' }
      ],
      default: 'gpt-3.5-turbo'
    },
    {
      type: 'number',
      name: 'maxFilesPerReview',
      message: 'Maximum files to review per PR:',
      default: 10,
      validate: (input) => input > 0 ? true : 'Must be a positive number'
    },
    {
      type: 'number',
      name: 'maxDiffSize',
      message: 'Maximum diff size per file (characters):',
      default: 5000,
      validate: (input) => input > 0 ? true : 'Must be a positive number'
    }
  ]);

  const envContent = `# GitHub Configuration
GITHUB_TOKEN=${answers.githubToken}
GITHUB_OWNER=${answers.githubOwner}
GITHUB_REPO=${answers.githubRepo}

# OpenAI Configuration
OPENAI_API_KEY=${answers.openaiApiKey}
OPENAI_MODEL=${answers.openaiModel}

# Review Configuration
MAX_FILES_PER_REVIEW=${answers.maxFilesPerReview}
MAX_DIFF_SIZE=${answers.maxDiffSize}
MIN_CONFIDENCE_SCORE=0.7

# Logging
LOG_LEVEL=info
`;

  await fs.writeFile('.env', envContent);
  console.log(chalk.green('\n✓ Configuration saved to .env file'));
  console.log(chalk.yellow('⚠️  Make sure to add .env to your .gitignore file'));
  
  // Display helpful information about model access
  console.log(chalk.cyan('\n📝 Model Access Information:'));
  console.log(chalk.white('• GPT-3.5 Turbo models are available to all OpenAI API users'));
  console.log(chalk.white('• GPT-4 models require special access - check your OpenAI dashboard'));
  console.log(chalk.white('• The application will automatically fallback to GPT-3.5 Turbo if your selected model is not available'));
}