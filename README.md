# PR Code Review Utility

An intelligent automated code review system that connects to GitHub, analyzes Angular and .NET code changes using OpenAI's GPT-4, and posts constructive feedback directly to pull requests.

## Features

- 🔍 **Intelligent Code Analysis**: Uses GPT-4 to analyze code changes with context awareness
- 🎯 **Framework-Specific Reviews**: Specialized analysis for Angular and .NET projects
- 🤖 **Automated GitHub Integration**: Seamlessly integrates with GitHub PRs
- 📝 **Constructive Feedback**: Provides actionable suggestions and improvements
- 🔒 **Security-Focused**: Identifies potential security vulnerabilities
- ⚡ **Performance Insights**: Highlights performance optimization opportunities
- 🏗️ **Architecture Review**: Evaluates design patterns and best practices
- 🧪 **Testing Recommendations**: Suggests testing improvements
- 📚 **Documentation Guidance**: Recommends documentation enhancements

## Prerequisites

- Node.js 18 or higher
- GitHub Personal Access Token with `repo` and `pull_requests` permissions
- OpenAI API key with GPT-4 access

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pr-code-review-utility
```

2. Install dependencies:
```bash
npm install
```

3. Set up configuration:
```bash
npm run setup
```

4. Create a `.env` file with your credentials (or use the setup command):
```env
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repository_name
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
```

## Usage

### CLI Commands

#### Review a specific PR:
```bash
npm run review -- --pr 123 --owner username --repo repository-name
```

#### Run in dry-run mode (show reviews without posting):
```bash
npm run review -- --pr 123 --dry-run
```

#### Start webhook server for automated reviews:
```bash
npm start webhook --port 3000
```

### Webhook Integration

1. Start the webhook server:
```bash
npm start webhook
```

2. Configure GitHub webhook:
   - Go to your repository settings
   - Navigate to Webhooks
   - Add new webhook with URL: `http://your-server:3000/webhook/github`
   - Select events: Pull requests, Pull request reviews
   - Content type: `application/json`

### Manual API Usage

You can also trigger reviews via HTTP API:

```bash
curl -X POST http://localhost:3000/review \
  -H "Content-Type: application/json" \
  -d '{"owner":"username","repo":"repository","prNumber":123}'
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Required |
| `GITHUB_OWNER` | Repository owner/organization | Required |
| `GITHUB_REPO` | Repository name | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4` |
| `MAX_FILES_PER_REVIEW` | Maximum files to review per PR | `10` |
| `MAX_DIFF_SIZE` | Maximum diff size per file | `5000` |
| `MIN_CONFIDENCE_SCORE` | Minimum confidence for posting | `0.7` |
| `LOG_LEVEL` | Logging level | `info` |

### Supported File Types

**Angular Projects:**
- TypeScript (`.ts`, `.tsx`)
- JavaScript (`.js`, `.jsx`)
- HTML templates (`.html`)
- Styles (`.scss`, `.css`)
- Configuration (`.json`)

**.NET Projects:**
- C# (`.cs`)
- VB.NET (`.vb`)
- F# (`.fs`)
- Razor (`.razor`, `.cshtml`)
- Configuration (`.json`, `.xml`)

## Review Categories

The system analyzes code across multiple dimensions:

### 🔍 Code Quality
- Best practices adherence
- Code readability and maintainability
- Naming conventions
- Code structure and organization

### 🔒 Security
- Potential vulnerabilities
- Input validation
- Authentication and authorization
- Data protection

### ⚡ Performance
- Optimization opportunities
- Memory usage
- Database query efficiency
- Caching strategies

### 🏗️ Architecture
- Design patterns
- SOLID principles
- Dependency injection
- Separation of concerns

### 🧪 Testing
- Test coverage
- Test quality
- Missing test scenarios
- Test maintainability

### 📚 Documentation
- Code comments
- API documentation
- README updates
- Inline documentation

## Framework-Specific Analysis

### Angular
- Component lifecycle best practices
- RxJS usage and memory leak prevention
- Change detection optimization
- Dependency injection patterns
- Angular security guidelines
- TypeScript strict mode compliance

### .NET
- C# coding conventions
- Exception handling patterns
- LINQ optimization
- Entity Framework best practices
- Async/await patterns
- Memory management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the GitHub issues page
2. Create a new issue with detailed information
3. Include relevant logs and configuration

## Roadmap

- [ ] Support for more programming languages
- [ ] Integration with other CI/CD platforms
- [ ] Custom rule configuration
- [ ] Team-specific review templates
- [ ] Performance metrics and analytics
- [ ] Integration with code quality tools