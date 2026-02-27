import re
import codecs

path = r'src\data\mockAgents.ts'
with codecs.open(path, 'r', 'utf-8') as f:
    text = f.read()

strings_to_fix = [
  'Code Review', 'Deep Research', 'System Audit', 'issue_alpha_directive',
  'Deploy to Prod', 'Neural Handoff', 'Risk Analysis', 'Emergency Shutdown',
  'Brainstorming', 'Content Generation', 'Market Research', 'Schedule Meeting',
  'Task Prioritization', 'Resource Allocation', 'Performance Tracking', 'Sprint Planning',
  'Team Retrospective', 'Debug', 'Git Push', 'System Architecture Review',
  'Code Generation', 'Unit Testing', 'CI/CD Pipeline', 'Refactoring', 'Documentation',
  'Incident Response', 'Copywriting', 'SEO Analysis', 'Campaign Launch', 'Market Trend Analysis',
  'Lead Qualification', 'Update CRM', 'Quarterly Forecasting', 'Client Onboarding',
  'User Interview', 'Write Spec', 'Feature Roadmap', 'Check Server Health', 'View Logs',
  'Pipeline Optimization', 'Database Migration', 'API Test', 'Database Query',
  'Refactor Microservice', 'API Documentation', 'Generate Image', 'UI Audit',
  'Design System Update', 'Usability Testing', 'Ticket Triage', 'Knowledge Base Search',
  'Customer Incident Review', 'Support Training', 'Scan Vulnerabilities', 'Security Audit',
  'Scale Cluster', 'Analyze Feedback', 'Product Sync', 'Figma Sync', 'Prototype Review',
  'Data Analysis', 'Competitive Audit', 'Edit Content', 'Newsletter Draft',
  'Post Update', 'Monitor Mentions', 'Social Strategy', 'Engagement Report',
  'Keyword Research', 'Search Optimization', 'Cold Call', 'Pipeline Management',
  'Employee Onboarding', 'Conflict Resolution', 'Policy Review', 'Team Building',
  'Analyze Budget', 'Expense Tracking', 'Finance Review', 'Burn Rate Forecast',
  'Contract Review', 'Legal Filing', 'Risk Assessment', 'Customer Chat',
  'Feedback Collection', 'Code Audit', 'Compliance Check', 'Quality Gate Review'
]

for s in strings_to_fix:
    snake = s.lower().replace(' ', '_').replace('-', '_')
    text = text.replace("'" + s + "'", "'" + snake + "'")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(text)
print('mockAgents.ts normalized to snake_case!')
