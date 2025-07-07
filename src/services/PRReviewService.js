import { GitHubService } from './GitHubService.js';
import { OpenAIService } from './OpenAIService.js';
import { CodeAnalyzer } from './CodeAnalyzer.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';
import ora from 'ora';

export class PRReviewService {
  constructor() {
    this.githubService = new GitHubService();
    this.openaiService = new OpenAIService();
    this.codeAnalyzer = new CodeAnalyzer();
    this.maxFilesPerReview = parseInt(process.env.MAX_FILES_PER_REVIEW) || 10;
    this.maxDiffSize = parseInt(process.env.MAX_DIFF_SIZE) || 5000;
  }

  async reviewPR({ owner, repo, prNumber, dryRun = false }) {
    const spinner = ora('Fetching PR details...').start();

    try {
      // Fetch PR details
      const prDetails = await this.githubService.getPRDetails(owner, repo, prNumber);
      spinner.succeed(`Found PR #${prNumber}: ${prDetails.title}`);

      // Fetch PR diff
      spinner.start('Fetching PR diff...');
      const diff = await this.githubService.getPRDiff(owner, repo, prNumber);
      spinner.succeed('PR diff fetched successfully');

      // Parse and filter files
      spinner.start('Analyzing changed files...');
      const changedFiles = await this.codeAnalyzer.parseGitDiff(diff);
      const filteredFiles = this.filterRelevantFiles(changedFiles);

      if (filteredFiles.length === 0) {
        spinner.warn('No relevant files found for review');
        return;
      }

      spinner.succeed(`Found ${filteredFiles.length} files to review`);

      // Review each file
      const reviews = [];
      for (const file of filteredFiles.slice(0, this.maxFilesPerReview)) {
        spinner.start(`Reviewing ${file.filename}...`);

        try {
          const review = await this.reviewFile(file, prDetails);
          if (review && review.comments.length > 0) {
            reviews.push(review);
            spinner.succeed(`Reviewed ${file.filename} (${review.comments.length} comments)`);
          } else {
            spinner.info(`No issues found in ${file.filename}`);
          }
        } catch (error) {
          spinner.fail(`Failed to review ${file.filename}: ${error.message}`);
          logger.error(`Error reviewing file ${file.filename}:`, error);
        }
      }

      // Post reviews to GitHub
      if (reviews.length > 0) {
        if (dryRun) {
          spinner.info('Dry run mode - displaying reviews without posting');
          this.displayReviews(reviews);
        } else {
          spinner.start('Posting reviews to GitHub...');
          await this.postReviews(owner, repo, prNumber, reviews);
          spinner.succeed('Reviews posted successfully');
        }
      } else {
        spinner.info('No reviews to post');
      }

    } catch (error) {
      spinner.fail('PR review failed');
      throw error;
    }
  }

  async reviewFile(file, prDetails) {
    const fileExtension = this.getFileExtension(file.filename);
    const language = this.detectLanguage(fileExtension);

    if (!this.isRelevantFile(language, fileExtension)) {
      return null;
    }

    const diff = file.patch;
    if (!diff || diff.length > this.maxDiffSize) {
      logger.warn(`Skipping ${file.filename}: diff too large or empty`);
      return null;
    }

    const context = {
      filename: file.filename,
      language,
      prTitle: prDetails.title,
      prDescription: prDetails.body || '',
      isAngularProject: this.isAngularProject(prDetails),
      isDotNetProject: this.isDotNetProject(prDetails)
    };

    const analysis = await this.openaiService.analyzeCode(diff, context);
    const comments = this.parseAnalysisToComments(analysis, file);

    return {
      filename: file.filename,
      comments,
      analysis
    };
  }

  filterRelevantFiles(files) {
    return files.filter(file => {
      const extension = this.getFileExtension(file.filename);
      return this.isRelevantFile(this.detectLanguage(extension), extension);
    });
  }

  isRelevantFile(language, extension) {
    const relevantExtensions = [
      // Angular/TypeScript
      '.ts', '.js', '.tsx', '.jsx', '.html', '.scss', '.css',
      // .NET
      '.cs', '.vb', '.fs', '.razor', '.cshtml',
      // Config files
      '.json', '.xml', '.yml', '.yaml'
    ];

    return relevantExtensions.includes(extension.toLowerCase());
  }

  detectLanguage(extension) {
    const languageMap = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.html': 'html',
      '.scss': 'scss',
      '.css': 'css',
      '.cs': 'csharp',
      '.vb': 'vb.net',
      '.fs': 'fsharp',
      '.razor': 'razor',
      '.cshtml': 'razor',
      '.json': 'json',
      '.xml': 'xml',
      '.yml': 'yaml',
      '.yaml': 'yaml'
    };

    return languageMap[extension.toLowerCase()] || 'text';
  }

  getFileExtension(filename) {
    return '.' + filename.split('.').pop();
  }

  isAngularProject(prDetails) {
    const angularIndicators = [
      'angular', '@angular', 'ng-', 'angular.json', 'package.json',
      'component.ts', 'service.ts', 'module.ts'
    ];

    const content = (prDetails.title + ' ' + prDetails.body).toLowerCase();
    return angularIndicators.some(indicator => content.includes(indicator));
  }

  isDotNetProject(prDetails) {
    const dotNetIndicators = [
      '.net', 'dotnet', 'csharp', 'c#', '.cs', '.csproj',
      'asp.net', 'blazor', 'razor', 'entity framework'
    ];

    const content = (prDetails.title + ' ' + prDetails.body).toLowerCase();
    return dotNetIndicators.some(indicator => content.includes(indicator));
  }

  parseAnalysisToComments(analysis, file) {
    const comments = [];

    if (analysis.issues) {
      analysis.issues.forEach(issue => {
        comments.push({
          path: file.filename,
          line: issue.line || 1,
          body: this.formatComment(issue),
          severity: issue.severity || 'info'
        });
      });
    }

    return comments;
  }

  formatComment(issue) {
    const severityEmoji = {
      'high': '🚨',
      'medium': '⚠️',
      'low': '💡',
      'info': 'ℹ️'
    };

    const emoji = severityEmoji[issue.severity] || 'ℹ️';

    return `${emoji} **${issue.title}**

${issue.description}

${issue.suggestion ? `**Suggestion:**\n${issue.suggestion}` : ''}

${issue.example ? `**Example:**\n\`\`\`${issue.language || 'typescript'}\n${issue.example}\n\`\`\`` : ''}

---
*Generated by PR Code Review Utility*`;
  }

  async postReviews(owner, repo, prNumber, reviews) {
    const allComments = reviews.flatMap(review => review.comments);

    for (const comment of allComments) {
      await this.githubService.postReviewComment(owner, repo, prNumber, comment);
    }
  }

  displayReviews(reviews) {
    console.log(chalk.blue('\n📋 Code Review Results\n'));

    reviews.forEach(review => {
      console.log(chalk.cyan(`📄 ${review.filename}`));
      console.log('─'.repeat(50));

      review.comments.forEach(comment => {
        console.log(`Line ${comment.line}: ${comment.body}\n`);
      });

      console.log('');
    });
  }
}