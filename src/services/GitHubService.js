import { Octokit } from '@octokit/rest';
import { logger } from '../utils/logger.js';

export class GitHubService {
  constructor() {
    const token = process.env.GITHUB_TOKEN;

    if (!token || token === 'your_github_personal_access_token_here') {
      throw new Error('GitHub token is not configured. Please run "npm run setup" to configure your API keys.');
    }

    this.octokit = new Octokit({
      auth: token
    });
  }

  async getPRDetails(owner, repo, prNumber) {
    try {
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      return {
        title: data.title,
        body: data.body,
        state: data.state,
        author: data.user.login,
        baseBranch: data.base.ref,
        headBranch: data.head.ref,
        url: data.html_url,
        head: data.head
      };
    } catch (error) {
      logger.error('Failed to fetch PR details:', error);
      throw new Error(`Failed to fetch PR details: ${error.message}`);
    }
  }

  async getPRDiff(owner, repo, prNumber) {
    try {
      const { data } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: {
          format: 'diff'
        }
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch PR diff:', error);
      throw new Error(`Failed to fetch PR diff: ${error.message}`);
    }
  }

  async getPRFiles(owner, repo, prNumber) {
    try {
      const { data } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch PR files:', error);
      throw new Error(`Failed to fetch PR files: ${error.message}`);
    }
  }

  async postReviewComment(owner, repo, prNumber, comment) {
    try {
      const { data } = await this.octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        body: comment.body,
        path: comment.path,
        line: comment.line,
        position: comment.line,                      // Position of the line in the diff
        commit_id: comment.commit_id
      });

      logger.info(`Posted comment on ${comment.path}:${comment.line}`);
      return data;
    } catch (error) {
      logger.error('Failed to post review comment:', error);
      throw new Error(`Failed to post review comment: ${error.message}`);
    }
  }

  async createReview(owner, repo, prNumber, review) {
    try {
      const { data } = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        body: review.body,
        event: review.event || 'COMMENT',
        comments: review.comments
      });

      logger.info(`Created review for PR #${prNumber}`);
      return data;
    } catch (error) {
      logger.error('Failed to create review:', error);
      throw new Error(`Failed to create review: ${error.message}`);
    }
  }

  async addLabels(owner, repo, prNumber, labels) {
    try {
      const { data } = await this.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels
      });

      logger.info(`Added labels to PR #${prNumber}: ${labels.join(', ')}`);
      return data;
    } catch (error) {
      logger.error('Failed to add labels:', error);
      throw new Error(`Failed to add labels: ${error.message}`);
    }
  }
}