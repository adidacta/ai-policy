---
id: data-handling
title: Data Handling for AI Systems
status: active
version: 1.1.0
updated: 2026-09-22
owner: adi@adidacta.com
domain: security
tags: [data, privacy, security]
depends_on: [ai-governance-charter]
relates_to: [acceptable-use, model-procurement]
supersedes: []
references:
  - GDPR Art. 5, Art. 22
  - ISO/IEC 27001:2022
---

## Purpose

Set the rules for what data may reach an AI system, where it may be processed,
and what happens to it afterwards.

## Scope

All data flowing into or out of an AI system: prompts, retrieved context,
fine-tuning corpora, evaluation sets, and logged outputs.

## Policy

1. Data is classified before it reaches a model. Unclassified data is treated as
   confidential.
2. Personal data is minimised at the prompt boundary. If a task can be done with
   a pseudonym, it is done with a pseudonym.
3. Vendor terms must state that submitted data is not used for training. Absent
   that guarantee in writing, the tool handles public data only.
4. Prompt and output logs are retained for 90 days for debugging and incident
   review, then deleted. Logs inherit the classification of their contents.
5. Retrieval systems respect the permissions of the requesting user. A model may
   never surface a document the user could not open directly.

## Exceptions

Granted by the data owner jointly with the policy owner, and recorded in the
processing register.

## Review

Reviewed annually, and on any change to a vendor's data processing terms.
