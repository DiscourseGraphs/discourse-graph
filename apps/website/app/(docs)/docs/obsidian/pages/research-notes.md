---
title: "Research Notes with Discourse Graphs"
date: "2025-01-01"
author: ""
published: true
---

## Overview

Discourse Graphs transforms your research notes into a structured knowledge network, helping you:
- Capture and connect research insights
- Track the development of ideas
- Link evidence to hypotheses
- Maintain research context

## Setting Up for Research

### 1. Node Types for Research

Configure these essential node types:

- **Observation**: Raw research observations
- **Hypothesis**: Proposed explanations
- **Evidence**: Supporting data or findings
- **Method**: Research procedures
- **Question**: Research questions
- **Insight**: Synthesized understanding

### 2. Research Relationships

Define relationships such as:

- Evidence → supports/challenges → Hypothesis
- Question → leads to → Method
- Observation → generates → Hypothesis
- Method → produces → Evidence

## Research Workflow

### 1. Capturing Observations

```markdown
Title: OBS - Unexpected Pattern in Data
Type: Observation

## Description
[Detailed observation]

## Context
- Date: {{date}}
- Location/Setting:
- Conditions:

## Initial Thoughts
- [First interpretations]
- [Potential implications]
```

### 2. Forming Hypotheses

```markdown
Title: HYP - Mechanism for Pattern
Type: Hypothesis

## Statement
[Clear hypothesis statement]

## Supporting Evidence
- [[OBS - Unexpected Pattern]]
- [Other evidence]

## Testing Plan
- [ ] Experiment 1
- [ ] Experiment 2
```

### 3. Tracking Methods

```markdown
Title: MTD - Validation Procedure
Type: Method

## Protocol
1. Step 1
2. Step 2

## Controls
- [List controls]

## Variables
- Independent:
- Dependent:
- Controlled:
```

## Best Practices

### Organization
1. **Consistent Structure**
   - Use templates for each node type
   - Maintain clear naming conventions
   - Link related notes systematically

2. **Version Control**
   - Track changes to hypotheses
   - Document method iterations
   - Update evidence relationships

3. **Context Preservation**
   - Link to source materials
   - Record environmental conditions
   - Note temporal relationships

## Example Research Structure

```markdown
Research Project
├── Questions
│   ├── Primary Question
│   └── Sub-questions
├── Observations
│   ├── Raw Data
│   └── Initial Patterns
├── Hypotheses
│   ├── Working Hypotheses
│   └── Rejected Hypotheses
├── Methods
│   ├── Protocols
│   └── Procedures
└── Evidence
    ├── Direct Evidence
    └── Indirect Evidence
```

## Advanced Features

### 1. Evidence Tracking
- Rate evidence strength
- Track replication status
- Note confidence levels

### 2. Hypothesis Evolution
- Version hypotheses
- Track refinements
- Document pivots

### 3. Method Development
- Iterate procedures
- Document optimizations
- Track failures

## Integration Tips

1. **With Lab Notebooks**
   - Link to experimental data
   - Connect to protocols
   - Reference equipment settings

2. **With Literature**
   - Connect to relevant papers
   - Compare with published findings
   - Track related work

3. **With Collaboration**
   - Share hypothesis networks
   - Coordinate methods
   - Combine evidence

## Next Steps

- [Explore lab notebooks](./lab-notebooks)
- [Set up templates](./using-templates)
- [Start literature review](./literature-review) 