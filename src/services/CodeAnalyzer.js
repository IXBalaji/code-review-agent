export class CodeAnalyzer {
  async parseGitDiff(diff) {
    const files = [];
    const fileSections = diff.split(/^diff --git/m);

    fileSections.forEach(section => {
      if (!section.trim()) return;

      const lines = section.split('\n');
      const fileInfo = this.parseFileInfo(lines);

      if (fileInfo) {
        files.push(fileInfo);
      }
    });

    return files;
  }

  parseFileInfo(lines) {
    const fileInfo = {
      filename: '',
      status: 'modified',
      additions: 0,
      deletions: 0,
      patch: ''
    };

    let patchStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract filename
      if (line.startsWith(' a/') && line.includes(' b/')) {
        const match = line.match(/a\/(.+) b\/(.+)/);
        if (match) {
          fileInfo.filename = match[2];
        }
      }

      // Detect file status
      if (line.startsWith('new file mode')) {
        fileInfo.status = 'added';
      } else if (line.startsWith('deleted file mode')) {
        fileInfo.status = 'deleted';
      } else if (line.startsWith('rename from')) {
        fileInfo.status = 'renamed';
      }

      // Find patch start
      if (line.startsWith('@@')) {
        patchStartIndex = i;
        break;
      }
    }

    if (patchStartIndex >= 0) {
      const patchLines = lines.slice(patchStartIndex);
      fileInfo.patch = patchLines.join('\n');

      // Count additions and deletions
      patchLines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          fileInfo.additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          fileInfo.deletions++;
        }
      });
    }

    return fileInfo.filename ? fileInfo : null;
  }

  extractLineNumbers(patch) {
    const lines = patch.split('\n');
    const lineNumbers = [];
    let currentLine = 1;

    lines.forEach(line => {
      const hunkHeader = line.match(/^@@ -\d+,?\d* \+(\d+),?\d* @@/);
      if (hunkHeader) {
        currentLine = parseInt(hunkHeader[1]);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        lineNumbers.push(currentLine);
        currentLine++;
      } else if (!line.startsWith('-') && !line.startsWith('---')) {
        currentLine++;
      }
    });

    return lineNumbers;
  }

  getFileComplexity(patch) {
    const lines = patch.split('\n');
    let complexity = 0;

    // Simple complexity metrics
    lines.forEach(line => {
      if (line.match(/\b(if|for|while|switch|catch|function|class)\b/)) {
        complexity++;
      }
    });

    return complexity;
  }

  getChangeTypes(patch) {
    const types = new Set();
    const lines = patch.split('\n');

    lines.forEach(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        if (line.includes('import') || line.includes('require')) {
          types.add('dependency');
        } else if (line.includes('function') || line.includes('class')) {
          types.add('structure');
        } else if (line.includes('test') || line.includes('spec')) {
          types.add('test');
        } else if (line.includes('TODO') || line.includes('FIXME')) {
          types.add('comment');
        } else {
          types.add('logic');
        }
      }
    });

    return Array.from(types);
  }
}