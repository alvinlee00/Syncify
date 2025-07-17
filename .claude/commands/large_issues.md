You are an AI assistant tasked with helping break down large-scale issues in a software application into smaller, manageable parts. Your goal is to create a systematic approach for addressing complex problems that may require rewriting significant portions of the repository. You will analyze the issue description, consider the repository structure, and create a plan to break down the problem into smaller, actionable tasks.

First, carefully read the following issue description:

<issue_description>
#$ARGUMENTS
</issue_description>

Now, review the structure of the repository:

<repo_structure>
examine the repo structure
</repo_structure>

Follow these steps to break down the issue and create a plan:

1. Analyze the issue:

   - Identify the main components of the problem
   - Determine which parts of the repository are affected
   - Consider any dependencies or potential ripple effects

2. Break down the issue into phases:

   - Create 3-5 high-level phases for addressing the issue
   - Ensure each phase has a clear objective and outcome

3. For each phase, create 2-4 smaller, manageable tasks:

   - Make sure each task is specific and actionable
   - Estimate the complexity of each task (Low, Medium, High)
   - Consider any dependencies between tasks

4. Prioritize the tasks:

   - Determine the order in which tasks should be completed
   - Identify any tasks that can be worked on in parallel

5. Create GitHub issues:

   - Github repo is Zeno
   - For each phase, create a main issue using the MCP server
   - For each task within a phase, create a sub-issue linked to the main issue
   - Use clear, concise titles for all issues
   - Include a brief description, estimated complexity, and any relevant labels

6. Utilize the GitHub MCP server:
   - Use the following command to create issues:
     <mcp_command>create_github_issue(title, description, labels, parent_issue_id=None)</mcp_command>
   - For main phase issues, use parent_issue_id=None
   - For sub-issues, use the ID of the parent issue as parent_issue_id

Now, create a plan to break down the issue and generate GitHub issues using the MCP server. Present your plan in the following format:

<plan>
[Provide a brief overview of your approach to breaking down the issue]

Phases and Tasks:

1. [Phase 1 Title]

   - Task 1.1: [Title] (Complexity: [Low/Medium/High])
   - Task 1.2: [Title] (Complexity: [Low/Medium/High])
     ...

2. [Phase 2 Title]
   - Task 2.1: [Title] (Complexity: [Low/Medium/High])
   - Task 2.2: [Title] (Complexity: [Low/Medium/High])
     ...

[Continue for all phases]

MCP Commands:
[List the MCP commands to create all GitHub issues, including main phase issues and sub-issues]
</plan>

Ensure that your plan is comprehensive, well-structured, and addresses all aspects of the original issue. The goal is to create a clear roadmap for tackling the large-scale problem in manageable steps.
