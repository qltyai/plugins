const fs = require('fs');
const path = require('path');

async function createIssues(github, context) {
  // Path to the JSON file containing the issues
  const filePath = path.join(process.env.GITHUB_WORKSPACE, 'github_issues.json');
  const issuesData = fs.readFileSync(filePath, 'utf8');
  const issues = JSON.parse(issuesData);

  // Loop through each issue object and create it
  for (const issue of issues) {
    const { title, body, assignees } = issue;
    console.log(`Creating issue: ${title}`);
    await github.rest.issues.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: title,
      body: body,
      assignees: assignees
    });
  }
}

module.exports = createIssues;
