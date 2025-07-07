import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

export class OpenAIService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      throw new Error('OpenAI API key is not configured. Please run "npm run setup" to configure your API keys.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey
    });
    // Ensure we use the environment variable, with a safe fallback
    this.model = process.env.OPENAI_MODEL;
    this.fallbackModels = ['gpt-3.5-turbo'];

    logger.info(`OpenAI Service initialized with model: ${this.model}`);
  }

  async analyzeCode(diff, context) {

    const prompt = this.buildPrompt(diff, context);

    const response = await this.makeOpenAIRequest(prompt, context);
    const analysis = response.choices[0].message.content;
    return this.parseAnalysis(analysis);
  }

  async makeOpenAIRequest(prompt, context, modelToTry = null) {
    const model = modelToTry || this.model;

    try {
      logger.info(`Attempting to use model: ${model}`);

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(context)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      return response; // Or response.choices[0].message.content;
    } catch (error) {
      if (
        error.status === 404 &&
        (error.message?.includes('does not exist') || error.message?.includes('do not have access'))
      ) {
        logger.warn(`Model ${model} not available, trying fallback models...`);

        for (const fallbackModel of this.fallbackModels) {
          if (fallbackModel !== model) {
            try {
              logger.info(`Trying fallback model: ${fallbackModel}`);
              return await this.makeOpenAIRequest(prompt, context, fallbackModel);
            } catch (fallbackError) {
              logger.warn(`Fallback model ${fallbackModel} also failed: ${fallbackError.message}`);
            }
          }
        }

        throw new Error(
          `None of the available models (${model}, ${this.fallbackModels.join(', ')}) are accessible with your API key. Please check your OpenAI account permissions or run 'npm run setup' to reconfigure.`
        );
      }

      // Consider logging unexpected errors here too
      logger.error(`OpenAI request failed: ${error.message}`);
      throw error;
    }
  }


  getSystemPrompt(context) {
    let systemPrompt = `You are an expert code reviewer specializing in ${context.language} development. 
Your task is to review code diffs and provide **constructive, actionable feedback** focused on:

1. Code Quality: Best practices, readability, maintainability
2. Security: Vulnerabilities, anti-patterns, input validation
3. Performance: Efficiency issues, optimization opportunities
4. Architecture: Design patterns, SOLID principles, clean design
5. Testing: Missing/insufficient tests, test structure
6. Documentation: Code comments, API docs, clarity

`;

    if (context.isAngularProject) {
      systemPrompt += `
Angular-specific guidelines:
- Follow Angular style guide
- Correct component lifecycle management
- RxJS best practices (avoid memory leaks, proper operator usage)
- TypeScript strict mode compliance
- Proper dependency injection patterns
- Angular security (XSS prevention, CSRF protection)
- Performance (OnPush, lazy loading)
- Accessibility (ARIA, semantic HTML)
`;
    }

    if (context.isDotNetProject) {
      systemPrompt += `
.NET-specific guidelines:
- C# coding conventions and .NET best practices
- Exception handling and logging
- LINQ performance and readability
- Entity Framework optimization
- Proper memory management and disposal
- Async/await usage
- Security (input validation, auth, authorization)
- Caching and DB query efficiency
`;
    }

    systemPrompt += `
Response format (JSON):
{
  "summary": "Brief overall assessment of code quality",
  "issues": [
    {
      "line": 10,
      "title": "Short issue title",
      "description": "What is wrong and why",
      "severity": "high|medium|low|info",
      "category": "quality|security|performance|architecture|testing|documentation",
      "suggestion": "What to do to improve",
      "example": "Optional code snippet",
      "language": "typescript|csharp"
    }
  ],
  "positives": ["Short positive observations"],
  "score": 85
}

Return only JSON. Be specific, constructive, and clear in feedback. If no issues, acknowledge the code quality.`;

    return systemPrompt;
  }


  buildPrompt(diff, context) {
    return `You are an expert code reviewer for Angular (TypeScript) and .NET (C#). 
Review the following GitHub Pull Request diff. Identify potential issues, suggest improvements, and write inline comments.

Provide output in this format:
<file>:<line>: <comment>

---

PR details:
- File: ${context.filename}
- Language: ${context.language}
- Title: ${context.prTitle}
- Description: ${context.prDescription}

Code diff:
\`\`\`diff
${diff}
\`\`\`

Focus on:
- Code quality
- Security
- Performance
- Architecture
- Testing
- Documentation

Be specific about line numbers. Provide actionable suggestions, not just generic observations.`;
  }

  parseAnalysis(analysis) {
    try {
      // Try to parse as JSON first
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback to text parsing
      return this.parseTextAnalysis(analysis);
    } catch (error) {
      logger.warn('Failed to parse analysis as JSON, using text parsing:', error);
      return this.parseTextAnalysis(analysis);
    }
  }

  parseTextAnalysis(analysis) {
    const lines = analysis.split('\n');
    const issues = [];
    let currentIssue = null;

    lines.forEach(line => {
      line = line.trim();

      // Look for issue markers
      if (line.match(/^\d+\./)) {
        if (currentIssue) {
          issues.push(currentIssue);
        }
        currentIssue = {
          title: line.replace(/^\d+\.\s*/, ''),
          description: '',
          severity: 'info',
          category: 'quality'
        };
      } else if (currentIssue && line) {
        currentIssue.description += line + ' ';
      }
    });

    if (currentIssue) {
      issues.push(currentIssue);
    }

    return {
      summary: 'Code review completed',
      issues,
      positives: [],
      score: 75
    };
  }
}