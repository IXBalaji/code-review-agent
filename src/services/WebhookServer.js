import express from 'express';
import { PRReviewService } from './PRReviewService.js';
import { logger } from '../utils/logger.js';

export class WebhookServer {
  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.reviewService = new PRReviewService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Basic logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Root endpoint with API information and PR URL form
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PR Code Review Utility</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 20px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 8px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            h1 { color: #333; margin-bottom: 10px; }
            .subtitle { color: #666; margin-bottom: 30px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: 500; }
            input[type="url"], input[type="text"] { 
              width: 100%; 
              padding: 10px; 
              border: 1px solid #ddd; 
              border-radius: 4px; 
              font-size: 14px; 
            }
            button { 
              background: #0366d6; 
              color: white; 
              padding: 10px 20px; 
              border: none; 
              border-radius: 4px; 
              cursor: pointer; 
              font-size: 14px; 
              margin-right: 10px;
            }
            button:hover { background: #0256cc; }
            .dry-run { background: #28a745; }
            .dry-run:hover { background: #218838; }
            .status { 
              margin-top: 20px; 
              padding: 10px; 
              border-radius: 4px; 
              display: none; 
            }
            .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .status.loading { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
            .endpoints { 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 4px; 
              margin-top: 20px; 
            }
            .endpoints h3 { margin-top: 0; }
            .endpoint { margin: 5px 0; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 Smart Code Review Assistant</h1>
            <p class="subtitle">Supercharge your code with AI-powered reviews and insights</p>
            
            <form id="reviewForm">
              <div class="form-group">
                <label for="prUrl"> Pull Request URL:</label>
                <input 
                  type="url" 
                  id="prUrl" 
                  name="prUrl" 
                  placeholder="https://github.com/owner/repo/pull/123"
                  required
                />
              </div>
              
              <button type="submit" name="action" value="review">🔍 Review PR</button>
              
            </form>
            
            <div id="status" class="status"></div>
            
            
          </div>

          <script>
            document.getElementById('reviewForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const formData = new FormData(e.target);
              const prUrl = formData.get('prUrl');
              const isDryRun = e.submitter.value === 'dry-run';
              
              const statusDiv = document.getElementById('status');
              statusDiv.className = 'status loading';
              statusDiv.style.display = 'block';
              statusDiv.textContent = isDryRun ? 'Running dry-run review...' : 'Starting PR review...';
              
              try {
                const response = await fetch('/review-url', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prUrl, dryRun: isDryRun })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  statusDiv.className = 'status success';
                  statusDiv.textContent = result.message;
                } else {
                  statusDiv.className = 'status error';
                  statusDiv.textContent = result.error || 'Review failed';
                }
              } catch (error) {
                statusDiv.className = 'status error';
                statusDiv.textContent = 'Network error: ' + error.message;
              }
            });
          </script>
        </body>
        </html>
      `);
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // GitHub webhook endpoint
    this.app.post('/webhook/github', async (req, res) => {
      try {
        const event = req.headers['x-github-event'];
        const payload = req.body;

        if (event === 'pull_request') {
          await this.handlePullRequestEvent(payload);
        } else if (event === 'pull_request_review') {
          await this.handlePullRequestReviewEvent(payload);
        }

        res.status(200).json({ message: 'Event processed successfully' });
      } catch (error) {
        logger.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Manual review endpoint
    this.app.post('/review', async (req, res) => {
      try {
        const { owner, repo, prNumber } = req.body;

        if (!owner || !repo || !prNumber) {
          return res.status(400).json({
            error: 'Missing required parameters: owner, repo, prNumber'
          });
        }

        await this.reviewService.reviewPR({
          owner,
          repo,
          prNumber: parseInt(prNumber),
          dryRun: false
        });

        res.json({ message: 'Review completed successfully' });
      } catch (error) {
        logger.error('Manual review error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Review by PR URL endpoint
    this.app.post('/review-url', async (req, res) => {
      try {
        const { prUrl, dryRun = false } = req.body;

        if (!prUrl) {
          return res.status(400).json({
            error: 'Missing required parameter: prUrl'
          });
        }

        const parsed = this.parsePRUrl(prUrl);
        if (!parsed) {
          return res.status(400).json({
            error: 'Invalid PR URL format. Expected: https://github.com/owner/repo/pull/123'
          });
        }

        const { owner, repo, prNumber } = parsed;

        await this.reviewService.reviewPR({
          owner,
          repo,
          prNumber,
          dryRun
        });

        res.json({
          message: dryRun
            ? `Dry-run review completed for ${owner}/${repo}#${prNumber}`
            : `Review completed successfully for ${owner}/${repo}#${prNumber}`,
          prDetails: { owner, repo, prNumber }
        });
      } catch (error) {
        logger.error('PR URL review error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  parsePRUrl(url) {
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

  async handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;

    // Only review when PR is opened or updated
    if (!['opened', 'synchronize'].includes(action)) {
      return;
    }

    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;

    logger.info(`Processing PR #${prNumber} (${action}) in ${owner}/${repo}`);

    // Add a small delay to ensure GitHub has processed the changes
    setTimeout(async () => {
      try {
        await this.reviewService.reviewPR({
          owner,
          repo,
          prNumber,
          dryRun: false
        });
      } catch (error) {
        logger.error(`Failed to review PR #${prNumber}:`, error);
      }
    }, 5000);
  }

  async handlePullRequestReviewEvent(payload) {
    const { action, review, pull_request, repository } = payload;

    // Handle review submitted events if needed
    if (action === 'submitted' && review.state === 'approved') {
      logger.info(`PR #${pull_request.number} approved by ${review.user.login}`);
      // Could add additional logic here, like removing review labels
    }
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Webhook server started on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Webhook server stopped');
          resolve();
        });
      });
    }
  }
}