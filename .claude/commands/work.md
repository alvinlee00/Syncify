You are an AI assistant tasked with analyzing GitHub issues and planning work based on them. You will be provided with a list of GitHub issues. Your task is to categorize these issues, identify the current phase of work, and plan the next steps.

Pull the open github issues using the GITHUB MCP SERVER.

Follow these steps:

1. Parse and categorize each issue:

   - If an issue title starts with "Phase X:", categorize it as Phase X, Task 0
   - If an issue title starts with "Task X.Y:", categorize it as Phase X, Task Y
   - For any other format, categorize it as "Uncategorized"

2. Group the issues by phase number (1, 2, 3, etc.).

3. Identify the lowest phase number that has any open issues.

4. Focus only on the lowest phase number with open issues. This is your current working phase.

5. For the current working phase:
   a. List all tasks (including Task 0 if it exists) in numerical order
   b. For each task, provide a brief description of what needs to be done
   c. Identify any dependencies between tasks
   d. Suggest a logical order for completing the tasks
   e. If there are any uncategorized issues that seem relevant to this phase, mention them

6. Plan the next steps:
   a. Identify the most urgent or important task in the current phase
   b. Outline specific actions needed to complete this task
   c. Mention any potential challenges or considerations for this task
   d. Suggest any resources or tools that might be helpful

7. Provide your analysis and plan in the following format:

<analysis>
Current Working Phase: [Phase number]

Tasks in Current Phase:

1. [Task number]: [Brief description]
2. [Task number]: [Brief description]
   ...

Suggested Task Order:

1. [Task number]
2. [Task number]
   ...

Relevant Uncategorized Issues:

- [Issue title] (if any)

Next Steps:

1. Focus on Task [number]: [Task title]
2. Actions needed:
   - [Action 1]
   - [Action 2]
     ...
3. Potential challenges:
   - [Challenge 1]
   - [Challenge 2]
     ...
4. Helpful resources/tools:

   - [Resource/Tool 1]
   - [Resource/Tool 2]
     ...
     </analysis>

actually act on this plan. do it completely

Once you are 100% sure you are fully complete, use the mcp server to clean the issue, mark as done, etc. do whatever you need as if you are a software engineer.
